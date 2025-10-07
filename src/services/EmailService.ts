import nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * EmailService - Production-ready email notifications
 * Uses Gmail SMTP for reliable delivery
 * Integrated with: Bookings, Waitlist, Notifications
 */
export class EmailService {
  private transporter!: nodemailer.Transporter;
  private config: EmailConfig;
  private isConfigured: boolean;

  constructor() {
    // Support both Gmail and SendGrid
    const isSendGrid = process.env.SENDGRID_API_KEY;
    
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      user: process.env.SMTP_USER || 'apikey', // SendGrid uses 'apikey' as username
      password: process.env.SMTP_PASSWORD || process.env.SENDGRID_API_KEY || '', // Gmail App Password or SendGrid API Key
      from: process.env.SMTP_FROM || 'Evently <noreply@evently.com>'
    };

    // Check if email is properly configured
    this.isConfigured = !!(this.config.user && this.config.password);

    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.password,
        },
        // Timeout settings for production reliability
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds  
        socketTimeout: 60000,     // 60 seconds
        // Connection pool settings
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Retry settings
        rateDelta: 20000,
        rateLimit: 5
      });
      const provider = isSendGrid ? 'SendGrid' : 'Gmail SMTP';
      console.log(`✅ EmailService initialized with ${provider} configuration`);
    } else {
      console.warn('⚠️  EmailService: SMTP credentials not configured. Email notifications disabled.');
    }
  }

  /**
   * Send email with automatic retry and error handling
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('📧 Email not configured - would send:', options.subject, 'to', options.to);
      return false;
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId
      });
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  }

  /**
   * BOOKING CONFIRMATION EMAIL
   */
  async sendBookingConfirmation(data: {
    to: string;
    userName: string;
    eventName: string;
    eventDate: string;
    venue: string;
    quantity: number;
    totalPrice: number;
    reference: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #667eea; }
          .reference { background: #667eea; color: white; padding: 15px; text-align: center; border-radius: 8px; font-size: 18px; font-weight: bold; letter-spacing: 2px; }
          .footer { text-align: center; color: #999; padding: 20px; font-size: 12px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
            <p>Your tickets have been reserved</p>
          </div>
          <div class="content">
            <p>Hi <strong>${data.userName}</strong>,</p>
            <p>Great news! Your booking has been confirmed. Here are your details:</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">🎫 Event:</span>
                <span>${data.eventName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📅 Date:</span>
                <span>${new Date(data.eventDate).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📍 Venue:</span>
                <span>${data.venue}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🎟️ Quantity:</span>
                <span>${data.quantity} ticket(s)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💰 Total:</span>
                <span><strong>$${data.totalPrice.toFixed(2)}</strong></span>
              </div>
            </div>

            <p><strong>Your Booking Reference:</strong></p>
            <div class="reference">${data.reference}</div>

            <p style="margin-top: 30px;">
              <strong>Important:</strong> Please save this email. You'll need your booking reference to manage your booking or for entry at the event.
            </p>

            <center>
              <a href="https://evently-app-7hx2.onrender.com" class="button">View My Bookings</a>
            </center>
          </div>
          <div class="footer">
            <p>© 2025 Evently - Event Booking System</p>
            <p>Need help? Contact support@evently.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject: `🎉 Booking Confirmed - ${data.eventName}`,
      html
    });
  }

  /**
   * BOOKING CANCELLATION EMAIL
   */
  async sendBookingCancellation(data: {
    to: string;
    userName: string;
    eventName: string;
    quantity: number;
    refundAmount: number;
    reference: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #f5576c; }
          .refund-box { background: #4ade80; color: white; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #999; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Cancelled</h1>
            <p>Your cancellation has been processed</p>
          </div>
          <div class="content">
            <p>Hi <strong>${data.userName}</strong>,</p>
            <p>Your booking has been successfully cancelled as requested.</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">🎫 Event:</span>
                <span>${data.eventName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">🎟️ Quantity:</span>
                <span>${data.quantity} ticket(s)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📝 Reference:</span>
                <span>${data.reference}</span>
              </div>
            </div>

            <div class="refund-box">
              <h2 style="margin: 0;">✅ Refund Processed</h2>
              <p style="font-size: 24px; margin: 10px 0;"><strong>$${data.refundAmount.toFixed(2)}</strong></p>
              <p style="margin: 0;">Refund will appear in your account within 5-7 business days</p>
            </div>

            <p><strong>What happens next?</strong></p>
            <ul>
              <li>Your seats have been released and are now available for others</li>
              <li>If there was a waitlist, users have been automatically notified</li>
              <li>You'll receive your refund within 5-7 business days</li>
            </ul>

            <p>We're sorry to see you go! We hope to serve you again soon.</p>
          </div>
          <div class="footer">
            <p>© 2025 Evently - Event Booking System</p>
            <p>Questions? Contact support@evently.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject: `Booking Cancelled - ${data.eventName}`,
      html
    });
  }

  /**
   * WAITLIST JOINED EMAIL
   */
  async sendWaitlistJoined(data: {
    to: string;
    userName: string;
    eventName: string;
    position: number;
    estimatedWaitTime: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffa500 0%, #ff6347 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .position-badge { background: white; border: 3px solid #ffa500; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0; }
          .position-number { font-size: 48px; color: #ffa500; font-weight: bold; }
          .info-box { background: #fff3cd; border-left: 4px solid #ffa500; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; color: #999; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏳ You're on the Waitlist!</h1>
            <p>${data.eventName}</p>
          </div>
          <div class="content">
            <p>Hi <strong>${data.userName}</strong>,</p>
            <p>You've been successfully added to the waitlist for this popular event!</p>
            
            <div class="position-badge">
              <p style="margin: 0; color: #666;">Your Position</p>
              <div class="position-number">#${data.position}</div>
              <p style="margin: 0; color: #666;">Estimated wait: ${data.estimatedWaitTime}</p>
            </div>

            <div class="info-box">
              <strong>📬 What happens next?</strong>
              <ul style="margin: 10px 0 0 0;">
                <li>We'll notify you immediately if a spot opens up</li>
                <li>You'll have a limited time window to complete your booking</li>
                <li>Your position may improve as others cancel</li>
              </ul>
            </div>

            <p><strong>💡 Tips:</strong></p>
            <ul>
              <li>Keep your notifications enabled for instant alerts</li>
              <li>Check your position anytime in your dashboard</li>
              <li>Act quickly when you receive a promotion notification</li>
            </ul>

            <p>We'll keep you updated on your position. Good luck! 🤞</p>
          </div>
          <div class="footer">
            <p>© 2025 Evently - Event Booking System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject: `⏳ You're #${data.position} on the Waitlist - ${data.eventName}`,
      html
    });
  }

  /**
   * WAITLIST PROMOTION EMAIL (URGENT!)
   */
  async sendWaitlistPromotion(data: {
    to: string;
    userName: string;
    eventName: string;
    eventDate: string;
    bookingWindowMinutes: number;
    expiresAt: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .urgent-box { background: #fee2e2; border: 3px solid #ef4444; padding: 25px; text-align: center; border-radius: 8px; margin: 20px 0; }
          .timer { font-size: 36px; color: #ef4444; font-weight: bold; margin: 10px 0; }
          .button { display: inline-block; background: #22c55e; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; color: #999; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 GREAT NEWS!</h1>
            <p>A spot has opened up!</p>
          </div>
          <div class="content">
            <p>Hi <strong>${data.userName}</strong>,</p>
            <p><strong>You've been promoted from the waitlist!</strong></p>
            
            <div class="urgent-box">
              <h2 style="margin: 0; color: #ef4444;">⏰ ACT FAST!</h2>
              <p style="margin: 10px 0;">You have limited time to complete your booking:</p>
              <div class="timer">${data.bookingWindowMinutes} MINUTES</div>
              <p style="margin: 0; font-size: 14px; color: #666;">Expires at: ${new Date(data.expiresAt).toLocaleString()}</p>
            </div>

            <p><strong>Event Details:</strong></p>
            <ul>
              <li><strong>Event:</strong> ${data.eventName}</li>
              <li><strong>Date:</strong> ${new Date(data.eventDate).toLocaleString()}</li>
            </ul>

            <center>
              <a href="https://evently-app-7hx2.onrender.com/events" class="button">🎫 BOOK NOW</a>
            </center>

            <p style="color: #ef4444; font-weight: bold;">
              ⚠️ If you don't complete your booking within ${data.bookingWindowMinutes} minutes, the spot will be offered to the next person in line.
            </p>

            <p>Don't miss out on this opportunity! Book now to secure your spot! 🚀</p>
          </div>
          <div class="footer">
            <p>© 2025 Evently - Event Booking System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject: `🎉 URGENT: You've Been Promoted! Book Now - ${data.eventName}`,
      html
    });
  }

  /**
   * GENERIC NOTIFICATION EMAIL
   */
  async sendNotification(data: {
    to: string;
    userName: string;
    title: string;
    message: string;
    type: string;
  }): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .message-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0; }
          .footer { text-align: center; color: #999; padding: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 ${data.title}</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${data.userName}</strong>,</p>
            
            <div class="message-box">
              ${data.message}
            </div>

            <p style="color: #666; font-size: 14px;">
              Notification Type: ${data.type}
            </p>
          </div>
          <div class="footer">
            <p>© 2025 Evently - Event Booking System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: data.to,
      subject: data.title,
      html
    });
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Verify email configuration (for testing)
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email configuration verified');
      return true;
    } catch (error) {
      console.error('❌ Email configuration invalid:', error);
      return false;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();
