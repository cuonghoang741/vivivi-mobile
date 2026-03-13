/**
 * Script to read local medias directory, upload medias to S3, generate and upload thumbnails,
 * and insert records into Supabase medias table.
 * 
 * Directory structure:
 * scripts/medias/
 *   ├── [character_id_1]/
 *   │   ├── video1.mp4
 *   │   └── photo1.png
 *   └── [character_id_2]/
 *       └── photo2.jpg
 * 
 * Usage: node scripts/import-medias.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import { spawn } from 'child_process';
import { readFile, unlink, mkdir, readdir, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import os from 'os';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIAS_DIR = path.join(__dirname, 'medias');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Supabase config - use service key for admin access
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cjtghurczxqheqwegpiy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGdodXJjenhxaGVxd2VncGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM4MDAxMCwiZXhwIjoyMDc4OTU2MDEwfQ.1gDh3kIlmhl68xAvRO9QUBJxtWcP-UTZ7HINjE1t8zA';

// S3/Cloudfly config
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'https://s3.cloudfly.vn';
const AWS_BUCKET = process.env.AWS_BUCKET || 'roxie';
const AWS_REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';

// Public URL base for uploaded files
const S3_PUBLIC_URL_BASE = `https://s3.cloudfly.vn/${AWS_BUCKET}`;

// Thumbnail settings
const THUMBNAIL_MAX_WIDTH = 400;
const THUMBNAIL_MAX_HEIGHT = 600;
const THUMBNAIL_QUALITY = 80; // JPEG quality (0-100)
const THUMBNAIL_FOLDER = 'media-thumbnails'; // Folder in S3 bucket
const MEDIA_FOLDER = 'medias'; // Main media folder

// Video thumbnail settings
const VIDEO_FRAME_TIME = '00:00:01'; // Extract frame at 1 second

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Initialize S3 client
const s3Client = new S3Client({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false, // Use virtual-hosted-style URLs
});

// Temp directory for video processing
const TEMP_DIR = path.join(os.tmpdir(), 'media-thumbnails');

const MIME_MAP = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
};

/**
 * Ensure temp directory exists
 */
async function ensureTempDir() {
    try {
        await mkdir(TEMP_DIR, { recursive: true });
    } catch (err) {
        // Directory might already exist
    }
}

/**
 * Generate a unique filename for the thumbnail
 */
function generateThumbnailFilename(originalFilename, mediaType) {
    const hash = crypto.randomBytes(4).toString('hex');
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const prefix = mediaType === 'video' ? 'vid' : 'img';
    return `${prefix}_${baseName}_thumb_${hash}.jpg`;
}

/**
 * Generate a unique filename for the main media
 */
function generateMediaFilename(characterId, originalFilename) {
    const hash = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    return `${characterId}_${baseName}_${hash}${ext}`;
}

/**
 * Compress an image from local path
 */
async function compressImage(localPath) {
    try {
        console.log(`  🖼️ Compressing image...`);
        const buffer = await readFile(localPath);
        const originalSize = buffer.length;

        const compressedBuffer = await sharp(buffer)
            .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({
                quality: THUMBNAIL_QUALITY,
                progressive: true
            })
            .toBuffer();

        const compressedSize = compressedBuffer.length;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        console.log(`  📦 Compressed size: ${(compressedSize / 1024).toFixed(2)} KB (${compressionRatio}% smaller)`);

        return compressedBuffer;
    } catch (error) {
        console.error(`  ❌ Error compressing image:`, error.message);
        throw error;
    }
}

/**
 * Extract a frame from video and compress it from local path
 */
async function extractVideoThumbnail(localPath) {
    try {
        console.log(`  🎬 Extracting video frame...`);

        const hash = crypto.randomBytes(4).toString('hex');
        const tempOutputPath = path.join(TEMP_DIR, `frame_${hash}.jpg`);

        // Use ffmpeg to extract a frame from the local video
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y', // Overwrite output
                '-ss', VIDEO_FRAME_TIME, // Seek to time
                '-i', localPath, // Input path
                '-vframes', '1', // Extract 1 frame
                '-q:v', '2', // Quality
                '-f', 'image2', // Output format
                tempOutputPath
            ]);

            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`ffmpeg error: ${err.message}`));
            });
        });

        // Read the extracted frame
        const frameBuffer = await readFile(tempOutputPath);
        const originalSize = frameBuffer.length;

        // Compress the frame using sharp
        const compressedBuffer = await sharp(frameBuffer)
            .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({
                quality: THUMBNAIL_QUALITY,
                progressive: true
            })
            .toBuffer();

        const compressedSize = compressedBuffer.length;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        console.log(`  📦 Compressed frame: ${(compressedSize / 1024).toFixed(2)} KB (${compressionRatio}% smaller)`);

        // Clean up temp file
        try {
            await unlink(tempOutputPath);
        } catch (e) {
            // Ignore cleanup errors
        }

        return compressedBuffer;
    } catch (error) {
        console.error(`  ❌ Error extracting video thumbnail:`, error.message);
        throw error;
    }
}

/**
 * Upload buffer to S3
 */
async function uploadBufferToS3(buffer, key, contentType) {
    try {
        const command = new PutObjectCommand({
            Bucket: AWS_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: contentType || 'application/octet-stream',
            ACL: 'public-read',
        });

        await s3Client.send(command);

        return `${S3_PUBLIC_URL_BASE}/${key}`;
    } catch (error) {
        console.error(`  ❌ Error uploading to S3:`, error.message);
        throw error;
    }
}

