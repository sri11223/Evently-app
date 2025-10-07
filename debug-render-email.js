// Debug Render environment variables
console.log('🔍 Render Environment Debug:');
console.log('================================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ Missing');
console.log('SMTP_HOST:', process.env.SMTP_HOST || '❌ Missing');
console.log('SMTP_PORT:', process.env.SMTP_PORT || '❌ Missing');
console.log('SMTP_SECURE:', process.env.SMTP_SECURE || '❌ Missing');
console.log('SMTP_USER:', process.env.SMTP_USER || '❌ Missing');
console.log('SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✅ Set' : '❌ Missing');
console.log('SMTP_FROM:', process.env.SMTP_FROM || '❌ Missing');
console.log('================================');

// Test SendGrid configuration
const nodemailer = require('nodemailer');

async function testRenderSendGrid() {
    console.log('🧪 Testing SendGrid on Render...');
    
    const config = {
        host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || 'apikey',
        password: process.env.SMTP_PASSWORD || process.env.SENDGRID_API_KEY || '',
        from: process.env.SMTP_FROM || 'Evently <noreply@evently.com>'
    };
    
    console.log('📧 Config:', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        password: config.password ? '✅ Set' : '❌ Missing',
        from: config.from
    });
    
    if (!config.password) {
        console.log('❌ No SendGrid API key configured!');
        return;
    }
    
    const transporter = nodemailer.createTransporter({
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

    try {
        console.log('⏳ Verifying connection...');
        await transporter.verify();
        console.log('✅ SendGrid connection successful!');
        
        console.log('📧 Sending test email...');
        const info = await transporter.sendMail({
            from: config.from,
            to: 'nutalapatisrikrishna85@gmail.com',
            subject: '🧪 Render Test - SendGrid Working!',
            html: '<h2>✅ SendGrid is working on Render!</h2>'
        });
        
        console.log('✅ Test email sent:', info.messageId);
        
    } catch (error) {
        console.error('❌ SendGrid test failed:', error.message);
        console.error('🔍 Full error:', error);
    }
}

testRenderSendGrid();