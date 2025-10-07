import express from 'express';
import { DatabaseInitController } from '../controllers/DatabaseInitController';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Get database pool from config
import { pool } from '../config/database';

const dbController = new DatabaseInitController(pool);

/**
 * @route POST /api/v1/database/init
 * @desc Initialize database tables and sample data
 * @access Public (for initial setup)
 */
router.post('/init', async (req, res) => {
    await dbController.initializeDatabase(req, res);
});

/**
 * @route GET /api/v1/database/status
 * @desc Get database connection status and table information
 * @access Public
 */
router.get('/status', async (req, res) => {
    await dbController.getDatabaseStatus(req, res);
});

/**
 * @route POST /api/v1/database/migrate-waitlists
 * @desc Create/update waitlists tables with correct naming
 * @access Public (for migration)
 */
router.post('/migrate-waitlists', async (req, res) => {
    try {
        console.log('🔄 Running waitlist migration...');
        
        const migrationPath = path.join(__dirname, '../database/migrations/create_waitlists_tables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        await pool.query(sql);
        
        console.log('✅ Waitlist migration completed successfully');
        
        res.json({
            success: true,
            message: 'Waitlist tables created/updated successfully',
            tables: ['waitlists', 'waitlist_promotions'],
            indexes: ['idx_waitlists_event_status', 'idx_waitlists_user_event', 'idx_waitlists_position', 'idx_waitlist_promotions_status', 'idx_waitlist_promotions_waitlist'],
            triggers: ['waitlists_updated_at', 'waitlist_promotions_updated_at']
        });
    } catch (error) {
        console.error('❌ Waitlist migration failed:', error);
        res.status(500).json({
            success: false,
            error: 'Migration failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;