-- Restrict comments.entity_type to ticket scope (job, hazard, control, photo).
-- Drops the broader CHECK from 20260225000000_add_comments and replaces with ticket-scope only.

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_entity_type_check;

ALTER TABLE comments ADD CONSTRAINT comments_entity_type_check
  CHECK (entity_type IN ('job', 'hazard', 'control', 'photo'));

COMMENT ON COLUMN comments.entity_type IS 'Entity type (ticket scope): job, hazard, control, photo.';
