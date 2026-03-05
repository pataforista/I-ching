#!/usr/bin/env node
/**
 * generate-screenshots.js
 * Genera capturas de pantalla placeholder para Google Play Store
 * Tamaño: 1080x1920 (formato 9:16 portrait)
 * Feature graphic: 1024x500
 *
 * Uso: node scripts/generate-screenshots.js
 * Requiere: sharp (ya instalado como devDependency)
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Colores de la app
const BG = { r: 245, g: 242, b: 233 };   // #f5f2e9 paper
const ACCENT = { r: 74, g: 144, b: 112 }; // #4a9070 green
const DARK = { r: 30, g: 30, b: 46 };     // #1e1e2e dark

/**
 * Crea un SVG placeholder con el estilo de la app
 */
function makeScreenSVG(label, subtitle) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#f5f2e9"/>

  <!-- Header bar -->
  <rect width="1080" height="180" fill="#4a9070"/>

  <!-- Status bar simulation -->
  <rect width="1080" height="60" fill="#3d7a5e" opacity="0.5"/>

  <!-- App title in header -->
  <text x="540" y="140" font-family="serif" font-size="48" fill="white" text-anchor="middle" opacity="0.9">I Ching · Guía Taoísta</text>

  <!-- Central hexagram glyph -->
  <text x="540" y="680" font-family="serif" font-size="280" fill="#4a9070" text-anchor="middle" opacity="0.15">易</text>

  <!-- Decorative lines (hexagram) -->
  <g transform="translate(340, 820)" opacity="0.6">
    <rect x="0" y="0" width="400" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="50" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="235" y="50" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="100" width="400" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="150" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="235" y="150" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="200" width="400" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="250" width="400" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="300" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="235" y="300" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="350" width="400" height="16" rx="8" fill="#4a9070"/>
    <rect x="0" y="400" width="165" height="16" rx="8" fill="#4a9070"/>
    <rect x="235" y="400" width="165" height="16" rx="8" fill="#4a9070"/>
  </g>

  <!-- Label -->
  <text x="540" y="1480" font-family="sans-serif" font-size="52" fill="#1e1e2e" text-anchor="middle" opacity="0.8">${label}</text>
  <text x="540" y="1550" font-family="sans-serif" font-size="36" fill="#4a9070" text-anchor="middle" opacity="0.7">${subtitle}</text>

  <!-- Bottom decoration -->
  <rect x="420" y="1620" width="240" height="4" rx="2" fill="#4a9070" opacity="0.3"/>

  <!-- Watermark note -->
  <text x="540" y="1820" font-family="sans-serif" font-size="28" fill="#1e1e2e" text-anchor="middle" opacity="0.3">REEMPLAZAR CON CAPTURA REAL</text>
</svg>`;
}

function makeFeatureSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="#1e1e2e"/>

  <!-- Background glyph -->
  <text x="512" y="360" font-family="serif" font-size="400" fill="#4a9070" text-anchor="middle" opacity="0.08">易</text>

  <!-- Accent decoration -->
  <rect x="0" y="0" width="8" height="500" fill="#4a9070"/>
  <rect x="1016" y="0" width="8" height="500" fill="#4a9070"/>

  <!-- Title -->
  <text x="512" y="210" font-family="serif" font-size="72" fill="white" text-anchor="middle" opacity="0.95">I Ching · Guía Taoísta</text>
  <text x="512" y="290" font-family="sans-serif" font-size="36" fill="#4a9070" text-anchor="middle" opacity="0.85">Oráculo · Reflexión · Sabiduría Taoísta</text>

  <!-- Bottom line -->
  <rect x="312" y="360" width="400" height="2" fill="#4a9070" opacity="0.4"/>

  <!-- Watermark -->
  <text x="512" y="460" font-family="sans-serif" font-size="22" fill="white" text-anchor="middle" opacity="0.25">REEMPLAZAR CON GRÁFICO REAL (1024x500)</text>
</svg>`;
}

async function generateAll() {
  console.log('Generando capturas de pantalla placeholder para Play Store...\n');

  const screens = [
    {
      file: 'screen-home.png',
      svg: makeScreenSVG('Nueva Consulta', 'Lanza las monedas y recibe tu lectura'),
    },
    {
      file: 'screen-reading.png',
      svg: makeScreenSVG('Tu Hexagrama', 'Interpretación profunda y taoísta'),
    },
  ];

  for (const screen of screens) {
    const outPath = path.join(OUT_DIR, screen.file);
    await sharp(Buffer.from(screen.svg))
      .png()
      .toFile(outPath);
    console.log(`✓ ${screen.file} (1080x1920)`);
  }

  // Feature graphic (1024x500)
  const featurePath = path.join(OUT_DIR, 'feature-graphic.png');
  await sharp(Buffer.from(makeFeatureSVG()))
    .png()
    .toFile(featurePath);
  console.log('✓ feature-graphic.png (1024x500)');

  console.log(`\nArchivos en: ${OUT_DIR}`);
  console.log('\n⚠️  IMPORTANTE: Estos son placeholders. Reemplázalos con capturas reales de la app antes de publicar en Play Store.');
}

generateAll().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
