// src/controllers/PricingController.ts
import { Request, Response } from 'express';
import { dynamicPricingService } from '../services/DynamicPricingService';

export class PricingController {

    /**
     * Get pricing recommendation for specific event
     */
    public async getEventPricing(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const recommendation = await dynamicPricingService.calculateDynamicPrice(eventId);
            
            res.json({
                success: true,
                data: recommendation
            });

        } catch (error: any) {
            console.error('❌ Get event pricing error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to calculate pricing'
            });
        }
    }

    /**
     * Get all pricing recommendations
     */
    public async getAllPricingRecommendations(req: Request, res: Response): Promise<void> {
        try {
            const recommendations = await dynamicPricingService.getAllPricingRecommendations();
            
            res.json({
                success: true,
                data: recommendations,
                count: recommendations.length
            });

        } catch (error) {
            console.error('❌ Get all pricing recommendations error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pricing recommendations'
            });
        }
    }

    /**
     * Apply dynamic pricing to event
     */
    public async applyPricing(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const adminUserId = req.body.admin_user_id || 'admin';
            
            const result = await dynamicPricingService.applyDynamicPricing(eventId, adminUserId);
            
            res.json({
                success: result.success,
                message: result.message,
                data: result
            });

        } catch (error: any) {
            console.error('❌ Apply pricing error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to apply dynamic pricing'
            });
        }
    }
}

export const pricingController = new PricingController();
