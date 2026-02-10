import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");

// App colors (surface-900 bg, accent-400 text)
const BG_COLOR = "#1a1a1e";
const TEXT_COLOR = "#f27a93";

async function generateIcon(size, filename, maskable = false) {
  // For maskable icons, use extra padding (safe zone is inner 80%)
  const padding = maskable ? Math.round(size * 0.2) : Math.round(size * 0.15);
  const fontSize = size - padding * 2;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${BG_COLOR}" rx="${maskable ? 0 : Math.round(size * 0.1)}"/>
      <text
        x="50%"
        y="54%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="sans-serif"
        font-weight="800"
        font-size="${fontSize}px"
        fill="${TEXT_COLOR}"
      >M</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, filename));
  console.log(`Generated ${filename} (${size}x${size})`);
}

await generateIcon(192, "icon-192.png");
await generateIcon(512, "icon-512.png");
await generateIcon(512, "icon-maskable-512.png", true);

console.log("Done!");
