-- Create database
CREATE DATABASE lifestyle_calculator;

-- Connect to database
\c lifestyle_calculator;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    date TIMESTAMP NOT NULL,
    timestamp TIMESTAMP NOT NULL
);

-- Insert default users (passwords will be hashed by the server)
INSERT INTO users (username, password) VALUES 
    ('user1', 'password1'),
    ('user2', 'password2')
ON CONFLICT (username) DO NOTHING;
