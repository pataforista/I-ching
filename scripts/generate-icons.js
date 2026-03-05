/**
 * generate-icons.js
 * Generates all required PWA/Play Store icon sizes from the source icon.
 * Usage: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.resolve(__dirname, '..', 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\1738bea2-f38d-45d3-b321-765f2bdf9625\\iching_icon_512_1772676506007.png');
const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'icons');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const SIZES = [48, 72, 96, 144, 192, 512];

async function run() {
    console.log('Checking source:', SRC);
    if (!fs.existsSync(SRC)) {
        console.error('Source icon not found:', SRC);
        process.exit(1);
    }

    // Generate standard icons
    for (const size of SIZES) {
        const out = path.join(OUT_DIR, `icon-${size}.png`);
        await sharp(SRC)
            .resize(size, size, { fit: 'cover', position: 'center' })
            .png({ compressionLevel: 9 })
            .toFile(out);
        console.log(`✓ icon-${size}.png`);
    }

    // Maskable icon: same image, sharp will handle the 512px output
    // The safe zone (80%) is already handled by the generated image having padding
    const maskableOut = path.join(OUT_DIR, 'icon-512-maskable.png');
    await sharp(SRC)
        .resize(512, 512, { fit: 'cover', position: 'center' })
        .png({ compressionLevel: 9 })
        .toFile(maskableOut);
    console.log('✓ icon-512-maskable.png');

    console.log('\nAll icons generated in assets/icons/');
}

run().catch(err => { console.error(err); process.exit(1); });
