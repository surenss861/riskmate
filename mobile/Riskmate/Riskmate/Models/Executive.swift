import Foundation

/// Executive Dashboard models - matches backend response structure
struct ExecutivePostureResponse: Codable {
    let exposureLevel: String
    let highRiskJobs: Int
    let openIncidents: Int
    let recentViolations: Int
    let flaggedJobs: Int
    let pendingSignoffs: Int
    let signedJobs: Int
    let proofPacksGenerated: Int
    let confidenceStatement: String
    let ledgerIntegrity: String
    let deltas: ExecutiveDeltas?
    
    enum CodingKeys: String, CodingKey {
        case exposureLevel = "exposure_level"
        case highRiskJobs = "high_risk_jobs"
        case openIncidents = "open_incidents"
        case recentViolations = "recent_violations"
        case flaggedJobs = "flagged_jobs"
        case pendingSignoffs = "pending_signoffs"
        case signedJobs = "signed_jobs"
        case proofPacksGenerated = "proof_packs_generated"
        case confidenceStatement = "confidence_statement"
        case ledgerIntegrity = "ledger_integrity"
        case deltas
    }
}

struct ExecutiveDeltas: Codable {
    let highRiskJobs: Int?
    let openIncidents: Int?
    let violations: Int?
    
    enum CodingKeys: String, CodingKey {
        case highRiskJobs = "high_risk_jobs"
        case openIncidents = "open_incidents"
        case violations
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
