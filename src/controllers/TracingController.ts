// src/controllers/TracingController.ts
import { Request, Response } from 'express';
import { tracingManager } from '../middleware/TracingMiddleware';

export class TracingController {

    /**
     * Get tracing statistics
     */
    public async getTracingStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = tracingManager.getTraceStats();
            
            res.json({
                success: true,
                data: stats,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Tracing stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve tracing statistics'
            });
        }
    }

    /**
     * Get specific trace by ID
     */
    public async getTrace(req: Request, res: Response): Promise<void> {
        try {
            const { traceId } = req.params;
            const trace = tracingManager.getTrace(traceId);

            if (!trace) {
                res.status(404).json({
                    success: false,
                    error: 'Trace not found'
                });
                return;
            }

            // Convert Map to object for JSON serialization
            const traceData = {
                ...trace,
                tags: Object.fromEntries(trace.tags),
                duration_ms: trace.duration ? Math.round(trace.duration * 100) / 100 : null
            };

            res.json({
                success: true,
                data: traceData
            });

        } catch (error) {
            console.error('❌ Get trace error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve trace'
            });
        }
    }

    /**
     * Get recent traces
     */
    public async getRecentTraces(req: Request, res: Response): Promise<void> {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const traces = tracingManager.getRecentTraces(limit);

            const tracesData = traces.map(trace => ({
                trace_id: trace.traceId,
                operation: trace.operationName,
                duration_ms: trace.duration ? Math.round(trace.duration * 100) / 100 : null,
                status: trace.status,
                status_code: trace.statusCode,
                start_time: new Date(Date.now() - (performance.now() - trace.startTime)),
                tags: Object.fromEntries(trace.tags)
            }));

            res.json({
                success: true,
                data: tracesData,
                count: tracesData.length
            });

        } catch (error) {
            console.error('❌ Get recent traces error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve recent traces'
            });
        }
    }

    /**
     * Search traces
     */
    public async searchTraces(req: Request, res: Response): Promise<void> {
        try {
            const { operation, status, limit } = req.query;
            
            const traces = tracingManager.searchTraces({
                operation: operation as string,
                status: status as string,
                limit: limit ? parseInt(limit as string) : undefined
            });

            const tracesData = traces.map(trace => ({
                trace_id: trace.traceId,
                operation: trace.operationName,
                duration_ms: trace.duration ? Math.round(trace.duration * 100) / 100 : null,
                status: trace.status,
                status_code: trace.statusCode,
                error_message: trace.tags.get('error.message'),
                user_ip: trace.tags.get('user.ip')
            }));

            res.json({
                success: true,
                data: tracesData,
                count: tracesData.length,
                query: { operation, status, limit }
            });

        } catch (error) {
            console.error('❌ Search traces error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to search traces'
            });
        }
    }
}

export const tracingController = new TracingController();
