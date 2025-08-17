// db/connection.js
const { Pool } = require('pg');






const pool = new Pool({
  user: 'shop_admin',
  host: 'localhost',
  database: 'my_multivendor_db',
  password: '1234567',
  port: 5432,
});

// اختبار الاتصال
pool.connect((err, client, done) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('✅ اتصال ناجح بقاعدة بيانات PostgreSQL!');
  }
  done();
});

module.exports = { pool };