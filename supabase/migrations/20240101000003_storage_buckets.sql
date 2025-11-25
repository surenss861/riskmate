-- Create storage buckets for RiskMate
-- These buckets are created via SQL since config.toml doesn't support bucket definitions

-- Documents bucket (contracts, insurance certificates, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Reports bucket (generated PDF reports)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

-- Photos bucket (job site photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  52428800, -- 50MB
  ARRAY['image/*']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
DROP POLICY IF EXISTS "Users can view documents in their organization" ON storage.objects;
CREATE POLICY "Users can view documents in their organization"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can upload documents to their organization" ON storage.objects;
CREATE POLICY "Users can upload documents to their organization"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can delete documents from their organization" ON storage.objects;
CREATE POLICY "Users can delete documents from their organization"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Storage policies for reports bucket
DROP POLICY IF EXISTS "Users can view reports in their organization" ON storage.objects;
CREATE POLICY "Users can view reports in their organization"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reports' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can upload reports to their organization" ON storage.objects;
CREATE POLICY "Users can upload reports to their organization"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reports' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Storage policies for photos bucket
DROP POLICY IF EXISTS "Users can view photos in their organization" ON storage.objects;
CREATE POLICY "Users can view photos in their organization"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can upload photos to their organization" ON storage.objects;
CREATE POLICY "Users can upload photos to their organization"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can delete photos from their organization" ON storage.objects;
CREATE POLICY "Users can delete photos from their organization"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

