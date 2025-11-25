'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

import ProtectedRoute from '@/components/ProtectedRoute'
import RiskMateLogo from '@/components/RiskMateLogo'
import { ReportView } from '@/components/report/ReportView'
import { reportsApi } from '@/lib/api'
import { useFullJob } from '@/hooks/useFullJob'

const base64ToBlob = (base64: string, contentType = 'application/pdf') => {
  if (typeof window === 'undefined') return null
  const byteCharacters = atob(base64)
  const byteArrays = []
  const sliceSize = 1024

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)
    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  return new Blob(byteArrays, { type: contentType })
}

export default function JobReportPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = Array.isArray(params.id) ? params.id[0] : (params.id as string | undefined)

  const { data, isLoading, error } = useFullJob(jobId)
  const [exporting, setExporting] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (downloadUrl && downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }, [downloadUrl])

  // Helper function to generate filename from job data
  const generateFileName = () => {
    if (!data?.job) {
      return `riskmate-report-${jobId?.substring(0, 8) || 'report'}.pdf`
    }
    
    const clientName = data.job.client_name || 'client'
    const jobType = data.job.job_type || 'job'
    
    // Sanitize filename: remove special characters, replace spaces with hyphens
    const sanitize = (str: string) => {
      return str
        .replace(/[^a-z0-9]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .substring(0, 50) // Limit length
    }
    
    const sanitizedClient = sanitize(clientName)
    const sanitizedJobType = sanitize(jobType)
    
    return `${sanitizedClient}-${sanitizedJobType}-report.pdf`
  }

  const handleExport = async () => {
    if (!jobId) return
    setExporting(true)
    try {
      const response = await reportsApi.generate(jobId)
      console.log('PDF generation response:', response)
      const { pdf_url, pdf_base64 } = response.data ?? {}

      console.log('PDF URL:', pdf_url)
      console.log('PDF Base64 present:', !!pdf_base64)

      const fileName = generateFileName()

      // Prefer base64 for direct download
      if (pdf_base64) {
        console.log('Creating blob from base64, length:', pdf_base64.length)
        const blob = base64ToBlob(pdf_base64, 'application/pdf')
        if (blob) {
          console.log('Blob created, size:', blob.size)
          
          // Create blob URL
          const objectUrl = URL.createObjectURL(blob)
          if (downloadUrl && downloadUrl.startsWith('blob:')) {
            URL.revokeObjectURL(downloadUrl)
          }
          setDownloadUrl(objectUrl)
          
          // Create download link - make it briefly visible for better browser compatibility
          const link = document.createElement('a')
          link.href = objectUrl
          link.download = fileName
          link.type = 'application/pdf'
          link.style.position = 'fixed'
          link.style.top = '-1000px'
          link.style.left = '-1000px'
          link.style.opacity = '0'
          link.style.pointerEvents = 'none'
          link.setAttribute('download', fileName)
          
          // Add to DOM
          document.body.appendChild(link)
          
          // Use a combination of methods to trigger download
          const triggerDownload = () => {
            try {
              // Create a synthetic click event
              const clickEvent = document.createEvent('MouseEvents')
              clickEvent.initEvent('click', true, true)
              link.dispatchEvent(clickEvent)
              
              // Also try direct click
              if (typeof link.click === 'function') {
                link.click()
              }
            } catch (e) {
              console.warn('Download trigger failed:', e)
              // Fallback: show the link to user
              link.style.position = 'fixed'
              link.style.top = '50%'
              link.style.left = '50%'
              link.style.transform = 'translate(-50%, -50%)'
              link.style.zIndex = '9999'
              link.style.padding = '10px 20px'
              link.style.backgroundColor = '#F97316'
              link.style.color = 'white'
              link.style.borderRadius = '8px'
              link.style.textDecoration = 'none'
              link.textContent = 'Click to Download PDF'
              link.style.opacity = '1'
              link.style.pointerEvents = 'auto'
              
              // Auto-remove after 5 seconds
              setTimeout(() => {
                try {
                  document.body.removeChild(link)
                  URL.revokeObjectURL(objectUrl)
                } catch (e) {
                  // Already removed
                }
              }, 5000)
            }
          }
          
          // Trigger download immediately
          setTimeout(() => {
            triggerDownload()
            
            // Clean up after delay
            setTimeout(() => {
              try {
                if (link.parentNode) {
                  document.body.removeChild(link)
                }
              } catch (e) {
                // Already removed
              }
              // Don't revoke immediately - let download complete
              setTimeout(() => {
                URL.revokeObjectURL(objectUrl)
              }, 3000)
            }, 500)
          }, 100)
          
          return
        } else {
          console.error('Failed to create blob from base64')
          alert('Failed to create PDF file. Please try again.')
        }
      } else if (pdf_url) {
        // Fallback to URL download
        if (downloadUrl && downloadUrl.startsWith('blob:')) {
          URL.revokeObjectURL(downloadUrl)
        }
        setDownloadUrl(pdf_url)
        
        // Try to download from URL
        const fileName = generateFileName()
        const link = document.createElement('a')
        link.href = pdf_url
        link.download = fileName
        link.target = '_blank'
        link.style.display = 'none'
        document.body.appendChild(link)
        
        requestAnimationFrame(() => {
          link.click()
          setTimeout(() => {
            document.body.removeChild(link)
          }, 100)
        })
        return
      } else {
        console.error('No PDF URL or base64 data available')
        alert('Report generated but no PDF data available. Please check the console for details.')
      }
    } catch (err: any) {
      console.error('Failed to export PDF', err)
      const errorMessage = err?.message || err?.detail || 'Failed to export PDF'
      console.error('Error details:', err)
      alert(errorMessage)
    } finally {
      setExporting(false)
    }
  }


  if (!jobId) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg text-white/70">Job not found.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mx-auto" />
            <p className="text-white/60">Building job report…</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !data) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-lg text-white/70">Unable to load this report.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-lg bg-[#F97316] px-6 py-3 text-black font-semibold hover:bg-[#FB923C]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-[#F97316]/15 blur-[200px]" />
          <div className="absolute left-[-20%] top-1/3 h-[420px] w-[420px] rounded-full bg-[#38BDF8]/15 blur-[180px]" />
          <div className="absolute right-[-10%] bottom-[-15%] h-[520px] w-[520px] rounded-full bg-[#A855F7]/15 blur-[220px]" />
        </div>

        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/40 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <RiskMateLogo size="md" showText />
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/dashboard/jobs/${jobId}`)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
              >
                ← Back to Job
              </button>
              <button
                onClick={() => router.push(`/dashboard/jobs/${jobId}/edit`)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/30 hover:bg-white/5"
              >
                Edit Job
              </button>
            </div>
          </div>
        </header>

        <main className="relative mx-auto max-w-7xl px-6 py-14 space-y-10">
          <ReportView
            data={data}
            readOnly={false}
            onExport={handleExport}
            exportInProgress={exporting}
          />
        </main>
      </div>
    </ProtectedRoute>
  )
}


