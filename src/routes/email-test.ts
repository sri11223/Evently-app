// src/routes/email-test.ts - Test email configuration
import { Router, Request, Response } from 'express';
import { emailService } from '../services/EmailService';
import { authenticateRequired } from '../middleware/AuthMiddleware';

const router = Router();

/**
 * Test email configuration (verify SMTP connection)
 */
router.get('/verify', async (req: Request, res: Response) => {
    try {
        const isConfigured = await emailService.verifyConnection();
        
        if (isConfigured) {
            res.json({
                success: true,
                message: '✅ Email service configured and ready',
                smtp_host: process.env.SMTP_HOST,
                smtp_user: process.env.SMTP_USER,
                configured: true
            });
        } else {
            res.json({
                success: false,
                message: '⚠️ Email service not configured (SMTP credentials missing)',
                configured: false,
                note: 'Add SMTP_USER and SMTP_PASSWORD to environment variables'
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            error: 'Email verification failed',
            details: error.message,
            configured: false
        });
    }
});

/**
 * Send test email to yourself
 */
router.post('/send-test', authenticateRequired, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).userId;
        
        // Get user email from database
        const { db } = await import('../config/database');
        const userResult = await db.query('SELECT email, name FROM users WHERE id = $1', [userId]);
        
        if (!userResult.rows[0]) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }

        const user = userResult.rows[0];

        // Send test email
        const success = await emailService.sendNotification({
            to: user.email,
            userName: user.name,
            title: '🎉 Evently Email Test',
            message: `
                <h2>Hello ${user.name}!</h2>
                <p>This is a test email from your Evently booking system.</p>
                <p>If you're receiving this, your email integration is working perfectly! ✅</p>
                <ul>
                    <li>✅ Gmail SMTP configured</li>
                    <li>✅ Nodemailer integrated</li>
                    <li>✅ Email templates ready</li>
                    <li>✅ Multi-channel notifications active</li>
                </ul>
                <p><strong>You're all set for your Atlassian interview! 🚀</strong></p>
            `,
            type: 'test'
        });

        if (success) {
            res.json({
                success: true,
                message: `✅ Test email sent to ${user.email}`,
                recipient: user.email,
                check: 'Please check your inbox (and spam folder)'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send test email',
                note: 'Check SMTP credentials in environment variables'
            });
        }

    } catch (error: any) {
        console.error('Test email error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send test email',
            details: error.message
        });
    }
});

export default router;
