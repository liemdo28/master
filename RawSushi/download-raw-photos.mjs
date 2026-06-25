import https from 'https';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const SHARE_TOKEN = 'DJlqAY0sQCa5NNaq-T0NMA.8ZaMcRqT09Mk0hJNJxYNwv';
const GROUP_ID = 'DJlqAY0sQCa5NNaq-T0NMA';
const OUT_DIR = 'E:/Project/Master/RawSushi/RawWebsite/public/images/raw-photos';

fs.mkdirSync(OUT_DIR, { recursive: true });

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        try { fs.unlinkSync(dest); } catch(e) {}
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

const apiUrl = `https://www.amazon.com/drive/v1/search/groups/${GROUP_ID}?asset=ALL&filters=type%3A(PHOTOS)&limit=200&searchContext=groups&sort=%5B%27contentProperties.contentDate+DESC%27%5D&tempLink=true&timeZone=Asia%2FSaigon&groupShareToken=${SHARE_TOKEN}&resourceVersion=V2&ContentType=JSON&_=${Date.now()}`;

console.log('Fetching photo list...');
const data = await fetchJson(apiUrl);
console.log(`Found ${data.data.length} photos (total: ${data.count})`);

let success = 0, failed = 0;
for (const item of data.data) {
  const dest = path.join(OUT_DIR, item.name);
  if (fs.existsSync(dest)) {
    console.log(`  [SKIP] ${item.name}`);
    success++;
    continue;
  }
  try {
    process.stdout.write(`  Downloading ${item.name} (${(item.contentProperties?.size / 1024 / 1024).toFixed(1)}MB)...`);
    await downloadFile(item.tempLink, dest);
    success++;
    console.log(' OK');
  } catch (e) {
    failed++;
    console.log(` FAILED: ${e.message}`);
  }
}

console.log(`\nDone! ${success} downloaded, ${failed} failed`);
console.log(`Saved to: ${OUT_DIR}`);
