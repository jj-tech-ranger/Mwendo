import sharp from 'sharp';
import path from 'path';

const publicDir = path.resolve(process.cwd(), 'public');
const brandDir = path.join(publicDir, 'brand');
const officialFavicon = path.join(brandDir, 'favicon-light.png');

/**
 * Generate technical PWA icon variants from the official Mwendo Salama
 * favicon artwork. The source of truth is public/brand/favicon-light.png;
 * no logo artwork is recreated in this script.
 */
async function generate() {
  // Fail loudly if the official asset is missing rather than silently
  // rebuilding an approximation of the brand.
  const source = sharp(officialFavicon);
  const metadata = await source.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read official brand asset: ${officialFavicon}`);
  }

  // Standard PWA icons preserve the official favicon artwork.
  await source.clone()
    .resize(192, 192, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  await source.clone()
    .resize(512, 512, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  // Maskable icons need safe-zone padding. Keep the official artwork intact
  // and place it inside a full-bleed Mwendo green background.
  await source.clone()
    .resize(146, 146, { fit: 'contain' })
    .extend({
      top: 23,
      bottom: 23,
      left: 23,
      right: 23,
      background: '#1A5C2E',
    })
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));

  await source.clone()
    .resize(390, 390, { fit: 'contain' })
    .extend({
      top: 61,
      bottom: 61,
      left: 61,
      right: 61,
      background: '#1A5C2E',
    })
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  // iOS expects a dedicated 180x180 PNG. It uses the same official artwork.
  await source.clone()
    .resize(180, 180, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  console.log('Generated PWA icons from official Mwendo Salama brand asset:', officialFavicon);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
