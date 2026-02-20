-- Align comments schema with spec: use content column. For DBs that have body from an earlier run of add_comments, rename to content.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'body'
  ) THEN
    ALTER TABLE comments RENAME COLUMN body TO content;
  END IF;
END $$;
