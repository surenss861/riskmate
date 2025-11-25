import { supabase } from "../lib/supabaseClient";

/**
 * Risk Scoring Engine
 * Deterministic scoring based on risk factor severity weights
 */

export interface RiskFactor {
  id: string;
  code: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  mitigation_steps: string[];
}

export interface RiskScoreResult {
  overall_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    code: string;
    name: string;
    severity: string;
    weight: number;
  }>;
}

/**
 * Severity weight mapping
 * Critical = 25 points, High = 15, Medium = 8, Low = 3
 */
const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

/**
 * Risk level thresholds
 */
const RISK_LEVEL_THRESHOLDS = {
  low: 40,
  medium: 70,
  high: 90,
  critical: 100,
};

/**
 * Calculate risk score from selected risk factor codes
 */
export async function calculateRiskScore(
  riskFactorCodes: string[]
): Promise<RiskScoreResult> {
  if (!riskFactorCodes || riskFactorCodes.length === 0) {
    return {
      overall_score: 0,
      risk_level: 'low',
      factors: [],
    };
  }

  // Fetch risk factors from database
  const { data: riskFactors, error } = await supabase
    .from('risk_factors')
    .select('id, code, name, severity, category, mitigation_steps')
    .in('code', riskFactorCodes)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching risk factors:', error);
    throw new Error('Failed to fetch risk factors');
  }

  if (!riskFactors || riskFactors.length === 0) {
    return {
      overall_score: 0,
      risk_level: 'low',
      factors: [],
    };
  }

  // Calculate weighted score
  let totalScore = 0;
  const factors: Array<{
    code: string;
    name: string;
    severity: string;
    weight: number;
  }> = [];

  for (const factor of riskFactors) {
    const weight = SEVERITY_WEIGHTS[factor.severity] || 0;
    totalScore += weight;
    
    factors.push({
      code: factor.code,
      name: factor.name,
      severity: factor.severity,
      weight,
    });
  }

  // Cap score at 100
  const overall_score = Math.min(100, totalScore);

  // Determine risk level
  let risk_level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (overall_score >= RISK_LEVEL_THRESHOLDS.critical) {
    risk_level = 'critical';
  } else if (overall_score >= RISK_LEVEL_THRESHOLDS.high) {
    risk_level = 'high';
  } else if (overall_score >= RISK_LEVEL_THRESHOLDS.medium) {
    risk_level = 'medium';
  }

  return {
    overall_score,
    risk_level,
    factors,
  };
}

/**
 * Generate mitigation items from triggered risk factors
 */
export async function generateMitigationItems(
  jobId: string,
  riskFactorCodes: string[]
): Promise<void> {
  if (!riskFactorCodes || riskFactorCodes.length === 0) {
    return;
  }

  // Fetch risk factors with mitigation steps
  const { data: riskFactors, error } = await supabase
    .from('risk_factors')
    .select('id, code, name, mitigation_steps')
    .in('code', riskFactorCodes)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching risk factors for mitigation:', error);
    throw new Error('Failed to fetch risk factors');
  }

  if (!riskFactors || riskFactors.length === 0) {
    return;
  }

  // Create mitigation items for each risk factor
  const mitigationItems = [];

  for (const factor of riskFactors) {
    const steps = factor.mitigation_steps || [];
    
    // Create one mitigation item per step, or one item if no steps defined
    if (steps.length > 0) {
      for (const step of steps) {
        mitigationItems.push({
          job_id: jobId,
          risk_factor_id: factor.id,
          title: step,
          description: `Mitigation for ${factor.name}: ${step}`,
          done: false,
          is_completed: false,
        });
      }
    } else {
      // Default mitigation if no steps defined
      mitigationItems.push({
        job_id: jobId,
        risk_factor_id: factor.id,
        title: `Address ${factor.name}`,
        description: `Review and mitigate risks associated with ${factor.name}`,
        done: false,
        is_completed: false,
      });
    }
  }

  // Insert mitigation items in batch
  if (mitigationItems.length > 0) {
    const { error: insertError } = await supabase
      .from('mitigation_items')
      .insert(mitigationItems);

    if (insertError) {
      console.error('Error creating mitigation items:', insertError);
      throw new Error('Failed to create mitigation items');
    }
  }
}

