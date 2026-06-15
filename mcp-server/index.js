#!/usr/bin/env node
/**
 * mssql-cowork MCP Server
 *
 * Stdio JSON-RPC server (MCP protocol 2024-11-05).
 * Exposes read-only SQL Server tools to Claude.
 *
 * Credentials are supplied via environment variables (set in .mcp.json):
 *   MSSQL_HOST, MSSQL_PORT, MSSQL_USER, MSSQL_PASSWORD,
 *   MSSQL_DATABASE, MSSQL_ENCRYPT
 *
 * A local .env file in this directory is also supported as a fallback.
 */

'use strict';

const readline = require('readline');
const fs       = require('fs');
const path     = require('path');

// ── Load .env and .mcp.json ────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

// Fallback: load from .mcp.json if Claude failed to pass environment variables
const findMcpJson = (startPath) => {
  let curr = startPath;
  while (curr !== path.dirname(curr)) {
    const p = path.join(curr, '.mcp.json');
    if (fs.existsSync(p)) return p;
    curr = path.dirname(curr);
  }
  return null;
};
const mcpJsonPath = findMcpJson(__dirname) || findMcpJson(process.cwd());
if (mcpJsonPath) {
  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
    const envs = mcpConfig?.mcpServers?.['mssql-cowork']?.env;
    if (envs) {
      for (const [key, value] of Object.entries(envs)) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (err) {
    console.error(`Failed to parse .mcp.json: ${err.message}`);
  }
}

// ── Lazy pool ──────────────────────────────────────────────────────────────
let _sql  = null;
let _pool = null;

function getSql() {
  if (!_sql) _sql = require('mssql');
  return _sql;
}

async function getPool() {
  if (_pool) return _pool;
  const sql = getSql();
  _pool = await sql.connect({
    user:     process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server:   process.env.MSSQL_HOST || 'localhost',
    database: process.env.MSSQL_DATABASE,
    port:     parseInt(process.env.MSSQL_PORT || '1433'),
    options: {
      encrypt:               process.env.MSSQL_ENCRYPT === 'true',
      trustServerCertificate: true,
    },
    connectionTimeout: 15000,
  });
  return _pool;
}

// ── Read-only guard ────────────────────────────────────────────────────────
const DESTRUCTIVE = new Set([
  'INSERT','UPDATE','DELETE','DROP','ALTER','CREATE',
  'EXEC','EXECUTE','TRUNCATE','MERGE','GRANT','REVOKE',
  'WRITETEXT','UPDATETEXT','OPENROWSET','OPENDATASOURCE','OPENQUERY',
]);

function assertReadOnly(query) {
  // Strip string literals and comments before tokenising
  let q = query
    .replace(/--[^\n]*/g, ' ')           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
    .replace(/'[^']*'/g, "''")           // string literals
    .replace(/\[[^\]]*\]/g, '[]');       // bracketed identifiers

  const tokens = q.toUpperCase().match(/\b[A-Z_]+\b/g) || [];

  if (!tokens.length || (tokens[0] !== 'SELECT' && tokens[0] !== 'WITH')) {
    throw new Error('Only SELECT / WITH queries are permitted.');
  }
  for (const t of tokens) {
    if (DESTRUCTIVE.has(t)) throw new Error(`Blocked keyword detected: ${t}`);
  }
}

// ── Tool implementations ───────────────────────────────────────────────────

async function run_query({ sql: query, limit = 100 }) {
  assertReadOnly(query);
  const sql  = getSql();
  const pool = await getPool();

  // Auto-inject TOP if absent
  let q = query;
  const safeLimit = Math.min(Math.max(1, limit), 1000);
  if (!/\bTOP\b/i.test(q)) {
    q = q.replace(/^\s*(SELECT\s+DISTINCT)/i, `$1 TOP ${safeLimit}`);
    q = q.replace(/^\s*(SELECT)/i,            `$1 TOP ${safeLimit}`);
  }

  const start  = Date.now();
  const result = await pool.request().query(q);
  return {
    rows:           result.recordset,
    rowCount:       result.recordset.length,
    executionTimeMs: Date.now() - start,
  };
}

