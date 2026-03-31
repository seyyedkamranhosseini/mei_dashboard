// setup-mysql-user.js
import mysql from 'mysql2/promise';

async function setupMySQLUser() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root1234'
  });

  try {
    console.log('Connected to MySQL as root...');
    
    // Create user if not exists
    console.log('\n1. Creating user...');
    await connection.query(`
      CREATE USER IF NOT EXISTS 'inspection_user'@'localhost' 
      IDENTIFIED BY 'secure_password_123'
    `);
    console.log('✅ User "inspection_user" created or already exists');
    
    // Grant privileges on the existing database
    console.log('\n2. Granting privileges...');
    await connection.query(`
      GRANT ALL PRIVILEGES ON inspection_dashboard.* 
      TO 'inspection_user'@'localhost'
    `);
    console.log('✅ Privileges granted');
    
    // Grant additional privileges for future operations
    await connection.query(`
      GRANT CREATE, ALTER, DROP, INDEX, LOCK TABLES, REFERENCES, 
      CREATE TEMPORARY TABLES, EXECUTE, CREATE VIEW, SHOW VIEW,
      CREATE ROUTINE, ALTER ROUTINE, EVENT, TRIGGER 
      ON inspection_dashboard.* TO 'inspection_user'@'localhost'
    `);
    console.log('✅ Additional privileges granted');
    
    // Flush privileges
    await connection.query('FLUSH PRIVILEGES');
    console.log('✅ Privileges flushed');
    
    // Verify the user can connect
    console.log('\n3. Testing connection as inspection_user...');
    const testConn = await mysql.createConnection({
      host: 'localhost',
      user: 'inspection_user',
      password: 'secure_password_123',
      database: 'inspection_dashboard'
    });
    
    const [tables] = await testConn.query('SHOW TABLES');
    console.log(`✅ Successfully connected as inspection_user`);
    console.log(`   Found ${tables.length} tables in database`);
    
    await testConn.end();
    
    console.log('\n🎉 MySQL user setup complete!');
    console.log('\nYou can now run: node setup-admin-app.mjs');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

setupMySQLUser();