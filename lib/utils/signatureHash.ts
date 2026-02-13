import { createHash } from 'crypto'

/**
 * Canonical inputs for computing a report signature hash.
 * The hash binds the signature to the sealed report payload, run, and attestation text.
 */
export interface SignatureHashInputs {
  /** report_runs.data_hash — hash of the frozen report payload */
  dataHash: string
  /** report_runs.id — binds signature to this run */
  reportRunId: string
  signatureSvg: string
  signerName: string
  signerTitle: string
  signatureRole: string
  /** Signer-accepted attestation wording; null/empty treated as "" for existing records */
  attestationText?: string | null
}

/**
 * Normalizes attestation for hash: null/undefined/empty become "" so existing records are handled.
 */
function normalizedAttestation(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return ''
  const t = value.trim()
  return t
}

/**
 * Computes the signature hash stored in report_signatures.signature_hash.
 * Hash is bound to the sealed payload (data_hash), run (reportRunId), and attestation text
 * so the same signature cannot be reused and attestation tampering is detected.
 *
 * Contract (order matters): dataHash | reportRunId | signatureSvg | signerName | signerTitle | signatureRole | attestationText(normalized)
 */
export function computeSignatureHash(inputs: SignatureHashInputs): string {
  const attestation = normalizedAttestation(inputs.attestationText)
  return createHash('sha256')
    .update(inputs.dataHash)
    .update(inputs.reportRunId)
    .update(inputs.signatureSvg)
    .update(inputs.signerName)
    .update(inputs.signerTitle)
    .update(inputs.signatureRole)
    .update(attestation)
    .digest('hex')
}
