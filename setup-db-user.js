// setup-db-user.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;

const appDbName = process.env.APP_DB_NAME || (dbUrl ? dbUrl.pathname.replace(/^\//, '') : 'inspection_dashboard');
const appDbUser = process.env.APP_DB_USER || (dbUrl && dbUrl.username && dbUrl.username !== 'root' ? dbUrl.username : 'inspection_user');
const appDbPassword = process.env.APP_DB_PASSWORD || (dbUrl && dbUrl.username && dbUrl.username !== 'root' ? dbUrl.password : 'secure_password_123');

const rootHost = process.env.MYSQL_HOST || (dbUrl ? dbUrl.hostname : 'localhost');
const rootPort = Number(process.env.MYSQL_PORT || (dbUrl && dbUrl.port ? dbUrl.port : '3306'));
const rootUser = process.env.MYSQL_ROOT_USER || (dbUrl && dbUrl.username === 'root' ? dbUrl.username : 'root');
const rootPassword = process.env.MYSQL_ROOT_PASSWORD || (dbUrl && dbUrl.username === 'root' ? dbUrl.password : '');

async function createDatabaseUser() {
  let connection;
  
  try {
    console.log('Attempting to connect to MySQL as root...');
    console.log(`Host: ${rootHost}:${rootPort} | User: ${rootUser}`);

    connection = await mysql.createConnection({
      host: rootHost,
      port: rootPort,
      user: rootUser,
      password: rootPassword,
    });

    console.log('✅ Connected to MySQL successfully!');
    
    // Create database
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${appDbName}\``);
    console.log(`✓ Database ${appDbName} created or already exists`);
    
    // Create user
    await connection.query(`
      CREATE USER IF NOT EXISTS '${appDbUser}'@'localhost' 
      IDENTIFIED BY '${appDbPassword}'
    `);
    console.log(`✓ User ${appDbUser} created or already exists`);
    
    // Grant privileges
    await connection.query(`
      GRANT ALL PRIVILEGES ON \`${appDbName}\`.* 
      TO '${appDbUser}'@'localhost'
    `);
    console.log('✓ Privileges granted');
    
    // Flush privileges
    await connection.query('FLUSH PRIVILEGES');
    console.log('✓ Privileges flushed');
    
    console.log('\n✅ Database user setup complete!');
    console.log('You can now run: pnpm db:push');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\nPlease check:');
      console.log('1. Is MySQL running?');
      console.log('2. Is your root password correct?');
      console.log('3. Try these solutions:');
      console.log('\n   a) Set MYSQL_ROOT_PASSWORD (and optionally MYSQL_ROOT_USER, MYSQL_HOST, MYSQL_PORT) in .env');
      console.log('      Example: MYSQL_ROOT_PASSWORD=your_password');
      console.log('\n   b) If your DATABASE_URL uses root, update the password there');
      console.log('\n   c) Reset MySQL root password (if forgotten):');
      console.log('      Stop MySQL in XAMPP');
      console.log('      Run: mysqld --skip-grant-tables');
      console.log('      Then in another terminal: mysql -u root');
      console.log('      Then run: FLUSH PRIVILEGES;');
      console.log('      ALTER USER "root"@"localhost" IDENTIFIED BY "new_password";');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createDatabaseUser();