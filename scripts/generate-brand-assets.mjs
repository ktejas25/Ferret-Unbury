import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '../frontend/node_modules/@resvg/resvg-js/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'frontend', 'public');
const brandDir = path.join(publicDir, 'brand');

if (!fs.existsSync(brandDir)) {
  fs.mkdirSync(brandDir, { recursive: true });
}

// 1. Copy 4 SVG files into public/brand/ intact
const svgFiles = [
  'ferret-unbury-primary.svg',
  'ferret-unbury-icon.svg',
  'ferret-unbury-compact.svg',
  'ferret-unbury-mono.svg',
];

for (const file of svgFiles) {
  const src = path.join(publicDir, file);
  const dest = path.join(brandDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to public/brand/`);
  } else {
    console.error(`Source not found: ${src}`);
  }
}

// Read raw SVGs and strip metadata tags only for raster rasterizer parsing
function sanitizeForRaster(svgStr) {
  return svgStr.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
}

const rawIconSvg = fs.readFileSync(path.join(brandDir, 'ferret-unbury-icon.svg'), 'utf8');
const iconSvgForRaster = sanitizeForRaster(rawIconSvg);

function renderSvgToPng(svgString, width) {
  const resvg = new Resvg(svgString, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

console.log('Rendering raster icons...');

// Standard PNG sizes
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'icon-64.png', size: 64 },
  { name: 'icon-128.png', size: 128 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-256.png', size: 256 },
  { name: 'icon-512.png', size: 512 },
];

for (const { name, size } of sizes) {
  const pngBuf = renderSvgToPng(iconSvgForRaster, size);
  fs.writeFileSync(path.join(brandDir, name), pngBuf);
  if (['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'].includes(name)) {
    fs.writeFileSync(path.join(publicDir, name), pngBuf);
  }
}
console.log('Standard PNG icons generated.');

// Maskable icon: 512x512 with safe-zone padding (centered inside 80% circle)
// Canvas is #0B1F3A, icon rendered at 384x384 placed at offset (64, 64)
const maskableInner = iconSvgForRaster
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>/, '');

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0B1F3A" />
  <g transform="translate(64, 64) scale(0.75)">
    ${maskableInner}
  </g>
</svg>`;

const maskablePng = renderSvgToPng(maskableSvg, 512);
fs.writeFileSync(path.join(brandDir, 'icon-512-maskable.png'), maskablePng);
fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), maskablePng);
console.log('Maskable 512x512 icon generated.');

// Open Graph image (1200x630) with primary logo centered on navy background
// Using clean mono/white SVG for maximum contrast and legibility on #0B1F3A
const rawMonoSvg = fs.readFileSync(path.join(brandDir, 'ferret-unbury-mono.svg'), 'utf8');
const monoSvgClean = sanitizeForRaster(rawMonoSvg)
  .replace(/color="#0B1F3A"/g, 'color="#FFFFFF"')
  .replace(/fill="currentColor"/g, 'fill="#FFFFFF"');

const monoInner = monoSvgClean
  .replace(/<svg[^>]*>/, '')
  .replace(/<\/svg>/, '');

// Primary logo aspect ratio is 600:160 = 3.75:1.
// Scale by 1.35 => 810 x 216. Centered: x = (1200 - 810)/2 = 195, y = (630 - 216)/2 = 207
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#0B1F3A" />
  <g transform="translate(195, 207) scale(1.35)">
    ${monoInner}
  </g>
</svg>`;

const ogPng = renderSvgToPng(ogSvg, 1200);
fs.writeFileSync(path.join(brandDir, 'og-image.png'), ogPng);
fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogPng);
console.log('og-image.png (1200x630) generated.');

// Manifests
const manifest = {
  name: "Ferret-Unbury",
  short_name: "Ferret-Unbury",
  description: "Ferret-Unbury — Local-first document discovery and intelligence application",
  start_url: "/",
  display: "standalone",
  theme_color: "#0B1F3A",
  background_color: "#0B1F3A",
  icons: [
    {
      src: "/brand/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any"
    },
    {
      src: "/brand/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any"
    },
    {
      src: "/brand/icon-512-maskable.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable"
    }
  ]
};

fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(brandDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Manifests created.');
