// src/middleware/TracingMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import crypto from 'crypto';

export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: Map<string, any>;
    logs: Array<{ timestamp: number; message: string; level: string }>;
    status: 'success' | 'error';
    statusCode?: number;
}

class TracingManager {
    private activeTraces: Map<string, TraceContext> = new Map();
    private completedTraces: TraceContext[] = [];
    private maxCompletedTraces = 1000;

    /**
     * Create tracing middleware
     */
    createMiddleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            const traceId = this.generateTraceId();
            const spanId = this.generateSpanId();
            const startTime = performance.now();
            
            // Create trace context
            const traceContext: TraceContext = {
                traceId,
                spanId,
                operationName: `${req.method} ${req.path}`,
                startTime,
                tags: new Map([
                    ['http.method', req.method],
                    ['http.url', req.originalUrl],
                    ['http.path', req.path],
                    ['user.ip', this.getClientIP(req)],
                    ['user.agent', req.headers['user-agent'] || 'unknown']
                ]),
                logs: [],
                status: 'success'
            };

            // Add correlation ID to request and response headers
            req.headers['x-trace-id'] = traceId;
            res.setHeader('X-Trace-ID', traceId);
            res.setHeader('X-Span-ID', spanId);

            // Store in active traces
            this.activeTraces.set(traceId, traceContext);

            // Extend request object with tracing methods
            (req as any).trace = {
                traceId,
                spanId,
                log: (message: string, level: string = 'info') => {
                    traceContext.logs.push({
                        timestamp: performance.now(),
                        message,
                        level
                    });
                },
                setTag: (key: string, value: any) => {
                    traceContext.tags.set(key, value);
                },
                setError: (error: Error) => {
                    traceContext.status = 'error';
                    traceContext.tags.set('error', true);
                    traceContext.tags.set('error.message', error.message);
                    traceContext.logs.push({
                        timestamp: performance.now(),
                        message: `Error: ${error.message}`,
                        level: 'error'
                    });
                }
            };

            // Log request start
            traceContext.logs.push({
                timestamp: startTime,
                message: `Request started: ${req.method} ${req.path}`,
                level: 'info'
            });

            // Hook into response finish
            const originalSend = res.send;
            const originalJson = res.json;

            res.send = function(body) {
                tracingManager.finishTrace(traceId, res.statusCode, performance.now());
                return originalSend.call(this, body);
            };

            res.json = function(body) {
                tracingManager.finishTrace(traceId, res.statusCode, performance.now());
                return originalJson.call(this, body);
            };

            // Handle response errors
            res.on('error', (error) => {
                (req as any).trace.setError(error);
                this.finishTrace(traceId, 500, performance.now());
            });

            console.log(`🔍 Trace started: ${traceId} - ${req.method} ${req.path}`);
            next();
        };
    }

    /**
     * Finish a trace
     */
    finishTrace(traceId: string, statusCode: number, endTime: number): void {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return;

        trace.endTime = endTime;
        trace.duration = endTime - trace.startTime;
        trace.statusCode = statusCode;
        trace.status = statusCode >= 400 ? 'error' : 'success';
        trace.tags.set('http.status_code', statusCode);

        // Log completion
        trace.logs.push({
            timestamp: endTime,
            message: `Request completed: ${statusCode} in ${trace.duration.toFixed(2)}ms`,
            level: trace.status === 'error' ? 'error' : 'info'
        });

        // Move to completed traces
        this.activeTraces.delete(traceId);
        this.completedTraces.unshift(trace);

        // Trim completed traces
        if (this.completedTraces.length > this.maxCompletedTraces) {
            this.completedTraces = this.completedTraces.slice(0, this.maxCompletedTraces);
        }

        // Log performance metrics
        const perfLevel = trace.duration > 1000 ? 'warn' : trace.duration > 500 ? 'info' : 'debug';
        console.log(`📊 Trace completed: ${traceId} - ${trace.duration.toFixed(2)}ms - ${statusCode}`);

        if (trace.duration > 1000) {
            console.warn(`🐌 Slow request detected: ${trace.operationName} took ${trace.duration.toFixed(2)}ms`);
        }
    }

    /**
     * Get trace statistics
     */
    getTraceStats(): any {
        const recentTraces = this.completedTraces.slice(0, 100);
        const successful = recentTraces.filter(t => t.status === 'success').length;
        const errors = recentTraces.filter(t => t.status === 'error').length;
        
        const durations = recentTraces.map(t => t.duration || 0);
        const avgDuration = durations.length > 0 ? 
            durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        
        const sortedDurations = [...durations].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedDurations.length * 0.95);
        const p99Index = Math.floor(sortedDurations.length * 0.99);

        return {
            active_traces: this.activeTraces.size,
            completed_traces: this.completedTraces.length,
            success_rate: recentTraces.length > 0 ? (successful / recentTraces.length) * 100 : 100,
            error_rate: recentTraces.length > 0 ? (errors / recentTraces.length) * 100 : 0,
            performance: {
                avg_duration_ms: Math.round(avgDuration * 100) / 100,
                p95_duration_ms: Math.round((sortedDurations[p95Index] || 0) * 100) / 100,
                p99_duration_ms: Math.round((sortedDurations[p99Index] || 0) * 100) / 100
            },
            recent_slow_requests: recentTraces
                .filter(t => (t.duration || 0) > 500)
                .slice(0, 5)
                .map(t => ({
                    trace_id: t.traceId,
                    operation: t.operationName,
                    duration_ms: Math.round((t.duration || 0) * 100) / 100,
                    status_code: t.statusCode
                }))
        };
    }

    /**
     * Get trace by ID
     */
    getTrace(traceId: string): TraceContext | null {
        return this.activeTraces.get(traceId) || 
               this.completedTraces.find(t => t.traceId === traceId) || null;
    }

    /**
     * Get recent traces
     */
    getRecentTraces(limit: number = 20): TraceContext[] {
        return this.completedTraces.slice(0, limit);
    }

    /**
     * Search traces by operation or status
     */
    searchTraces(query: { operation?: string; status?: string; limit?: number }): TraceContext[] {
        let filtered = [...this.completedTraces];

        if (query.operation) {
            filtered = filtered.filter(t => 
                t.operationName.toLowerCase().includes(query.operation!.toLowerCase())
            );
        }

        if (query.status) {
            filtered = filtered.filter(t => t.status === query.status);
        }

        return filtered.slice(0, query.limit || 20);
    }

    // Utility methods
    private generateTraceId(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    private generateSpanId(): string {
        return crypto.randomBytes(8).toString('hex');
    }

    private getClientIP(req: Request): string {
        return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               '127.0.0.1';
    }
}

// Singleton instance
export const tracingManager = new TracingManager();

// Middleware export
export const requestTracing = tracingManager.createMiddleware();
