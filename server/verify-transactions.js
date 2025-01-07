const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lifestyle_calculator',
    password: '1234',
    port: 5432,
});

async function verifyTransactionsTable() {
    try {
        // Drop existing transactions table
        console.log('Dropping existing transactions table...');
        await pool.query('DROP TABLE IF EXISTS transactions');
        
        // Create transactions table with proper constraints
        console.log('Creating transactions table...');
        await pool.query(`
            CREATE TABLE transactions (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
                amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
                category VARCHAR(50) NOT NULL,
                description TEXT,
                date TIMESTAMP NOT NULL,
                timestamp TIMESTAMP NOT NULL
            )
        `);

        // Test insert
        console.log('\nTesting transaction insert...');
        const testTransaction = {
            id: 'test-' + Date.now(),
            user_id: 'default',
            type: 'income',
            amount: 100.00,
            category: 'Salary',
            description: 'Test transaction',
            date: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        await pool.query(`
            INSERT INTO transactions 
            (id, user_id, type, amount, category, description, date, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            testTransaction.id,
            testTransaction.user_id,
            testTransaction.type,
            testTransaction.amount,
            testTransaction.category,
            testTransaction.description,
            testTransaction.date,
            testTransaction.timestamp
        ]);

        console.log('✓ Test transaction inserted successfully');

        // Verify the insert
        const result = await pool.query('SELECT * FROM transactions WHERE id = $1', [testTransaction.id]);
        console.log('\nVerifying inserted transaction:');
        console.log(result.rows[0]);

        // Clean up test data
        await pool.query('DELETE FROM transactions WHERE id = $1', [testTransaction.id]);
        console.log('\n✓ Test transaction cleaned up');
        
        console.log('\n✓ Transactions table verified successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error verifying transactions table:', error);
        process.exit(1);
    }
}

verifyTransactionsTable();
