// src/database/ReplicationManager.ts
import { Pool } from 'pg';

export enum OperationType {
    READ = 'READ',
    WRITE = 'WRITE'
}

export interface ReplicationConfig {
    master: {
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    replicas: Array<{
        id: string;
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        weight: number; // Load balancing weight
    }>;
}

export interface ReplicaInfo {
    id: string;
    pool: Pool;
    isHealthy: boolean;
    weight: number;
    lastHealthCheck: Date;
    lagMs: number;
}

export class ReplicationManager {
    private masterPool!: Pool;
    private replicas: Map<string, ReplicaInfo> = new Map();
    private config!: ReplicationConfig;
    private healthCheckInterval!: NodeJS.Timeout;

    constructor() {
        this.initializeConfig();
        this.setupMasterConnection();
        this.setupReplicaConnections();
        this.startHealthChecks();
    }

    private initializeConfig(): void {
        this.config = {
            master: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5433'),
                database: process.env.DB_NAME || 'evently_db',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password'
            },
            replicas: [
                {
                    id: 'replica-1',
                    host: process.env.DB_REPLICA1_HOST || process.env.DB_HOST || 'localhost',
                    port: parseInt(process.env.DB_REPLICA1_PORT || process.env.DB_PORT || '5433'),
                    database: process.env.DB_REPLICA1_NAME || process.env.DB_NAME || 'evently_db',
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || 'password',
                    weight: 1
                },
                {
                    id: 'replica-2',
                    host: process.env.DB_REPLICA2_HOST || process.env.DB_HOST || 'localhost',
                    port: parseInt(process.env.DB_REPLICA2_PORT || process.env.DB_PORT || '5433'),
                    database: process.env.DB_REPLICA2_NAME || process.env.DB_NAME || 'evently_db',
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || 'password',
                    weight: 1
                }
            ]
        };
    }

    private async setupMasterConnection(): Promise<void> {
        try {
            this.masterPool = new Pool({
                ...this.config.master,
                max: 15, // More connections for master (writes + fallback reads)
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000
            });

            // Test master connection
            const client = await this.masterPool.connect();
            await client.query('SELECT 1');
            client.release();

            console.log('✅ Master database connection established');

        } catch (error) {
            console.error('❌ Failed to connect to master database:', error);
            throw error;
        }
    }

    private async setupReplicaConnections(): Promise<void> {
        for (const replicaConfig of this.config.replicas) {
            try {
                const pool = new Pool({
                    host: replicaConfig.host,
                    port: replicaConfig.port,
                    database: replicaConfig.database,
                    user: replicaConfig.user,
                    password: replicaConfig.password,
                    max: 10, // Fewer connections per replica
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000
                });

                // Test replica connection
                const client = await pool.connect();
                await client.query('SELECT 1');
                client.release();

                this.replicas.set(replicaConfig.id, {
                    id: replicaConfig.id,
                    pool,
                    isHealthy: true,
                    weight: replicaConfig.weight,
                    lastHealthCheck: new Date(),
                    lagMs: 0
                });

                console.log(`✅ Replica ${replicaConfig.id} connection established`);

            } catch (error) {
                console.error(`❌ Failed to connect to replica ${replicaConfig.id}:`, error);
                
                // Add unhealthy replica for monitoring
                this.replicas.set(replicaConfig.id, {
                    id: replicaConfig.id,
                    pool: new Pool(), // Empty pool
                    isHealthy: false,
                    weight: replicaConfig.weight,
                    lastHealthCheck: new Date(),
                    lagMs: Number.MAX_SAFE_INTEGER
                });
            }
        }
    }

    /**
     * Route operation to appropriate database
     */
    public async route(operationType: OperationType, requiresConsistency: boolean = false): Promise<Pool> {
        if (operationType === OperationType.WRITE || requiresConsistency) {
            return this.masterPool;
        }

        // For reads, try to use a healthy replica
        const healthyReplica = this.getHealthyReplica();
        if (healthyReplica) {
            return healthyReplica.pool;
        }

        // Fallback to master if no healthy replicas
        console.warn('⚠️ No healthy replicas available, falling back to master for read');
        return this.masterPool;
    }

