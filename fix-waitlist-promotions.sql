-- Fix for missing waitlist_promotions table
-- Run this to add the missing table that WaitlistManager needs

CREATE TABLE IF NOT EXISTS waitlist_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    event_id UUID REFERENCES events(id) NOT NULL,
    waitlist_id UUID REFERENCES waitlist(id) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
    promotion_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_user_id ON waitlist_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_event_id ON waitlist_promotions(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_status ON waitlist_promotions(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_expires_at ON waitlist_promotions(promotion_expires_at);

-- Verify table was created
SELECT 'waitlist_promotions table created successfully' AS status;