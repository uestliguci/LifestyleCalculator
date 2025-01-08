const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lifestyle_calculator',
    password: '1234',
    port: 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// Add error handler for pool
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

// Initialize database
app.post('/init', async (req, res) => {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL
            )
        `);

        // Create transactions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id VARCHAR(50) PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT,
                date TIMESTAMP NOT NULL,
                timestamp TIMESTAMP NOT NULL
            )
        `);

        // Add default users if they don't exist
        const saltRounds = 10;
        const users = [
            { username: 'user1', password: await bcrypt.hash('password1', saltRounds) },
            { username: 'user2', password: await bcrypt.hash('password2', saltRounds) }
        ];

        for (const user of users) {
            await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
                [user.username, user.password]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Database initialization error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Add transaction
app.post('/transactions', async (req, res) => {
    try {
        console.log('Received transaction:', req.body);
        const { id, user_id, type, amount, category, description, date, timestamp } = req.body;
        
        // Validate required fields
        if (!id || !type || !amount || !category || !date || !timestamp) {
            console.error('Missing required fields:', { id, type, amount, category, date, timestamp });
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields',
                received: { id, type, amount, category, date, timestamp }
            });
        }

        // Use default user_id if not provided
        const userId = user_id || 'default';

        // Log the query parameters
        console.log('Executing query with params:', [id, userId, type, amount, category, description || '', date, timestamp]);

        const result = await pool.query(
            'INSERT INTO transactions (id, user_id, type, amount, category, description, date, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [id, userId, type, amount, category, description || '', date, timestamp]
        );

        console.log('Transaction added successfully:', result.rows[0]);
        res.json({ success: true, transaction: result.rows[0] });
    } catch (error) {
        console.error('Add transaction error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.detail || error.toString()
        });
    }
});

// Get all transactions
app.get('/transactions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM transactions ORDER BY date DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user transactions
app.get('/transactions/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC',
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get user transactions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update transaction
app.put('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, amount, category, description } = req.body;
        
        const result = await pool.query(
            'UPDATE transactions SET type = $1, amount = $2, category = $3, description = $4 WHERE id = $5 RETURNING *',
            [type, amount, category, description, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        res.json({ success: true, transaction: result.rows[0] });
    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete transaction
app.delete('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Import transactions
app.post('/transactions/import', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        for (const transaction of req.body) {
            await client.query(
                'INSERT INTO transactions (id, user_id, type, amount, category, description, date, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET type = $3, amount = $4, category = $5, description = $6, date = $7, timestamp = $8',
                [transaction.id, transaction.user_id, transaction.type, transaction.amount, transaction.category, transaction.description, transaction.date, transaction.timestamp]
            );
        }
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Import error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        client.release();
    }
});

// User authentication
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt for user:', username);
        
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        console.log('Found users:', result.rows.length);
        
        if (result.rows.length === 0) {
            console.log('No user found with username:', username);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = result.rows[0];
        console.log('Stored password hash:', user.password);
        
        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password valid:', validPassword);
        
        if (!validPassword) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        console.log('Login successful for user:', username);
        res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
