const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const VIEWER_PATH = path.join(__dirname, 'web-viewer.html');

const server = http.createServer((req, res) => {
  fs.readFile(VIEWER_PATH, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('web-viewer.html not found — run `npm run build` first');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Encyclopedia viewer listening on port ${PORT}`);
});
