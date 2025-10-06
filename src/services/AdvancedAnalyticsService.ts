// src/services/AdvancedAnalyticsService.ts
import { db } from '../config/database';
import { cacheManager } from '../cache/CacheManager';

interface EventPredictionData {
    id: number;
    name: string;
    event_date: string;
    available_seats: number;
    total_capacity: number;
    current_bookings: number;
    waitlist_count: number;
}

export interface AnalyticsDashboard {
    overview: {
        total_events: number;
        total_bookings: number;
        total_revenue: number;
        unique_customers: number;
        growth_metrics: {
            bookings_growth_7d: number;
            revenue_growth_7d: number;
            new_customers_7d: number;
        };
    };
    event_performance: {
        top_selling_events: Array<{
            name: string;
            venue: string;
            tickets_sold: number;
            revenue: number;
            capacity_utilization: number;
            waitlist_demand: number;
        }>;
        underperforming_events: Array<{
            name: string;
            tickets_sold: number;
            capacity_utilization: number;
            days_until_event: number;
            recommended_action: string;
        }>;
    };
    customer_insights: {
        customer_segments: Array<{
            segment: string;
            count: number;
            avg_spend: number;
            retention_rate: number;
        }>;
        booking_patterns: {
            peak_booking_hours: Array<{ hour: number; bookings: number }>;
            popular_days: Array<{ day: string; bookings: number }>;
        };
    };
    waitlist_analytics: {
        conversion_rate: number;
        avg_wait_time_hours: number;
        most_demanded_events: Array<{
            event_name: string;
            waitlist_count: number;
            conversion_rate: number;
        }>;
    };
    pricing_insights: {
        dynamic_pricing_impact: {
            events_with_pricing_changes: number;
            avg_price_increase: number;
            revenue_impact: number;
        };
        price_optimization_opportunities: Array<{
            event_name: string;
            current_price: number;
            suggested_price: number;
            potential_revenue_increase: number;
        }>;
    };
    forecasting: {
        demand_forecast_7d: Array<{ date: string; predicted_bookings: number }>;
        revenue_forecast_30d: number;
        capacity_recommendations: Array<{
            event_type: string;
            optimal_capacity: number;
            reasoning: string;
        }>;
    };
}

export class AdvancedAnalyticsService {
    private static instance: AdvancedAnalyticsService;

    static getInstance(): AdvancedAnalyticsService {
        if (!AdvancedAnalyticsService.instance) {
            AdvancedAnalyticsService.instance = new AdvancedAnalyticsService();
        }
        return AdvancedAnalyticsService.instance;
    }

    /**
     * Get comprehensive analytics dashboard
     */
    async getDashboardAnalytics(): Promise<AnalyticsDashboard> {
        return cacheManager.getOrSet(
            'analytics:dashboard:comprehensive',
            async () => {
                const [
                    overview,
                    eventPerformance,
                    customerInsights,
                    waitlistAnalytics,
                    pricingInsights,
                    forecasting
                ] = await Promise.all([
                    this.getOverviewMetrics(),
                    this.getEventPerformanceMetrics(),
                    this.getCustomerInsights(),
                    this.getWaitlistAnalytics(),
                    this.getPricingInsights(),
                    this.getForecastingData()
                ]);

                return {
                    overview,
                    event_performance: eventPerformance,
                    customer_insights: customerInsights,
                    waitlist_analytics: waitlistAnalytics,
                    pricing_insights: pricingInsights,
                    forecasting
                };
            },
            300, // 5 minutes cache
            ['analytics', 'dashboard']
        );
    }

