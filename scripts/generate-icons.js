const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    const svgBuffer = await fs.readFile(path.join(__dirname, '../icons/icon.svg'));
    
    // Generate main icons
    for (const size of sizes) {
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(path.join(__dirname, `../icons/icon-${size}x${size}.png`));
        console.log(`Generated ${size}x${size} icon`);
    }

    // Generate shortcut icons
    await sharp(svgBuffer)
        .resize(72, 72)
        .composite([{
            input: Buffer.from(`
                <svg>
                    <rect x="40" y="40" width="24" height="24" fill="#fff" rx="12"/>
                    <path d="M48 52h8M52 48v8" stroke="#3498db" stroke-width="2"/>
                </svg>
            `),
            top: 0,
            left: 0,
        }])
        .png()
        .toFile(path.join(__dirname, '../icons/add-72x72.png'));
    console.log('Generated add shortcut icon');

    await sharp(svgBuffer)
        .resize(72, 72)
        .composite([{
            input: Buffer.from(`
                <svg>
                    <rect x="40" y="40" width="24" height="24" fill="#fff" rx="12"/>
                    <path d="M46 52l4 4 8-8" stroke="#3498db" stroke-width="2"/>
                </svg>
            `),
            top: 0,
            left: 0,
        }])
        .png()
        .toFile(path.join(__dirname, '../icons/analytics-72x72.png'));
    console.log('Generated analytics shortcut icon');
}

generateIcons().catch(console.error);
