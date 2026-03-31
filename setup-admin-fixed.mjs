// setup-admin-fixed.mjs
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

// Hash password using PBKDF2 (matching auth-utils.ts)
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function setupUsers(connection) {
  // Check if admin user exists
  const [adminRows] = await connection.execute(
    'SELECT id FROM users WHERE username = ?',
    ['admin']
  );

  if (adminRows.length > 0) {
    console.log('Admin user already exists. Updating password...');
    const passwordHash = hashPassword('admin123');
    await connection.execute(
      'UPDATE users SET passwordHash = ?, isActive = 1 WHERE username = ?',
      [passwordHash, 'admin']
    );
    console.log('✓ Admin user password updated: admin / admin123');
  } else {
    console.log('Creating admin user...');
    const passwordHash = hashPassword('admin123');
    const openId = 'admin-' + Date.now();
    
    await connection.execute(
      `INSERT INTO users (openId, email, username, passwordHash, name, role, isActive, loginMethod, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        openId,
        'admin@example.com',
        'admin',
        passwordHash,
        'Admin User',
        'admin',
        1,
        'local',
        new Date(),
        new Date(),
        new Date(),
      ]
    );
    console.log('✓ Admin user created: admin / admin123');
  }

  // Create a test employee user
  const [empRows] = await connection.execute(
    'SELECT id FROM users WHERE username = ?',
    ['employee']
  );

  if (empRows.length === 0) {
    console.log('Creating employee user...');
    const passwordHash = hashPassword('employee123');
    const openId = 'employee-' + Date.now();
    
    await connection.execute(
      `INSERT INTO users (openId, email, username, passwordHash, name, role, isActive, loginMethod, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        openId,
        'employee@example.com',
        'employee',
        passwordHash,
        'Employee User',
        'user',
        1,
        'local',
        new Date(),
        new Date(),
        new Date(),
      ]
    );
    console.log('✓ Employee user created: employee / employee123');
  } else {
    console.log('Employee user already exists.');
  }

  console.log('\n✓ Setup complete!');
  console.log('\nLogin credentials:');
  console.log('  Admin: admin / admin123');
  console.log('  Employee: employee / employee123');
}

async function setupAdmin() {
  const dbUrl = process.env.DATABASE_URL;
  console.log('DATABASE_URL from env:', dbUrl ? 'Found' : 'Not found');
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.log('\nTrying direct connection with inspection_user...');
    
    try {
      // Try direct connection with the user we just created
      const fallbackHost = process.env.MYSQL_HOST || '127.0.0.1';
      const fallbackPort = Number(process.env.MYSQL_PORT || 3306);

      const connection = await mysql.createConnection({
        host: fallbackHost,
        port: fallbackPort,
        user: 'inspection_user',
        password: 'secure_password_123',
        database: 'inspection_dashboard'
      });
      
      console.log('✅ Connected directly with inspection_user!');
      await setupUsers(connection);
      await connection.end();
    } catch (directError) {
      console.error('❌ Direct connection failed:', directError.message);
      process.exit(1);
    }
    
    return;
  }

  try {
    // Parse the database URL
    const url = new URL(dbUrl);
    console.log('Connecting to database:', url.hostname);
    
    const connection = await mysql.createConnection({
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      port: url.port || 3306,
    });

    try {
      await setupUsers(connection);
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('Error setting up users:', error);
    process.exit(1);
  }
}

setupAdmin();