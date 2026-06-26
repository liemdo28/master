import https from 'https';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'E:/Project/Master/RawSushi/RawWebsite/public/images/fb-photos';
fs.mkdirSync(OUT_DIR, { recursive: true });

const photos = JSON.parse(fs.readFileSync('./fb-photos-list.json', 'utf8'));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve('skip'); return; }
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.facebook.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'cross-site'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(dest).size;
        resolve(size);
      });
    }).on('error', err => {
      try { fs.unlinkSync(dest); } catch(e) {}
      reject(err);
    });
  });
}

let success = 0, skipped = 0, failed = 0;
for (let i = 0; i < photos.length; i++) {
  const { filename, url } = photos[i];
  const dest = path.join(OUT_DIR, filename);
  try {
    process.stdout.write(`  [${i+1}/${photos.length}] ${filename}...`);
    const result = await downloadFile(url, dest);
    if (result === 'skip') { skipped++; console.log(' SKIP'); }
    else { success++; console.log(` OK (${(result/1024).toFixed(0)}KB)`); }
  } catch(e) {
    failed++;
    console.log(` FAILED: ${e.message}`);
  }
}

console.log(`\nDone! ${success} downloaded, ${skipped} skipped, ${failed} failed`);
console.log(`Saved to: ${OUT_DIR}`);
