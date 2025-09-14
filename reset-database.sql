-- Reset and recreate database schema
-- Drop existing tables to start fresh
DROP TABLE IF EXISTS waitlist CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
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
CREATE TABLE events (
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
CREATE TABLE bookings (
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
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    event_id UUID REFERENCES events(id) NOT NULL,
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
    status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'expired')),
    notification_count INTEGER DEFAULT 0,
    priority_score INTEGER DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);

-- Add some sample data
INSERT INTO users (name, email, password_hash, role) VALUES 
('Admin User', 'admin@evently.com', '$2a$12$6Q8nRJ8lN9zH8H.X3mZ3dOQx9T7c4P5xU8nW1bR6c3D9E4F2A1q0V', 'admin'),
('Test User', 'user@evently.com', '$2a$12$6Q8nRJ8lN9zH8H.X3mZ3dOQx9T7c4P5xU8nW1bR6c3D9E4F2A1q0V', 'user');

INSERT INTO events (name, description, venue, event_date, total_capacity, available_seats, price) VALUES
('Tech Conference 2025', 'Annual technology conference', 'Convention Center', '2025-10-15T09:00:00Z', 500, 450, 99.99),
('Music Festival', 'Summer music festival', 'City Park', '2025-08-20T18:00:00Z', 1000, 800, 149.99),
('Business Workshop', 'Professional development workshop', 'Business Center', '2025-09-30T10:00:00Z', 100, 85, 49.99),
('Art Exhibition', 'Modern art exhibition', 'Art Gallery', '2025-11-05T14:00:00Z', 200, 200, 25.00),
('Food Festival', 'Local cuisine festival', 'Downtown Square', '2025-10-20T12:00:00Z', 2000, 1800, 15.00);

-- Create indexes
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_event ON bookings(event_id);
CREATE INDEX idx_waitlist_event ON waitlist(event_id);
CREATE INDEX idx_waitlist_user ON waitlist(user_id);