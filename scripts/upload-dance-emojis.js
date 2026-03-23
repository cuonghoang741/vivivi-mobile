/**
 * Script: upload-dance-emojis.js
 * Upload ảnh emoji cho từng dance lên S3, rồi update icon_url trong bảng dances.
 *
 * Cấu trúc thư mục:
 *   scripts/dance-emojis/
 *     ├── Angry.png
 *     ├── Blow A Kiss.png
 *     ├── Hip Hop.png
 *     └── ...
 *
 * Tên file phải trùng với dance name hoặc file_name trong DB.
 * Usage: node scripts/upload-dance-emojis.js
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import path from 'path';
import { readFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMOJI_DIR = path.join(__dirname, 'dance-emojis');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cjtghurczxqheqwegpiy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGdodXJjenhxaGVxd2VncGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM4MDAxMCwiZXhwIjoyMDc4OTU2MDEwfQ.1gDh3kIlmhl68xAvRO9QUBJxtWcP-UTZ7HINjE1t8zA';

// S3/Cloudfly
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'https://s3.cloudfly.vn';
const AWS_BUCKET = process.env.AWS_BUCKET || 'roxie';
const AWS_REGION = process.env.AWS_DEFAULT_REGION || 'us-east-1';
const S3_PUBLIC_URL_BASE = `https://s3.cloudfly.vn/${AWS_BUCKET}`;
const S3_FOLDER = 'dance-emojis';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const s3Client = new S3Client({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: false,
});

const MIME_MAP = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
};

async function compressImage(buffer) {
    return await sharp(buffer)
        .resize(400, null, { withoutEnlargement: true, fit: 'inside' })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
}

async function uploadToS3(buffer, key, contentType) {
    const command = new PutObjectCommand({
        Bucket: AWS_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
    });
    await s3Client.send(command);
    return `${S3_PUBLIC_URL_BASE}/${key}`;
}

function normalize(str) {
    return str.toLowerCase()
        .replace(/\.fbx$/i, '')
        .replace(/\.\w+$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();
}

async function main() {
    console.log('🚀 Upload Dance Emoji Images');
    console.log('====================================\n');

    // Lấy danh sách dances từ DB
    const { data: dances, error: dbError } = await supabase
        .from('dances')
        .select('id, name, file_name')
        .order('display_order');

    if (dbError) {
        console.error('❌ Lỗi fetch dances:', dbError.message);
        process.exit(1);
    }
    console.log(`📦 Tìm thấy ${dances.length} dances trong DB`);

    // Lấy danh sách file ảnh
    const files = (await readdir(EMOJI_DIR))
        .filter(f => !f.startsWith('.') && Object.keys(MIME_MAP).some(ext => f.toLowerCase().endsWith(ext)));

    console.log(`🖼️  Tìm thấy ${files.length} file ảnh trong ${EMOJI_DIR}\n`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const baseName = normalize(file);

        // Tìm dance match
        const dance = dances.find(d =>
            normalize(d.name) === baseName ||
            normalize(d.file_name) === baseName ||
            normalize(d.name).replace(/\s/g, '') === baseName.replace(/\s/g, '')
        );

        if (!dance) {
            console.log(`⚠️  Không match được dance nào cho file: ${file}`);
            skipped++;
            continue;
        }

        try {
            const rawBuffer = await readFile(path.join(EMOJI_DIR, file));
            const buffer = await compressImage(rawBuffer);
            const s3Key = `${S3_FOLDER}/${dance.id}.jpg`; // always .jpg after compress
            const contentType = 'image/jpeg';

            console.log(`[${dance.name}] Đang upload...`);
            const publicUrl = await uploadToS3(buffer, s3Key, contentType);

            // Update icon_url trong DB
            const { error: updateError } = await supabase
                .from('dances')
                .update({ icon_url: publicUrl })
                .eq('id', dance.id);

            if (updateError) {
                console.error(`  ❌ Cập nhật DB thất bại: ${updateError.message}`);
                failed++;
            } else {
                console.log(`  ✅ → ${publicUrl}`);
                success++;
            }
        } catch (err) {
            console.error(`  ❌ [${dance.name}] Lỗi: ${err.message}`);
            failed++;
        }
    }

    console.log('\n════════════════════════════════════');
    console.log(`✅ Thành công: ${success}`);
    console.log(`⏩ Bỏ qua: ${skipped}`);
    console.log(`❌ Thất bại: ${failed}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
