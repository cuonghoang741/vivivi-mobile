/**
 * Script to remove background, resize custom character images to 400px width,
 * upload them to S3, and generate a TypeScript constants file.
 *
 * Pipeline per image:
 *   1. Remove background (AI-powered, @imgly/background-removal-node)
 *   2. Resize to 400px width
 *   3. Export as WebP (transparent)
 *   4. Upload to S3
 *   5. Generate constants file
 *
 * Usage: node scripts/upload-custom-character-images.mjs
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';
import path from 'path';
import { readFile, readdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Config ─────────────────────────────────────────────────────────
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets', 'custom-character');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'constants', 'customCharacterOptions.ts');

const RESIZE_WIDTH = 400;
const WEBP_QUALITY = 85;
const S3_FOLDER = 'custom-character-options';

// S3/Cloudfly config (same as insert-medias.js)
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'https://s3.cloudfly.vn';
const AWS_BUCKET = process.env.AWS_BUCKET || 'roxie';
const AWS_REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';

const S3_PUBLIC_URL_BASE = `https://s3.cloudfly.vn/${AWS_BUCKET}`;

// Initialize S3 client
const s3Client = new S3Client({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
});

// ─── Auto-generate label from filename ──────────────────────────────
/**
 * Convert filename to a human-readable label.
 * e.g. "body_curvy.png" → "body curvy"
 *      "eth_southeast_asian.png" → "eth southeast asian"
 */
function fileNameToLabel(filename) {
    // Strip extension and any trailing numeric timestamp (e.g. "_1774241662685")
    const name = filename.replace(/\.[^.]+$/, '').replace(/_\d+$/, '');
    return name.replace(/_/g, ' '); // underscores → spaces
}

/**
 * Parse the existing constants file to get already-uploaded URLs.
 * Returns a Record<label, url> of existing entries.
 */
async function loadExistingUrls() {
    try {
        const content = await readFile(OUTPUT_FILE, 'utf-8');
        const existing = {};
        // Match lines like:     'body curvy': 'https://...',
        const regex = /^\s*'([^']+)'\s*:\s*'([^']+)'\s*,?\s*$/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            existing[match[1]] = match[2];
        }
        return existing;
    } catch {
        // File doesn't exist yet, return empty
        return {};
    }
}

/**
 * Remove background from image buffer using AI
 */
async function removeImageBackground(inputBuffer) {
    console.log('  🔮 Removing background...');

    // removeBackground expects a Blob
    const blob = new Blob([inputBuffer], { type: 'image/png' });
    const resultBlob = await removeBackground(blob, {
        output: {
            format: 'image/png',
            quality: 1,
        },
    });

    // Convert Blob back to Buffer
    const arrayBuffer = await resultBlob.arrayBuffer();
    const resultBuffer = Buffer.from(arrayBuffer);

    console.log('  ✅ Background removed');
    return resultBuffer;
}

/**
 * Resize image to target width and compress as WebP (with transparency)
 */
async function resizeAndCompress(inputBuffer) {
    const originalSize = inputBuffer.length;

    const compressedBuffer = await sharp(inputBuffer)
        .resize(RESIZE_WIDTH, null, {
            fit: 'inside',
            withoutEnlargement: true,
        })
        .webp({
            quality: WEBP_QUALITY,
            alphaQuality: 100, // preserve transparency
        })
        .toBuffer();

    const compressedSize = compressedBuffer.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(
        `  📦 ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (${ratio}% smaller)`
    );

    return compressedBuffer;
}

/**
 * Upload buffer to S3
 */
async function uploadToS3(buffer, key, contentType) {
    const command = new PutObjectCommand({
        Bucket: AWS_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'image/webp',
        ACL: 'public-read',
    });

    await s3Client.send(command);
    return `${S3_PUBLIC_URL_BASE}/${key}`;
}

/**
 * Generate the TypeScript constants file
 */
