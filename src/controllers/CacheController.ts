// src/controllers/CacheController.ts
import { Request, Response } from 'express';
import { cacheManager } from '../cache/CacheManager';
import { redis } from '../config/redis';

export class CacheController {

    /**
     * Get comprehensive cache statistics
     */
    public async getCacheStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await cacheManager.getStats();
            
            // Get Redis info
            const redisInfo = await redis.info('memory');
            const keyspaceInfo = await redis.info('keyspace');
            
            // Parse Redis memory info
            const memoryStats = this.parseRedisInfo(redisInfo);
            const keyspaceStats = this.parseRedisInfo(keyspaceInfo);
            
            res.json({
                success: true,
                data: {
                    cache_performance: {
                        hit_ratio: stats.hitRatio,
                        total_requests: stats.totalRequests,
                        cache_hits: stats.hits,
                        cache_misses: stats.misses,
                        performance_grade: this.getPerformanceGrade(stats.hitRatio)
                    },
                    memory_usage: {
                        used_memory_human: memoryStats.used_memory_human || 'N/A',
                        used_memory_peak_human: memoryStats.used_memory_peak_human || 'N/A',
                        memory_fragmentation_ratio: memoryStats.mem_fragmentation_ratio || 'N/A',
                        total_keys: stats.keys
                    },
                    keyspace_info: keyspaceStats,
                    cache_efficiency: {
                        estimated_database_queries_saved: Math.floor(stats.hits * 0.8), // Assume 80% would be DB queries
                        estimated_response_time_improvement: `${Math.round(stats.hitRatio * 0.95)}% faster`,
                        cache_size_mb: this.bytesToMB(parseInt(memoryStats.used_memory) || 0)
                    }
                },
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Cache stats error:', error instanceof Error ? error.message : String(error));
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve cache statistics'
            });
        }
    }

    /**
     * Cache warming endpoint
     */
    // Replace the warmCache method with this corrected version:
public async warmCache(req: Request, res: Response): Promise<void> {
    try {
        // Direct import to avoid circular dependency
        const { eventCache } = require('../cache/EventCache');
        
        const startTime = Date.now();
        
        console.log('🔥 Starting cache warming process...');
        
        // Warm popular events
        await eventCache.warmPopularEvents();
        
        // Warm all events list (this will trigger cache miss then cache it)
        const events = await eventCache.getAllEvents();
        
        const duration = Date.now() - startTime;
        
        console.log(`✅ Cache warming completed in ${duration}ms`);
        
        res.json({
            success: true,
            message: 'Cache warmed successfully',
            duration_ms: duration,
            warmed_items: events.length,
            actions: [
                'Warmed popular events cache',
                'Warmed events list cache',
                `Cached ${events.length} individual events`
            ]
        });

    } catch (error) {
        console.error('❌ Cache warming error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to warm cache',
            details: error instanceof Error ? error.message : String(error)
        });
    }
}



    /**
     * Cache invalidation endpoint
     */
    public async invalidateCache(req: Request, res: Response): Promise<void> {
        try {
            const { pattern, tag } = req.body;
            
            let invalidated = 0;
            const actions = [];
            
            if (pattern) {
                invalidated += await cacheManager.invalidatePattern(pattern);
                actions.push(`Invalidated pattern: ${pattern}`);
            }
            
            if (tag) {
                invalidated += await cacheManager.invalidateByTag(tag);
                actions.push(`Invalidated tag: ${tag}`);
            }
            
            if (!pattern && !tag) {
                // Invalidate common caches
                invalidated += await cacheManager.invalidateByTag('events');
                invalidated += await cacheManager.invalidateByTag('analytics');
                actions.push('Invalidated all events and analytics caches');
            }
            
            res.json({
                success: true,
                message: `Invalidated ${invalidated} cache entries`,
                invalidated_count: invalidated,
                actions
            });

        } catch (error) {
            console.error('❌ Cache invalidation error:', error instanceof Error ? error.message : String(error));
            res.status(500).json({
                success: false,
                error: 'Failed to invalidate cache'
            });
        }
    }

    /**
     * Real-time cache monitoring
     */
    public async getCacheMetrics(req: Request, res: Response): Promise<void> {
        try {
            const stats = await cacheManager.getStats();
            const currentTime = Date.now();
            
            // Simulate real-time metrics (in production, use actual metrics)
            const realtimeMetrics = {
                timestamp: currentTime,
                requests_per_second: Math.random() * 100 + 50, // Mock RPS
                cache_hit_ratio: stats.hitRatio,
                avg_response_time_ms: Math.random() * 20 + 5, // Mock response time
                active_connections: Math.floor(Math.random() * 50) + 20,
                memory_usage_percent: Math.random() * 30 + 40, // Mock memory usage
                top_cached_keys: [
                    { key: 'events:all', hits: Math.floor(Math.random() * 100), ttl: 300 },
                    { key: 'events:popular:5', hits: Math.floor(Math.random() * 50), ttl: 600 },
                    { key: 'analytics:event:*', hits: Math.floor(Math.random() * 75), ttl: 180 }
                ]
            };
            
            res.json({
                success: true,
                data: realtimeMetrics
            });

        } catch (error) {
            console.error('❌ Cache metrics error:', error instanceof Error ? error.message : String(error));
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve cache metrics'
            });
        }
    }

    // Helper methods
    private parseRedisInfo(infoString: string): any {
        const info: any = {};
        const lines = infoString.split('\r\n');
        
        for (const line of lines) {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    info[key] = value;
                }
            }
        }
        
        return info;
    }

    private getPerformanceGrade(hitRatio: number): string {
        if (hitRatio >= 90) return 'A+ (Excellent)';
        if (hitRatio >= 80) return 'A (Very Good)';
        if (hitRatio >= 70) return 'B+ (Good)';
        if (hitRatio >= 60) return 'B (Fair)';
        if (hitRatio >= 50) return 'C+ (Below Average)';
        return 'C (Needs Optimization)';
    }

    private bytesToMB(bytes: number): number {
        return Math.round((bytes / 1024 / 1024) * 100) / 100;
    }
}

export const cacheController = new CacheController();
