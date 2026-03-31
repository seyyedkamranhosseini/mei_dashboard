// check-users.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkUsers() {
  const dbUrl = process.env.DATABASE_URL;
  const connection = dbUrl
    ? await mysql.createConnection(dbUrl)
    : await mysql.createConnection({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: 'inspection_user',
        password: 'secure_password_123',
        database: 'inspection_dashboard',
      });

  try {
    console.log('Connected to database. Checking users...\n');
    
    const [rows] = await connection.query('SELECT id, username, email, role, isActive FROM users');
    
    if (rows.length === 0) {
      console.log('No users found in the database.');
    } else {
      console.log(`Found ${rows.length} user(s):\n`);
      rows.forEach((user, index) => {
        console.log(`User ${index + 1}:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Active: ${user.isActive ? 'Yes' : 'No'}`);
        console.log('  ---');
      });
    }

    // Also check the table structure
    console.log('\nChecking table structure...');
    const [columns] = await connection.query('DESCRIBE users');
    console.log('Users table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
    console.log('\nDatabase connection closed.');
  }
}

checkUsers();