import sharp from 'sharp';
import path from 'path';

const publicDir = path.resolve(process.cwd(), 'public');
const derivedDir = path.join(publicDir, 'derived');
const appIcon = path.join(derivedDir, 'app-icon-light.png');

/**
 * Generate technical PWA icon sizes from the supplied circular Mwendo Salama
 * app artwork. The artwork itself is never recreated here; this script only
 * resizes the committed brand asset for platform-specific dimensions.
 */
async function generate() {
  const source = sharp(appIcon);
  const metadata = await source.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read derived brand asset: ${appIcon}`);
  }

  // Standard PWA icons preserve the circular app artwork and its transparent
  // corners rather than introducing a square white/green container.
  await source.clone()
    .resize(192, 192, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  await source.clone()
    .resize(512, 512, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  // Maskable icons require a safe area and a full-bleed background. Keep the
  // circular artwork centered so platform masking can crop it safely.
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

  // iOS expects a dedicated 180x180 PNG. Use the same circular app artwork.
  await source.clone()
    .resize(180, 180, { fit: 'contain' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  console.log('Generated PWA icons from circular Mwendo Salama app artwork:', appIcon);
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
