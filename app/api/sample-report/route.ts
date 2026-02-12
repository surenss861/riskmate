import { NextResponse } from 'next/server'
import { generateRiskSnapshotPDF } from '@/lib/utils/pdf'

export const runtime = 'nodejs'

// Sample data for the demo PDF
const SAMPLE_JOB = {
  id: 'sample-001',
  client_name: 'Downtown Office Complex',
  client_type: 'Commercial',
  job_type: 'HVAC Installation',
  location: '123 Main St, Suite 400, Toronto, ON',
  description: 'Installation of new rooftop HVAC unit for commercial office building. Work includes electrical connections, refrigerant lines, and ductwork modifications.',
  status: 'completed',
  risk_score: 78,
  risk_level: 'high',
  created_at: new Date('2024-11-15T09:00:00Z').toISOString(),
  updated_at: new Date('2024-11-15T14:30:00Z').toISOString(),
}

const SAMPLE_RISK_SCORE = {
  overall_score: 78,
  risk_level: 'high',
  factors: [
    { code: 'HEIGHT', name: 'Height work (over 6 feet)', severity: 'high', weight: 15 },
    { code: 'ELECTRICAL', name: 'Live electrical work', severity: 'critical', weight: 20 },
    { code: 'CONFINED', name: 'Confined space entry', severity: 'high', weight: 18 },
    { code: 'PUBLIC', name: 'Public access area', severity: 'medium', weight: 10 },
    { code: 'SUBCONTRACTOR', name: 'Multiple subcontractors', severity: 'medium', weight: 10 },
  ],
}

const SAMPLE_MITIGATIONS = [
  {
    id: '1',
    title: 'Install guardrails at roof edges',
    description: 'Temporary guardrails installed at all roof edges before work begins',
    done: true,
    is_completed: true,
  },
  {
    id: '2',
    title: 'Verify subcontractor COI is current',
    description: 'Certificate of Insurance verified for all subcontractors on-site',
    done: true,
    is_completed: true,
  },
  {
    id: '3',
    title: 'Post warning signs in public access areas',
    description: 'Warning signs posted at all public entrances and access points',
    done: true,
    is_completed: true,
  },
  {
    id: '4',
    title: 'Lock out electrical panels before work',
    description: 'All electrical panels locked and tagged before any electrical work',
    done: true,
    is_completed: true,
  },
  {
    id: '5',
    title: 'Assign safety spotter for height work',
    description: 'Dedicated safety spotter assigned for all work above 6 feet',
    done: true,
    is_completed: true,
  },
  {
    id: '6',
    title: 'Review emergency evacuation plan with crew',
    description: 'Emergency evacuation procedures reviewed with all crew members',
    done: true,
    is_completed: true,
  },
]

const SAMPLE_ORGANIZATION = {
  id: 'sample-org',
  name: 'ABC Contracting Services',
  logo_url: null,
  accent_color: '#F97316',
}

const SAMPLE_PHOTOS: Array<{ name: string; description: string | null; created_at: string; buffer: Buffer }> = [
  // Empty array - no photos in sample
]

const SAMPLE_AUDIT = [
  {
    id: '1',
    event_name: 'job.created',
    target_type: 'job',
    target_id: 'sample-001',
    actor_id: 'sample-user',
    actor_name: 'John Smith',
    timestamp: new Date('2024-11-15T09:00:00Z').toISOString(),
    metadata: { action: 'Job created' },
    created_at: new Date('2024-11-15T09:00:00Z').toISOString(),
  },
  {
    id: '2',
    event_name: 'hazard.identified',
    target_type: 'job',
    target_id: 'sample-001',
    actor_id: 'sample-user',
    actor_name: 'John Smith',
    timestamp: new Date('2024-11-15T09:15:00Z').toISOString(),
    metadata: { hazard: 'Height work' },
    created_at: new Date('2024-11-15T09:15:00Z').toISOString(),
  },
  {
    id: '3',
    event_name: 'mitigation.completed',
    target_type: 'mitigation',
    target_id: '1',
    actor_id: 'sample-user',
    actor_name: 'John Smith',
    timestamp: new Date('2024-11-15T10:00:00Z').toISOString(),
    metadata: { mitigation: 'Guardrails installed' },
    created_at: new Date('2024-11-15T10:00:00Z').toISOString(),
  },
  {
    id: '4',
    event_name: 'report.generated',
    target_type: 'report',
    target_id: 'sample-report',
    actor_id: 'sample-user',
    actor_name: 'John Smith',
    timestamp: new Date('2024-11-15T14:30:00Z').toISOString(),
    metadata: { report_type: 'Risk Snapshot' },
    created_at: new Date('2024-11-15T14:30:00Z').toISOString(),
  },
]

export async function GET() {
  try {
    // Generate PDF with sample data
    const pdfBuffer = await generateRiskSnapshotPDF(
      SAMPLE_JOB as any,
      SAMPLE_RISK_SCORE as any,
      SAMPLE_MITIGATIONS as any,
      SAMPLE_ORGANIZATION as any,
      SAMPLE_PHOTOS,
      SAMPLE_AUDIT as any,
      undefined, // signatures - sample report has no signatures
      undefined  // reportRunId - sample report has no report_run
    )

    // Return PDF with proper headers
    // NextResponse accepts Buffer at runtime, but TypeScript types are strict
    // @ts-expect-error - Buffer is compatible with BodyInit at runtime
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="sample-risk-report.pdf"',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    })
  } catch (error: any) {
    console.error('Failed to generate sample PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate sample PDF', message: error?.message },
      { status: 500 }
    )
  }
}