function generateConstantsFile(urlMap) {
    const lines = [
        '/**',
        ' * Auto-generated by scripts/upload-custom-character-images.mjs',
        ` * Generated at: ${new Date().toISOString()}`,
        ' *',
        ' * S3 URLs for custom character option images.',
        ' * Background removed + resized to 400px width + WebP format.',
        ' */',
        '',
        'export const CUSTOM_CHARACTER_IMAGE_URLS: Record<string, string> = {',
    ];

    for (const [label, url] of Object.entries(urlMap)) {
        lines.push(`    '${label}': '${url}',`);
    }

    lines.push('};');
    lines.push('');

    return lines.join('\n');
}

/**
 * Main
 */
async function main() {
    const args = process.argv.slice(2);
    const skipBgRemoval = args.includes('rmBg=false');

    console.log('🎨 Custom Character Image Uploader');
    console.log(`🤖 Background removal: ${skipBgRemoval ? 'SKIPPED' : 'ENABLED'}`);
    console.log('════════════════════════════════════════════════════');
    console.log(`📁 Source: ${ASSETS_DIR}`);
    console.log(`📦 S3 Bucket: ${AWS_BUCKET}`);
    console.log(`📂 S3 Folder: ${S3_FOLDER}`);
    console.log(`📏 Resize width: ${RESIZE_WIDTH}px`);
    console.log('');

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        console.error('❌ Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env');
        process.exit(1);
    }

    // Load existing URLs to skip already-uploaded images
    const existingUrls = await loadExistingUrls();
    const existingCount = Object.keys(existingUrls).length;
    if (existingCount > 0) {
        console.log(`📋 Found ${existingCount} already-uploaded images in constants file`);
    }

    // Read image files
    const files = await readdir(ASSETS_DIR);
    const imageFiles = files.filter(f => !f.startsWith('.') && /\.(png|jpe?g|webp)$/i.test(f));

    console.log(`📊 Found ${imageFiles.length} images\n`);

    // Start with existing URLs
    const urlMap = { ...existingUrls };
    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const filename of imageFiles) {
        const label = fileNameToLabel(filename);

        // Skip if already uploaded
        if (existingUrls[label]) {
            console.log(`⏩ Skipping ${filename} → "${label}" (already uploaded)`);
            skipped++;
            continue;
        }

        console.log(`\n🖼️  Processing: ${filename} → "${label}"`);

        try {
            const filePath = path.join(ASSETS_DIR, filename);
            const originalBuffer = await readFile(filePath);

            // 1. Remove background (conditionally)
            let processedBuffer = originalBuffer;
            if (!skipBgRemoval) {
                processedBuffer = await removeImageBackground(originalBuffer);
            } else {
                console.log('  ⏭️  Skipping background removal');
            }

            // 2. Resize & compress to WebP
            const compressedBuffer = await resizeAndCompress(processedBuffer);

            // 3. Upload to S3 (stripping the trailing numeric timestamp from filename)
            const cleanFilename = filename.replace(/_\d+(?=\.[^.]+$)/, '');
            const baseName = cleanFilename.replace(/\.[^.]+$/, '');
            const s3Key = `${S3_FOLDER}/${baseName}_${crypto.randomUUID()}.webp`;
            const url = await uploadToS3(compressedBuffer, s3Key, 'image/webp');
            console.log(`  ☁️  Uploaded: ${url}`);

            urlMap[label] = url;
            success++;
        } catch (error) {
            console.error(`  ❌ Failed: ${error.message}`);
            failed++;
        }
    }

    // Write constants file
    console.log('\n\n📝 Generating constants file...');
    const tsContent = generateConstantsFile(urlMap);
    await writeFile(OUTPUT_FILE, tsContent, 'utf-8');
    console.log(`  ✅ Written to: ${OUTPUT_FILE}`);

    // Summary
    console.log('\n════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('════════════════════════════════════');
    console.log(`✅ New uploads: ${success}`);
    console.log(`⏩ Skipped (existing): ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total entries: ${Object.keys(urlMap).length}`);
    console.log(`📝 Constants: ${OUTPUT_FILE}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
