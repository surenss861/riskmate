-- Seed data for RiskMate
-- Initial risk factors and sample data

-- Insert default risk factors
INSERT INTO risk_factors (code, name, description, severity, category, mitigation_steps) VALUES
  ('HEIGHT_WORK', 'Working at Height', 'Job involves work at elevated heights (>6 feet)', 'high', 'safety', '["Require fall protection equipment", "Conduct safety briefing", "Obtain signed waiver", "Verify worker certifications"]'),
  ('UNSUPERVISED_SUB', 'Unsupervised Subcontractor', 'Using subcontractors without direct supervision', 'medium', 'subcontractor', '["Verify subcontractor insurance", "Get signed contract", "Check worker certifications", "Require proof of liability coverage"]'),
  ('NO_INSURANCE_SUB', 'Missing Sub Insurance', 'Subcontractor has not provided certificate of insurance', 'critical', 'insurance', '["Request certificate of insurance", "Verify coverage dates", "Check coverage amounts", "Store certificate in system"]'),
  ('HAZARDOUS_MATERIAL', 'Hazardous Materials', 'Job involves handling or working near hazardous materials', 'high', 'safety', '["Identify all hazardous materials", "Obtain MSDS sheets", "Provide proper PPE", "Notify relevant authorities if required"]'),
  ('PUBLIC_ACCESS', 'Public Access Area', 'Work site has public access during work hours', 'medium', 'liability', '["Install proper barriers", "Post warning signs", "Assign spotter if needed", "Notify adjacent businesses"]'),
  ('ELECTRICAL_WORK', 'Electrical Work', 'Job involves electrical installation or repair', 'high', 'safety', '["Verify electrician license", "Use proper lockout/tagout", "Test before touching", "Follow electrical code"]'),
  ('TRENCHING_EXCAVATION', 'Trenching/Excavation', 'Job involves digging trenches or excavation', 'critical', 'safety', '["Call 811 for utility location", "Use proper shoring", "Check soil conditions", "Have emergency plan"]'),
  ('NO_CONTRACT', 'Missing Contract', 'No signed contract or work agreement', 'high', 'documentation', '["Draft written contract", "Include scope of work", "Specify payment terms", "Include liability clauses"]'),
  ('EXPIRED_INSURANCE', 'Expired Insurance', 'Organization or subcontractor insurance has expired', 'critical', 'insurance', '["Renew insurance immediately", "Verify effective dates", "Update certificate in system"]'),
  ('WEEKEND_WORK', 'Weekend/After-Hours Work', 'Work scheduled outside normal business hours', 'low', 'compliance', '["Check local noise ordinances", "Notify neighbors", "Obtain required permits"]'),
  ('HEAVY_EQUIPMENT', 'Heavy Equipment Operation', 'Job requires operation of heavy machinery', 'high', 'safety', '["Verify operator certifications", "Inspect equipment before use", "Follow safety protocols", "Use spotter when needed"]'),
  ('WATER_DAMAGE_RISK', 'Water Damage Risk', 'Work involves plumbing near finished areas', 'medium', 'liability', '["Check water shutoff location", "Have cleanup supplies ready", "Notify client of risks", "Take before photos"]'),
  ('LACK_DOCUMENTATION', 'Insufficient Documentation', 'Job lacks required documentation or permits', 'medium', 'documentation', '["Gather all required permits", "Document job scope", "Take progress photos", "Maintain detailed records"]'),
  ('CLIENT_DEMANDS', 'High Client Expectations', 'Client has high expectations or past disputes', 'low', 'liability', '["Document all communications", "Set clear expectations", "Get approvals in writing", "Maintain professional communication"]'),
  ('WEATHER_SENSITIVE', 'Weather Dependent', 'Job is sensitive to weather conditions', 'medium', 'safety', '["Monitor weather forecast", "Have contingency plan", "Protect work site", "Communicate delays proactively"]')
ON CONFLICT (code) DO NOTHING;

