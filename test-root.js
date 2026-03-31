// test-root.js
import mysql from 'mysql2/promise';

async function testRoot() {
  try {
    console.log('Testing connection with root...');
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root1234'
    });
    
    console.log('✅ Connected successfully as root!');
    
    // Show databases
    const [rows] = await connection.query('SHOW DATABASES');
    console.log('\nExisting databases:');
    rows.forEach(row => console.log(`  - ${row.Database}`));
    
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

testRoot();