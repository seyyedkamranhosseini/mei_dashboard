import mysql from 'mysql2/promise';
import crypto from 'crypto';

// Hash password using PBKDF2
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function setupAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inspection_dashboard',
    port: process.env.DB_PORT || 3306,
  });

  try {
    // Check if admin user exists
    const [rows] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      ['admin']
    );

    if (rows.length > 0) {
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
  } catch (error) {
    console.error('Error setting up admin user:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupAdmin();
