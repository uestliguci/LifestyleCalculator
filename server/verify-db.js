const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lifestyle_calculator',
    password: '1234',
    port: 5432,
});

async function verifyDatabase() {
    try {
        // Test connection
        console.log('Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✓ Database connection successful');

        // Check users table
        console.log('\nChecking users table...');
        const tableResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        if (tableResult.rows[0].exists) {
            console.log('✓ Users table exists');
        } else {
            console.log('✗ Users table does not exist');
        }

        // Check users
        console.log('\nChecking users...');
        const usersResult = await pool.query('SELECT username, password FROM users');
        console.log(`Found ${usersResult.rows.length} users:`);
        usersResult.rows.forEach(user => {
            console.log(`- Username: ${user.username}`);
            console.log(`  Password hash length: ${user.password.length}`);
            console.log(`  Password hash: ${user.password}`);
        });

        // Check transactions table
        console.log('\nChecking transactions table...');
        const transTableResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'transactions'
            );
        `);
        if (transTableResult.rows[0].exists) {
            console.log('✓ Transactions table exists');
        } else {
            console.log('✗ Transactions table does not exist');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error verifying database:', error);
        process.exit(1);
    }
}

verifyDatabase();
