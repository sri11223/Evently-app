// src/cache/CacheManager.ts
import { redis } from '../config/redis';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface CacheConfig {
    defaultTTL: number;
    compressionThreshold: number;
    prefixNamespace: string;
    maxMemoryMB: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRatio: number;
    totalRequests: number;
}

export class AdvancedCacheManager extends EventEmitter {
    private static instance: AdvancedCacheManager;
    private stats: Map<string, { hits: number; misses: number }> = new Map();
    private config: CacheConfig;
    private compressionEnabled: boolean = true;

    constructor(config: CacheConfig) {
        super();
        this.config = config;
        this.setupMetrics();
        console.log('📦 Advanced Cache Manager initialized');
    }

    static getInstance(config?: CacheConfig): AdvancedCacheManager {
        if (!AdvancedCacheManager.instance && config) {
            AdvancedCacheManager.instance = new AdvancedCacheManager(config);
        }
        return AdvancedCacheManager.instance;
    }

    /**
     * Intelligent get with compression support
     */
    async get<T>(key: string, tags: string[] = []): Promise<T | null> {
        const fullKey = this.buildKey(key);
        const startTime = Date.now();

        try {
            const cached = await redis.get(fullKey);
            
            if (cached === null) {
                this.recordMiss(key);
                this.emit('cache:miss', { key, tags, duration: Date.now() - startTime });
                return null;
            }

            this.recordHit(key);
            
            // Handle compressed data
            let data = cached;
            if (cached.startsWith('GZIP:')) {
                data = this.decompress(cached.substring(5));
            }
            
            const result = JSON.parse(data);
            this.emit('cache:hit', { key, tags, duration: Date.now() - startTime });
            
            return result;
            
        } catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            this.recordMiss(key);
            return null;
        }
    }

    /**
     * Smart set with compression and tagging
     */
    async set<T>(key: string, value: T, ttl?: number, tags: string[] = []): Promise<void> {
        const fullKey = this.buildKey(key);
        const serialized = JSON.stringify(value);
        const startTime = Date.now();

        try {
            let finalValue = serialized;
            let compressed = false;
            
            // Compress large payloads
            if (this.compressionEnabled && serialized.length > this.config.compressionThreshold) {
                finalValue = 'GZIP:' + this.compress(serialized);
                compressed = true;
                console.log(`📦 Compressed cache entry ${key}: ${serialized.length} → ${finalValue.length - 5} bytes`);
            }

            const finalTTL = ttl || this.config.defaultTTL;
            
            // Set main cache entry
            await redis.setex(fullKey, finalTTL, finalValue);
            
            // Set tag mappings for invalidation
            if (tags.length > 0) {
                await this.setTagMappings(key, tags, finalTTL);
            }
            
            this.emit('cache:set', { 
                key, 
                tags,
                size: finalValue.length, 
                ttl: finalTTL,
                compressed,
                duration: Date.now() - startTime
            });
            
        } catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
            throw error;
        }
    }

    /**
     * Cache-aside pattern with fallback
     */
    async getOrSet<T>(
        key: string,
        fallbackFn: () => Promise<T>,
        ttl?: number,
        tags: string[] = []
    ): Promise<T> {
        // Try cache first
        const cached = await this.get<T>(key, tags);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - execute fallback
        const startTime = Date.now();
        try {
            const result = await fallbackFn();
            await this.set(key, result, ttl, tags);
            
            this.emit('cache:fallback', {
                key,
                tags,
                duration: Date.now() - startTime
            });
            
            return result;
        } catch (error) {
            console.error(`Cache fallback error for key ${key}:`, error);
            throw error;
        }
    }

    /**
     * Bulk operations for performance
     */
    async mget(keys: string[]): Promise<Map<string, any>> {
        const fullKeys = keys.map(k => this.buildKey(k));
        const results = new Map();
        
        try {
            const values = await redis.mget(...fullKeys);
            
            for (let i = 0; i < keys.length; i++) {
                const value = values[i];
                if (value !== null) {
                    let data = value;
                    if (value.startsWith('GZIP:')) {
                        data = this.decompress(value.substring(5));
                    }
                    results.set(keys[i], JSON.parse(data));
                    this.recordHit(keys[i]);
                } else {
                    this.recordMiss(keys[i]);
                }
            }
            
        } catch (error) {
            console.error('Cache mget error:', error);
        }
        
        return results;
    }

    /**
     * Tag-based cache invalidation
     */
    async invalidateByTag(tag: string): Promise<number> {
        try {
            const tagKey = `${this.config.prefixNamespace}:tag:${tag}`;
            const keys = await redis.smembers(tagKey);
            
            if (keys.length === 0) {
                return 0;
            }

            // Delete all keys with this tag
            const fullKeys = keys.map(k => this.buildKey(k));
            const deleted = await redis.del(...fullKeys);
            
            // Clean up tag mapping
            await redis.del(tagKey);
            
            console.log(`🗑️ Invalidated ${deleted} cache entries with tag: ${tag}`);
            
            this.emit('cache:invalidate', { tag, count: deleted });
            
            return deleted;
            
        } catch (error) {
            console.error(`Cache invalidation error for tag ${tag}:`, error);
            return 0;
        }
    }

    /**
     * Pattern-based invalidation
     */
    async invalidatePattern(pattern: string): Promise<number> {
        const fullPattern = this.buildKey(pattern);
        
        try {
            const keys = await redis.keys(fullPattern);
            if (keys.length > 0) {
                const deleted = await redis.del(...keys);
                console.log(`🗑️ Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
                
                this.emit('cache:invalidate', { pattern, count: deleted });
                
                return deleted;
            }
            return 0;
        } catch (error) {
            console.error(`Cache pattern invalidation error for ${pattern}:`, error);
            return 0;
        }
    }

    /**
     * Cache warming strategy
     */
    async warmCache(entries: Array<{
        key: string;
        generator: () => Promise<any>;
        ttl?: number;
        tags?: string[];
    }>): Promise<void> {
        console.log(`🔥 Warming cache with ${entries.length} entries`);
        
        const promises = entries.map(async ({ key, generator, ttl, tags = [] }) => {
            try {
                const value = await generator();
                await this.set(key, value, ttl, tags);
                return { key, success: true };
            } catch (error) {
                console.error(`Cache warming failed for key ${key}:`, error);
                return { key, success: false, error };
            }
        });

        const results = await Promise.allSettled(promises);
        const successful = results.filter(r => 
            r.status === 'fulfilled' && r.value.success
        ).length;
        
        console.log(`🔥 Cache warming completed: ${successful}/${entries.length} successful`);
        
        this.emit('cache:warm', { 
            total: entries.length, 
            successful, 
            failed: entries.length - successful 
        });
    }

    /**
     * Get comprehensive cache statistics
     */
    async getStats(): Promise<CacheStats & { memory: any; keys: number }> {
        const overallStats = Array.from(this.stats.values()).reduce(
            (acc, stats) => ({
                hits: acc.hits + stats.hits,
                misses: acc.misses + stats.misses
            }),
            { hits: 0, misses: 0 }
        );

        const totalRequests = overallStats.hits + overallStats.misses;
        const hitRatio = totalRequests > 0 ? (overallStats.hits / totalRequests) * 100 : 0;

        // Get Redis memory info
        const memoryInfo = await redis.info('memory');
        const keyCount = await redis.dbsize();

        return {
            hits: overallStats.hits,
            misses: overallStats.misses,
            sets: 0, // Can be tracked if needed
            deletes: 0, // Can be tracked if needed
            hitRatio: parseFloat(hitRatio.toFixed(2)),
            totalRequests,
            memory: memoryInfo,
            keys: keyCount
        };
    }

    // Private helper methods
    private buildKey(key: string): string {
        return `${this.config.prefixNamespace}:${key}`;
    }

    private async setTagMappings(key: string, tags: string[], ttl: number): Promise<void> {
        const promises = tags.map(tag => {
            const tagKey = `${this.config.prefixNamespace}:tag:${tag}`;
            return redis.sadd(tagKey, key).then(() => redis.expire(tagKey, ttl));
        });
        
        await Promise.all(promises);
    }

    private recordHit(key: string): void {
        const stats = this.stats.get(key) || { hits: 0, misses: 0 };
        stats.hits++;
        this.stats.set(key, stats);
    }

    private recordMiss(key: string): void {
        const stats = this.stats.get(key) || { hits: 0, misses: 0 };
        stats.misses++;
        this.stats.set(key, stats);
    }

    private setupMetrics(): void {
        // Emit metrics every minute
        setInterval(async () => {
            try {
                const stats = await this.getStats();
                this.emit('metrics', stats);
                
                if (stats.totalRequests > 0) {
                    console.log(`📊 Cache Metrics - Hit Ratio: ${stats.hitRatio}%, Total: ${stats.totalRequests}, Keys: ${stats.keys}`);
                }
            } catch (error) {
                console.error('Cache metrics error:', error);
            }
        }, 60000);
    }

    private compress(data: string): string {
        // Simple base64 compression (in production, use gzip)
        return Buffer.from(data).toString('base64');
    }

    private decompress(data: string): string {
        return Buffer.from(data, 'base64').toString();
    }

    /**
     * Cleanup and close connections
     */
    async close(): Promise<void> {
        this.removeAllListeners();
        console.log('🔐 Cache manager closed');
    }
}

// Initialize with production-grade configuration
export const cacheManager = AdvancedCacheManager.getInstance({
    defaultTTL: 300, // 5 minutes
    compressionThreshold: 1024, // 1KB
    prefixNamespace: 'evently:v2',
    maxMemoryMB: 100 // 100MB cache limit
});
