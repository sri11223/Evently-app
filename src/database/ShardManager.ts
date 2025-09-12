// src/database/ShardManager.ts
import { Pool } from 'pg';
import crypto from 'crypto';

export interface ShardConfig {
    shard_id: number;
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

export interface ShardInfo {
    shard_id: number;
    pool: Pool;
    isHealthy: boolean;
}

export class ShardManager {
    private shards: Map<number, ShardInfo> = new Map();
    private shardConfigs: ShardConfig[] = [];
    private readonly SHARD_COUNT = 4;

    constructor() {
        this.initializeShardConfigs();
        this.setupShards();
    }

    private initializeShardConfigs(): void {
        // For now, all shards point to same database (will expand to multiple DBs)
        for (let i = 0; i < this.SHARD_COUNT; i++) {
            this.shardConfigs.push({
                shard_id: i,
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5433'),
                database: `${process.env.DB_NAME || 'evently_db'}_shard_${i}`,
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password'
            });
        }
    }

    private async setupShards(): Promise<void> {
        for (const config of this.shardConfigs) {
            try {
                const pool = new Pool({
                    host: config.host,
                    port: config.port,
                    database: process.env.DB_NAME || 'evently_db', // For now, same DB
                    user: config.user,
                    password: config.password,
                    max: 10, // Smaller pool per shard
                    idleTimeoutMillis: 30000
                });

                // Test connection
                const client = await pool.connect();
                await client.query('SELECT 1');
                client.release();

                this.shards.set(config.shard_id, {
                    shard_id: config.shard_id,
                    pool: pool,
                    isHealthy: true
                });

                console.log(`✅ Shard ${config.shard_id} initialized and healthy`);

            } catch (error) {
                console.error(`❌ Failed to initialize shard ${config.shard_id}:`, error);
                // Add unhealthy shard for monitoring
                this.shards.set(config.shard_id, {
                    shard_id: config.shard_id,
                    pool: new Pool(), // Empty pool
                    isHealthy: false
                });
            }
        }
    }

    /**
     * Get shard ID for organizer using consistent hashing
     */
    public getShardForOrganizer(organizerId: string): number {
        const hash = crypto.createHash('md5').update(organizerId).digest('hex');
        const hashInt = parseInt(hash.substring(0, 8), 16);
        return Math.abs(hashInt) % this.SHARD_COUNT;
    }

    /**
     * Get shard ID for event (requires organizer lookup)
     */
    public async getShardForEvent(eventId: string): Promise<number> {
        try {
            // For now, query default shard to get organizer_id
            const defaultShard = this.shards.get(0);
            if (!defaultShard?.isHealthy) {
                throw new Error('Default shard unavailable');
            }

            const result = await defaultShard.pool.query(
                'SELECT organizer_id FROM events WHERE id = $1',
                [eventId]
            );

            if (result.rows.length === 0) {
                throw new Error(`Event ${eventId} not found`);
            }

            return this.getShardForOrganizer(result.rows[0].organizer_id);

        } catch (error) {
            console.error(`Error getting shard for event ${eventId}:`, error);
            return 0; // Fallback to default shard
        }
    }

    /**
     * Get database pool for specific shard
     */
    public getShardPool(shardId: number): Pool {
        const shard = this.shards.get(shardId);
        if (!shard || !shard.isHealthy) {
            console.warn(`Shard ${shardId} unavailable, falling back to shard 0`);
            return this.shards.get(0)!.pool;
        }
        return shard.pool;
    }

    /**
     * Execute query on specific shard
     */
    public async queryByShard(shardId: number, query: string, params?: any[]): Promise<any> {
        const pool = this.getShardPool(shardId);
        const client = await pool.connect();
        
        try {
            const result = await client.query(query, params);
            return result;
        } finally {
            client.release();
        }
    }

    /**
     * Execute query on organizer's shard
     */
    public async queryByOrganizer(organizerId: string, query: string, params?: any[]): Promise<any> {
        const shardId = this.getShardForOrganizer(organizerId);
        return this.queryByShard(shardId, query, params);
    }

    /**
     * Execute query on event's shard
     */
    public async queryByEvent(eventId: string, query: string, params?: any[]): Promise<any> {
        const shardId = await this.getShardForEvent(eventId);
        return this.queryByShard(shardId, query, params);
    }

    /**
     * Fan-out query to all shards and aggregate results
     */
    public async fanOutQuery(query: string, params?: any[]): Promise<any[]> {
        const promises: Promise<any>[] = [];

        for (const [shardId, shard] of this.shards) {
            if (shard.isHealthy) {
                promises.push(
                    this.queryByShard(shardId, query, params)
                        .then(result => ({
                            shard_id: shardId,
                            data: result.rows,
                            success: true
                        }))
                        .catch(error => ({
                            shard_id: shardId,
                            error: error.message,
                            success: false
                        }))
                );
            }
        }

        const results = await Promise.allSettled(promises);
        return results
            .filter(result => result.status === 'fulfilled')
            .map(result => (result as PromiseFulfilledResult<any>).value)
            .filter(result => result.success);
    }

    /**
     * Health check all shards
     */
    public async healthCheck(): Promise<Map<number, boolean>> {
        const healthStatus = new Map<number, boolean>();

        for (const [shardId, shard] of this.shards) {
            try {
                const client = await shard.pool.connect();
                await client.query('SELECT 1');
                client.release();
                
                shard.isHealthy = true;
                healthStatus.set(shardId, true);
                
            } catch (error) {
                shard.isHealthy = false;
                healthStatus.set(shardId, false);
                console.error(`Shard ${shardId} health check failed:`, error);
            }
        }

        return healthStatus;
    }

    /**
     * Get shard statistics
     */
    public async getShardStats(): Promise<any> {
        const stats = {
            total_shards: this.SHARD_COUNT,
            healthy_shards: 0,
            shard_details: [] as any[]
        };

        for (const [shardId, shard] of this.shards) {
            if (shard.isHealthy) {
                stats.healthy_shards++;
                
                try {
                    // Get record count per shard
                    const eventCount = await this.queryByShard(shardId, 
                        'SELECT COUNT(*) as count FROM events WHERE organizer_id IN (SELECT id FROM organizers WHERE (CAST($1 AS INTEGER) % CAST($2 AS INTEGER)) = CAST($3 AS INTEGER))', 
                        [shardId, this.SHARD_COUNT, shardId]
                    );

                    stats.shard_details.push({
                        shard_id: shardId,
                        status: 'healthy',
                        event_count: parseInt(eventCount.rows[0].count)
                    });

                } catch (error) {
                    stats.shard_details.push({
                        shard_id: shardId,
                        status: 'error',
                        error: error
                    });
                }
            } else {
                stats.shard_details.push({
                    shard_id: shardId,
                    status: 'unhealthy'
                });
            }
        }

        return stats;
    }

    /**
     * Close all shard connections
     */
    public async close(): Promise<void> {
        const promises = Array.from(this.shards.values()).map(shard => 
            shard.pool.end().catch(err => console.error('Error closing shard pool:', err))
        );
        
        await Promise.all(promises);
        console.log('🔐 All shard connections closed');
    }
}

// Singleton instance
export const shardManager = new ShardManager();
