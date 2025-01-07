const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lifestyle_calculator',
    password: '1234',
    port: 5432,
});

async function hashPasswords() {
    try {
        const saltRounds = 10;
        const users = [
            { username: 'user1', password: 'password1' },
            { username: 'user2', password: 'password2' }
        ];

        for (const user of users) {
            // First, delete existing users
            await pool.query('DELETE FROM users WHERE username = $1', [user.username]);
            
            // Then insert with hashed password
            const hashedPassword = await bcrypt.hash(user.password, saltRounds);
            await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2)',
                [user.username, hashedPassword]
            );
            console.log(`Updated password for ${user.username}`);
        }

        console.log('All passwords hashed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error hashing passwords:', error);
        process.exit(1);
    }
}

hashPasswords();
