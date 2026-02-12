/**
 * Permit Pack Generator
 * 
 * Creates a comprehensive ZIP bundle containing all job-related documents,
 * photos, reports, and compliance materials for inspectors, clients, or supervisors.
 * 
 * This is a Business plan feature.
 */

import archiver from 'archiver'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobReport } from './jobReport'
import { generateRiskSnapshotPDF } from './pdf'
import { getEffectivePhotoCategory } from './photoCategory'

export interface PermitPackOptions {
  jobId: string
  organizationId: string
  userId: string
}

export interface PermitPackResult {
  filePath: string
  downloadUrl: string
  size: number
}

/**
 * Generate a comprehensive permit pack ZIP for a job
 */
export async function generatePermitPack(
  options: PermitPackOptions
): Promise<PermitPackResult> {
  const { jobId, organizationId, userId } = options
  const supabase = await createSupabaseServerClient()

  // Build job report data
  const reportData = await buildJobReport(organizationId, jobId)
  const job = reportData.job

  if (!job) {
    throw new Error('Job not found')
  }

  // Collect all files to add
  const filesToAdd: Array<{
    path: string
    content: Buffer | string
  }> = []

  // 1. Generate Risk Snapshot PDF
  const photoDocuments = (reportData.documents ?? []).filter(
    (doc: any) => doc.type === 'photo' && doc.file_path
  )

  const photos = await Promise.all(
    photoDocuments.map(async (document: any) => {
      try {
        const { data: fileData } = await supabase.storage
          .from('documents')
          .download(document.file_path)

        if (!fileData) return null

        const arrayBuffer = await fileData.arrayBuffer()
        return {
          name: document.name,
          description: document.description,
          created_at: document.created_at,
          buffer: Buffer.from(arrayBuffer),
          category: document.category ?? undefined,
        }
      } catch (error) {
        console.warn('Failed to include photo in PDF', error)
        return null
      }
    })
  )

  const validPhotos = photos.filter((p): p is NonNullable<typeof p> => p !== null)

  const pdfBuffer = await generateRiskSnapshotPDF(
    job,
    reportData.risk_score,
    reportData.mitigations || [],
    reportData.organization ?? {
      id: organizationId,
      name: job?.client_name ?? 'Organization',
    },
    validPhotos,
    reportData.audit || [],
    undefined, // signatures - not used by permit pack
    undefined  // reportRunId - not used by permit pack
  )

  filesToAdd.push({
    path: 'Riskmate_Report.pdf',
    content: pdfBuffer,
  })

  // 2. Generate Hazard Checklist (CSV)
  const hazardChecklist = generateHazardChecklistCSV(reportData)
  filesToAdd.push({
    path: 'hazard-checklist.csv',
    content: hazardChecklist,
  })

  // 3. Generate Controls/Mitigations Summary (CSV)
  const controlsSummary = generateControlsSummaryCSV(reportData)
  filesToAdd.push({
    path: 'controls-summary.csv',
    content: controlsSummary,
  })

  // 4. Fetch and organize job photos by category
  const photosByCategory: Record<string, Array<{ name: string; buffer: Buffer }>> = {
    before: [],
    during: [],
    after: [],
  }

  for (const doc of reportData.documents || []) {
    if (doc.type === 'photo' && doc.file_path) {
      try {
        const category = getEffectivePhotoCategory(
          { category: doc.category, created_at: doc.created_at },
          job.start_date,
          job.end_date
        )

        const { data: fileData } = await supabase.storage
          .from('documents')
          .download(doc.file_path)

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          const fileName = doc.name || `photo_${doc.id}.jpg`
          photosByCategory[category].push({
            name: fileName,
            buffer: Buffer.from(arrayBuffer),
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch photo ${doc.id}:`, error)
      }
    }
  }

  // Add photos to ZIP in organized folders
  for (const [category, photoList] of Object.entries(photosByCategory)) {
    if (photoList.length > 0) {
      for (const photo of photoList) {
        filesToAdd.push({
          path: `photos/${category}/${photo.name}`,
          content: photo.buffer,
        })
      }
    }
  }

  // 5. Fetch job documents (permits, blueprints, manuals, etc.)
  const jobDocs = (reportData.documents || []).filter(
    (doc: any) => doc.type !== 'photo'
  )

  for (const doc of jobDocs) {
    if (doc.file_path) {
      try {
        const { data: fileData } = await supabase.storage
          .from('documents')
          .download(doc.file_path)

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer()
          const fileName = doc.name || `document_${doc.id}.pdf`
          filesToAdd.push({
            path: `documents/${fileName}`,
            content: Buffer.from(arrayBuffer),
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch document ${doc.id}:`, error)
      }
    }
  }

  // 6. Generate Signatures & Compliance Sheet (CSV)
  const signaturesSheet = generateSignaturesSheetCSV(reportData)
  filesToAdd.push({
    path: 'compliance/signatures.csv',
    content: signaturesSheet,
  })

  // 7. Generate Timeline Log (JSON)
  const timelineLog = JSON.stringify(reportData.audit || [], null, 2)
  filesToAdd.push({
    path: 'job-details.json',
    content: timelineLog,
  })

  // 8. Generate metadata JSON
  const metadata = {
    job_id: jobId,
    job_name: job.client_name || 'Untitled Job',
    job_type: job.job_type,
    location: job.location,
    start_date: job.start_date,
    end_date: job.end_date,
    risk_score: reportData.risk_score?.overall_score || null,
    risk_level: reportData.risk_score?.risk_level || null,
    generated_at: new Date().toISOString(),
    generated_by: userId,
    organization_id: organizationId,
    total_photos: validPhotos.length,
    total_documents: jobDocs.length,
    total_hazards: reportData.risk_factors?.length || 0,
    total_controls: reportData.mitigations?.length || 0,
  }

  filesToAdd.push({
    path: 'metadata.json',
    content: JSON.stringify(metadata, null, 2),
  })

  // Create ZIP buffer
  const zipBuffer = await createZipBuffer(filesToAdd)

  // Upload ZIP to Supabase Storage
  const zipFileName = `permit-packs/job-${jobId}-${Date.now()}.zip`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(zipFileName, zipBuffer, {
      contentType: 'application/zip',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload permit pack: ${uploadError.message}`)
  }

  // Generate signed URL for download (valid for 1 hour)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('documents')
    .createSignedUrl(zipFileName, 3600)

  if (signedUrlError || !signedUrlData) {
    throw new Error('Failed to generate download URL')
  }

  // Record in job_reports table
  await supabase.from('job_reports').insert({
    job_id: jobId,
    organization_id: organizationId,
    version: 1,
    file_path: zipFileName,
    generated_by: userId,
    generated_at: new Date().toISOString(),
  })

  return {
    filePath: zipFileName,
    downloadUrl: signedUrlData.signedUrl,
    size: zipBuffer.length,
  }
}

/**
 * Create ZIP buffer from files
 */
function createZipBuffer(
  files: Array<{ path: string; content: Buffer | string }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    archive.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    archive.on('error', (err) => {
      reject(err)
    })

    // Add all files to archive
    for (const file of files) {
      if (file.content instanceof Buffer) {
        archive.append(file.content, { name: file.path })
      } else {
        archive.append(file.content, { name: file.path })
      }
    }

    archive.finalize()
  })
}

/**
 * Generate Hazard Checklist CSV
 */
function generateHazardChecklistCSV(reportData: any): string {
  const hazards = reportData.risk_factors || []
  const rows = ['Hazard Type,Severity,Description,Identified At']

  for (const hazard of hazards) {
    const type = hazard.code || hazard.hazard_type || 'Unknown'
    const severity = hazard.severity || 'medium'
    const description = (hazard.description || '').replace(/,/g, ';')
    const identifiedAt = hazard.created_at || new Date().toISOString()

    rows.push(`${type},${severity},${description},${identifiedAt}`)
  }

  return rows.join('\n')
}

/**
 * Generate Controls Summary CSV
 */
function generateControlsSummaryCSV(reportData: any): string {
  const controls = reportData.mitigations || []
  const rows = ['Title,Description,Status,Completed At,Completed By']

  for (const control of controls) {
    const title = (control.title || '').replace(/,/g, ';')
    const description = (control.description || '').replace(/,/g, ';')
    const status = control.done || control.is_completed ? 'Completed' : 'Pending'
    const completedAt = control.completed_at || ''
    const completedBy = control.completed_by || ''

    rows.push(`${title},${description},${status},${completedAt},${completedBy}`)
  }

  return rows.join('\n')
}

/**
 * Generate Signatures Sheet CSV
 */
function generateSignaturesSheetCSV(reportData: any): string {
  // If we have signatures in the report data, use them
  // Otherwise, create a template
  const rows = ['Role,Name,Email,Signature Date,Status']

  // This would need to be populated from actual signatures table
  // For now, we'll create a template
  if (reportData.signatures && reportData.signatures.length > 0) {
    for (const sig of reportData.signatures) {
      rows.push(
        `${sig.role || 'N/A'},${sig.signed_by || 'N/A'},${sig.signed_at || 'N/A'},${sig.status || 'N/A'}`
      )
    }
  } else {
    rows.push('Lead Technician,N/A,N/A,N/A,Pending')
    rows.push('Supervisor,N/A,N/A,N/A,Pending')
    rows.push('Client,N/A,N/A,N/A,Pending')
  }

  return rows.join('\n')
}

