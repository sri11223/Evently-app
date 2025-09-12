-- Add organizer support to existing schema
ALTER TABLE events ADD COLUMN organizer_id UUID;

-- Create organizer table
CREATE TABLE IF NOT EXISTS organizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    organization_type VARCHAR(100) DEFAULT 'company',
    shard_id INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shard mapping table
CREATE TABLE IF NOT EXISTS shard_mappings (
    organizer_id UUID PRIMARY KEY REFERENCES organizers(id),
    shard_id INTEGER NOT NULL,
    shard_host VARCHAR(255) NOT NULL,
    shard_database VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update existing events with default organizer
INSERT INTO organizers (id, name, email, shard_id) VALUES 
('11111111-1111-1111-1111-111111111111', 'Default Event Organizer', 'admin@evently.com', 0)
ON CONFLICT (email) DO NOTHING;

-- Link existing events to default organizer
UPDATE events 
SET organizer_id = '11111111-1111-1111-1111-111111111111' 
WHERE organizer_id IS NULL;

-- Add foreign key constraint
ALTER TABLE events ADD CONSTRAINT fk_events_organizer 
FOREIGN KEY (organizer_id) REFERENCES organizers(id);

-- Create indexes for sharding
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_shard_mappings_shard_id ON shard_mappings(shard_id);
