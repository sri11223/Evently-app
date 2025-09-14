-- Add missing waitlist_promotions table to fix the error
-- This table is needed by WaitlistManager.processExpiredPromotions()

CREATE TABLE IF NOT EXISTS waitlist_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    event_id UUID REFERENCES events(id) NOT NULL,
    waitlist_id UUID REFERENCES waitlist(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
    promotion_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for the new table
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_status ON waitlist_promotions(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_expires_at ON waitlist_promotions(promotion_expires_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_user_id ON waitlist_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_event_id ON waitlist_promotions(event_id);

-- Show success message
SELECT 'waitlist_promotions table added successfully!' as result;