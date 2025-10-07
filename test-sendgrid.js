// Quick SendGrid test script
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSendGrid() {
    console.log('🧪 Testing SendGrid configuration...');
    
    const transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY || process.env.SMTP_PASSWORD
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000
    });

    try {
        // Verify connection
        console.log('⏳ Verifying SendGrid connection...');
        await transporter.verify();
        console.log('✅ SendGrid connection successful!');
        
        // Send test email
        console.log('📧 Sending test email...');
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@evently.com',
            to: 'nutalapatisrikrishna85@gmail.com', // Your email
            subject: '🧪 SendGrid Test - Evently',
            html: '<h2>✅ SendGrid is working!</h2><p>Email timeout issue has been resolved.</p>'
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('📧 Message ID:', info.messageId);
        
    } catch (error) {
        console.error('❌ SendGrid test failed:', error.message);
        console.error('🔍 Error details:', error);
    }
}

testSendGrid();