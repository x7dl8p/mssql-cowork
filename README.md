# mssql-cowork

A Claude Cowork plugin that gives Claude live, read-only access to any Microsoft SQL Server database — including SAP Business One (SBO/SAP B1).

## What it does

| Tool | Description |
|---|---|
| `run_query` | Execute SELECT / CTE queries directly from Claude |
| `list_tables` | List all tables with approximate row counts |
| `inspect_schema` | View columns, types, and constraints for a table |
| `search_schema` | Find tables/columns by keyword |
| `explain_query` | Pull the SQL Server execution plan without running |
| `test_connection` | Verify connectivity at any time |

Skills loaded automatically:
- `/mssql-analyst` — general T-SQL query workflow
- `/sbo-analyst` — SAP Business One domain knowledge (OINV, OCRD, OITM, gate passes, etc.)

---

## Install (use the pre-built release)

1. Download `mssql-cowork.plugin` from [Releases](../../releases/latest)
2. Open Claude → Settings → Plugins → Install from file → select the `.plugin`
3. Edit the plugin env vars to your database credentials (see [Configuration](#configuration))

---

## Build from source

### Prerequisites

- Node.js 18+
- npm

### Steps

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/mssql-cowork.git
cd mssql-cowork

# 2. Install dependencies
cd mcp-server
npm install
cd ..

# 3. Bundle (compiles index.js + all deps into one file)
npm run bundle

# 4. Package (zips everything into mssql-cowork.plugin)
npm run package
```

The `.plugin` file appears in the project root. Install it in Claude as above.

### npm scripts

| Script | What it does |
|---|---|
| `npm run bundle` | Runs esbuild → `mcp-server/bundle.js` |
| `npm run package` | Zips plugin files into `mssql-cowork.plugin` |
| `npm run build` | bundle + package in one step |

---

## Configuration

Credentials are set in the plugin's `.mcp.json` `env` block. After installing, edit them in Claude → Settings → Plugins → mssql-cowork:

| Variable | Example | Description |
|---|---|---|
| `MSSQL_HOST` | `192.168.1.103` | SQL Server hostname or IP |
| `MSSQL_PORT` | `1433` | Port (default 1433) |
| `MSSQL_USER` | `readonlyuser` | SQL login username |
| `MSSQL_PASSWORD` | `yourpassword` | SQL login password |
| `MSSQL_DATABASE` | `MyDatabase` | Database name |
| `MSSQL_ENCRYPT` | `false` | `true` for Azure SQL, `false` for on-prem |

A local `mcp-server/.env` file is also supported as a fallback for local development.

---

## Security

- All queries are checked token-by-token before execution
- Only `SELECT` and `WITH` (CTE) statements are permitted
- Blocked: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `EXEC`, `TRUNCATE`, `MERGE`
- Row output is capped at 1000 rows maximum
- Credentials live in `.mcp.json` env vars — never in source code

---

## CI / Releases

Every push to `main` triggers a GitHub Actions build that:
1. Installs dependencies
2. Bundles with esbuild
3. Packages as `mssql-cowork.plugin`
4. Uploads the artifact

Pushing a version tag (`v1.0.0`) additionally creates a GitHub Release with the `.plugin` attached.

---

## Requirements

- Node.js 18+
- Network access to your SQL Server (VPN if needed)
