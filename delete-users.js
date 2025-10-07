// Delete users from production database
const { Pool } = require('pg');

async function deleteUsers() {
    // Use your Render database URL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔍 Connecting to production database...');
        
        // List current users first
        const users = await pool.query('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 10');
        console.log('\n📋 Current users:');
        users.rows.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} (${user.name}) - ${user.created_at}`);
        });

        // Delete specific emails (update these as needed)
        const emailsToDelete = [
            'testuser@example.com',
            'codexclubiot@gmail.com',
            'srikrishnanutalapati@gmail.com',
            'srisarhya@gmail.com'
            // Add more emails here as needed
        ];

        console.log('\n🗑️ Deleting users...');
        for (const email of emailsToDelete) {
            const result = await pool.query('DELETE FROM users WHERE email = $1', [email]);
            if (result.rowCount > 0) {
                console.log(`✅ Deleted: ${email}`);
            } else {
                console.log(`ℹ️ Not found: ${email}`);
            }
        }

        // Show remaining users
        const remainingUsers = await pool.query('SELECT COUNT(*) as count FROM users');
        console.log(`\n📊 Remaining users: ${remainingUsers.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
        console.log('🔐 Database connection closed');
    }
}

// Set your production database URL here
process.env.DATABASE_URL = 'postgresql://evnetly_user:9LlHyDqmXVHF026Zrcnw3ahfPHvX282j@dpg-d33duf3e5dus73e79l30-a.oregon-postgres.render.com/evnetly';

deleteUsers();