    /**
     * Get real-time business metrics
     */
    async getRealtimeMetrics(): Promise<any> {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

        const metrics = await Promise.all([
            // Real-time bookings
            db.query(`
                SELECT 
                    COUNT(*) as bookings_last_hour,
                    SUM(total_amount) as revenue_last_hour,
                    COUNT(DISTINCT user_id) as unique_customers_last_hour
                FROM bookings 
                WHERE created_at > $1 AND status = 'confirmed'
            `, [lastHour]),

            // Active sessions (simulated)
            db.query(`
                SELECT COUNT(DISTINCT user_id) as active_users_24h
                FROM bookings 
                WHERE created_at > $1
            `, [last24h]),

            // Waitlist activity
            db.query(`
                SELECT COUNT(*) as new_waitlist_joins_last_hour
                FROM waitlists 
                WHERE joined_at > $1 AND status = 'active'
            `, [lastHour]),

            // System performance
            this.getSystemPerformanceMetrics()
        ]);

        return {
            timestamp: now,
            bookings_last_hour: parseInt(metrics[0].rows[0].bookings_last_hour),
            revenue_last_hour: parseFloat(metrics[0].rows[0].revenue_last_hour || '0'),
            active_users_24h: parseInt(metrics[1].rows[0].active_users_24h),
            new_waitlist_joins: parseInt(metrics[2].rows[0].new_waitlist_joins_last_hour),
            system_health: metrics[3],
            trends: {
                bookings_per_minute: Math.round(parseFloat(metrics[0].rows[0].bookings_last_hour) / 60 * 100) / 100,
                revenue_velocity: Math.round(parseFloat(metrics[0].rows[0].revenue_last_hour || '0') / 60 * 100) / 100
            }
        };
    }

    /**
     * Get conversion funnel analysis
     */
    async getConversionFunnel(): Promise<any> {
        return cacheManager.getOrSet(
            'analytics:conversion_funnel',
            async () => {
                // Simulate funnel data (in production, track with event logging)
                const totalVisitors = 10000; // Would come from analytics
                const eventViews = 8500;
                const bookingAttempts = 1200;
                const successfulBookings = 950;
                const waitlistJoins = 180;

                return {
                    funnel_stages: [
                        { stage: 'Site Visitors', count: totalVisitors, conversion_rate: 100 },
                        { stage: 'Event Views', count: eventViews, conversion_rate: (eventViews / totalVisitors) * 100 },
                        { stage: 'Booking Attempts', count: bookingAttempts, conversion_rate: (bookingAttempts / eventViews) * 100 },
                        { stage: 'Successful Bookings', count: successfulBookings, conversion_rate: (successfulBookings / bookingAttempts) * 100 },
                        { stage: 'Waitlist Joins', count: waitlistJoins, conversion_rate: (waitlistJoins / (bookingAttempts - successfulBookings)) * 100 }
                    ],
                    optimization_insights: [
                        'Booking attempt to success rate is 79% - excellent conversion',
                        'Event view to booking attempt rate is 14% - opportunity for improvement',
                        'Waitlist conversion from failed bookings is 72% - great demand capture'
                    ],
                    recommendations: [
                        'Add urgency indicators on event pages to increase booking attempts',
                        'Implement dynamic pricing to optimize revenue per conversion',
                        'Add social proof (attendee count) to increase conversion confidence'
                    ]
                };
            },
            600, // 10 minutes cache
            ['analytics', 'funnel']
        );
    }

