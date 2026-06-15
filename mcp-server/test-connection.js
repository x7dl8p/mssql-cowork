#!/usr/bin/env node
// Quick connection test — run from terminal:
//   node test-connection.js

'use strict';

const fs   = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} else {
  console.error('❌  No .env file found. Run node setup.js first.');
  process.exit(1);
}

const sql   = require('mssql');
const start = Date.now();

console.log(`\nConnecting to ${process.env.MSSQL_HOST}:${process.env.MSSQL_PORT} → ${process.env.MSSQL_DATABASE} ...`);

sql.connect({
  user:     process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  server:   process.env.MSSQL_HOST,
  database: process.env.MSSQL_DATABASE,
  port:     parseInt(process.env.MSSQL_PORT || '1433'),
  options:  { encrypt: process.env.MSSQL_ENCRYPT === 'true', trustServerCertificate: true },
  connectionTimeout: 10000,
})
.then(async (pool) => {
  const r   = await pool.request().query(`
    SELECT
      DB_NAME()  AS db,
      GETDATE()  AS server_time,
      @@VERSION  AS version
  `);
  const row = r.recordset[0];
  console.log(`\n✅  Connected in ${Date.now() - start} ms`);
  console.log(`   Database    : ${row.db}`);
  console.log(`   Server time : ${row.server_time}`);
  console.log(`   SQL Server  : ${row.version.split('\n')[0]}\n`);
  await pool.close();
  process.exit(0);
})
.catch((err) => {
  console.error(`\n❌  Connection failed: ${err.message}\n`);
  process.exit(1);
});
