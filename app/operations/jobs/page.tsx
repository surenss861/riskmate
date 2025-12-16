'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import ProtectedRoute from '@/components/ProtectedRoute'
import { jobsApi } from '@/lib/api'
import { JobsPageContentView } from './JobsPageContent'

interface Job {
  id: string
  client_name: string
  job_type: string
  location: string
  status: string
  risk_score: number | null
  risk_level: string | null
  created_at: string
  updated_at: string
  applied_template_id?: string | null
  applied_template_type?: 'hazard' | 'job' | null
}

const JobsPageContent = () => {
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('')
  const [filterTemplateSource, setFilterTemplateSource] = useState<string>('')
  const [filterTemplateId, setFilterTemplateId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('member')

  // Initialize filters from URL params
  useEffect(() => {
    if (searchParams) {
      const source = searchParams.get('source') || ''
      const templateId = searchParams.get('templateId') || ''
      setFilterTemplateSource(source)
      setFilterTemplateId(templateId)
    }
  }, [searchParams])

  // Load templates for filter dropdown
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true)
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        if (!userRow?.organization_id) return

        // Load both hazard and job templates
        const { data: hazardTemplates } = await supabase
          .from('hazard_templates')
          .select('id, name')
          .eq('organization_id', userRow.organization_id)
          .eq('archived', false)

        const { data: jobTemplates } = await supabase
          .from('job_templates')
          .select('id, name')
          .eq('organization_id', userRow.organization_id)
          .eq('archived', false)

        setTemplates([...(hazardTemplates || []), ...(jobTemplates || [])])
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        setLoadingTemplates(false)
      }
    }
    loadTemplates()
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (!user) return

      // Get user role for permissions
      const { data: userRow } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()

      if (!userRow?.organization_id) return
      
      // Set user role
      if (userRow.role) {
        setUserRole(userRow.role as 'owner' | 'admin' | 'member')
      }

      // Use authenticated API endpoint (same source of truth as backend)
      // This ensures consistent filtering, auth, and archive/delete handling
      const response = await jobsApi.list({
        page,
        limit: 50,
        status: filterStatus || undefined,
        risk_level: filterRiskLevel || undefined,
      })

      const jobsData = response.data || []
      
      // Apply template filters client-side (since API doesn't support them yet)
      let filteredJobs = jobsData
      
      if (filterTemplateSource === 'template') {
        filteredJobs = filteredJobs.filter(job => job.applied_template_id !== null)
      } else if (filterTemplateSource === 'manual') {
        filteredJobs = filteredJobs.filter(job => job.applied_template_id === null)
      }
      
      if (filterTemplateId) {
        filteredJobs = filteredJobs.filter(job => job.applied_template_id === filterTemplateId)
      }

      // Ensure jobsData is an array and set jobs
      if (Array.isArray(filteredJobs)) {
        setJobs(filteredJobs)
      } else {
        console.warn('Jobs query returned non-array data:', filteredJobs)
        setJobs([])
      }
      
      // Calculate total pages from API pagination or filtered count
      const totalCount = response.pagination?.total || filteredJobs.length
      setTotalPages(Math.ceil(totalCount / 50))
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load jobs:', err)
      setLoading(false)
      // Don't throw - just show empty state
      setJobs([])
    }
  }, [page, filterStatus, filterRiskLevel, filterTemplateSource, filterTemplateId])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const getRiskColor = (riskLevel: string | null) => {
    if (!riskLevel) return 'text-white/40'
    switch (riskLevel.toLowerCase()) {
      case 'low':
        return 'text-green-400'
      case 'medium':
        return 'text-yellow-400'
      case 'high':
        return 'text-orange-400'
      case 'critical':
        return 'text-red-400'
      default:
        return 'text-white/40'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'on-hold':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-white/10 text-white/60 border-white/10'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <JobsPageContentView
      user={user}
      loading={loading}
      jobs={jobs}
      filterStatus={filterStatus}
      filterRiskLevel={filterRiskLevel}
      filterTemplateSource={filterTemplateSource}
      filterTemplateId={filterTemplateId}
      templates={templates}
      loadingTemplates={loadingTemplates}
      page={page}
      totalPages={totalPages}
      onFilterStatusChange={setFilterStatus}
      onFilterRiskLevelChange={setFilterRiskLevel}
      onFilterTemplateSourceChange={setFilterTemplateSource}
      onFilterTemplateIdChange={setFilterTemplateId}
      onPageChange={setPage}
      getRiskColor={getRiskColor}
      getStatusColor={getStatusColor}
      formatDate={formatDate}
      userRole={userRole}
      onJobArchived={loadJobs}
      onJobDeleted={loadJobs}
    />
  )
}

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]" />
          </div>
        }
      >
        <JobsPageContent />
      </Suspense>
    </ProtectedRoute>
  )
}

