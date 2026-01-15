import Foundation

/// Executive Dashboard models
struct ExecutivePostureResponse: Codable {
    let riskPosture: RiskPosture
    let exposure: ExposureAssessment
    let controls: ControlsStatus
    let defensibility: DefensibilityPosture
    
    enum CodingKeys: String, CodingKey {
        case riskPosture = "risk_posture"
        case exposure
        case controls
        case defensibility
    }
}

struct RiskPosture: Codable {
    let exposureLevel: String // "low" | "moderate" | "high"
    let confidenceStatement: String
    let generatedAt: String
    
    enum CodingKeys: String, CodingKey {
        case exposureLevel = "exposure_level"
        case confidenceStatement = "confidence_statement"
        case generatedAt = "generated_at"
    }
}

struct ExposureAssessment: Codable {
    let highRiskJobs: ExposureMetric
    let openIncidents: ExposureMetric
    let violations: ExposureMetric
    
    enum CodingKeys: String, CodingKey {
        case highRiskJobs = "high_risk_jobs"
        case openIncidents = "open_incidents"
        case violations
    }
}

struct ExposureMetric: Codable {
    let count: Int
    let delta: Int? // Positive = increase, negative = decrease
}

struct ControlsStatus: Codable {
    let flaggedJobs: Int
    let pendingSignoffs: Int
    let signedJobs: Int
}

struct DefensibilityPosture: Codable {
    let ledgerIntegrity: String // "verified" | "unverified" | "error"
    let proofPacksGenerated: Int
    let enforcementActions: Int
    let attestationsCoverage: AttestationsCoverage
    
    enum CodingKeys: String, CodingKey {
        case ledgerIntegrity = "ledger_integrity"
        case proofPacksGenerated = "proof_packs_generated"
        case enforcementActions = "enforcement_actions"
        case attestationsCoverage = "attestations_coverage"
    }
}

struct AttestationsCoverage: Codable {
    let signed: Int
    let total: Int
}
