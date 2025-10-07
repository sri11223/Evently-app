// Debug route for checking email configuration on Render
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

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

            const useSendGridAPI = !!(process.env.SENDGRID_API_KEY && process.env.NODE_ENV === 'production');
            let webApiTest = '❌ Not tested';
            let smtpTest = '❌ Not tested';

            // Test SendGrid Web API
            if (process.env.SENDGRID_API_KEY) {
                try {
                    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                    
                    const msg = {
                        to: 'nutalapatisrikrishna85@gmail.com',
                        from: process.env.SMTP_FROM || 'Evently <noreply@evently.com>',
                        subject: '🧪 Render Debug - SendGrid Web API Test',
                        html: '<h2>✅ SendGrid Web API is working on Render!</h2><p>This email was sent using SendGrid Web API.</p>'
                    };

                    const [response] = await sgMail.send(msg);
                    webApiTest = `✅ Success (Status: ${response.statusCode})`;

                } catch (error: any) {
                    webApiTest = `❌ Failed: ${error.message}`;
                }
            } else {
                webApiTest = '❌ No API key configured';
            }

            // Test SMTP (only if not using Web API)
            if (!useSendGridAPI && process.env.SMTP_PASSWORD) {
                try {
                    const config = {
                        host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: process.env.SMTP_SECURE === 'true',
                        user: process.env.SMTP_USER || 'apikey',
                        password: process.env.SMTP_PASSWORD,
                    };

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
                    });

                    await transporter.verify();
                    smtpTest = '✅ Connection verified';

                } catch (error: any) {
                    smtpTest = `❌ Failed: ${error.message}`;
                }
            }

            res.json({
                success: true,
                message: 'Email configuration debug report',
                data: {
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV,
                    methodUsed: useSendGridAPI ? 'SendGrid Web API' : 'SMTP',
                    environmentVariables: envCheck,
                    sendGridWebApiTest: webApiTest,
                    smtpTest: smtpTest,
                    recommendation: useSendGridAPI ? 
                        'Using SendGrid Web API (recommended for production)' : 
                        'Using SMTP (recommended for development)'
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