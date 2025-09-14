// src/controllers/DatabaseTestController.ts - Test Database Connectivity
import { Request, Response } from 'express';
import { db } from '../config/database';

export class DatabaseTestController {
    
    public async testConnection(req: Request, res: Response): Promise<void> {
        try {
            // Test basic connection
            const testResult = await db.query(`
                SELECT NOW() as current_time, version() as db_version
            `);
            
            // Get list of tables
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

    public async fixUsersTable(req: Request, res: Response): Promise<void> {
        try {
            // Add is_active column if it doesn't exist
            await db.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
            `);

            console.log('✅ Users table schema fixed - is_active column added');
            
            res.json({
                success: true,
                message: 'Users table schema fixed successfully',
                data: {
                    action: 'Added is_active column to users table',
                    columnAdded: 'is_active BOOLEAN DEFAULT true'
                }
            });
            
        } catch (error: any) {
            console.error('❌ Fix users table error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fix users table',
                details: error?.message || 'Unknown error'
            });
        }
    }
}

export const databaseTestController = new DatabaseTestController();