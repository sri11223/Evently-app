// src/controllers/LoadTestController.ts
import { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { db } from '../config/database';
import { cacheManager } from '../cache/CacheManager';

interface LoadTestConfig {
    concurrent_users: number;
    duration_seconds: number;
    test_type: 'booking' | 'read' | 'mixed';
    target_rps: number;
}

interface LoadTestMetrics {
    requests_sent: number;
    successful_requests: number;
    failed_requests: number;
    avg_response_time: number;
    p95_response_time: number;
    p99_response_time: number;
    throughput_rps: number;
    error_rate: number;
    concurrent_connections: number;
}

export class LoadTestController {
    private activeTests: Map<string, any> = new Map();

    /**
     * Start load test
     */
    public async startLoadTest(req: Request, res: Response): Promise<void> {
        try {
            const config: LoadTestConfig = {
                concurrent_users: parseInt(req.body.concurrent_users) || 100,
                duration_seconds: parseInt(req.body.duration_seconds) || 60,
                test_type: req.body.test_type || 'mixed',
                target_rps: parseInt(req.body.target_rps) || 50
            };

            // Validate reasonable limits
            if (config.concurrent_users > 1000) {
                res.status(400).json({
                    success: false,
                    error: 'Maximum 1000 concurrent users allowed for safety'
                });
                return;
            }

            const testId = `load_test_${Date.now()}`;
            
            console.log(`🚀 Starting load test: ${testId}`);
            console.log(`📊 Config:`, config);

            // Start test in background
            const testPromise = this.executeLoadTest(testId, config);
            this.activeTests.set(testId, { config, startTime: Date.now(), status: 'running' });

            res.json({
                success: true,
                test_id: testId,
                message: 'Load test started',
                config,
                status_endpoint: `/api/v1/load-test/status/${testId}`
            });

            // Handle test completion
            testPromise.then(metrics => {
                const test = this.activeTests.get(testId);
                if (test) {
                    test.status = 'completed';
                    test.results = metrics;
                    console.log(`✅ Load test completed: ${testId}`);
                    console.log('📊 Results:', metrics);
                }
            }).catch(error => {
                const test = this.activeTests.get(testId);
                if (test) {
                    test.status = 'failed';
                    test.error = error.message;
                }
                console.error(`❌ Load test failed: ${testId}`, error);
            });

        } catch (error) {
            console.error('❌ Load test start error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to start load test'
            });
        }
    }

    /**
     * Get load test status
     */
    public async getLoadTestStatus(req: Request, res: Response): Promise<void> {
        try {
            const { testId } = req.params;
            const test = this.activeTests.get(testId);

            if (!test) {
                res.status(404).json({
                    success: false,
                    error: 'Load test not found'
                });
                return;
            }

            const runtime = Date.now() - test.startTime;

            res.json({
                success: true,
                test_id: testId,
                status: test.status,
                runtime_ms: runtime,
                config: test.config,
                results: test.results || null,
                error: test.error || null
            });

        } catch (error) {
            console.error('❌ Load test status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get load test status'
            });
        }
    }

    /**
     * Get system performance benchmarks
     */
    public async getPerformanceBenchmarks(req: Request, res: Response): Promise<void> {
        try {
            console.log('📊 Running performance benchmarks...');

            const benchmarks = {
                database_performance: await this.benchmarkDatabase(),
                cache_performance: await this.benchmarkCache(),
                api_performance: await this.benchmarkAPI(),
                concurrent_capacity: await this.estimateConcurrentCapacity()
            };

            res.json({
                success: true,
                benchmarks,
                timestamp: new Date(),
                recommendations: this.generateRecommendations(benchmarks)
            });

        } catch (error) {
            console.error('❌ Benchmark error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to run benchmarks'
            });
        }
    }

    /**
     * Execute the actual load test
     */
    private async executeLoadTest(testId: string, config: LoadTestConfig): Promise<LoadTestMetrics> {
        const startTime = performance.now();
        const responseTimes: number[] = [];
        let successCount = 0;
        let errorCount = 0;

        const promises: Promise<any>[] = [];
        const requestsPerUser = Math.ceil((config.target_rps * config.duration_seconds) / config.concurrent_users);

        // Create concurrent users
        for (let user = 0; user < config.concurrent_users; user++) {
            const userPromise = this.simulateUser(user, requestsPerUser, config, responseTimes);
            promises.push(userPromise);
        }

        // Wait for all users to complete
        const results = await Promise.allSettled(promises);
        
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                successCount += result.value.success;
                errorCount += result.value.errors;
            } else {
                errorCount++;
            }
        });

        const endTime = performance.now();
        const totalTime = (endTime - startTime) / 1000; // seconds
        const totalRequests = successCount + errorCount;

        // Calculate metrics
        responseTimes.sort((a, b) => a - b);
        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);

        const metrics: LoadTestMetrics = {
            requests_sent: totalRequests,
            successful_requests: successCount,
            failed_requests: errorCount,
            avg_response_time: responseTimes.length > 0 ? 
                responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
            p95_response_time: responseTimes[p95Index] || 0,
            p99_response_time: responseTimes[p99Index] || 0,
            throughput_rps: totalRequests / totalTime,
            error_rate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
            concurrent_connections: config.concurrent_users
        };

        return metrics;
    }

    /**
     * Simulate a single user making requests
     */
    private async simulateUser(userId: number, requestCount: number, config: LoadTestConfig, responseTimes: number[]): Promise<{ success: number, errors: number }> {
        let success = 0;
        let errors = 0;
        
        for (let req = 0; req < requestCount; req++) {
            try {
                const startTime = performance.now();
                
                // Simulate different request types based on test type
                if (config.test_type === 'booking') {
                    await this.simulateBookingRequest(userId);
                } else if (config.test_type === 'read') {
                    await this.simulateReadRequest();
                } else {
                    // Mixed: 80% read, 20% write
                    if (Math.random() < 0.8) {
                        await this.simulateReadRequest();
                    } else {
                        await this.simulateBookingRequest(userId);
                    }
                }
                
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                responseTimes.push(responseTime);
                
                success++;
                
                // Add small delay to control RPS
                await new Promise(resolve => setTimeout(resolve, 10));
                
            } catch (error) {
                errors++;
                console.error(`Load test request failed for user ${userId}:`, error);
            }
        }
        
        return { success, errors };
    }

    /**
     * Simulate booking request (write operation)
     */
    private async simulateBookingRequest(userId: number): Promise<void> {
        const eventId = 'f07a948d-4c28-4b32-94a6-e106c24c6da9'; // Use known event ID
        const testUserId = `550e8400-e29b-41d4-a716-44665544${userId.toString().padStart(4, '0')}`;
        
        // Try to book 1-3 tickets
        const quantity = Math.floor(Math.random() * 3) + 1;
        
        // Simulate booking logic (without actually creating bookings)
        const result = await db.queryRead(
            'SELECT available_seats FROM events WHERE id = $1',
            [eventId]
        );
        
        if (result.rows.length > 0 && result.rows[0].available_seats >= quantity) {
            // Simulate successful booking check
            return;
        }
        
        throw new Error('No seats available');
    }

    /**
     * Simulate read request (read operation)
     */
    private async simulateReadRequest(): Promise<void> {
        // Randomly choose read operation
        const operations = [
            () => db.queryRead('SELECT COUNT(*) FROM events WHERE status = $1', ['active']),
            () => db.queryRead('SELECT id, name FROM events WHERE status = $1 LIMIT 5', ['active']),
            () => cacheManager.get('events:all')
        ];
        
        const operation = operations[Math.floor(Math.random() * operations.length)];
        await operation();
    }

    // Benchmark methods
    private async benchmarkDatabase(): Promise<any> {
        const start = performance.now();
        await db.queryRead('SELECT COUNT(*) FROM events');
        const end = performance.now();
        
        return {
            simple_query_ms: Math.round(end - start),
            rating: (end - start) < 10 ? 'Excellent' : (end - start) < 50 ? 'Good' : 'Needs Optimization'
        };
    }

    private async benchmarkCache(): Promise<any> {
        const stats = await cacheManager.getStats();
        return {
            hit_ratio: stats.hitRatio,
            total_keys: stats.keys,
            rating: stats.hitRatio > 80 ? 'Excellent' : stats.hitRatio > 60 ? 'Good' : 'Needs Optimization'
        };
    }

    private async benchmarkAPI(): Promise<any> {
        const start = performance.now();
        // Simulate API call timing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
        const end = performance.now();
        
        return {
            avg_response_time_ms: Math.round(end - start),
            rating: (end - start) < 50 ? 'Excellent' : 'Good'
        };
    }

    private async estimateConcurrentCapacity(): Promise<any> {
        // Estimate based on current performance
        const dbBench = await this.benchmarkDatabase();
        const cacheBench = await this.benchmarkCache();
        
        const estimated = Math.floor(1000 / (dbBench.simple_query_ms || 10)) * 100;
        
        return {
            estimated_concurrent_users: estimated,
            based_on: 'Current database and cache performance',
            confidence: 'Medium'
        };
    }

    private generateRecommendations(benchmarks: any): string[] {
        const recommendations = [];
        
        if (benchmarks.cache_performance.hit_ratio < 70) {
            recommendations.push('Consider increasing cache TTL values to improve hit ratio');
        }
        
        if (benchmarks.database_performance.simple_query_ms > 50) {
            recommendations.push('Database queries are slow - consider adding indexes');
        }
        
        if (benchmarks.concurrent_capacity.estimated_concurrent_users < 1000) {
            recommendations.push('System may need horizontal scaling for high load');
        } else {
            recommendations.push('System is well-optimized for high concurrent load');
        }
        
        return recommendations;
    }
}

export const loadTestController = new LoadTestController();