    /**
     * Get healthy replica using weighted round-robin
     */
    private getHealthyReplica(): ReplicaInfo | null {
        const healthyReplicas = Array.from(this.replicas.values())
            .filter(replica => replica.isHealthy && replica.lagMs < 5000); // Max 5s lag

        if (healthyReplicas.length === 0) {
            return null;
        }

        // Simple round-robin for now (can be enhanced with weighted selection)
        const randomIndex = Math.floor(Math.random() * healthyReplicas.length);
        return healthyReplicas[randomIndex];
    }

    /**
     * Execute query with automatic routing
     */
    public async query(
        sql: string, 
        params: any[] = [], 
        operationType: OperationType = OperationType.READ,
        requiresConsistency: boolean = false
    ): Promise<any> {
        const pool = await this.route(operationType, requiresConsistency);
        const client = await pool.connect();

        try {
            const startTime = Date.now();
            const result = await client.query(sql, params);
            const duration = Date.now() - startTime;

            // Log slow queries
            if (duration > 1000) {
                console.warn(`🐌 Slow query detected: ${duration}ms - ${sql.substring(0, 100)}...`);
            }

            return result;

        } finally {
            client.release();
        }
    }

    /**
     * Force query to master (for critical operations)
     */
    public async queryMaster(sql: string, params: any[] = []): Promise<any> {
        const client = await this.masterPool.connect();

        try {
            return await client.query(sql, params);
        } finally {
            client.release();
        }
    }

    /**
     * Execute transaction (always on master)
     */
    public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const client = await this.masterPool.connect();

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Health check for all replicas
     */
    private async performHealthChecks(): Promise<void> {
        for (const [replicaId, replica] of this.replicas) {
            try {
                const startTime = Date.now();
                const client = await replica.pool.connect();
                
                // Check basic connectivity
                await client.query('SELECT 1');
                
                // Measure replication lag (simplified)
                const lagResult = await client.query('SELECT EXTRACT(EPOCH FROM NOW()) as current_time');
                const masterResult = await this.masterPool.query('SELECT EXTRACT(EPOCH FROM NOW()) as current_time');
                
                const replicaTime = parseFloat(lagResult.rows[0].current_time);
                const masterTime = parseFloat(masterResult.rows[0].current_time);
                const lagMs = Math.abs((masterTime - replicaTime) * 1000);

                client.release();

                // Update replica status
                replica.isHealthy = true;
                replica.lastHealthCheck = new Date();
                replica.lagMs = lagMs;

                if (lagMs > 10000) { // 10 second lag warning
                    console.warn(`⚠️ Replica ${replicaId} has high lag: ${lagMs}ms`);
                }

            } catch (error) {
                console.error(`❌ Health check failed for replica ${replicaId}:`, error);
                replica.isHealthy = false;
                replica.lagMs = Number.MAX_SAFE_INTEGER;
            }
        }
    }

    /**
     * Start periodic health checks
     */
    private startHealthChecks(): void {
        // Health check every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthChecks();
        }, 30000);

        // Immediate health check
        setTimeout(() => this.performHealthChecks(), 1000);
    }

    /**
     * Get replication status
     */
    public getReplicationStatus(): any {
        const status = {
            master: {
                status: 'healthy', // Assume healthy if we got here
                pool_size: this.masterPool.totalCount,
                idle_count: this.masterPool.idleCount,
                waiting_count: this.masterPool.waitingCount
            },
            replicas: [] as any[]
        };

        for (const [replicaId, replica] of this.replicas) {
            status.replicas.push({
                id: replicaId,
                status: replica.isHealthy ? 'healthy' : 'unhealthy',
                lag_ms: replica.lagMs,
                last_health_check: replica.lastHealthCheck,
                pool_size: replica.pool.totalCount,
                idle_count: replica.pool.idleCount,
                waiting_count: replica.pool.waitingCount
            });
        }

        return status;
    }

    /**
     * Close all connections
     */
    public async close(): Promise<void> {
        // Stop health checks
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        // Close master connection
        await this.masterPool.end();

        // Close replica connections
        const closePromises = Array.from(this.replicas.values()).map(replica => 
            replica.pool.end().catch(err => console.error(`Error closing replica ${replica.id}:`, err))
        );

        await Promise.all(closePromises);
        console.log('🔐 All replication connections closed');
    }
}

// Singleton instance
export const replicationManager = new ReplicationManager();
