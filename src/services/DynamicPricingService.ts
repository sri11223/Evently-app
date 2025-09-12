// src/services/DynamicPricingService.ts
import { db } from '../config/database';
import { cacheManager } from '../cache/CacheManager';

interface PricingFactors {
    basePrice: number;
    demandFactor: number;
    timeFactor: number;
    capacityFactor: number;
    competitorFactor: number;
    seasonalFactor: number;
}

interface PricingRecommendation {
    eventId: string;
    currentPrice: number;
    recommendedPrice: number;
    priceChange: number;
    priceChangePercent: number;
    confidence: number;
    factors: PricingFactors;
    reasoning: string[];
}

export class DynamicPricingService {
    private static instance: DynamicPricingService;

    static getInstance(): DynamicPricingService {
        if (!DynamicPricingService.instance) {
            DynamicPricingService.instance = new DynamicPricingService();
        }
        return DynamicPricingService.instance;
    }

    /**
     * Calculate dynamic pricing for an event
     */
    async calculateDynamicPrice(eventId: string): Promise<PricingRecommendation> {
        try {
            // Get event data
            const event = await this.getEventData(eventId);
            if (!event) {
                throw new Error('Event not found');
            }

            // Calculate pricing factors
            const factors = await this.calculatePricingFactors(event);
            
            // Calculate recommended price
            const recommendedPrice = this.calculateRecommendedPrice(factors);
            const currentPrice = parseFloat(event.price);
            const priceChange = recommendedPrice - currentPrice;
            const priceChangePercent = (priceChange / currentPrice) * 100;

            // Generate reasoning
            const reasoning = this.generatePricingReasoning(factors, priceChangePercent);

            // Calculate confidence based on data quality
            const confidence = this.calculateConfidence(event, factors);

            return {
                eventId,
                currentPrice,
                recommendedPrice: Math.round(recommendedPrice * 100) / 100,
                priceChange: Math.round(priceChange * 100) / 100,
                priceChangePercent: Math.round(priceChangePercent * 100) / 100,
                confidence,
                factors,
                reasoning
            };

        } catch (error) {
            console.error(`Dynamic pricing error for event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * Get pricing recommendations for all active events
     */
    async getAllPricingRecommendations(): Promise<PricingRecommendation[]> {
        const cacheKey = 'pricing:recommendations:all';
        
        return cacheManager.getOrSet(
            cacheKey,
            async () => {
                const events = await db.queryRead(`
                    SELECT id FROM events 
                    WHERE status = 'active' AND event_date > NOW()
                    ORDER BY event_date ASC
                `);

                const recommendations = await Promise.allSettled(
                    events.rows.map((event: { id: string; }) => this.calculateDynamicPrice(event.id))
                );

                return recommendations
                    .filter(result => result.status === 'fulfilled')
                    .map(result => (result as PromiseFulfilledResult<PricingRecommendation>).value);
            },
            300, // 5 minutes TTL
            ['pricing', 'events']
        );
    }

    /**
     * Apply dynamic pricing to an event
     */
    async applyDynamicPricing(eventId: string, adminUserId: string): Promise<any> {
        try {
            const recommendation = await this.calculateDynamicPrice(eventId);
            
            if (Math.abs(recommendation.priceChangePercent) < 5) {
                return {
                    success: false,
                    message: 'Price change is less than 5% - no update needed',
                    recommendation
                };
            }

            // Update event price
            const result = await db.queryWrite(`
                UPDATE events 
                SET price = $1, updated_at = NOW()
                WHERE id = $2 AND status = 'active'
                RETURNING name, price
            `, [recommendation.recommendedPrice, eventId]);

            if (result.rows.length === 0) {
                throw new Error('Event not found or not active');
            }

            // Log pricing change
            await db.queryWrite(`
                INSERT INTO pricing_history (event_id, old_price, new_price, change_reason, applied_by, applied_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            `, [
                eventId, 
                recommendation.currentPrice, 
                recommendation.recommendedPrice,
                recommendation.reasoning.join('; '),
                adminUserId
            ]);

            // Invalidate cache
            await cacheManager.invalidateByTag('events');
            await cacheManager.invalidateByTag('pricing');

            console.log(`💰 Dynamic pricing applied to ${result.rows[0].name}: $${recommendation.currentPrice} → $${recommendation.recommendedPrice}`);

            return {
                success: true,
                message: 'Dynamic pricing applied successfully',
                old_price: recommendation.currentPrice,
                new_price: recommendation.recommendedPrice,
                change_percent: recommendation.priceChangePercent,
                recommendation
            };

        } catch (error) {
            console.error(`Apply pricing error for event ${eventId}:`, error);
            throw error;
        }
    }

    /**
     * Get event data for pricing calculation
     */
    private async getEventData(eventId: string): Promise<any> {
        const result = await db.queryRead(`
            SELECT 
                e.*,
                COUNT(b.id) as total_bookings,
                SUM(b.quantity) as total_tickets_sold,
                AVG(b.total_amount / b.quantity) as avg_ticket_price
            FROM events e
            LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
            WHERE e.id = $1 AND e.status = 'active'
            GROUP BY e.id
        `, [eventId]);

        return result.rows[0] || null;
    }

    /**
     * Calculate all pricing factors
     */
    private async calculatePricingFactors(event: any): Promise<PricingFactors> {
        const basePrice = parseFloat(event.price);
        
        // Demand Factor (based on booking velocity)
        const demandFactor = await this.calculateDemandFactor(event);
        
        // Time Factor (closer to event = higher price)
        const timeFactor = this.calculateTimeFactor(event.event_date);
        
        // Capacity Factor (less availability = higher price)
        const capacityFactor = this.calculateCapacityFactor(
            event.available_seats, 
            event.total_capacity
        );
        
        // Competitor Factor (simulated)
        const competitorFactor = await this.calculateCompetitorFactor(event);
        
        // Seasonal Factor (time of year, day of week)
        const seasonalFactor = this.calculateSeasonalFactor(event.event_date);

        return {
            basePrice,
            demandFactor,
            timeFactor,
            capacityFactor,
            competitorFactor,
            seasonalFactor
        };
    }

    /**
     * Calculate demand factor based on booking velocity
     */
    private async calculateDemandFactor(event: any): Promise<number> {
        const recentBookingsResult = await db.queryRead(`
            SELECT COUNT(*) as recent_bookings
            FROM bookings 
            WHERE event_id = $1 
            AND status = 'confirmed'
            AND created_at > NOW() - INTERVAL '24 hours'
        `, [event.id]);

        const recentBookings = parseInt(recentBookingsResult.rows[0]?.recent_bookings || '0');
        
        // High demand if >5 bookings in last 24h
        if (recentBookings >= 10) return 1.3; // +30%
        if (recentBookings >= 5) return 1.15;  // +15%
        if (recentBookings >= 2) return 1.05;  // +5%
        return 0.95; // -5% for low demand
    }

    /**
     * Calculate time factor (urgency)
     */
    private calculateTimeFactor(eventDate: string): number {
        const now = new Date();
        const eventTime = new Date(eventDate);
        const daysUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

        if (daysUntilEvent <= 1) return 1.5;   // Day of event: +50%
        if (daysUntilEvent <= 3) return 1.25;  // 3 days: +25%
        if (daysUntilEvent <= 7) return 1.1;   // Week: +10%
        if (daysUntilEvent <= 30) return 1.0;  // Month: normal
        return 0.9; // Far future: -10%
    }

    /**
     * Calculate capacity factor (scarcity)
     */
    private calculateCapacityFactor(availableSeats: number, totalCapacity: number): number {
        const utilizationRate = (totalCapacity - availableSeats) / totalCapacity;
        
        if (utilizationRate >= 0.9) return 1.4;   // 90%+ sold: +40%
        if (utilizationRate >= 0.8) return 1.2;   // 80%+ sold: +20%
        if (utilizationRate >= 0.6) return 1.1;   // 60%+ sold: +10%
        if (utilizationRate >= 0.4) return 1.0;   // 40%+ sold: normal
        return 0.9; // Low utilization: -10%
    }

    /**
     * Calculate competitor factor (market positioning)
     */
    private async calculateCompetitorFactor(event: any): Promise<number> {
        // Simulate competitor analysis (in real system, would integrate with external APIs)
        const eventType = event.name.toLowerCase();
        
        if (eventType.includes('conference') || eventType.includes('tech')) {
            return 1.1; // Tech events command premium
        }
        if (eventType.includes('music') || eventType.includes('festival')) {
            return 1.05; // Entertainment slight premium
        }
        if (eventType.includes('meetup') || eventType.includes('networking')) {
            return 0.95; // Networking events lower price
        }
        
        return 1.0; // Default
    }

    /**
     * Calculate seasonal factor
     */
    private calculateSeasonalFactor(eventDate: string): number {
        const eventTime = new Date(eventDate);
        const dayOfWeek = eventTime.getDay();
        const month = eventTime.getMonth();
        
        let factor = 1.0;
        
        // Weekend premium
        if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday/Saturday
            factor *= 1.1;
        }
        
        // Holiday season premium
        if (month === 11 || month === 0) { // December/January
            factor *= 1.05;
        }
        
        // Summer events (Jun-Aug)
        if (month >= 5 && month <= 7) {
            factor *= 1.03;
        }
        
        return factor;
    }

    /**
     * Calculate final recommended price
     */
    private calculateRecommendedPrice(factors: PricingFactors): number {
        return factors.basePrice * 
               factors.demandFactor * 
               factors.timeFactor * 
               factors.capacityFactor * 
               factors.competitorFactor * 
               factors.seasonalFactor;
    }

    /**
     * Generate human-readable reasoning
     */
    private generatePricingReasoning(factors: PricingFactors, priceChangePercent: number): string[] {
        const reasoning = [];
        
        if (factors.demandFactor > 1.1) {
            reasoning.push('High recent booking activity detected');
        } else if (factors.demandFactor < 0.95) {
            reasoning.push('Low booking velocity - price reduction recommended');
        }
        
        if (factors.timeFactor > 1.2) {
            reasoning.push('Event is imminent - urgency premium applied');
        }
        
        if (factors.capacityFactor > 1.3) {
            reasoning.push('Event is nearly sold out - scarcity premium');
        }
        
        if (factors.seasonalFactor > 1.05) {
            reasoning.push('Premium time/season for events');
        }
        
        if (Math.abs(priceChangePercent) < 5) {
            reasoning.push('Market conditions stable - minimal price adjustment needed');
        }
        
        return reasoning.length > 0 ? reasoning : ['Standard market pricing applies'];
    }

    /**
     * Calculate confidence score
     */
    private calculateConfidence(event: any, factors: PricingFactors): number {
        let confidence = 0.5; // Base confidence
        
        // More bookings = higher confidence
        const totalBookings = parseInt(event.total_bookings || '0');
        if (totalBookings >= 10) confidence += 0.3;
        else if (totalBookings >= 5) confidence += 0.2;
        else if (totalBookings >= 1) confidence += 0.1;
        
        // Event age (older events have more data)
        const eventAge = Date.now() - new Date(event.created_at).getTime();
        const daysOld = eventAge / (1000 * 60 * 60 * 24);
        if (daysOld >= 30) confidence += 0.1;
        
        // Constrain to 0-1 range
        return Math.min(1.0, Math.max(0.1, confidence));
    }
}

export const dynamicPricingService = DynamicPricingService.getInstance();
