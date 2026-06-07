const fs = require('fs');
const path = require('path');

const viewerDir = path.join(__dirname, 'web-viewer');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/parsed/web-entries.json')));
const embeddedData = JSON.stringify(data);

const css = fs.readFileSync(path.join(viewerDir, 'styles.css'), 'utf8').trimEnd();
const markup = fs.readFileSync(path.join(viewerDir, 'markup.html'), 'utf8').trimEnd();
const appJs = fs.readFileSync(path.join(viewerDir, 'app.js'), 'utf8').trimEnd();

const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>האנציקלופדיה של הרעיונות</title>
  <style>
${css}
  </style>
</head>
<body>

${markup}

<script>
const ENTRIES = ${embeddedData};

${appJs}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '../web-viewer.html'), html);
console.log('web-viewer.html written (' + Math.round(html.length / 1024) + ' KB)');
