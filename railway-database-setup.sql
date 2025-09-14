-- ========================================
-- EVENTLY DATABASE SETUP FOR RAILWAY
-- Copy and paste this entire script into Railway PostgreSQL Query tab
-- ========================================

-- Create Users table
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

-- Create Events table
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

-- Create Bookings table
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

-- Create Waitlist table
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

-- Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist(position);

-- Create Booking Reference Generator Function
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN 'EVT' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(EXTRACT(EPOCH FROM NOW())::TEXT, 10, '0')::VARCHAR(10);
END;
$$ LANGUAGE plpgsql;

-- Create Trigger Function
CREATE OR REPLACE FUNCTION set_booking_reference()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_reference IS NULL OR NEW.booking_reference = '' THEN
        NEW.booking_reference := generate_booking_reference();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create Trigger
CREATE TRIGGER booking_reference_trigger
    BEFORE INSERT ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION set_booking_reference();

-- Insert Sample Admin User (password: Admin123!)
INSERT INTO users (email, name, password_hash, role) VALUES 
('admin@evently.com', 'System Admin', '$2b$12$rWmzJ.Tx7JHuF4j4lKJ4.u4QK5mM9vU7KN7bXjxRzL7cKG1R8X6fC', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Regular User (password: User123!)
INSERT INTO users (email, name, password_hash, role) VALUES 
('user@evently.com', 'Demo User', '$2b$12$rWmzJ.Tx7JHuF4j4lKJ4.u4QK5mM9vU7KN7bXjxRzL7cKG1R8X6fC', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Events
INSERT INTO events (name, description, venue, event_date, total_capacity, available_seats, price) VALUES 
('Tech Conference 2025', 'Annual technology conference showcasing the latest innovations', 'Convention Center', '2025-12-15 09:00:00+00', 500, 500, 149.99),
('Music Festival', 'Summer music festival with top artists', 'City Park', '2025-11-20 18:00:00+00', 1000, 997, 89.99),
('Startup Meetup', 'Monthly startup networking and pitch event', 'Co-working Space', '2025-10-25 19:00:00+00', 50, 47, 25.00),
('Workshop: AI in Business', 'Hands-on workshop about implementing AI solutions', 'Innovation Hub', '2025-10-30 14:00:00+00', 30, 30, 199.99)
ON CONFLICT DO NOTHING;

-- Verify Setup
SELECT 'Database setup completed successfully!' AS status;
SELECT 'Users created: ' || COUNT(*) AS users_count FROM users;
SELECT 'Events created: ' || COUNT(*) AS events_count FROM events;