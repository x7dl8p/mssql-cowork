const fs = require('fs');
const path = require('path');

const sessionsDir = 'C:\\Users\\Admin\\AppData\\Roaming\\Claude\\local-agent-mode-sessions\\a9702579-bab4-4421-941f-1d0795f00dd0\\a7bf3d44-20dc-43bb-bacf-f64f92f093f7';

if (!fs.existsSync(sessionsDir)) {
  console.error('Sessions directory does not exist');
  process.exit(1);
}

const files = fs.readdirSync(sessionsDir);
for (const file of files) {
  if (file.endsWith('.json') && file.startsWith('local_')) {
    const filePath = path.join(sessionsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const session = JSON.parse(content);
      if (session.enabledMcpTools) {
        let updated = false;
        for (const key of Object.keys(session.enabledMcpTools)) {
          if (key.includes('mssql-cowork')) {
            if (session.enabledMcpTools[key] !== true) {
              session.enabledMcpTools[key] = true;
              updated = true;
            }
          }
        }
        if (updated) {
          fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
          console.log(`Updated mssql-cowork tools to true in: ${file}`);
        } else {
          console.log(`Already enabled in: ${file}`);
        }
      }
    } catch (err) {
      console.error(`Failed to process ${file}:`, err.message);
    }
  }
}
