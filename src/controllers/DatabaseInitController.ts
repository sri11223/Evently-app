import { Request, Response } from 'express';
import { Pool } from 'pg';

export class DatabaseInitController {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * Initialize database tables and data
     * POST /api/v1/database/init
     */
    async initializeDatabase(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔄 Starting database initialization...');

            // Database schema SQL (embedded to avoid file path issues in production)
            const schemaSql = `
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

                -- Indexes for performance
                CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
                CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
                CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
                CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
                CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
                CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
                CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist(position);

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
                ('admin@evently.com', 'Admin User', '$2b$12$LfEvsX2Kt2Zt9qOQpJdEyeU4nPUGhkbQZ8y8VK8L4hKVh8v7L4v7u', 'admin'),
                ('user@evently.com', 'Test User', '$2b$12$LfEvsX2Kt2Zt9qOQpJdEyeU4nPUGhkbQZ8y8VK8L4hKVh8v7L4v7u', 'user')
                ON CONFLICT (email) DO NOTHING;

                INSERT INTO events (name, description, venue, event_date, total_capacity, available_seats, price) VALUES 
                ('Tech Conference 2025', 'Annual technology conference', 'Convention Center', '2025-10-15 09:00:00+00', 500, 500, 99.99),
                ('Music Festival', 'Summer music festival', 'City Park', '2025-11-20 18:00:00+00', 1000, 1000, 149.99),
                ('Startup Meetup', 'Monthly startup networking', 'Co-working Space', '2025-09-25 19:00:00+00', 50, 50, 25.00)
                ON CONFLICT DO NOTHING;
            `;

            // Execute the schema SQL
            await this.pool.query(schemaSql);

            console.log('✅ Database schema created successfully');

            // Verify tables were created
            const tables = await this.pool.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            `);

            const tableNames = tables.rows.map(row => row.table_name);
            console.log('📋 Created tables:', tableNames);

            // Count records in each table
            const counts: any = {};
            for (const tableName of tableNames) {
                try {
                    const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                    counts[tableName] = parseInt(countResult.rows[0].count);
                } catch (error) {
                    counts[tableName] = 'error';
                }
            }

            res.status(200).json({
                success: true,
                message: 'Database initialized successfully',
                tables: tableNames,
                recordCounts: counts,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Database initialization error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to initialize database',
                details: error.message,
                code: 'DATABASE_INIT_ERROR'
            });
        }
    }

    /**
     * Check database status
     * GET /api/v1/database/status
     */
    async getDatabaseStatus(req: Request, res: Response): Promise<void> {
        try {
            // Test connection
            await this.pool.query('SELECT NOW()');

            // Get table information
            const tables = await this.pool.query(`
                SELECT 
                    table_name,
                    (SELECT COUNT(*) FROM information_schema.columns 
                     WHERE table_name = t.table_name AND table_schema = 'public') as column_count
                FROM information_schema.tables t
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name;
            `);

            // Get record counts
            const counts: any = {};
            for (const table of tables.rows) {
                try {
                    const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
                    counts[table.table_name] = parseInt(countResult.rows[0].count);
                } catch (error) {
                    counts[table.table_name] = 0;
                }
            }

            res.status(200).json({
                success: true,
                database: {
                    connected: true,
                    tables: tables.rows,
                    recordCounts: counts
                },
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Database status error:', error);
            res.status(500).json({
                success: false,
                error: 'Database connection failed',
                details: error.message,
                code: 'DATABASE_CONNECTION_ERROR'
            });
        }
    }

    /**
     * Reset database (drop and recreate all tables)
     * POST /api/v1/database/reset
     */
    async resetDatabase(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔄 Starting database reset...');

            // Drop all tables
            await this.pool.query(`
                DROP TABLE IF EXISTS waitlist CASCADE;
                DROP TABLE IF EXISTS bookings CASCADE;
                DROP TABLE IF EXISTS events CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
                DROP FUNCTION IF EXISTS generate_booking_reference() CASCADE;
                DROP FUNCTION IF EXISTS set_booking_reference() CASCADE;
            `);

            console.log('✅ Dropped existing tables');

            // Recreate tables using embedded SQL
            const schemaSql = `
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

                -- Indexes for performance
                CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
                CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
                CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
                CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
                CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
                CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
                CREATE INDEX IF NOT EXISTS idx_waitlist_position ON waitlist(position);

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
                ('admin@evently.com', 'Admin User', '$2b$12$LfEvsX2Kt2Zt9qOQpJdEyeU4nPUGhkbQZ8y8VK8L4hKVh8v7L4v7u', 'admin'),
                ('user@evently.com', 'Test User', '$2b$12$LfEvsX2Kt2Zt9qOQpJdEyeU4nPUGhkbQZ8y8VK8L4hKVh8v7L4v7u', 'user')
                ON CONFLICT (email) DO NOTHING;

                INSERT INTO events (name, description, venue, event_date, total_capacity, available_seats, price) VALUES 
                ('Tech Conference 2025', 'Annual technology conference', 'Convention Center', '2025-10-15 09:00:00+00', 500, 500, 99.99),
                ('Music Festival', 'Summer music festival', 'City Park', '2025-11-20 18:00:00+00', 1000, 1000, 149.99),
                ('Startup Meetup', 'Monthly startup networking', 'Co-working Space', '2025-09-25 19:00:00+00', 50, 50, 25.00)
                ON CONFLICT DO NOTHING;
            `;
            await this.pool.query(schemaSql);

            console.log('✅ Database reset completed');

            res.status(200).json({
                success: true,
                message: 'Database reset successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            console.error('❌ Database reset error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset database',
                details: error.message,
                code: 'DATABASE_RESET_ERROR'
            });
        }
    }
}