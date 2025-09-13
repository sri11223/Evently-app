// src/controllers/WaitlistController.ts
import { Request, Response } from 'express';
import { waitlistManager } from '../services/WaitlistManager';
import { db } from '../config/database';

export class WaitlistController {

    public async joinWaitlist(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const { user_id } = req.body;

            if (!user_id) {
                res.status(400).json({
                    success: false,
                    error: 'user_id is required'
                });
                return;
            }

            const result = await waitlistManager.joinWaitlist(eventId, user_id);

            res.status(201).json({
                success: true,
                message: 'Successfully joined waitlist',
                data: result
            });

        } catch (error: any) {
            console.error('❌ Join waitlist error:', error);
            res.status(409).json({
                success: false,
                error: error.message
            });
        }
    }

    public async leaveWaitlist(req: Request, res: Response): Promise<void> {
        try {
            const { eventId, userId } = req.params;

            const result = await waitlistManager.leaveWaitlist(eventId, userId);

            if (!result) {
                res.status(404).json({
                    success: false,
                    error: 'User not found in waitlist'
                });
                return;
            }

            res.json({
                success: true,
                message: 'Successfully left waitlist'
            });

        } catch (error: any) {
            console.error('❌ Leave waitlist error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    public async getWaitlistPosition(req: Request, res: Response): Promise<void> {
        try {
            const { eventId, userId } = req.params;

            const waitlistEntry = await waitlistManager.getUserWaitlistPosition(eventId, userId);

            if (!waitlistEntry) {
                res.status(404).json({
                    success: false,
                    error: 'User not found in waitlist'
                });
                return;
            }

            res.json({
                success: true,
                data: waitlistEntry
            });

        } catch (error: any) {
            console.error('❌ Get waitlist position error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    public async getWaitlistStats(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;

            const query = `
                SELECT 
                    COUNT(*) as total_waitlisted,
                    MIN(created_at) as oldest_entry,
                    MAX(created_at) as newest_entry
                FROM waitlist 
                WHERE event_id = $1 AND status = 'waiting'
            `;

            const result = await db.query(query, [eventId]);
            const stats = result.rows[0];

            res.json({
                success: true,
                data: {
                    event_id: eventId,
                    total_waitlisted: parseInt(stats.total_waitlisted),
                    oldest_entry: stats.oldest_entry,
                    newest_entry: stats.newest_entry
                }
            });

        } catch (error: any) {
            console.error('❌ Get waitlist stats error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    public async processWaitlist(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const { available_seats } = req.body;

            if (!available_seats || available_seats <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'available_seats must be greater than 0'
                });
                return;
            }

            const promotedCount = await waitlistManager.processWaitlistPromotions(
                eventId, 
                parseInt(available_seats)
            );

            res.json({
                success: true,
                message: 'Waitlist processed successfully',
                data: {
                    promoted_users: promotedCount,
                    available_seats_processed: parseInt(available_seats)
                }
            });

        } catch (error: any) {
            console.error('❌ Process waitlist error:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

export const waitlistController = new WaitlistController();
