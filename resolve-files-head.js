const fs = require('fs');

const files = process.argv.slice(2);
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('<<<<<<< HEAD')) {
    const regex = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> [^\r\n]*\r?\n/g;
    let changed = false;
    const newContent = content.replace(regex, (match, p1, p2) => {
      changed = true;
      return p1 + '\n';
    });
    if (changed) {
      fs.writeFileSync(file, newContent);
      console.log('Fixed (Kept HEAD):', file);
    }
  }
}
