// src/controllers/AdvancedAnalyticsController.ts
import { Request, Response } from 'express';
import { advancedAnalyticsService } from '../services/AdvancedAnalyticsService';

export class AdvancedAnalyticsController {

    /**
     * Get comprehensive dashboard analytics
     */
    public async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const dashboard = await advancedAnalyticsService.getDashboardAnalytics();
            
            res.json({
                success: true,
                data: dashboard,
                generated_at: new Date(),
                cache_info: {
                    cached: true,
                    ttl_minutes: 5
                }
            });

        } catch (error) {
            console.error('❌ Dashboard analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve dashboard analytics'
            });
        }
    }

    /**
     * Get real-time business metrics
     */
    public async getRealtimeMetrics(req: Request, res: Response): Promise<void> {
        try {
            const metrics = await advancedAnalyticsService.getRealtimeMetrics();
            
            res.json({
                success: true,
                data: metrics
            });

        } catch (error) {
            console.error('❌ Real-time metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve real-time metrics'
            });
        }
    }

    /**
     * Get conversion funnel analysis
     */
    public async getConversionFunnel(req: Request, res: Response): Promise<void> {
        try {
            const funnel = await advancedAnalyticsService.getConversionFunnel();
            
            res.json({
                success: true,
                data: funnel
            });

        } catch (error) {
            console.error('❌ Conversion funnel error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve conversion funnel'
            });
        }
    }

    /**
     * Get predictive analytics
     */
    public async getPredictiveAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const predictions = await advancedAnalyticsService.getPredictiveAnalytics();
            
            res.json({
                success: true,
                data: predictions
            });

        } catch (error) {
            console.error('❌ Predictive analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve predictive analytics'
            });
        }
    }
}

export const advancedAnalyticsController = new AdvancedAnalyticsController();
