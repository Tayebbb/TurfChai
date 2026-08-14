const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.css') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('<<<<<<< HEAD')) {
        // Regex handles \r\n or \n
        const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> [^\r\n]*\r?\n/g;
        let changed = false;
        const newContent = content.replace(regex, (match, p1, p2) => {
          changed = true;
          return p1 + '\n';
        });
        if (changed) {
          fs.writeFileSync(fullPath, newContent);
          console.log('Fixed (Kept HEAD):', fullPath);
        }
      }
    }
  }
}
processDir(path.join(__dirname, 'frontend', 'src', 'components'));
