-- ============================================================================
-- ADD PACKET TYPE TO REPORT RUNS
-- ============================================================================
-- Adds packet_type field to report_runs to support multiple packet types
-- (insurance, audit, incident, client_compliance)

-- Add packet_type column
ALTER TABLE report_runs 
ADD COLUMN IF NOT EXISTS packet_type TEXT DEFAULT 'insurance' 
CHECK (packet_type IN ('insurance', 'audit', 'incident', 'client_compliance'));

-- Create index for packet type queries
CREATE INDEX IF NOT EXISTS idx_report_runs_packet_type ON report_runs(packet_type);

-- Update comment
COMMENT ON COLUMN report_runs.packet_type IS 'Type of report packet: insurance, audit, incident, or client_compliance';

