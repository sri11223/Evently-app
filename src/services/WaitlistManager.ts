// src/services/WaitlistManager.ts
import { redis } from '../config/redis';
import { db } from '../config/database';
import { EventEmitter } from 'events';
import { notificationService } from './NotificationService';
import { emailService } from './EmailService';


export interface WaitlistEntry {
    userId: string;
    eventId: string;
    joinedAt: Date;
    priorityScore: number;
    position: number;
    estimatedWaitTime?: number;
    promotionProbability?: number;
}

export interface WaitlistStats {
    totalWaiting: number;
    averageWaitTime: number;
    promotionRate: number;
    currentPosition: number;
}

export class WaitlistManager extends EventEmitter {
    removeFromWaitlist(arg0: number, userId: string) {
        throw new Error('Method not implemented.');
    }
    // Get position in queue
    getWaitlistPosition // Get position in queue
        (arg0: number, userId: string) {
            throw new Error('Method not implemented.');
    }
    private static instance: WaitlistManager;
    
    static getInstance(): WaitlistManager {
        if (!WaitlistManager.instance) {
            WaitlistManager.instance = new WaitlistManager();
        }
        return WaitlistManager.instance;
    }

    constructor() {
        super();
        this.startWaitlistProcessor();
    }

    /**
     * Add user to waitlist
     */
    async joinWaitlist(eventId: string, userId: string, userTier: string = 'standard'): Promise<WaitlistEntry> {
        try {
            // Check if event is full
            const event = await this.getEventAvailability(eventId);
            if (event.available_seats > 0) {
                throw new Error('Event still has available seats. Please book directly.');
            }
    
            // Check if user already on waitlist
            const existingEntry = await this.getUserWaitlistPosition(eventId, userId);
            if (existingEntry) {
                throw new Error('User already on waitlist for this event');
            }
    
            // Calculate priority score
            const priorityScore = this.calculatePriorityScore(userTier);
            const joinedAt = new Date();
            
            // Add to Redis sorted set (score = priority + timestamp for ordering)
            const score = priorityScore * 1000000 + Date.now();
            const waitlistKey = `waitlist:${eventId}`;
            
            await redis.zadd(waitlistKey, score, userId);
            
            // Get position in queue
            const rank = await redis.zrank(waitlistKey, userId);
            if (rank === null) {
                throw new Error('Failed to retrieve user position in waitlist');
            }
            const position = rank + 1;
            
            // Store in database
            await db.queryWrite(`
                INSERT INTO waitlists (event_id, user_id, position, priority_score, joined_at, status)
                VALUES ($1, $2, $3, $4, $5, 'active')
                ON CONFLICT (event_id, user_id) 
                DO UPDATE SET 
                    position = $3,
                    priority_score = $4,
                    joined_at = $5,
                    status = 'active'
            `, [eventId, userId, position, priorityScore, joinedAt]);
    
            // Calculate estimated wait time
            const estimatedWaitTime = await this.calculateEstimatedWaitTime(eventId, position);
            const promotionProbability = await this.calculatePromotionProbability(eventId, position);
    
            const waitlistEntry: WaitlistEntry = {
                userId,
                eventId,
                joinedAt,
                priorityScore,
                position,
                estimatedWaitTime,
                promotionProbability
            };
    
            console.log(`📝 User ${userId} joined waitlist for event ${eventId} at position ${position}`);
    
            // 🔔 SEND WAITLIST CONFIRMATION NOTIFICATION
            try {
                const { notificationService } = await import('./NotificationService');
                
                // Get event details for notification
                const eventResult = await db.query(`
                    SELECT name, venue, event_date FROM events WHERE id = $1
                `, [eventId]);
                
                const eventData = eventResult.rows[0];
                const eventName = eventData?.name || 'Event';
                
                await notificationService.sendNotification({
                    type: 'waitlist_joined',
                    title: '📝 You\'re on the waitlist!',
                    message: `You've joined the waitlist for "${eventName}". You're #${position} in line with ${promotionProbability}% chance of getting a spot. We'll notify you immediately if a spot opens up!`,
                    userId: userId,
                    eventId: eventId,
                    data: {
                        eventName,
                        venue: eventData?.venue,
                        eventDate: eventData?.event_date,
                        position,
                        estimatedWaitTime,
                        promotionProbability,
                        priorityTier: userTier
                    },
                    channels: ['websocket', 'email'],
                    priority: 'medium',
                    timestamp: new Date()
                });
    
                console.log(`📧 Waitlist confirmation sent to user ${userId} for position ${position}`);
                
                // Send waitlist confirmation email
                const userResult = await db.query('SELECT email, name FROM users WHERE id = $1', [userId]);
                if (userResult.rows[0]) {
                    emailService.sendWaitlistJoined({
                        to: userResult.rows[0].email,
                        userName: userResult.rows[0].name,
                        eventName,
                        position,
                        estimatedWaitTime: estimatedWaitTime ? `${(estimatedWaitTime / 60).toFixed(1)} hours` : 'TBD'
                    }).catch(err => console.error('📧 Waitlist email failed:', err));
                }
                
            } catch (notificationError) {
                console.error('❌ Waitlist notification error:', notificationError);
                // Don't fail the waitlist join if notification fails
            }
            
            // Emit event for notifications
            this.emit('waitlist:joined', waitlistEntry);
            
            return waitlistEntry;
    
        } catch (error) {
            console.error(`Waitlist join error for event ${eventId}, user ${userId}:`, error);
            throw error;
        }
    }
    

