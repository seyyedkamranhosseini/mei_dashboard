// test-mysql.js
import mysql from 'mysql2/promise';

async function testMySQL() {
  console.log('Testing MySQL connections...\n');
  
  // Common passwords to try
  const passwords = ['', 'root', 'password', 'mysql', '123456', 'admin', ' '];
  
  for (const pwd of passwords) {
    try {
      console.log(`Trying password: "${pwd}"`);
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: pwd,
      });
      console.log(`✅ SUCCESS! Connected with password: "${pwd}"`);
      
      // Get MySQL version
      const [rows] = await conn.query('SELECT VERSION() as version');
      console.log(`   MySQL Version: ${rows[0].version}`);
      
      await conn.end();
      return pwd;
    } catch (err) {
      if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.log(`❌ Access denied with password: "${pwd}"`);
      } else if (err.code === 'ECONNREFUSED') {
        console.log('❌ MySQL is not running! Start MySQL in XAMPP');
        return null;
      } else {
        console.log(`❌ Other error: ${err.message}`);
      }
    }
  }
  
  console.log('\n❌ Could not connect with any common passwords.');
  console.log('\nPlease check:');
  console.log('1. Is MySQL running? (Open XAMPP Control Panel and start MySQL)');
  console.log('2. What is your MySQL root password?');
  console.log('3. Try connecting manually:');
  console.log('   - Open Command Prompt');
  console.log('   - Run: mysql -u root -p');
  console.log('   - Press Enter for empty password or type your password');
}

// Also try connecting via XAMPP's default socket
async function tryXAMPPConnection() {
  try {
    console.log('\nTrying XAMPP default connection...');
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      port: 3306
    });
    console.log('✅ Connected to XAMPP MySQL with empty password!');
    await conn.end();
    return '';
  } catch (err) {
    console.log('❌ XAMPP connection failed');
    return null;
  }
}

// Run both tests
async function run() {
  console.log('=== MySQL Connection Test ===\n');
  
  // First try XAMPP default
  const xamppPassword = await tryXAMPPConnection();
  if (xamppPassword !== null) {
    console.log('\n✅ XAMPP MySQL is working with empty password!');
    return;
  }
  
  // Then try common passwords
  const workingPassword = await testMySQL();
  
  if (workingPassword !== undefined) {
    console.log(`\n✅ Found working password: "${workingPassword}"`);
    console.log('\nYou can now:');
    console.log('1. Update your .env file with this password');
    console.log('2. Or create the database user with: node setup-db-user.js');
  }
}

run();