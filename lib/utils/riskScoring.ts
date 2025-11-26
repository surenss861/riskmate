import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface RiskScoreResult {
  overall_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  factors: Array<{
    code: string
    name: string
    severity: string
    weight: number
  }>
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
}

const RISK_LEVEL_THRESHOLDS = {
  low: 40,
  medium: 70,
  high: 90,
  critical: 100,
}

export async function calculateRiskScore(
  riskFactorCodes: string[]
): Promise<RiskScoreResult> {
  if (!riskFactorCodes || riskFactorCodes.length === 0) {
    return {
      overall_score: 0,
      risk_level: 'low',
      factors: [],
    }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch risk factors from database
  const { data: riskFactors, error } = await supabase
    .from('risk_factors')
    .select('id, code, name, severity, category, mitigation_steps')
    .in('code', riskFactorCodes)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching risk factors:', error)
    throw new Error('Failed to fetch risk factors')
  }

  if (!riskFactors || riskFactors.length === 0) {
    return {
      overall_score: 0,
      risk_level: 'low',
      factors: [],
    }
  }

  // Calculate weighted score
  let totalScore = 0
  const factors: Array<{
    code: string
    name: string
    severity: string
    weight: number
  }> = []

  for (const factor of riskFactors) {
    const weight = SEVERITY_WEIGHTS[factor.severity] || 0
    totalScore += weight

    factors.push({
      code: factor.code,
      name: factor.name,
      severity: factor.severity,
      weight,
    })
  }

  // Cap score at 100
  const overall_score = Math.min(100, totalScore)

  // Determine risk level
  let risk_level: 'low' | 'medium' | 'high' | 'critical' = 'low'
  if (overall_score >= RISK_LEVEL_THRESHOLDS.critical) {
    risk_level = 'critical'
  } else if (overall_score >= RISK_LEVEL_THRESHOLDS.high) {
    risk_level = 'high'
  } else if (overall_score >= RISK_LEVEL_THRESHOLDS.medium) {
    risk_level = 'medium'
  }

  return {
    overall_score,
    risk_level,
    factors,
  }
}

export async function generateMitigationItems(
  jobId: string,
  riskFactorCodes: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient()

  // Fetch risk factors with mitigation steps
  const { data: riskFactors, error } = await supabase
    .from('risk_factors')
    .select('code, name, mitigation_steps')
    .in('code', riskFactorCodes)
    .eq('is_active', true)

  if (error || !riskFactors) {
    console.error('Error fetching risk factors for mitigation:', error)
    return
  }

  // Generate mitigation items from all risk factors
  const mitigationItems: Array<{
    job_id: string
    title: string
    description: string
    done: boolean
    is_completed: boolean
  }> = []

  for (const factor of riskFactors) {
    if (factor.mitigation_steps && Array.isArray(factor.mitigation_steps)) {
      for (const step of factor.mitigation_steps) {
        mitigationItems.push({
          job_id: jobId,
          title: step,
          description: `Required for ${factor.name}`,
          done: false,
          is_completed: false,
        })
      }
    }
  }

  // Insert mitigation items
  if (mitigationItems.length > 0) {
    await supabase.from('mitigation_items').insert(mitigationItems)
  }
}

