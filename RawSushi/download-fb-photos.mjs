import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'E:/Project/Master/RawSushi/RawWebsite/public/images/fb-photos';
fs.mkdirSync(OUT_DIR, { recursive: true });

function fetchHtml(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...headers
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve('skip'); return; }
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.facebook.com/'
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
      file.on('finish', () => { file.close(); resolve('ok'); });
    }).on('error', err => {
      try { fs.unlinkSync(dest); } catch(e) {}
      reject(err);
    });
  });
}

// Extract scontent CDN URLs from HTML
function extractImageUrls(html) {
  const urls = new Set();
  // Match scontent CDN image URLs
  const regex = /https:\/\/scontent[^"'\s\\]+\.(?:jpg|jpeg|png|webp)[^"'\s\\]*/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let url = match[0].replace(/\\u003C.*$/, '').replace(/&amp;/g, '&').replace(/\\"/g, '');
    // Only full-size images (not tiny thumbnails)
    if (!url.includes('s60x60') && !url.includes('s32x32') && !url.includes('s16x16') &&
        !url.includes('p40x40') && !url.includes('p16x16') && !url.includes('fpp=1')) {
      urls.add(url);
    }
  }
  return [...urls];
}

function getFilename(url, index) {
  const match = url.match(/\/(\d+_\d+_\d+_[a-z0-9_]+\.(?:jpg|jpeg|png|webp))/i);
  if (match) return match[1];
  const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
  return `fb_photo_${String(index).padStart(3, '0')}.${ext}`;
}

console.log('Fetching Facebook photos page...');
const html = await fetchHtml('https://www.facebook.com/rawsushibar/photos');
console.log(`Got ${html.length} chars of HTML`);

const urls = extractImageUrls(html);
console.log(`Found ${urls.length} image URLs`);

if (urls.length === 0) {
  console.log('No images found. Facebook may require login. Trying mobile version...');
  const mHtml = await fetchHtml('https://m.facebook.com/rawsushibar/photos');
  const mUrls = extractImageUrls(mHtml);
  console.log(`Mobile: found ${mUrls.length} image URLs`);
  if (mUrls.length > 0) {
    urls.push(...mUrls);
  }
}

let success = 0, skipped = 0, failed = 0;
for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const filename = getFilename(url, i + 1);
  const dest = path.join(OUT_DIR, filename);
  try {
    process.stdout.write(`  [${i+1}/${urls.length}] ${filename}...`);
    const result = await downloadFile(url, dest);
    if (result === 'skip') { skipped++; console.log(' SKIP'); }
    else { success++; console.log(' OK'); }
  } catch(e) {
    failed++;
    console.log(` FAILED: ${e.message}`);
  }
}

console.log(`\nDone! ${success} downloaded, ${skipped} skipped, ${failed} failed`);
console.log(`Saved to: ${OUT_DIR}`);