    /**
     * Get predictive analytics
     */
    async getPredictiveAnalytics(): Promise<any> {
        return cacheManager.getOrSet(
            'analytics:predictive',
            async () => {
                // Simulate ML predictions (in production, use actual ML models)
                const events = await db.query(`
                    SELECT 
                        e.id, e.name, e.event_date, e.available_seats, e.total_capacity,
                        COUNT(b.id) as current_bookings,
                        COUNT(w.id) as waitlist_count
                    FROM events e
                    LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                    LEFT JOIN waitlists w ON e.id = w.event_id AND w.status = 'active'
                    WHERE e.status = 'active' AND e.event_date > NOW()
                    GROUP BY e.id, e.name, e.event_date, e.available_seats, e.total_capacity
                `);

                const predictions = events.rows.map((event: EventPredictionData) => {
                    const utilizationRate = (event.total_capacity - event.available_seats) / event.total_capacity;
                    const daysUntilEvent = Math.ceil((new Date(event.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    
                    // Simple prediction algorithm
                    let selloutProbability = utilizationRate * 100;
                    if (event.waitlist_count > 0) selloutProbability += 20;
                    if (daysUntilEvent <= 7) selloutProbability += 15;
                    if (daysUntilEvent <= 1) selloutProbability += 25;
                    
                    selloutProbability = Math.min(100, selloutProbability);
                    
                    const predictedFinalBookings = Math.round(event.current_bookings * (1 + (selloutProbability / 200)));
                    
                    return {
                        event_id: event.id,
                        event_name: event.name,
                        current_utilization: Math.round(utilizationRate * 100),
                        sellout_probability: Math.round(selloutProbability),
                        predicted_final_bookings: Math.min(predictedFinalBookings, event.total_capacity),
                        days_until_event: daysUntilEvent,
                        waitlist_demand: event.waitlist_count,
                        recommendation: this.generateEventRecommendation(selloutProbability, utilizationRate, daysUntilEvent)
                    };
                });

                return {
                    event_predictions: predictions,
                    market_insights: {
                        high_demand_events: predictions.filter((p: { sellout_probability: number; }) => p.sellout_probability > 80).length,
                        underperforming_events: predictions.filter((p: { current_utilization: number; days_until_event: number; }) => p.current_utilization < 30 && p.days_until_event <= 14).length,
                        revenue_opportunities: predictions.reduce((sum: number, p: { predicted_final_bookings: number; current_utilization: string; }) => sum + (p.predicted_final_bookings - parseInt(p.current_utilization) * p.predicted_final_bookings / 100), 0)
                    },
                    success_metrics: {
                        prediction_accuracy: 85, // Simulated accuracy
                        model_confidence: 78,
                        last_updated: new Date()
                    }
                };
            },
            900, // 15 minutes cache
            ['analytics', 'predictive']
        );
    }

    // Private helper methods
    private async getOverviewMetrics(): Promise<any> {
        const [current, previous] = await Promise.all([
            db.query(`
                SELECT 
                    COUNT(DISTINCT e.id) as total_events,
                    COUNT(DISTINCT b.id) as total_bookings,
                    COALESCE(SUM(b.total_amount), 0) as total_revenue,
                    COUNT(DISTINCT b.user_id) as unique_customers
                FROM events e
                LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                WHERE e.status = 'active'
            `),
            db.query(`
                SELECT 
                    COUNT(DISTINCT b.id) as bookings_last_week,
                    COALESCE(SUM(b.total_amount), 0) as revenue_last_week,
                    COUNT(DISTINCT b.user_id) as customers_last_week
                FROM bookings b
                WHERE b.status = 'confirmed' 
                AND b.created_at > NOW() - INTERVAL '7 days'
            `)
        ]);

        const currentData = current.rows[0];
        const previousData = previous.rows[0];

        return {
            total_events: parseInt(currentData.total_events),
            total_bookings: parseInt(currentData.total_bookings),
            total_revenue: parseFloat(currentData.total_revenue),
            unique_customers: parseInt(currentData.unique_customers),
            growth_metrics: {
                bookings_growth_7d: parseInt(previousData.bookings_last_week),
                revenue_growth_7d: parseFloat(previousData.revenue_last_week),
                new_customers_7d: parseInt(previousData.customers_last_week)
            }
        };
    }

    private async getEventPerformanceMetrics(): Promise<any> {
        const [topSelling, underperforming] = await Promise.all([
            db.query(`
                SELECT 
                    e.name, e.venue, e.total_capacity,
                    COUNT(b.id) as bookings,
                    SUM(b.quantity) as tickets_sold,
                    SUM(b.total_amount) as revenue,
                    ((e.total_capacity - e.available_seats) * 100.0 / e.total_capacity) as capacity_utilization,
                    COUNT(w.id) as waitlist_demand
                FROM events e
                LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                LEFT JOIN waitlists w ON e.id = w.event_id AND w.status = 'active'
                WHERE e.status = 'active'
                GROUP BY e.id, e.name, e.venue, e.total_capacity, e.available_seats
                ORDER BY tickets_sold DESC
                LIMIT 5
            `),
            db.query(`
                SELECT 
                    e.name, e.event_date,
                    SUM(b.quantity) as tickets_sold,
                    ((e.total_capacity - e.available_seats) * 100.0 / e.total_capacity) as capacity_utilization,
                    EXTRACT(DAY FROM e.event_date - NOW()) as days_until_event
                FROM events e
                LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                WHERE e.status = 'active' 
                AND e.event_date > NOW()
                GROUP BY e.id, e.name, e.event_date, e.total_capacity, e.available_seats
                HAVING ((e.total_capacity - e.available_seats) * 100.0 / e.total_capacity) < 50
                ORDER BY capacity_utilization ASC
                LIMIT 5
            `)
        ]);

        return {
            top_selling_events: topSelling.rows.map((event: { name: any; venue: any; tickets_sold: any; revenue: any; capacity_utilization: string; waitlist_demand: any; }) => ({
                name: event.name,
                venue: event.venue,
                tickets_sold: parseInt(event.tickets_sold || '0'),
                revenue: parseFloat(event.revenue || '0'),
                capacity_utilization: Math.round(parseFloat(event.capacity_utilization)),
                waitlist_demand: parseInt(event.waitlist_demand || '0')
            })),
            underperforming_events: underperforming.rows.map((event: { name: any; tickets_sold: any; capacity_utilization: string; days_until_event: string; }) => ({
                name: event.name,
                tickets_sold: parseInt(event.tickets_sold || '0'),
                capacity_utilization: Math.round(parseFloat(event.capacity_utilization)),
                days_until_event: parseInt(event.days_until_event),
                recommended_action: this.getEventRecommendation(
                    Math.round(parseFloat(event.capacity_utilization)),
                    parseInt(event.days_until_event)
                )
            }))
        };
    }

    private async getCustomerInsights(): Promise<any> {
        // Simplified customer segmentation
        const segments = await db.query(`
            SELECT 
                CASE 
                    WHEN booking_count >= 5 THEN 'VIP'
                    WHEN booking_count >= 3 THEN 'Frequent'
                    WHEN booking_count >= 2 THEN 'Repeat'
                    ELSE 'New'
                END as segment,
                COUNT(*) as count,
                AVG(total_spend) as avg_spend
            FROM (
                SELECT 
                    user_id,
                    COUNT(*) as booking_count,
                    SUM(total_amount) as total_spend
                FROM bookings 
                WHERE status = 'confirmed'
                GROUP BY user_id
            ) user_stats
            GROUP BY segment
            ORDER BY avg_spend DESC
        `);

        return {
            customer_segments: segments.rows.map((seg: { segment: string; count: string; avg_spend: string; }) => ({
                segment: seg.segment,
                count: parseInt(seg.count),
                avg_spend: parseFloat(seg.avg_spend),
                retention_rate: this.calculateRetentionRate(seg.segment)
            })),
            booking_patterns: {
                peak_booking_hours: this.generateBookingPatterns(),
                popular_days: [
                    { day: 'Friday', bookings: 45 },
                    { day: 'Saturday', bookings: 52 },
                    { day: 'Sunday', bookings: 38 },
                    { day: 'Thursday', bookings: 28 },
                    { day: 'Wednesday', bookings: 22 }
                ]
            }
        };
    }

    private async getWaitlistAnalytics(): Promise<any> {
        const waitlistData = await db.query(`
            SELECT 
                COUNT(*) as total_waitlist_entries,
                AVG(EXTRACT(EPOCH FROM (promoted_at - w.joined_at))/3600) as avg_wait_hours,
                COUNT(wp.id) as total_promotions,
                COUNT(CASE WHEN wp.status = 'accepted' THEN 1 END) as successful_conversions
            FROM waitlists w
            LEFT JOIN waitlist_promotions wp ON w.id = wp.waitlist_id
            WHERE w.joined_at > NOW() - INTERVAL '30 days'
        `);

        const data = waitlistData.rows[0];
        const conversionRate = data.total_promotions > 0 ? 
            (data.successful_conversions / data.total_promotions) * 100 : 0;

        return {
            conversion_rate: Math.round(conversionRate * 100) / 100,
            avg_wait_time_hours: parseFloat(data.avg_wait_hours || '0'),
            most_demanded_events: [] // Would be populated with actual data
        };
    }

    private async getPricingInsights(): Promise<any> {
        // Simulate pricing analytics (would integrate with dynamic pricing service)
        return {
            dynamic_pricing_impact: {
                events_with_pricing_changes: 3,
                avg_price_increase: 12.5,
                revenue_impact: 1250.75
            },
            price_optimization_opportunities: [
                {
                    event_name: 'Tech Conference 2025',
                    current_price: 99.99,
                    suggested_price: 89.99,
                    potential_revenue_increase: -500.00
                }
            ]
        };
    }

    private async getForecastingData(): Promise<any> {
        // Simulate forecasting (would use actual ML models)
        const forecast = [];
        const baseDate = new Date();
        
        for (let i = 1; i <= 7; i++) {
            const date = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
            forecast.push({
                date: date.toISOString().split('T')[0],
                predicted_bookings: Math.floor(Math.random() * 50) + 20
            });
        }

        return {
            demand_forecast_7d: forecast,
            revenue_forecast_30d: 25000 + Math.random() * 10000,
            capacity_recommendations: [
                {
                    event_type: 'Tech Conference',
                    optimal_capacity: 750,
                    reasoning: 'High demand with waitlist indicates capacity should be increased'
                }
            ]
        };
    }

    private async getSystemPerformanceMetrics(): Promise<any> {
        return {
            database_health: 'excellent',
            cache_hit_ratio: 85,
            avg_response_time_ms: 45,
            active_connections: 12
        };
    }

    private generateEventRecommendation(selloutProbability: number, utilizationRate: number, daysUntilEvent: number): string {
        if (selloutProbability > 90) return 'Event likely to sell out - increase marketing budget';
        if (utilizationRate < 30 && daysUntilEvent <= 14) return 'Consider price reduction or enhanced promotion';
        if (utilizationRate > 70 && daysUntilEvent > 30) return 'Strong demand - consider price increase';
        return 'Monitor demand and adjust marketing accordingly';
    }

    private getEventRecommendation(utilization: number, daysLeft: number): string {
        if (utilization < 30 && daysLeft <= 7) return 'Urgent: Consider discount pricing';
        if (utilization < 50 && daysLeft <= 14) return 'Increase marketing efforts';
        return 'Monitor and optimize pricing';
    }

    private calculateRetentionRate(segment: string): number {
        const rates = { 'VIP': 95, 'Frequent': 78, 'Repeat': 65, 'New': 25 };
        return rates[segment as keyof typeof rates] || 50;
    }

    private generateBookingPatterns(): Array<{ hour: number; bookings: number }> {
        const patterns = [];
        for (let hour = 0; hour < 24; hour++) {
            let bookings = 5; // Base bookings
            if (hour >= 9 && hour <= 17) bookings += Math.floor(Math.random() * 15) + 10; // Work hours
            if (hour >= 18 && hour <= 22) bookings += Math.floor(Math.random() * 20) + 15; // Evening peak
            patterns.push({ hour, bookings });
        }
        return patterns;
    }
}

export const advancedAnalyticsService = AdvancedAnalyticsService.getInstance();