    /**
     * Remove user from waitlist
     */
    async leaveWaitlist(eventId: string, userId: string): Promise<boolean> {
        try {
            const waitlistKey = `waitlist:${eventId}`;
            
            // Remove from Redis
            const removed = await redis.zrem(waitlistKey, userId);
            
            if (removed > 0) {
                // Update database
                await db.queryWrite(`
                    UPDATE waitlists 
                    SET status = 'cancelled', updated_at = NOW()
                    WHERE event_id = $1 AND user_id = $2 AND status = 'active'
                `, [eventId, userId]);

                // Rebalance positions
                await this.rebalanceWaitlistPositions(eventId);
                
                console.log(`❌ User ${userId} left waitlist for event ${eventId}`);
                
                this.emit('waitlist:left', { eventId, userId });
                return true;
            }
            
            return false;

        } catch (error) {
            console.error(`Waitlist leave error:`, error);
            return false;
        }
    }

    /**
     * Get user's position on waitlist
     */
    async getUserWaitlistPosition(eventId: string, userId: string): Promise<WaitlistEntry | null> {
        try {
            const waitlistKey = `waitlist:${eventId}`;
            const position = await redis.zrank(waitlistKey, userId);
            
            if (position === null) {
                return null;
            }

            // Get additional data from database
            const result = await db.query(`
                SELECT * FROM waitlists 
                WHERE event_id = $1 AND user_id = $2 AND status = 'active'
            `, [eventId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            const dbData = result.rows[0];
            const estimatedWaitTime = await this.calculateEstimatedWaitTime(eventId, position + 1);
            const promotionProbability = await this.calculatePromotionProbability(eventId, position + 1);

            return {
                userId,
                eventId,
                joinedAt: dbData.joined_at,
                priorityScore: dbData.priority_score,
                position: position + 1,
                estimatedWaitTime,
                promotionProbability
            };

        } catch (error) {
            console.error(`Get waitlist position error:`, error);
            return null;
        }
    }

    /**
     * Get waitlist statistics for event
     */
    async getWaitlistStats(eventId: string): Promise<WaitlistStats> {
        try {
            const waitlistKey = `waitlist:${eventId}`;
            const totalWaiting = await redis.zcard(waitlistKey);
            
            // Get promotion statistics
            const promotionStats = await db.query(`
                SELECT 
                    COUNT(*) as total_promotions,
                    AVG(EXTRACT(EPOCH FROM (promoted_at - joined_at))/3600) as avg_wait_hours,
                    COUNT(CASE WHEN status = 'accepted' THEN 1 END) as successful_promotions
                FROM waitlist_promotions wp
                JOIN waitlists w ON wp.waitlist_id = w.id
                WHERE wp.event_id = $1
                AND wp.promoted_at > NOW() - INTERVAL '30 days'
            `, [eventId]);

            const stats = promotionStats.rows[0];
            const promotionRate = stats.total_promotions > 0 ? 
                (parseInt(stats.successful_promotions) / parseInt(stats.total_promotions)) * 100 : 0;

            return {
                totalWaiting,
                averageWaitTime: parseFloat(stats.avg_wait_hours) || 0,
                promotionRate: Math.round(promotionRate * 100) / 100,
                currentPosition: 1
            };

        } catch (error) {
            console.error(`Get waitlist stats error:`, error);
            return {
                totalWaiting: 0,
                averageWaitTime: 0,
                promotionRate: 0,
                currentPosition: 0
            };
        }
    }

    /**
     * Process waitlist when seats become available
     */
    async processWaitlistPromotions(eventId: string, availableSeats: number): Promise<number> {
        try {
            if (availableSeats <= 0) return 0;
    
            const waitlistKey = `waitlist:${eventId}`;
            
            // Get top users from waitlist (highest priority first)
            const usersToPromote = await redis.zrevrange(waitlistKey, 0, availableSeats - 1);
            
            if (usersToPromote.length === 0) return 0;
    
            let promotedCount = 0;
            
            // Import notification service
            const { notificationService } = await import('./NotificationService');
            
            // Get event details for notification
            const eventResult = await db.query(
                'SELECT name, venue, event_date FROM events WHERE id = $1', 
                [eventId]
            );
            const eventName = eventResult.rows[0]?.name || 'Event';
            
            for (const userId of usersToPromote) {
                try {
                    // Create promotion record
                    const promotionId = await this.createWaitlistPromotion(eventId, userId);
                    
                    if (promotionId) {
                        // Remove from waitlist
                        await redis.zrem(waitlistKey, userId);
                        
                        // Update database
                        await db.queryWrite(`
                            UPDATE waitlists 
                            SET status = 'promoted', updated_at = NOW()
                            WHERE event_id = $1 AND user_id = $2 AND status = 'active'
                        `, [eventId, userId]);
    
                        // 🔔 SEND REAL-TIME NOTIFICATION
                        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
                        await notificationService.sendNotification({
                            type: 'waitlist_promoted',
                            title: '🎉 Great news! You\'re off the waitlist!',
                            message: `A spot opened up for "${eventName}"! You have 10 minutes to secure your booking before it expires.`,
                            userId: userId,
                            eventId: eventId,
                            data: { 
                                promotionId, 
                                bookingWindowMinutes: 10,
                                eventName,
                                expiresAt: expiresAt.toISOString()
                            },
                            channels: ['websocket', 'email', 'push'],
                            priority: 'urgent',
                            timestamp: new Date()
                        });
    
                        // Send urgent promotion email
                        const userResult = await db.query('SELECT email, name FROM users WHERE id = $1', [userId]);
                        if (userResult.rows[0]) {
                            emailService.sendWaitlistPromotion({
                                to: userResult.rows[0].email,
                                userName: userResult.rows[0].name,
                                eventName,
                                eventDate: eventResult.rows[0].event_date,
                                bookingWindowMinutes: 10,
                                expiresAt: expiresAt.toISOString()
                            }).catch(err => console.error('📧 Promotion email failed:', err));
                        }
    
                        promotedCount++;
                        
                        console.log(`🎉 Promoted user ${userId} from waitlist for event ${eventId} with notification`);
                        
                        // Emit promotion event
                        this.emit('waitlist:promoted', { 
                            eventId, 
                            userId, 
                            promotionId,
                            bookingWindowMinutes: 10 
                        });
                    }
                    
                } catch (error) {
                    console.error(`Error promoting user ${userId}:`, error);
                }
            }
    
            // Rebalance remaining positions
            if (promotedCount > 0) {
                await this.rebalanceWaitlistPositions(eventId);
            }
    
            console.log(`✅ Promoted ${promotedCount} users from waitlist for event ${eventId}`);
            return promotedCount;
    
        } catch (error) {
            console.error(`Process waitlist promotions error:`, error);
            return 0;
        }
    }
    

    // Private helper methods
    private calculatePriorityScore(userTier: string): number {
        const tierScores = {
            'premium': 200,
            'gold': 150,
            'silver': 120,
            'standard': 100,
            'new': 80
        };
        
        return tierScores[userTier as keyof typeof tierScores] || 100;
    }

    private async calculateEstimatedWaitTime(eventId: string, position: number): Promise<number> {
        // Simplified estimation - in production, use historical data
        const avgPromotionRate = 2; // 2 promotions per hour
        const estimatedHours = position / avgPromotionRate;
        return Math.max(0.5, estimatedHours); // Minimum 30 minutes
    }

    private async calculatePromotionProbability(eventId: string, position: number): Promise<number> {
        // Simple probability calculation - in production, use ML models
        const maxReasonablePosition = 50;
        const probability = Math.max(0, (maxReasonablePosition - position) / maxReasonablePosition);
        return Math.round(probability * 100);
    }

    private async getEventAvailability(eventId: string): Promise<any> {
        const result = await db.query(
            'SELECT available_seats, total_capacity FROM events WHERE id = $1',
            [eventId]
        );
        return result.rows[0];
    }

    private async createWaitlistPromotion(eventId: string, userId: string): Promise<string | null> {
        try {
            // Get waitlist entry
            const waitlistResult = await db.query(`
                SELECT id FROM waitlists 
                WHERE event_id = $1 AND user_id = $2 AND status = 'active'
            `, [eventId, userId]);

            if (waitlistResult.rows.length === 0) return null;

            const waitlistId = waitlistResult.rows[0].id;
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            const result = await db.queryWrite(`
                INSERT INTO waitlist_promotions (
                    waitlist_id, event_id, user_id, promotion_expires_at, booking_window_minutes
                ) VALUES ($1, $2, $3, $4, 10)
                RETURNING id
            `, [waitlistId, eventId, userId, expiresAt]);

            return result.rows[0].id;

        } catch (error) {
            console.error(`Create promotion error:`, error);
            return null;
        }
    }

    private async rebalanceWaitlistPositions(eventId: string): Promise<void> {
        try {
            const waitlistKey = `waitlist:${eventId}`;
            const users = await redis.zrevrange(waitlistKey, 0, -1);
            
            // Update positions in database
            for (let i = 0; i < users.length; i++) {
                await db.queryWrite(`
                    UPDATE waitlists 
                    SET position = $1, updated_at = NOW()
                    WHERE event_id = $2 AND user_id = $3 AND status = 'active'
                `, [i + 1, eventId, users[i]]);
            }

        } catch (error) {
            console.error(`Rebalance positions error:`, error);
        }
    }

    /**
     * Background processor for waitlist management
     */
    private startWaitlistProcessor(): void {
        // Process expired promotions every minute
        setInterval(async () => {
            try {
                await this.processExpiredPromotions();
            } catch (error) {
                console.error('Waitlist processor error:', error);
            }
        }, 60000);

        console.log('🔄 Waitlist processor started');
    }

    private async processExpiredPromotions(): Promise<void> {
        const expiredPromotions = await db.query(`
            SELECT event_id, user_id, id
            FROM waitlist_promotions 
            WHERE status = 'pending' 
            AND promotion_expires_at < NOW()
        `);

        for (const promotion of expiredPromotions.rows) {
            // Mark promotion as expired
            await db.queryWrite(`
                UPDATE waitlist_promotions 
                SET status = 'expired', updated_at = NOW()
                WHERE id = $1
            `, [promotion.id]);

            console.log(`⏰ Promotion expired for user ${promotion.user_id}, event ${promotion.event_id}`);
            
            // Emit event for cleanup
            this.emit('promotion:expired', promotion);
        }
    }
}

export const waitlistManager = WaitlistManager.getInstance();
