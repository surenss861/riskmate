import { createHash } from 'crypto'

/**
 * Canonical inputs for computing a report signature hash.
 * The hash binds the signature to the sealed report payload and run.
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
}

/**
 * Computes the signature hash stored in report_signatures.signature_hash.
 * Hash is bound to the sealed payload (data_hash) and run (reportRunId) so
 * the same signature cannot be reused across runs or payloads.
 *
 * Contract (order matters): dataHash | reportRunId | signatureSvg | signerName | signerTitle | signatureRole
 */
export function computeSignatureHash(inputs: SignatureHashInputs): string {
  return createHash('sha256')
    .update(inputs.dataHash)
    .update(inputs.reportRunId)
    .update(inputs.signatureSvg)
    .update(inputs.signerName)
    .update(inputs.signerTitle)
    .update(inputs.signatureRole)
    .digest('hex')
}
