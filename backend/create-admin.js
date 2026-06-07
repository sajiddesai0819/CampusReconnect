require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = connectionString 
    ? new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'demo_5',
        password: process.env.DB_PASSWORD || 'sajid121',
        port: process.env.DB_PORT || 5432,
    });

async function createAdmin() {
    const adminEmail = 'admin@campus.reconnect';
    const adminPassword = 'adminpass';
    const adminUsername = 'admin';
    const adminUsn = 'ADMIN';

    try {
        console.log('Connecting to database...');
        
        // Check if admin already exists
        const existingAdmin = await pool.query('SELECT * FROM users WHERE email = $1 OR usn = $2', [adminEmail, adminUsn]);
        
        if (existingAdmin.rows.length > 0) {
            console.log('Admin account already exists. Updating password...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await pool.query(
                'UPDATE users SET password_hash = $1, role = $2, username = $3 WHERE email = $4 OR usn = $5',
                [hashedPassword, 'admin', adminUsername, adminEmail, adminUsn]
            );
            console.log('✅ Admin password updated successfully!');
        } else {
            console.log('Creating new admin account...');
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await pool.query(
                'INSERT INTO users (username, email, password_hash, usn, role) VALUES ($1, $2, $3, $4, $5)',
                [adminUsername, adminEmail, hashedPassword, adminUsn, 'admin']
            );
            console.log('✅ Admin account created successfully!');
        }

        console.log('\n📧 Admin Login Credentials:');
        console.log('   Email: admin@campus.reconnect');
        console.log('   USN: ADMIN');
        console.log('   Password: adminpass');
        console.log('\n⚠️  WARNING: Please change the default password after first login!');
        
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
        await pool.end();
        process.exit(1);
    }
}

createAdmin();

