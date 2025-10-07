// Test user registration locally
const testUserRegistration = async () => {
    try {
        const response = await fetch('http://localhost:3000/api/v1/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'codexclubiot@gmail.com',
                name: 'Test User',
                password: 'testpassword123'
            })
        });

        const result = await response.json();
        console.log('🧪 Registration Response:', result);
        console.log('📧 Check server logs for email sending status');
        
    } catch (error) {
        console.error('❌ Registration test failed:', error);
    }
};

// Run the test
testUserRegistration();