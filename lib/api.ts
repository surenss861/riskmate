// ... existing code ...

export const auditApi = {
  getEvents: async (params?: {
    category?: 'governance' | 'operations' | 'access'
    site_id?: string
    job_id?: string
    actor_id?: string
    severity?: 'info' | 'material' | 'critical'
    outcome?: 'allowed' | 'blocked'
    time_range?: '24h' | '7d' | '30d' | 'all' | 'custom'
    start_date?: string
    end_date?: string
    view?: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review'
    cursor?: string
    limit?: number
    debug?: boolean
  }) => {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    return apiRequest<{
      data: {
        events: Array<any>
        stats: {
          total: number
          violations: number
          jobs_touched: number
          proof_packs: number
          signoffs: number
          access_changes: number
        }
        pagination: {
          next_cursor: string | null
          limit: number
          has_more: boolean
        }
      }
      _meta?: any
    }>(`/api/audit/events?${queryParams.toString()}`)
  },
  export: async (params: {
    format: 'pdf' | 'csv' | 'json'
    category?: 'governance' | 'operations' | 'access'
    site_id?: string
    job_id?: string
    actor_id?: string
    severity?: 'info' | 'material' | 'critical'
    outcome?: 'allowed' | 'blocked'
    time_range?: '24h' | '7d' | '30d' | 'all' | 'custom'
    start_date?: string
    end_date?: string
    view?: 'review-queue' | 'insurance-ready' | 'governance-enforcement' | 'incident-review' | 'access-review'
    export_type?: 'ledger' | 'controls' | 'attestations'
  }) => {
    const endpoint = params.export_type === 'controls' 
      ? '/api/audit/export/controls'
      : params.export_type === 'attestations'
      ? '/api/audit/export/attestations'
      : '/api/audit/export'
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Export failed')
    }

    // Handle file download
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    const contentDisposition = response.headers.get('Content-Disposition')
    const filename = contentDisposition 
      ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'export'
      : `export.${params.format}`
    
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },
}

// ... existing code ...
