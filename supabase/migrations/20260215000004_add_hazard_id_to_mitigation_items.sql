-- Add hazard_id to mitigation_items for control->hazard linkage (controls reference parent hazard)
-- hazard_id is nullable: hazards have NULL, controls reference their parent hazard (mitigation_items.id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mitigation_items' AND column_name = 'hazard_id') THEN
    ALTER TABLE mitigation_items ADD COLUMN hazard_id UUID REFERENCES mitigation_items(id) ON DELETE SET NULL;
  END IF;
END $$;
