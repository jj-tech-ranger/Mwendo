import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve(process.cwd(), 'public');

// Standard icon SVG (for any purpose, 512x512)
const standardSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#1A5C2E"/>
  <path d="M 256 80 C 338 111, 410 121, 410 213 C 410 331, 312 403, 256 429 C 200 403, 102 331, 102 213 C 102 121, 174 111, 256 80 Z" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 184 312 A 82 82 0 1 1 328 312" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round"/>
  <circle cx="256" cy="276" r="22" fill="none" stroke="#FFFFFF" stroke-width="14"/>
  <path d="M 263 263 L 322 204" stroke="#4AE175" stroke-width="26" stroke-linecap="round"/>
</svg>`;

// Maskable icon SVG (content scaled to 76% in center, full solid bleed with no rounded corners)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#1A5C2E"/>
  <g transform="translate(61.44, 61.44) scale(0.76)">
    <path d="M 256 80 C 338 111, 410 121, 410 213 C 410 331, 312 403, 256 429 C 200 403, 102 331, 102 213 C 102 121, 174 111, 256 80 Z" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 184 312 A 82 82 0 1 1 328 312" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round"/>
    <circle cx="256" cy="276" r="22" fill="none" stroke="#FFFFFF" stroke-width="14"/>
    <path d="M 263 263 L 322 204" stroke="#4AE175" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>`;

// Apple Touch Icon (180x180, full solid background, iOS masks corners)
const appleTouchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <rect width="180" height="180" fill="#1A5C2E"/>
  <g transform="translate(18, 18) scale(0.28125)">
    <path d="M 256 80 C 338 111, 410 121, 410 213 C 410 331, 312 403, 256 429 C 200 403, 102 331, 102 213 C 102 121, 174 111, 256 80 Z" fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 184 312 A 82 82 0 1 1 328 312" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round"/>
    <circle cx="256" cy="276" r="22" fill="none" stroke="#FFFFFF" stroke-width="14"/>
    <path d="M 263 263 L 322 204" stroke="#4AE175" stroke-width="26" stroke-linecap="round"/>
  </g>
</svg>`;

async function generate() {
  // 1. Apple Touch Icon PNG 180x180
  await sharp(Buffer.from(appleTouchSvg))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // 2. Standard 192x192 & 512x512 PNGs
  await sharp(Buffer.from(standardSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(Buffer.from(standardSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated standard icon PNGs (192, 512)');

  // 3. Maskable 192x192 & 512x512 PNGs
  await sharp(Buffer.from(maskableSvg))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));
  console.log('Generated maskable icon PNGs (192, 512)');

  // 4. Save maskable SVG
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg);
  console.log('Saved icon-maskable.svg');
}

generate().catch(console.error);
