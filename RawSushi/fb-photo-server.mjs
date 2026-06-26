import http from 'http';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'E:/Project/Master/RawSushi/RawWebsite/public/images/fb-photos';
const PORT = 7788;
fs.mkdirSync(OUT_DIR, { recursive: true });

let saved = 0;
let total = 0;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename, X-Total');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/save') {
    const filename = req.headers['x-filename'] || `photo_${Date.now()}.jpg`;
    total = parseInt(req.headers['x-total'] || '0');
    const dest = path.join(OUT_DIR, filename);
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(dest, buf);
      saved++;
      console.log(`  [${saved}/${total}] Saved: ${filename} (${(buf.length/1024).toFixed(0)}KB)`);
      if (saved >= total) {
        console.log(`\nAll ${saved} photos saved to ${OUT_DIR}`);
        res.writeHead(200); res.end('done');
        setTimeout(() => server.close(), 1000);
      } else {
        res.writeHead(200); res.end('ok');
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/done') {
    console.log(`\nFinished: ${saved} photos saved.`);
    res.writeHead(200); res.end('ok');
    setTimeout(() => server.close(), 500);
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Waiting for browser to send photos...');
});
