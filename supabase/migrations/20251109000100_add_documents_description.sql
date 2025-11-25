-- Add optional description for documents and ensure timestamp default
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.documents
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Helpful index for querying by uploaded_by (if not already present)
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);

