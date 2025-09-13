-- waitlist_schema.sql
-- Waitlist tables for Evently

-- Waitlist table
CREATE TABLE IF NOT EXISTS waitlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    user_id UUID NOT NULL REFERENCES users(id),
    position INTEGER NOT NULL,
    priority_score INTEGER DEFAULT 100,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true}',
    promotion_attempts INTEGER DEFAULT 0,
    last_promotion_attempt TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(event_id, user_id)
);

-- Waitlist promotions tracking
CREATE TABLE IF NOT EXISTS waitlist_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waitlist_id UUID NOT NULL REFERENCES waitlists(id),
    event_id UUID NOT NULL REFERENCES events(id),
    user_id UUID NOT NULL REFERENCES users(id),
    promoted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    promotion_expires_at TIMESTAMP WITH TIME ZONE,
    booking_window_minutes INTEGER DEFAULT 10,
    status VARCHAR(50) DEFAULT 'pending',
    booking_id UUID REFERENCES bookings(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_event_position ON waitlists(event_id, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlists(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_expires ON waitlists(expires_at);
CREATE INDEX IF NOT EXISTS idx_promotions_status ON waitlist_promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_expires ON waitlist_promotions(promotion_expires_at);

-- Add sample users for testing
INSERT INTO users (id, email, name, password_hash, role) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'testuser1@evently.com', 'Test User 1', 'hash123', 'user'),
('550e8400-e29b-41d4-a716-446655440002', 'testuser2@evently.com', 'Test User 2', 'hash123', 'user'),
('550e8400-e29b-41d4-a716-446655440003', 'premium@evently.com', 'Premium User', 'hash123', 'user')
ON CONFLICT (email) DO NOTHING;


