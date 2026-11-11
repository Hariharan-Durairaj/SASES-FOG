import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

export async function convertImage(input, output, { width = 1200, quality = 78 } = {}) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input).rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality }).toFile(output);
  return output;
}

export async function makeThumbnail(input, output) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(input).rotate().resize(720, 480, { fit: 'cover', position: 'attention' })
    .webp({ quality: 76 }).toFile(output);
  return output;
}
