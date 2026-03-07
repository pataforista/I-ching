const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceImage = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\87140ff4-565a-4a48-b989-91492296badd\\app_icon_zen_ink_1772846067683.png';
const iconDir = path.join(__dirname, '..', 'assets', 'icons');

if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

const sizes = [48, 72, 96, 144, 192, 512];

async function generate() {
    console.log('Generating icons...');
    for (const size of sizes) {
        const dest = path.join(iconDir, `icon-${size}.png`);
        await sharp(sourceImage)
            .resize(size, size)
            .toFile(dest);
        console.log(`Generated ${size}x${size} -> ${dest}`);
    }

    // Generate maskable icon (padding the content slightly)
    const maskableDest = path.join(iconDir, 'icon-512-maskable.png');
    await sharp(sourceImage)
        .resize(512, 512)
        .composite([{
            input: Buffer.from('<svg><rect x="0" y="0" width="512" height="512" fill="none"/></svg>'),
            blend: 'dest-in'
        }])
        .toFile(maskableDest);
    console.log(`Generated maskable -> ${maskableDest}`);

    console.log('Icons generated successfully.');
}

generate().catch(console.error);