/**
 * Upload local file to S3
 */
async function uploadFileToS3(localPath, key, contentType) {
    const buffer = await readFile(localPath);
    return await uploadBufferToS3(buffer, key, contentType);
}

/**
 * Check if media already exists in DB
 */
async function checkMediaExists(characterId, name, mediaType) {
    const { data, error } = await supabase
        .from('medias')
        .select('id')
        .eq('character_id', characterId)
        .eq('name', name)
        .eq('media_type', mediaType)
        .limit(1);

    if (error) {
        throw error;
    }

    return data && data.length > 0;
}

/**
 * Insert media record into DB
 */
async function insertMediaRecord(characterId, url, thumbnailUrl, mediaType, name) {
    const { error } = await supabase
        .from('medias')
        .insert({
            character_id: characterId,
            url: url,
            thumbnail: thumbnailUrl,
            media_type: mediaType,
            name: name,
            compressed: true,
            tier: 'pro'
        });

    if (error) {
        throw error;
    }
}

/**
 * Process a single media file
 */
async function processMediaFile(characterId, filePath, filename) {
    console.log(`\n[${characterId}] Processing ${filename}`);

    try {
        const ext = path.extname(filename).toLowerCase();
        const mimeType = MIME_MAP[ext] || 'application/octet-stream';
        const mediaType = mimeType.startsWith('video') ? 'video' : 'photo';
        const name = path.basename(filename, ext);

        // Check if exists
        const exists = await checkMediaExists(characterId, name, mediaType);
        if (exists) {
            console.log(`  ⏩ Skipped: Media with name "${name}" (${mediaType}) already exists for character.`);
            return { success: true, skipped: true };
        }

        // 1. Upload original media
        const s3MainFilename = generateMediaFilename(characterId, filename);
        const s3MainKey = `${MEDIA_FOLDER}/${s3MainFilename}`;
        console.log(`  ☁️ Uploading original media...`);
        const mainUrl = await uploadFileToS3(filePath, s3MainKey, mimeType);
        console.log(`  ✅ Original URL: ${mainUrl}`);

        // 2. Generate and upload thumbnail
        let thumbnailBuffer;
        if (mediaType === 'video') {
            thumbnailBuffer = await extractVideoThumbnail(filePath);
        } else {
            thumbnailBuffer = await compressImage(filePath);
        }

        const thumbFilename = generateThumbnailFilename(filename, mediaType);
        console.log(`  ☁️ Uploading thumbnail...`);
        const thumbnailUrl = await uploadBufferToS3(thumbnailBuffer, `${THUMBNAIL_FOLDER}/${thumbFilename}`, 'image/jpeg');
        console.log(`  ✅ Thumbnail URL: ${thumbnailUrl}`);

        // 3. Insert into Supabase
        await insertMediaRecord(characterId, mainUrl, thumbnailUrl, mediaType, name);
        console.log(`  ✅ Inserted into database`);

        return { success: true };
    } catch (error) {
        console.error(`  ❌ Failed:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Main function
 */
async function main() {
    console.log('🔍 Import Medias Script');
    console.log('====================================');
    console.log(`📦 S3 Bucket: ${AWS_BUCKET}`);
    console.log(`🌐 S3 Endpoint: ${AWS_ENDPOINT}\n`);

    await ensureTempDir();

    let success = 0;
    let failed = 0;
    const errors = [];

    // Read character ID directories
    let characterDirs = [];
    try {
        const items = await readdir(MEDIAS_DIR);
        // filter out DS_Store or ordinary files
        for (const item of items) {
            if (item.startsWith('.')) continue; // skip hidden files and directories
            const itemPath = path.join(MEDIAS_DIR, item);
            const stats = await stat(itemPath);
            if (stats.isDirectory()) {
                characterDirs.push(item);
            }
        }
    } catch (err) {
        console.error(`❌ Failed to read medias directory (${MEDIAS_DIR}):`, err.message);
        process.exit(1);
    }

    if (characterDirs.length === 0) {
        console.log('✅ No character folders found in medias directory!');
        process.exit(0);
    }

    console.log(`📊 Found ${characterDirs.length} character folders`);

    for (const characterId of characterDirs) {
        const charDirPath = path.join(MEDIAS_DIR, characterId);
        const files = await readdir(charDirPath);

        const mediaFiles = files.filter(f => !f.startsWith('.'));
        console.log(`\n━━━ Character: ${characterId} (${mediaFiles.length} files) ━━━`);

        for (const filename of mediaFiles) {
            const filePath = path.join(charDirPath, filename);
            const stats = await stat(filePath);
            if (!stats.isFile()) continue;

            const result = await processMediaFile(characterId, filePath, filename);
            if (result.success) {
                success++;
            } else {
                failed++;
                errors.push({ id: `${characterId}/${filename}`, error: result.error });
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Summary
    console.log('\n\n════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('════════════════════════════════════');
    console.log(`✅ Success: ${success}`);
    console.log(`❌ Failed: ${failed}`);

    if (errors.length > 0) {
        console.log('\n❌ Errors:');
        errors.forEach(e => {
            console.log(`  - [${e.id}]: ${e.error}`);
        });
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

