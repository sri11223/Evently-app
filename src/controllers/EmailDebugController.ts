// Debug route for checking email configuration on Render
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

export class EmailDebugController {
    /**
     * GET /api/v1/debug/email
     * Debug email configuration (temporary route for troubleshooting)
     */
    public static async debugEmailConfig(req: Request, res: Response): Promise<void> {
        try {
            // Check environment variables
            const envCheck = {
                NODE_ENV: process.env.NODE_ENV,
                SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ Missing',
                SMTP_HOST: process.env.SMTP_HOST || '❌ Missing',
                SMTP_PORT: process.env.SMTP_PORT || '❌ Missing',
                SMTP_SECURE: process.env.SMTP_SECURE || '❌ Missing',
                SMTP_USER: process.env.SMTP_USER || '❌ Missing',
                SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '✅ Set' : '❌ Missing',
                SMTP_FROM: process.env.SMTP_FROM || '❌ Missing'
            };

            // Test SendGrid configuration
            const config = {
                host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true',
                user: process.env.SMTP_USER || 'apikey',
                password: process.env.SMTP_PASSWORD || process.env.SENDGRID_API_KEY || '',
                from: process.env.SMTP_FROM || 'Evently <noreply@evently.com>'
            };

            const configCheck = {
                host: config.host,
                port: config.port,
                secure: config.secure,
                user: config.user,
                password: config.password ? '✅ Set' : '❌ Missing',
                from: config.from
            };

            let connectionTest = '❌ Not tested';
            let emailTest = '❌ Not tested';

            // Test connection if API key is available
            if (config.password) {
                try {
                    const transporter = nodemailer.createTransport({
                        host: config.host,
                        port: config.port,
                        secure: config.secure,
                        auth: {
                            user: config.user,
                            pass: config.password,
                        },
                        connectionTimeout: 60000,
                        greetingTimeout: 30000,
                        socketTimeout: 60000,
                        pool: true,
                        maxConnections: 5
                    });

                    await transporter.verify();
                    connectionTest = '✅ Success';

                    // Try sending a test email
                    const info = await transporter.sendMail({
                        from: config.from,
                        to: 'nutalapatisrikrishna85@gmail.com',
                        subject: '🧪 Render Debug Test - SendGrid',
                        html: '<h2>✅ SendGrid is working on Render!</h2><p>This email was sent from the debug route.</p>'
                    });

                    emailTest = `✅ Sent (ID: ${info.messageId})`;

                } catch (error: any) {
                    connectionTest = `❌ Failed: ${error.message}`;
                    emailTest = `❌ Failed: ${error.message}`;
                }
            }

            res.json({
                success: true,
                message: 'Email configuration debug report',
                data: {
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV,
                    environmentVariables: envCheck,
                    configuration: configCheck,
                    connectionTest,
                    emailTest
                }
            });

        } catch (error: any) {
            console.error('❌ Email debug error:', error);
            res.status(500).json({
                success: false,
                error: 'Debug route failed',
                details: error.message
            });
        }
    }
}