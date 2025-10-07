-- Waitlist Migration SQL
-- Run this to create/update waitlist tables with correct naming

-- Drop old singular table if exists
DROP TABLE IF EXISTS waitlist_promotions CASCADE;
DROP TABLE IF EXISTS waitlist CASCADE;

-- Create waitlists table (PLURAL - matches WaitlistManager code)
CREATE TABLE IF NOT EXISTS waitlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    priority_score INTEGER DEFAULT 100,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    promoted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'expired', 'cancelled')),
    notification_preferences JSONB DEFAULT '{"email": true, "push": true}',
    promotion_attempts INTEGER DEFAULT 0,
    last_promotion_attempt TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(event_id, user_id)
);

-- Create waitlist_promotions table
CREATE TABLE IF NOT EXISTS waitlist_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waitlist_id UUID NOT NULL REFERENCES waitlists(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promoted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    promotion_expires_at TIMESTAMP WITH TIME ZONE,
    booking_window_minutes INTEGER DEFAULT 10,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlists_event_status ON waitlists(event_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlists_user_event ON waitlists(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_waitlists_position ON waitlists(event_id, position, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_status ON waitlist_promotions(status, promotion_expires_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_waitlist ON waitlist_promotions(waitlist_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_waitlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS waitlists_updated_at ON waitlists;
CREATE TRIGGER waitlists_updated_at
    BEFORE UPDATE ON waitlists
    FOR EACH ROW
    EXECUTE FUNCTION update_waitlists_updated_at();

DROP TRIGGER IF EXISTS waitlist_promotions_updated_at ON waitlist_promotions;
CREATE TRIGGER waitlist_promotions_updated_at
    BEFORE UPDATE ON waitlist_promotions
    FOR EACH ROW
    EXECUTE FUNCTION update_waitlists_updated_at();

-- Success message
SELECT 'Waitlist tables created successfully with correct naming (waitlists, waitlist_promotions)' as status;
