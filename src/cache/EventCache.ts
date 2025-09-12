// src/cache/EventCache.ts
import { cacheManager } from './CacheManager';
import { db } from '../config/database';

export class EventCacheService {
    private static instance: EventCacheService;

    static getInstance(): EventCacheService {
        if (!EventCacheService.instance) {
            EventCacheService.instance = new EventCacheService();
        }
        return EventCacheService.instance;
    }

    /**
     * Get all events with intelligent caching
     */
    async getAllEvents(): Promise<any[]> {
        return cacheManager.getOrSet(
            'events:all',
            async () => {
                console.log('🔄 Cache miss - fetching all events from database');
                const result = await db.queryRead(`
                    SELECT 
                        id, name, description, venue, event_date,
                        total_capacity, available_seats, price, status,
                        created_at
                    FROM events 
                    WHERE status = 'active'
                    ORDER BY event_date ASC
                `);
                return result.rows;
            },
            300, // 5 minutes TTL
            ['events', 'events:list']
        );
    }

    /**
     * Get single event with caching
     */
    async getEventById(eventId: string): Promise<any | null> {
        return cacheManager.getOrSet(
            `event:${eventId}`,
            async () => {
                console.log(`🔄 Cache miss - fetching event ${eventId} from database`);
                const result = await db.queryRead(`
                    SELECT 
                        id, name, description, venue, event_date,
                        total_capacity, available_seats, price, status,
                        version, created_at, organizer_id
                    FROM events 
                    WHERE id = $1 AND status = 'active'
                `, [eventId]);
                
                return result.rows.length > 0 ? result.rows[0] : null;
            },
            120, // 2 minutes TTL (shorter for real-time availability)
            ['events', `event:${eventId}`]
        );
    }

    /**
     * Get popular events with extended caching
     */
    async getPopularEvents(limit: number = 5): Promise<any[]> {
        return cacheManager.getOrSet(
            `events:popular:${limit}`,
            async () => {
                console.log('🔄 Cache miss - fetching popular events from database');
                const result = await db.queryRead(`
                    SELECT 
                        e.id, e.name, e.venue, e.price, e.available_seats,
                        COUNT(b.id) as booking_count,
                        SUM(b.quantity) as total_tickets_sold
                    FROM events e
                    LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                    WHERE e.status = 'active'
                    GROUP BY e.id, e.name, e.venue, e.price, e.available_seats
                    ORDER BY booking_count DESC, total_tickets_sold DESC
                    LIMIT $1
                `, [limit]);
                
                return result.rows;
            },
            600, // 10 minutes TTL (popular events change slowly)
            ['events', 'events:popular', 'analytics']
        );
    }

    /**
     * Cache event analytics
     */
    async getEventAnalytics(eventId: string): Promise<any> {
        return cacheManager.getOrSet(
            `analytics:event:${eventId}`,
            async () => {
                console.log(`🔄 Cache miss - fetching analytics for event ${eventId}`);
                const result = await db.queryRead(`
                    SELECT 
                        e.name, e.venue, e.total_capacity, e.available_seats, e.price,
                        COUNT(b.id) as total_bookings,
                        COALESCE(SUM(b.quantity), 0) as tickets_sold,
                        COALESCE(SUM(b.total_amount), 0) as revenue,
                        CASE 
                            WHEN e.total_capacity > 0 
                            THEN ((e.total_capacity - e.available_seats) * 100.0 / e.total_capacity)
                            ELSE 0 
                        END as capacity_utilization
                    FROM events e
                    LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
                    WHERE e.id = $1
                    GROUP BY e.id, e.name, e.venue, e.total_capacity, e.available_seats, e.price
                `, [eventId]);
                
                return result.rows[0] || null;
            },
            180, // 3 minutes TTL
            ['analytics', `analytics:event:${eventId}`, `event:${eventId}`]
        );
    }

    /**
     * Invalidate event-related caches
     */
    async invalidateEvent(eventId: string): Promise<void> {
        console.log(`🗑️ Invalidating cache for event: ${eventId}`);
        
        // Invalidate specific event
        await cacheManager.invalidatePattern(`event:${eventId}`);
        
        // Invalidate analytics
        await cacheManager.invalidatePattern(`analytics:event:${eventId}`);
        
        // Invalidate list views
        await cacheManager.invalidateByTag('events');
        await cacheManager.invalidateByTag('events:list');
        await cacheManager.invalidateByTag('events:popular');
    }

    /**
     * Warm cache with popular events
     */
    async warmPopularEvents(): Promise<void> {
        console.log('🔥 Warming cache with popular events');
        
        // Get list of events to warm
        const events = await this.getAllEvents(); // This will cache the list
        
        // Warm individual popular events
        const popularEvents = events.slice(0, 10); // Top 10 events
        
        const warmingTasks = popularEvents.map(event => ({
            key: `event:${event.id}`,
            generator: () => Promise.resolve(event),
            ttl: 300,
            tags: ['events', `event:${event.id}`]
        }));

        await cacheManager.warmCache(warmingTasks);
    }
}

export const eventCache = EventCacheService.getInstance();
