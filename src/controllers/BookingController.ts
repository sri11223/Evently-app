// src/controllers/BookingController.ts
import { Request, Response } from 'express';
import { bookingService } from '../services/BookingService';

export class BookingController {

    public async bookTickets(req: Request, res: Response): Promise<void> {
        try {
            const { user_id, event_id, quantity } = req.body;

            if (!user_id || !event_id || !quantity || quantity <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'user_id, event_id, and quantity (> 0) are required'
                });
                return;
            }

            const result = await bookingService.bookTickets({
                user_id,
                event_id,
                quantity: parseInt(quantity)
            });

            res.status(201).json(result);

        } catch (error: any) {
            console.error('❌ Booking error:', error);
            res.status(409).json({
                success: false,
                error: error.message
            });
        }
    }
}

export const bookingController = new BookingController();
