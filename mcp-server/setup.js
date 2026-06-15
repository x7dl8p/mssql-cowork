#!/usr/bin/env node
/**
 * mssql-cowork setup
 * Run once: node setup.js
 * Prompts for your MSSQL connection details and saves them to .env
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   mssql-cowork — Connection Setup    ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log('Enter your MSSQL database credentials.');
  console.log('These are saved locally in .env (never sent anywhere).\n');

  const host     = (await ask('Host / IP address   : ')).trim();
  const portStr  = (await ask('Port          [1433]: ')).trim();
  const user     = (await ask('Username            : ')).trim();
  const password = (await ask('Password            : ')).trim();
  const database = (await ask('Database name       : ')).trim();
  const encrypt  = (await ask('Encrypt connection? [y/N]: ')).trim().toLowerCase();

  const port    = portStr || '1433';
  const useEncrypt = encrypt === 'y' ? 'true' : 'false';

  const envContent = [
    `MSSQL_HOST=${host}`,
    `MSSQL_PORT=${port}`,
    `MSSQL_USER=${user}`,
    `MSSQL_PASSWORD=${password}`,
    `MSSQL_DATABASE=${database}`,
    `MSSQL_ENCRYPT=${useEncrypt}`,
  ].join('\n') + '\n';

  const envPath = path.join(__dirname, '.env');
  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log(`\n✅  Credentials saved to: ${envPath}`);
  console.log('    Re-run this script at any time to update the connection.\n');

  // Quick connection test
  console.log('Testing connection...');
  try {
    const sql = require('mssql');
    const pool = await sql.connect({
      user,
      password,
      server: host,
      database,
      port: parseInt(port),
      options: { encrypt: useEncrypt === 'true', trustServerCertificate: true },
      connectionTimeout: 10000,
    });
    await pool.request().query('SELECT 1 AS alive');
    await pool.close();
    console.log('✅  Connection successful! You\'re ready to use mssql-cowork.\n');
  } catch (err) {
    console.log(`⚠️  Connection test failed: ${err.message}`);
    console.log('    Your credentials were saved. Check the host/port/VPN and try again.\n');
  }

  rl.close();
}

main().catch((err) => {
  console.error('Setup error:', err.message);
  process.exit(1);
});
