const sharp = require('sharp');
async function test() {
  const metadata = await sharp('./assets/adaptive-icon.png').metadata();
  const trimmed = await sharp('./assets/adaptive-icon.png').trim().toBuffer({ resolveWithObject: true });
  console.log("Original:", metadata.width, metadata.height);
  console.log("Trimmed:", trimmed.info.width, trimmed.info.height);
}
test();
