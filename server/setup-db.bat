@echo off
echo Setting up PostgreSQL database...

REM Run the SQL script using psql
psql -U postgres -f init-db.sql

echo Database setup complete!
