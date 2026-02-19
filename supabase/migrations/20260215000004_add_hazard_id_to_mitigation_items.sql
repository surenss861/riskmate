-- Add hazard_id to mitigation_items for control->hazard linkage (controls reference parent hazard)
-- hazard_id is nullable: hazards have NULL, controls reference their parent hazard (mitigation_items.id).
-- ON DELETE CASCADE so controls are deleted when their parent hazard is removed (not orphaned).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mitigation_items' AND column_name = 'hazard_id') THEN
    ALTER TABLE mitigation_items ADD COLUMN hazard_id UUID REFERENCES mitigation_items(id) ON DELETE CASCADE;
  END IF;
END $$;
