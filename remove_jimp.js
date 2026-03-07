const { Jimp } = require('jimp');
const fs = require('fs');
const path = require('path');

async function processCoin(inputPath, outputPath) {
    try {
        const image = await Jimp.read(inputPath);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // We assume the center is at width/2, height/2
        const cx = width / 2;
        const cy = height / 2;

        // Calculate radius to keep (slightly smaller than half to chop off the checkerboard)
        const radius = (Math.min(width, height) / 2) * 0.96;
        const holeRadius = radius * 0.16;

        // Iterate over all pixels
        image.scan(0, 0, width, height, function (x, y, idx) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // If outside outer circle, or inside inner square (or circle), make transparent
            // We will make the inner hole circular for simplicity since the checkerboard is there
            if (dist > radius || dist < holeRadius) {
                this.bitmap.data[idx + 3] = 0; // Set alpha to 0
            } else {
                // Optional feathering on the edges for a smoother look
                if (dist > radius - 2) {
                    this.bitmap.data[idx + 3] = Math.max(0, 255 - (dist - (radius - 2)) * 128);
                } else if (dist < holeRadius + 2) {
                    this.bitmap.data[idx + 3] = Math.max(0, ((dist - holeRadius) / 2) * 255);
                }
            }
        });

        await image.write(outputPath);
        console.log(`Processed ${inputPath} -> ${outputPath}`);
    } catch (err) {
        console.error("Error processing " + inputPath, err);
    }
}

async function main() {
    await processCoin('./assets/coin_yang_v4.png', './assets/coin_yang_final.png');
    await processCoin('./assets/coin_yin_v4.png', './assets/coin_yin_final.png');
}

main();
