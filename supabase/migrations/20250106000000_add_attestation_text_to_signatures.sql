-- Add attestation_text column to report_signatures table
-- This column stores the exact attestation text that the signer agreed to
-- Required for tamper-evident proof and compliance

-- Add column with default value for compliance-grade data
ALTER TABLE public.report_signatures
ADD COLUMN IF NOT EXISTS attestation_text TEXT
DEFAULT 'I attest this report is accurate to the best of my knowledge.';

-- Backfill any existing rows that might have null values
UPDATE public.report_signatures
SET attestation_text = 'I attest this report is accurate to the best of my knowledge.'
WHERE attestation_text IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.report_signatures.attestation_text IS 
  'Exact attestation text that the signer agreed to at sign-time. Required for tamper-evident proof.';

