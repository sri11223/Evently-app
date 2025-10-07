import express from 'express';
import { DatabaseInitController } from '../controllers/DatabaseInitController';
import { Pool } from 'pg';

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
        
        // Embedded SQL to avoid file path issues in production
        const sql = `
            -- Drop old singular table if exists
            DROP TABLE IF EXISTS waitlist_promotions CASCADE;
            DROP TABLE IF EXISTS waitlist CASCADE;

            -- Create waitlists table (PLURAL - matches WaitlistManager code)
            CREATE TABLE IF NOT EXISTS waitlists (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                position INTEGER NOT NULL,
                priority_score INTEGER DEFAULT 100,
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                promoted_at TIMESTAMP WITH TIME ZONE,
                expires_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'expired', 'cancelled')),
                notification_preferences JSONB DEFAULT '{"email": true, "push": true}',
                promotion_attempts INTEGER DEFAULT 0,
                last_promotion_attempt TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(event_id, user_id)
            );

            -- Create waitlist_promotions table
            CREATE TABLE IF NOT EXISTS waitlist_promotions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                waitlist_id UUID NOT NULL REFERENCES waitlists(id) ON DELETE CASCADE,
                event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                promoted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                promotion_expires_at TIMESTAMP WITH TIME ZONE,
                booking_window_minutes INTEGER DEFAULT 10,
                status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
                booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
                notification_sent BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_waitlists_event_status ON waitlists(event_id, status);
            CREATE INDEX IF NOT EXISTS idx_waitlists_user_event ON waitlists(user_id, event_id);
            CREATE INDEX IF NOT EXISTS idx_waitlists_position ON waitlists(event_id, position, status);
            CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_status ON waitlist_promotions(status, promotion_expires_at);
            CREATE INDEX IF NOT EXISTS idx_waitlist_promotions_waitlist ON waitlist_promotions(waitlist_id);

            -- Update trigger function
            CREATE OR REPLACE FUNCTION update_waitlists_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            -- Create triggers
            DROP TRIGGER IF EXISTS waitlists_updated_at ON waitlists;
            CREATE TRIGGER waitlists_updated_at
                BEFORE UPDATE ON waitlists
                FOR EACH ROW
                EXECUTE FUNCTION update_waitlists_updated_at();

            DROP TRIGGER IF EXISTS waitlist_promotions_updated_at ON waitlist_promotions;
            CREATE TRIGGER waitlist_promotions_updated_at
                BEFORE UPDATE ON waitlist_promotions
                FOR EACH ROW
                EXECUTE FUNCTION update_waitlists_updated_at();
        `;
        
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