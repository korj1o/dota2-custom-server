const { Pool } = require('pg');
require('dotenv').config();

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Testing database connection...');
    console.log('Connection string:', process.env.DATABASE_URL?.replace(/:[^:]*@/, ':****@')); // Скрываем пароль в логах
    
    const client = await pool.connect();
    console.log('✅ Connected to database successfully!');
    
    const result = await client.query('SELECT NOW() as time');
    console.log('✅ Database time:', result.rows[0].time);
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('✅ Available tables:', tables.rows.map(row => row.table_name));
    
    // Проверим конкретно нашу таблицу players
    try {
      const playersTable = await client.query('SELECT * FROM players LIMIT 1');
      console.log('✅ Players table is accessible');
    } catch (err) {
      console.log('❌ Players table error:', err.message);
    }
    
    client.release();
    await pool.end();
    
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('Full error:', err);
  }
}

testConnection();