async function list_tables() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      s.Name          AS schema_name,
      t.NAME          AS table_name,
      SUM(pa.rows)    AS row_count
    FROM sys.tables t
    INNER JOIN sys.indexes    i  ON t.OBJECT_ID  = i.object_id
    INNER JOIN sys.partitions pa ON i.object_id  = pa.object_id
                                 AND i.index_id   = pa.index_id
    INNER JOIN sys.schemas    s  ON t.schema_id   = s.schema_id
    WHERE t.is_ms_shipped = 0
      AND i.index_id < 2
    GROUP BY s.Name, t.NAME
    HAVING SUM(pa.rows) > 0
    ORDER BY SUM(pa.rows) DESC;
  `);
  return { tables: result.recordset, count: result.recordset.length };
}

async function inspect_schema({ table_name }) {
  const sql  = getSql();
  const pool = await getPool();
  const result = await pool.request()
    .input('t', sql.NVarChar, table_name)
    .query(`
      SELECT
        ORDINAL_POSITION  AS position,
        COLUMN_NAME       AS column_name,
        DATA_TYPE         AS data_type,
        CHARACTER_MAXIMUM_LENGTH AS max_length,
        IS_NULLABLE       AS nullable,
        COLUMN_DEFAULT    AS default_value
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @t
      ORDER BY ORDINAL_POSITION;
    `);
  if (!result.recordset.length) throw new Error(`Table "${table_name}" not found.`);
  return { table: table_name, columns: result.recordset };
}

async function search_schema({ keyword }) {
  const sql  = getSql();
  const pool = await getPool();
  const result = await pool.request()
    .input('k', sql.NVarChar, `%${keyword}%`)
    .query(`
      SELECT DISTINCT
        TABLE_SCHEMA  AS schema_name,
        TABLE_NAME    AS table_name,
        COLUMN_NAME   AS column_name,
        DATA_TYPE     AS data_type
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE @k
         OR TABLE_NAME  LIKE @k
      ORDER BY TABLE_NAME, COLUMN_NAME;
    `);
  return { keyword, matches: result.recordset, count: result.recordset.length };
}

async function explain_query({ sql: query }) {
  assertReadOnly(query);
  const sql  = getSql();
  const pool = await getPool();
  const tx   = new sql.Transaction(pool);
  await tx.begin();
  try {
    const req = new sql.Request(tx);
    await req.query('SET SHOWPLAN_ALL ON');
    const plan = await req.query(query);
    await req.query('SET SHOWPLAN_ALL OFF');
    await tx.commit();
    return { plan: plan.recordset };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function test_connection() {
  const pool  = await getPool();
  const start = Date.now();
  await pool.request().query('SELECT 1 AS alive');
  return {
    status:      'connected',
    host:        process.env.MSSQL_HOST,
    database:    process.env.MSSQL_DATABASE,
    port:        process.env.MSSQL_PORT || '1433',
    latencyMs:   Date.now() - start,
  };
}

// ── Tool catalogue ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'run_query',
    description: 'Execute a read-only SELECT or WITH (CTE) query. Automatically limits rows if TOP is absent. Blocked keywords: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, EXEC, TRUNCATE, MERGE.',
    inputSchema: {
      type: 'object',
      properties: {
        sql:   { type: 'string', description: 'The SQL query (SELECT / WITH only)' },
        limit: { type: 'number', description: 'Max rows to return. Default 100, max 1000.' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'inspect_schema',
    description: 'Return all columns with data types, max length, nullability and defaults for a specific table.',
    inputSchema: {
      type: 'object',
      properties: {
        table_name: { type: 'string', description: 'Exact table name (case-insensitive)' },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'list_tables',
    description: 'List all user tables in the database with approximate row counts, sorted largest first.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_schema',
    description: 'Search for tables or columns whose name contains a keyword. Useful before writing a query.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Partial table or column name to search for' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'explain_query',
    description: 'Return the SQL Server execution plan (SHOWPLAN_ALL) for a SELECT query without executing it.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'The SQL query to explain (SELECT / WITH only)' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'test_connection',
    description: 'Ping the database and return connection status, host, database name, and round-trip latency in ms.',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ── MCP stdio loop ─────────────────────────────────────────────────────────
const rl    = readline.createInterface({ input: process.stdin, terminal: false });
const write = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

rl.on('line', async (raw) => {
  const line = raw.trim();
  if (!line) return;

  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  const { id, method, params } = msg;

  // Notifications have no id — respond only if id is defined
  if (method === 'notifications/initialized') return;

  try {
    if (method === 'initialize') {
      write({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities:    { tools: {} },
          serverInfo:      { name: 'mssql-cowork', version: '0.1.0' },
        },
      });

    } else if (method === 'tools/list') {
      write({ jsonrpc: '2.0', id, result: { tools: TOOLS } });

    } else if (method === 'tools/call') {
      const { name, arguments: args = {} } = params;
      let result;
      switch (name) {
        case 'run_query':        result = await run_query(args);        break;
        case 'list_tables':      result = await list_tables();          break;
        case 'inspect_schema':   result = await inspect_schema(args);   break;
        case 'search_schema':    result = await search_schema(args);    break;
        case 'explain_query':    result = await explain_query(args);    break;
        case 'test_connection':  result = await test_connection();      break;
        default: throw new Error(`Unknown tool: ${name}`);
      }
      write({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      });

    } else {
      write({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
    }
  } catch (err) {
    console.error(`MCP Error for method ${method}: ${err.message}`);
    write({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
  }
});

process.on('SIGTERM', async () => {
  if (_pool) await _pool.close().catch(() => {});
  process.exit(0);
});
