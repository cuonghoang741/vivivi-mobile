import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SOURCE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const s3Client = new S3Client({
    region: process.env.AWS_DEFAULT_REGION || 'ap-southeast-1',
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    },
    forcePathStyle: process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true',
});

const uploadToS3 = async (buffer: Buffer, key: string, contentType: string) => {
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read' // Just in case it's needed for public access
    });
    await s3Client.send(command);
    const baseUrl = `${process.env.AWS_ENDPOINT}/${process.env.AWS_BUCKET}`;
    return `${baseUrl}/${key}`;
};

async function processCharacters() {
    console.log('🔄 Bắt đầu tải và nén ảnh đúng chuẩn...');

    let hasMore = true;
    let offset = 0;
    const limit = 50;

    while (hasMore) {
        const { data: characters, error } = await supabase
            .from('characters')
            .select('id, name, thumbnail_url, avatar')
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('❌ Lỗi tải characters:', error.message);
            break;
        }

        if (!characters || characters.length === 0) {
            hasMore = false;
            break;
        }

        for (const char of characters) {
            try {
                let updatePayload: any = {};
                let isUpdateNeeded = false;

                console.log(`\n============================`);
                console.log(`Tiến hành xử lý: ${char.name}`);

                // --- 1. Xử lý sửa chữa Thumbnail 500px từ thumbnail_url (ảnh to, toàn thân) ---
                if (char.thumbnail_url && char.thumbnail_url.startsWith('http')) {
                    console.log(`📥 Đang tải thumbnail_url gốc...`);
                    const response = await fetch(char.thumbnail_url);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        console.log(`   Nén thumbnail_url_small (500px)...`);
                        const thumbBuffer = await sharp(buffer)
                            .resize({ width: 500, withoutEnlargement: true })
                            .webp({ quality: 80 })
                            .toBuffer();
                        
                        const thumbKey = `CHARACTERS/${char.id}/thumbnail_500.webp`;
                        updatePayload.thumbnail_url_small = await uploadToS3(thumbBuffer, thumbKey, 'image/webp');
                        isUpdateNeeded = true;
                    } else {
                        console.error(`❌ Không thể tải thumbnail_url cho ${char.name}`);
                    }
                }

                // --- 2. Xử lý sửa chữa Avatar 150px từ avatar (chân dung) ---
                if (char.avatar && char.avatar.startsWith('http')) {
                    console.log(`📥 Đang tải avatar gốc...`);
                    const response = await fetch(char.avatar);
                    if (response.ok) {
                        const buffer = Buffer.from(await response.arrayBuffer());
                        console.log(`   Nén small_avatar_url (150px)...`);
                        const avatarBuffer = await sharp(buffer)
                            .resize({ width: 150, withoutEnlargement: true })
                            .webp({ quality: 80 })
                            .toBuffer();
                        
                        const avatarKey = `CHARACTERS/${char.id}/avatar_150.webp`;
                        updatePayload.small_avatar_url = await uploadToS3(avatarBuffer, avatarKey, 'image/webp');
                        isUpdateNeeded = true;
                    } else {
                        console.error(`❌ Không thể tải avatar cho ${char.name}`);
                    }
                }

                if (isUpdateNeeded) {
                    const { error: updateError } = await supabase
                        .from('characters')
                        .update(updatePayload)
                        .eq('id', char.id);

                    if (updateError) {
                        console.error(`❌ Lỗi lưu DB cho ${char.name}:`, updateError.message);
                    } else {
                        console.log(`✅ Cập nhật thành công vào Database cho ${char.name}`);
                    }
                }
            } catch (err: any) {
                 console.error(`❌ Lỗi xử lý ${char.name}:`, err.message);
            }
        }
        offset += limit;
    }
    console.log('\n🎉 Quá trình chạy lại (chuẩn nguồn ảnh) hoàn tất!');
}

processCharacters().catch(console.error);
