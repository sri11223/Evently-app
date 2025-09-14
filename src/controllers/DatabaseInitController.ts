import { Request, Response } from 'express';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

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

            // Read the schema file
            const schemaPath = path.join(__dirname, '../database/schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');

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

            // Recreate tables
            const schemaPath = path.join(__dirname, '../database/schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
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