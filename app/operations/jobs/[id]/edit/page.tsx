'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { jobsApi, riskApi } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskmateLogo from '@/components/RiskmateLogo'
import Image from 'next/image'
import { ImageModal } from '@/components/report/ImageModal'
import { typography, spacing } from '@/lib/styles/design-system'
import { AppBackground, AppShell, PageSection, GlassCard, Button, Input, Select, PageHeader } from '@/components/shared'
import { Toast } from '@/components/dashboard/Toast'
import { getEffectivePhotoCategory, type PhotoCategory } from '@/lib/utils/photoCategory'

function getDefaultCategory(jobStatus: string): PhotoCategory {
  if (jobStatus === 'draft') return 'before'
  if (jobStatus === 'completed' || jobStatus === 'archived') return 'after'
  return 'during'
}

interface RiskFactor {
  id: string
  code: string
  name: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
}

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [jobEndDate, setJobEndDate] = useState<string | null>(null)
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([])
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([])
  const [formData, setFormData] = useState({
    client_name: '',
    client_type: 'residential',
    job_type: 'repair',
    location: '',
    description: '',
    start_date: '',
    has_subcontractors: false,
    subcontractor_count: 0,
    insurance_status: 'pending',
  })
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [jobStatus, setJobStatus] = useState<string>('draft')
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>('during')
  const [photoFilter, setPhotoFilter] = useState<'all' | PhotoCategory>('all')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (jobId) {
      loadJob()
      loadRiskFactors()
      loadDocuments()
    }
  }, [jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadJob = async () => {
    try {
      const response = await jobsApi.get(jobId)
      const job = response.data

      setJobStatus(job.status ?? 'draft')
      setUploadCategory(getDefaultCategory(job.status ?? 'draft'))
      
      setFormData({
        client_name: job.client_name || '',
        client_type: job.client_type || 'residential',
        job_type: job.job_type || 'repair',
        location: job.location || '',
        description: job.description || '',
        start_date: job.start_date ? new Date(job.start_date).toISOString().split('T')[0] : '',
        has_subcontractors: job.has_subcontractors || false,
        subcontractor_count: job.subcontractor_count || 0,
        insurance_status: job.insurance_status || 'pending',
      })
      setJobEndDate(job.end_date ?? null)

      // Load selected risk factors from risk_score_detail
      if (job.risk_score_detail?.factors) {
        setSelectedRiskFactors(job.risk_score_detail.factors.map((f: any) => f.code))
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load job:', err)
      setError('Failed to load job details')
      setLoading(false)
    }
  }

  const loadRiskFactors = async () => {
    try {
      const response = await riskApi.getFactors()
      setRiskFactors(response.data)
    } catch (err: any) {
      console.error('Failed to load risk factors:', err)
    }
  }

  const loadDocuments = async () => {
    try {
      const response = await jobsApi.getDocuments(jobId)
      setDocuments(response.data || [])
    } catch (err: any) {
      console.error('Failed to load documents:', err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      await jobsApi.uploadDocument(jobId, file, {
        name: file.name,
        type: 'photo',
        description: `Uploaded on ${new Date().toLocaleDateString()}`,
        category: uploadCategory,
      })
      
      // Reload documents
      await loadDocuments()
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      console.error('Failed to upload document:', err)
      setError('Couldn\'t upload that photo. Make sure it\'s an image under 10MB and try again.')
    } finally {
      setUploading(false)
    }
  }

  const jobStartDate = formData.start_date || null
  const photos = documents.filter((doc: any) => doc.type === 'photo' && doc.url) as Array<{ id: string; name: string; description?: string; url: string; created_at?: string; category?: PhotoCategory }>
  const effectiveCat = (p: { category?: PhotoCategory | null; created_at?: string | null }) => getEffectivePhotoCategory(p, jobStartDate, jobEndDate)
  const filteredPhotos = photoFilter === 'all' ? photos : photos.filter((p) => effectiveCat(p) === photoFilter)
  const beforeCount = photos.filter((p) => effectiveCat(p) === 'before').length
  const duringCount = photos.filter((p) => effectiveCat(p) === 'during').length
  const afterCount = photos.filter((p) => effectiveCat(p) === 'after').length
  const categoryBadgeClass = (cat: PhotoCategory) => {
    if (cat === 'before') return 'bg-[#e3f2fd] text-[#1976d2]'
    if (cat === 'after') return 'bg-[#e8f5e9] text-[#388e3c]'
    return 'bg-[#fff3e0] text-[#f57c00]'
  }
  const handleCategoryChange = async (photoId: string, newCategory: PhotoCategory) => {
    const previousDocuments = [...documents]
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === photoId ? { ...doc, category: newCategory } : doc))
    )
    setCategoryDropdownOpen(null)
    try {
      await jobsApi.updateDocumentCategory(jobId, photoId, newCategory)
      setToast({ message: 'Category updated', type: 'success' })
    } catch {
      setDocuments(previousDocuments)
      setToast({ message: 'Failed to update category', type: 'error' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      await jobsApi.update(jobId, {
        ...formData,
        risk_factor_codes: selectedRiskFactors,
        start_date: formData.start_date || undefined,
      })

      // Redirect to job detail page
      router.push(`/operations/jobs/${jobId}`)
    } catch (err: any) {
      setError('Couldn\'t save those changes. Your edits are still here — try again.')
      setSaving(false)
    }
  }

  const toggleRiskFactor = (code: string) => {
    setSelectedRiskFactors((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10'
      case 'high':
        return 'border-orange-500/50 bg-orange-500/10'
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/10'
      default:
        return 'border-blue-500/50 bg-blue-500/10'
    }
  }

  const groupedFactors = riskFactors.reduce((acc, factor) => {
    if (!acc[factor.category]) {
      acc[factor.category] = []
    }
    acc[factor.category].push(factor)
    return acc
  }, {} as Record<string, RiskFactor[]>)

  if (loading) {
    return (
      <ProtectedRoute>
        <AppBackground>
          <AppShell>
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent mx-auto mb-4" />
                <p className="text-[#A1A1A1]">Loading job details...</p>
              </div>
            </div>
          </AppShell>
        </AppBackground>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <AppShell>
          <PageSection>
            <PageHeader
              title="Edit Job"
              subtitle="Update job details and risk factors"
            />
          </PageSection>

          {error && (
            <PageSection>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error}
              </div>
            </PageSection>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Job Info */}
            <PageSection>
              <GlassCard className="p-8">
                <h2 className={`${typography.h2} ${spacing.relaxed}`}>Job Information</h2>
                <div className={`grid md:grid-cols-2 ${spacing.gap.relaxed}`}>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Name *
                    </label>
                    <Input
                      type="text"
                      required
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                      placeholder="Downtown Office Complex"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Location *
                    </label>
                    <Input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      placeholder="123 Main St, Suite 400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Type *
                    </label>
                    <Select
                      required
                      value={formData.client_type}
                      onChange={(e) =>
                        setFormData({ ...formData, client_type: e.target.value })
                      }
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="government">Government</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Job Type *
                    </label>
                    <Select
                      required
                      value={formData.job_type}
                      onChange={(e) =>
                        setFormData({ ...formData, job_type: e.target.value })
                      }
                    >
                      <option value="repair">Repair</option>
                      <option value="installation">Installation</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inspection">Inspection</option>
                      <option value="remodel">Remodel</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Insurance Status
                    </label>
                    <Select
                      value={formData.insurance_status}
                      onChange={(e) =>
                        setFormData({ ...formData, insurance_status: e.target.value })
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="missing">Missing</option>
                      <option value="not_required">Not Required</option>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent resize-none"
                      placeholder="Additional details about the job..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.has_subcontractors}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            has_subcontractors: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded border-white/20 bg-[#121212]/60 text-[#F97316] focus:ring-[#F97316]"
                      />
                      <span className="text-sm">This job involves subcontractors</span>
                    </label>
                  </div>

                  {formData.has_subcontractors && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Number of Subcontractors
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.subcontractor_count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            subcontractor_count: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </GlassCard>
            </PageSection>

            {/* Photos Section */}
            <PageSection>
              <GlassCard className="p-8">
                <h2 className="text-2xl font-semibold mb-4">Photos & Evidence</h2>
                <p className="text-sm text-[#A1A1A1] mb-4">
                  Upload photos to document job conditions, hazards, and completed work.
                </p>

                {/* Photo category selector for upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white/80 mb-2">Photo category for next upload</label>
                  <div className="flex gap-2">
                    {(['before', 'during', 'after'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setUploadCategory(cat)}
                        className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          uploadCategory === cat
                            ? 'bg-[#2563eb] border-[#2563eb] text-white'
                            : 'bg-white/5 border-white/20 text-white/80 hover:bg-white/10'
                        }`}
                      >
                        {cat === 'before' && '📸 Before'}
                        {cat === 'during' && '🔧 During'}
                        {cat === 'after' && '✅ After'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/50 mt-1.5">Select when this photo was taken relative to the job.</p>
                </div>

                {/* Upload Button */}
                <div className="mb-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploading}
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/20 text-white cursor-pointer transition-colors ${
                      uploading
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-white/5 hover:border-white/30'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        <span>Add Photo</span>
                      </>
                    )}
                  </label>
                </div>

                {/* Filter tabs */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs text-white/50 mr-1">Filter:</span>
                    {(['all', 'before', 'during', 'after'] as const).map((tab) => {
                      const count = tab === 'all' ? photos.length : tab === 'before' ? beforeCount : tab === 'during' ? duringCount : afterCount
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setPhotoFilter(tab)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            photoFilter === tab
                              ? 'bg-[#2563eb] text-white'
                              : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Photo Gallery */}
                {filteredPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredPhotos.map((photo) => {
                      const cat = effectiveCat(photo) as PhotoCategory
                      return (
                        <div
                          key={photo.id}
                          className="bg-[#121212]/60 border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-colors"
                        >
                          <div className="relative">
                            <div
                              className="cursor-pointer"
                              onClick={() => {
                                if (photo.url) {
                                  setSelectedImage({
                                    url: photo.url,
                                    alt: photo.description || photo.name,
                                  })
                                }
                              }}
                            >
                              {photo.url ? (
                                <div className="relative w-full h-48 overflow-hidden group">
                                  <Image
                                    src={photo.url}
                                    alt={photo.description || photo.name}
                                    width={400}
                                    height={192}
                                    className="w-full h-48 object-cover"
                                    unoptimized
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <svg
                                        className="w-8 h-8 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full h-48 bg-white/5 flex items-center justify-center text-white/40">
                                  Image unavailable
                                </div>
                              )}
                            </div>
                            <div className="absolute top-2 right-2 z-10">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCategoryDropdownOpen(categoryDropdownOpen === photo.id ? null : photo.id)
                                  }}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${categoryBadgeClass(cat)} hover:opacity-90`}
                                >
                                  {cat}
                                </button>
                                {categoryDropdownOpen === photo.id && (
                                  <>
                                    <div className="absolute top-full right-0 mt-1 py-1 min-w-[100px] rounded-lg bg-[#1a1a1a] border border-white/20 shadow-xl z-20">
                                      {(['before', 'during', 'after'] as const).map((newCat) => (
                                        <button
                                          key={newCat}
                                          type="button"
                                          onClick={() => handleCategoryChange(photo.id, newCat)}
                                          className="block w-full text-left px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
                                        >
                                          {newCat.charAt(0).toUpperCase() + newCat.slice(1)}
                                        </button>
                                      ))}
                                    </div>
                                    <div
                                      className="fixed inset-0 z-10"
                                      aria-hidden
                                      onClick={() => setCategoryDropdownOpen(null)}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            <div className="text-sm font-semibold text-white truncate">
                              {photo.description || photo.name}
                            </div>
                            {photo.created_at && (
                              <div className="text-xs text-white/60 mt-1">
                                {new Date(photo.created_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : photos.length > 0 ? (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
                    <p className="text-white/60 text-sm">No photos in this category</p>
                  </div>
                ) : (
                  <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
                    <svg
                      className="w-12 h-12 text-white/20 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-white/60 text-sm">No photos uploaded yet</p>
                    <p className="text-white/40 text-xs mt-2">Click &quot;Add Photo&quot; to get started</p>
                  </div>
                )}
              </GlassCard>
            </PageSection>

            {/* Image Modal */}
            <ImageModal
              isOpen={selectedImage !== null}
              imageUrl={selectedImage?.url || null}
              imageAlt={selectedImage?.alt}
              onClose={() => setSelectedImage(null)}
            />

            {/* Risk Factors - Safety Checklist */}
            <PageSection>
              <GlassCard className="p-8">
                <h2 className="text-2xl font-semibold mb-4">Hazard Checklist</h2>
                <p className="text-sm text-[#A1A1A1] mb-6">
                  Update your safety assessment by selecting all hazards that apply to this job. Risk score and required controls will be recalculated automatically.
                </p>

                {Object.entries(groupedFactors).map(([category, factors]) => (
                  <div key={category} className="mb-6">
                    <h3 className="text-sm font-semibold text-[#A1A1A1] uppercase mb-3">
                      {category}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {factors.map((factor) => {
                        const isSelected = selectedRiskFactors.includes(factor.code)
                        return (
                          <label
                            key={factor.id}
                            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? getSeverityColor(factor.severity)
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRiskFactor(factor.code)}
                              className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316]"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{factor.name}</div>
                              <div className="text-xs text-[#A1A1A1] mt-1">
                                {factor.description}
                              </div>
                              <div className="text-xs mt-2">
                                <span
                                  className={`px-2 py-0.5 rounded ${
                                    factor.severity === 'critical'
                                      ? 'bg-red-500/20 text-red-400'
                                      : factor.severity === 'high'
                                      ? 'bg-orange-500/20 text-orange-400'
                                      : factor.severity === 'medium'
                                      ? 'bg-yellow-500/20 text-yellow-400'
                                      : 'bg-blue-500/20 text-blue-400'
                                  }`}
                                >
                                  {factor.severity}
                                </span>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {selectedRiskFactors.length > 0 && (
                  <div className="mt-6 p-4 bg-[#F97316]/10 border border-[#F97316]/20 rounded-lg">
                    <p className="text-sm text-[#F97316]">
                      {selectedRiskFactors.length} risk factor{selectedRiskFactors.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </GlassCard>
            </PageSection>

            {/* Submit */}
            <PageSection>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push(`/operations/jobs/${jobId}`)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Save Changes & Recalculate Risk'}
                </Button>
              </div>
            </PageSection>
          </form>

          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              isOpen={true}
              onClose={() => setToast(null)}
            />
          )}
        </AppShell>
      </AppBackground>
    </ProtectedRoute>
  )
}

