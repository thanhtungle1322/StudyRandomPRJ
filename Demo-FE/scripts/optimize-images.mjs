import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = ['backgroundLogin', 'backgroundDashboard', 'Cachhoatdong'];

for (const assetName of assets) {
  const inputPath = path.join(projectRoot, 'background', `${assetName}.png`);
  const outputPath = path.join(projectRoot, 'background', `${assetName}.webp`);
  await sharp(inputPath).webp({ quality: 82, effort: 6 }).toFile(outputPath);

  const [input, output] = await Promise.all([stat(inputPath), stat(outputPath)]);
  if (output.size >= input.size) {
    throw new Error(`${assetName}.webp is not smaller than its PNG source`);
  }
  const reduction = Math.round((1 - output.size / input.size) * 100);
  console.log(`${assetName}: ${input.size} -> ${output.size} bytes (${reduction}% smaller)`);
}