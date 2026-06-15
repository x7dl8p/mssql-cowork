#!/usr/bin/env node
/**
 * scripts/package.js
 *
 * Packages mssql-cowork into a distributable .plugin file.
 * Run via:  npm run package   (or as part of: npm run build)
 *
 * Requires Node 18+ — uses built-in modules only (fs, path, child_process).
 * Uses zip CLI on macOS/Linux and PowerShell Compress-Archive on Windows.
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '..');
const OUT    = path.join(ROOT, 'mssql-cowork.plugin');
const DIST_DIR = path.join(ROOT, 'mcp-server', 'dist');
const ANDRO  = path.join(ROOT, 'skills', 'andro');

// ── Pre-flight checks ──────────────────────────────────────────────────────
if (!fs.existsSync(DIST_DIR)) {
  console.error('\n❌  mcp-server/dist not found.');
  console.error('    Run:  npm run bundle\n');
  process.exit(1);
}
if (!fs.existsSync(ANDRO)) {
  console.error('\n❌  skills/andro not found.\n');
  process.exit(1);
}

// ── Remove old artifact ────────────────────────────────────────────────────
if (fs.existsSync(OUT)) {
  fs.unlinkSync(OUT);
  console.log('  🗑  Removed old mssql-cowork.plugin');
}

// ── Helper: copy directory recursively ─────────────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ── Files / dirs to include ────────────────────────────────────────────────
const INCLUDE = [
  '.mcp.json',
  'README.md',
  'launcher.js',
  'mcp-server/dist',
  '.claude-plugin',
  'skills/andro',
];

// ── Build zip ─────────────────────────────────────────────────────────────
const isWindows = process.platform === 'win32';

if (isWindows) {
  const tempDir = path.join(ROOT, '.temp-package');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  for (const file of INCLUDE) {
    const src = path.join(ROOT, file);
    const dest = path.join(tempDir, file);
    if (!fs.existsSync(src)) continue;
    
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    if (fs.statSync(src).isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  const zipTemp = path.join(ROOT, 'mssql-cowork.zip');
  if (fs.existsSync(zipTemp)) {
    fs.unlinkSync(zipTemp);
  }

  execSync(
    `tar -a -c -f "${zipTemp}" -C "${tempDir}" .`,
    { stdio: 'inherit', cwd: ROOT }
  );

  if (fs.existsSync(OUT)) {
    fs.unlinkSync(OUT);
  }
  let retries = 10;
  while (retries > 0) {
    try {
      fs.renameSync(zipTemp, OUT);
      break;
    } catch (e) {
      if ((e.code === 'EBUSY' || e.code === 'EPERM') && retries > 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
        retries--;
      } else {
        throw e;
      }
    }
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
} else {
  execSync(`zip -r "${OUT}" ${INCLUDE.join(' ')}`, { stdio: 'inherit', cwd: ROOT });
}

// ── Report ─────────────────────────────────────────────────────────────────
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`\n✅  mssql-cowork.plugin  (${kb} KB)`);
console.log(`   ${OUT}\n`);
