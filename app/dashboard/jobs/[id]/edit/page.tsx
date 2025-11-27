'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { jobsApi, riskApi } from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'
import Image from 'next/image'
import { ImageModal } from '@/components/report/ImageModal'

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
      })
      
      // Reload documents
      await loadDocuments()
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err: any) {
      console.error('Failed to upload document:', err)
      setError(err.message || 'Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const photos = documents.filter((doc) => doc.type === 'photo' && doc.url)

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
      router.push(`/dashboard/jobs/${jobId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to update job')
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
        <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent mx-auto mb-4" />
            <p className="text-[#A1A1A1]">Loading job details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        {/* Header */}
        <header className="border-b border-white/5 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RiskMateLogo size="sm" showText={true} />
            </div>
            <button
              onClick={() => router.push(`/dashboard/jobs/${jobId}`)}
              className="text-sm text-[#A1A1A1] hover:text-white transition-colors"
            >
              ← Back to Job
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-4xl font-bold mb-2 font-display">Edit Job</h1>
            <p className="text-[#A1A1A1] mb-8">
              Update job details and risk factors
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Job Info */}
              <div className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                <h2 className="text-2xl font-semibold mb-6">Job Information</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.client_name}
                      onChange={(e) =>
                        setFormData({ ...formData, client_name: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="Downtown Office Complex"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Location *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      placeholder="123 Main St, Suite 400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Client Type *
                    </label>
                    <select
                      required
                      value={formData.client_type}
                      onChange={(e) =>
                        setFormData({ ...formData, client_type: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="industrial">Industrial</option>
                      <option value="government">Government</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Job Type *
                    </label>
                    <select
                      required
                      value={formData.job_type}
                      onChange={(e) =>
                        setFormData({ ...formData, job_type: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    >
                      <option value="repair">Repair</option>
                      <option value="installation">Installation</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inspection">Inspection</option>
                      <option value="remodel">Remodel</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Insurance Status
                    </label>
                    <select
                      value={formData.insurance_status}
                      onChange={(e) =>
                        setFormData({ ...formData, insurance_status: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="missing">Missing</option>
                      <option value="not_required">Not Required</option>
                    </select>
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
                      className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
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
                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316]"
                      />
                      <span className="text-sm">This job involves subcontractors</span>
                    </label>
                  </div>

                  {formData.has_subcontractors && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Number of Subcontractors
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.subcontractor_count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            subcontractor_count: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Photos Section */}
              <div className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8">
                <h2 className="text-2xl font-semibold mb-4">Photos & Evidence</h2>
                <p className="text-sm text-[#A1A1A1] mb-6">
                  Upload photos to document job conditions, hazards, and completed work.
                </p>

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

                {/* Photo Gallery */}
                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="bg-black/40 border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-white/20 transition-colors"
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
                              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
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
                    ))}
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
              </div>

              {/* Image Modal */}
              <ImageModal
                isOpen={selectedImage !== null}
                imageUrl={selectedImage?.url || null}
                imageAlt={selectedImage?.alt}
                onClose={() => setSelectedImage(null)}
              />

              {/* Risk Factors - Safety Checklist */}
              <div className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8">
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
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/jobs/${jobId}`)}
                  className="px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-semibold transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Changes & Recalculate Risk'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

