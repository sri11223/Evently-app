// src/controllers/DatabaseTestController.ts - Test Database Connectivity
import { Request, Response } from 'express';
import { db } from '../config/database';

export class DatabaseTestController {
    
    public async testConnection(req: Request, res: Response): Promise<void> {
        try {
            // Test basic connection
            const testResult = await db.query('SELECT NOW() as current_time, version() as db_version');
            
            // Check if tables exist
            const tablesResult = await db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            `);
            
            const tables = tablesResult.rows.map((row: any) => row.table_name);
            
            res.json({
                success: true,
                message: 'Database connection test successful',
                data: {
                    timestamp: testResult.rows[0].current_time,
                    version: testResult.rows[0].db_version,
                    tablesFound: tables,
                    tablesCount: tables.length
                }
            });
            
        } catch (error: any) {
            console.error('❌ Database test error:', error);
            res.status(500).json({
                success: false,
                error: 'Database connection test failed',
                details: error?.message || 'Unknown error'
            });
        }
    }

    public async describeEventsTable(req: Request, res: Response): Promise<void> {
        try {
            const columnsResult = await db.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = 'events' 
                ORDER BY ordinal_position
            `);

            const sampleDataResult = await db.query(`
                SELECT * FROM events LIMIT 2
            `);
            
            res.json({
                success: true,
                message: 'Events table description',
                data: {
                    columns: columnsResult.rows,
                    sampleData: sampleDataResult.rows,
                    columnCount: columnsResult.rows.length,
                    recordCount: sampleDataResult.rows.length
                }
            });
            
        } catch (error: any) {
            console.error('❌ Describe table error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to describe events table',
                details: error?.message || 'Unknown error'
            });
        }
    }

    public async testEventQuery(req: Request, res: Response): Promise<void> {
        try {
            console.log('🔍 Testing direct events query...');
            const result = await db.query(`
                SELECT 
                    id, name, venue, event_date,
                    total_capacity, available_seats, price,
                    created_at
                FROM events 
                ORDER BY event_date ASC
            `);
            
            console.log(`✅ Found ${result.rows.length} events directly from database`);
            
            res.json({
                success: true,
                message: 'Direct events query successful',
                data: {
                    events: result.rows,
                    count: result.rows.length,
                    cached: false
                }
            });
            
        } catch (error: any) {
            console.error('❌ Direct events query error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to query events directly',
                details: error?.message || 'Unknown error'
            });
        }
    }

    public async initializeData(req: Request, res: Response): Promise<void> {
        try {
            // Create tables if they don't exist
            await db.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) DEFAULT 'user',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS events (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    venue VARCHAR(255) NOT NULL,
                    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
                    total_capacity INTEGER NOT NULL,
                    available_seats INTEGER NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS bookings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id),
                    event_id UUID REFERENCES events(id),
                    quantity INTEGER NOT NULL,
                    total_amount DECIMAL(10,2) NOT NULL,
                    booking_reference VARCHAR(20) UNIQUE NOT NULL,
                    status VARCHAR(50) DEFAULT 'confirmed',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS waitlist (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id),
                    event_id UUID REFERENCES events(id),
                    position INTEGER NOT NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `);

            // Insert sample data that works with existing schema
            await db.query(`
                INSERT INTO users (email, name, password_hash, role) 
                VALUES 
                    ('admin@evently.com', 'Admin User', '$2b$10$hash123', 'admin'),
                    ('user1@evently.com', 'John Doe', '$2b$10$hash123', 'user'),
                    ('user2@evently.com', 'Jane Smith', '$2b$10$hash123', 'user')
                ON CONFLICT (email) DO NOTHING
            `);

            // First check what columns exist in events table
            const eventColumns = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'events' AND table_schema = 'public'
                ORDER BY ordinal_position
            `);

            console.log('Events table columns:', eventColumns.rows.map((row: any) => row.column_name));

            // Insert events based on existing schema
            await db.query(`
                INSERT INTO events (name, venue, event_date, total_capacity, available_seats, price)
                VALUES 
                    ('Tech Conference 2025', 'Convention Center', NOW() + INTERVAL '30 days', 500, 450, 99.99),
                    ('Music Festival', 'City Park Amphitheater', NOW() + INTERVAL '45 days', 1000, 850, 149.99),
                    ('Business Workshop', 'Business Center', NOW() + INTERVAL '15 days', 100, 85, 49.99),
                    ('Art Exhibition', 'Art Gallery', NOW() + INTERVAL '20 days', 200, 200, 25.00),
                    ('Food Festival', 'Downtown Square', NOW() + INTERVAL '35 days', 2000, 1800, 15.00)
            `);

            // Get counts
            const userCount = await db.query('SELECT COUNT(*) as count FROM users');
            const eventCount = await db.query('SELECT COUNT(*) as count FROM events');
            const bookingCount = await db.query('SELECT COUNT(*) as count FROM bookings');

            res.json({
                success: true,
                message: 'Database initialized successfully',
                data: {
                    tablesCreated: ['users', 'events', 'bookings', 'waitlist'],
                    recordsCreated: {
                        users: userCount.rows[0].count,
                        events: eventCount.rows[0].count,
                        bookings: bookingCount.rows[0].count
                    }
                }
            });

        } catch (error: any) {
            console.error('❌ Database initialization error:', error);
            res.status(500).json({
                success: false,
                error: 'Database initialization failed',
                details: error?.message || 'Unknown error'
            });
        }
    }
}

export const databaseTestController = new DatabaseTestController();