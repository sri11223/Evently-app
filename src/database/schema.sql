-- src/database/schema.sql
-- Core Tables for Evently Booking System

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table with capacity management
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    venue VARCHAR(255) NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    total_capacity INTEGER NOT NULL CHECK (total_capacity > 0),
    available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT check_capacity CHECK (available_seats <= total_capacity)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    event_id UUID REFERENCES events(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'refunded')),
    booking_reference VARCHAR(20) UNIQUE NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Waitlist for full events
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    event_id UUID REFERENCES events(id) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    position INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);

-- Waitlist promotions for tracking when users get promoted from waitlist
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist(position);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_user_id ON waitlist_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_event_id ON waitlist_promotions(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_status ON waitlist_promotions(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_expires_at ON waitlist_promotions(promotion_expires_at);

-- Function to generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN 'EVT' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0')::VARCHAR(10);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate booking reference
CREATE OR REPLACE FUNCTION set_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
        NEW.booking_reference := generate_booking_reference();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_reference_trigger
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION set_booking_reference();

-- Sample data for testing
INSERT INTO users (email, name, password_hash, role) VALUES 
('admin@evently.com', 'Admin User', '$2b$12$dummy.hash', 'admin'),
('user@evently.com', 'Test User', '$2b$12$dummy.hash', 'user')
ON CONFLICT (email) DO NOTHING;

INSERT INTO events (name, description, venue, event_date, total_capacity, available_seats, price) VALUES 
('Tech Conference 2025', 'Annual technology conference', 'Convention Center', '2025-10-15 09:00:00+00', 500, 500, 99.99),
('Music Festival', 'Summer music festival', 'City Park', '2025-11-20 18:00:00+00', 1000, 1000, 149.99),
('Startup Meetup', 'Monthly startup networking', 'Co-working Space', '2025-09-25 19:00:00+00', 50, 50, 25.00)
ON CONFLICT DO NOTHING;
