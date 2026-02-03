/**
 * Script to compress media images and generate thumbnails for photos and videos
 * 
 * This script:
 * 1. Fetches all medias (photo/video) with no thumbnail
 * 2. For photos: Downloads, compresses and resizes using sharp
 * 3. For videos: Extracts a frame using ffmpeg and compresses it
 * 4. Uploads the compressed version to S3 (cloudfly.vn)
 * 5. Updates the media record with the thumbnail URL
 * 
 * Usage: node scripts/compress-media-thumbnails.mjs
 * 
 * Requirements:
 * - ffmpeg must be installed for video thumbnail extraction
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import os from 'os';

// Supabase config - use service key for admin access
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nysfrunajmmaoqtppowb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '-UTZ7HINjE1t8zA';

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
    forcePathStyle: false, // Use virtual-hosted–style URLs
});

// Temp directory for video processing
const TEMP_DIR = path.join(os.tmpdir(), 'media-thumbnails');

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
function generateThumbnailFilename(originalUrl, mediaType) {
    // Create a hash of the original URL for uniqueness
    const hash = crypto.createHash('md5').update(originalUrl).digest('hex').substring(0, 8);

    // Extract original filename without extension
    const urlPath = new URL(originalUrl).pathname;
    const originalFilename = path.basename(urlPath, path.extname(urlPath));

    // Add media type prefix for clarity
    const prefix = mediaType === 'video' ? 'vid' : 'img';

    // Return new filename with .jpg extension (since we're converting to JPEG)
    return `${prefix}_${originalFilename}_thumb_${hash}.jpg`;
}

/**
 * Download and compress an image
 */
async function compressImage(imageUrl) {
    try {
        console.log(`  📥 Downloading image...`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const originalSize = buffer.length;

        console.log(`  📏 Original size: ${(originalSize / 1024).toFixed(2)} KB`);

        // Compress and resize using sharp
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
 * Extract a frame from video and compress it
 */
async function extractVideoThumbnail(videoUrl) {
    try {
        console.log(`  🎬 Extracting video frame...`);

        const hash = crypto.createHash('md5').update(videoUrl).digest('hex').substring(0, 8);
        const tempOutputPath = path.join(TEMP_DIR, `frame_${hash}.jpg`);

        // Use ffmpeg to extract a frame from the video URL directly
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y', // Overwrite output
                '-ss', VIDEO_FRAME_TIME, // Seek to time
                '-i', videoUrl, // Input URL
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
        const { readFile } = await import('fs/promises');
        const frameBuffer = await readFile(tempOutputPath);
        const originalSize = frameBuffer.length;

        console.log(`  📏 Frame size: ${(originalSize / 1024).toFixed(2)} KB`);

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

        console.log(`  📦 Compressed size: ${(compressedSize / 1024).toFixed(2)} KB (${compressionRatio}% smaller)`);

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
 * Upload compressed image to S3
 */
async function uploadToS3(buffer, filename) {
    try {
        console.log(`  ☁️ Uploading to S3...`);

        const key = `${THUMBNAIL_FOLDER}/${filename}`;

        const command = new PutObjectCommand({
            Bucket: AWS_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'image/jpeg',
            ACL: 'public-read',
        });

        await s3Client.send(command);

        // Construct public URL
        const publicUrl = `${S3_PUBLIC_URL_BASE}/${key}`;

        console.log(`  ✅ Uploaded: ${publicUrl}`);

        return publicUrl;
    } catch (error) {
        console.error(`  ❌ Error uploading to S3:`, error.message);
        throw error;
    }
}

/**
 * Update media record with thumbnail URL
 */
async function updateMediaThumbnail(mediaId, thumbnailUrl) {
    const { error } = await supabase
        .from('medias')
        .update({
            thumbnail: thumbnailUrl,
            compressed: true
        })
        .eq('id', mediaId);

    if (error) {
        throw error;
    }
}

/**
 * Process a single media item
 */
async function processMedia(media) {
    console.log(`\n[${media.id}] (${media.media_type})`);
    console.log(`  URL: ${media.url}`);

    try {
        let compressedBuffer;

        // Step 1: Process based on media type
        if (media.media_type === 'video') {
            compressedBuffer = await extractVideoThumbnail(media.url);
        } else {
            compressedBuffer = await compressImage(media.url);
        }

        // Step 2: Generate filename and upload to S3
        const filename = generateThumbnailFilename(media.url, media.media_type);
        const thumbnailUrl = await uploadToS3(compressedBuffer, filename);

        // Step 3: Update database
        await updateMediaThumbnail(media.id, thumbnailUrl);
        console.log(`  ✅ Database updated`);

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
    console.log('🔍 Compress Media Thumbnails Script');
    console.log('====================================');
    console.log(`📦 S3 Bucket: ${AWS_BUCKET}`);
    console.log(`🌐 S3 Endpoint: ${AWS_ENDPOINT}\n`);

    // Ensure temp directory exists
    await ensureTempDir();

    // Fetch all medias without thumbnails (both photos and videos)
    console.log('📷 Fetching medias without thumbnails...\n');

    const { data: medias, error } = await supabase
        .from('medias')
        .select('id, url, thumbnail, media_type')
        .in('media_type', ['photo', 'video'])
        .or('thumbnail.is.null,thumbnail.eq.')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ Failed to fetch medias:', error);
        process.exit(1);
    }

    if (!medias || medias.length === 0) {
        console.log('✅ No medias need thumbnail compression!');
        process.exit(0);
    }

    // Count by type
    const photoCount = medias.filter(m => m.media_type === 'photo').length;
    const videoCount = medias.filter(m => m.media_type === 'video').length;

    console.log(`📊 Found ${medias.length} medias to process:`);
    console.log(`   📷 Photos: ${photoCount}`);
    console.log(`   🎬 Videos: ${videoCount}\n`);

    let success = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < medias.length; i++) {
        console.log(`\n━━━ Processing ${i + 1}/${medias.length} ━━━`);

        const result = await processMedia(medias[i]);

        if (result.success) {
            success++;
        } else {
            failed++;
            errors.push({ id: medias[i].id, type: medias[i].media_type, error: result.error });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
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
            console.log(`  - [${e.type}] ${e.id}: ${e.error}`);
        });
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
