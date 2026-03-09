const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cjtghurczxqheqwegpiy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SOURCE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGdodXJjenhxaGVxd2VncGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM4MDAxMCwiZXhwIjoyMDc4OTU2MDEwfQ.1gDh3kIlmhl68xAvRO9QUBJxtWcP-UTZ7HINjE1t8zA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Thư mục lưu file tải về (trong thư mục hiện hành mà script được gọi)
const downloadDir = path.resolve(process.cwd(), 'downloaded-backgrounds');

if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

/**
 * Hàm hỗ trợ tải file từ URL
 */
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            // Xử lý chuyển hướng (redirect) nếu có
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }

            if (res.statusCode !== 200) {
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }

            const fileStream = fs.createWriteStream(dest);
            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        }).on('error', reject);
    });
}

/**
 * Lấy tên file từ URL
 */
function getFileNameFromUrl(urlStr, defaultName) {
    try {
        const parsed = new URL(urlStr);
        let basename = path.basename(parsed.pathname);
        if (basename) {
            // Giải mã URL encoded, ví dụ: "my%20image.jpg" -> "my image.jpg"
            basename = decodeURIComponent(basename);
            return basename;
        }
        return defaultName;
    } catch {
        return defaultName;
    }
}

async function main() {
    console.log('✅ Bắt đầu kết nối database để tải backgrounds...');

    // Lấy toàn bộ dữ liệu từ bảng backgrounds
    const { data: backgrounds, error } = await supabase
        .from('backgrounds')
        .select('*');

    if (error) {
        console.error('❌ Lỗi khi lấy dữ liệu backgrounds:', error.message);
        return;
    }

    console.log(`🔍 Tìm thấy ${backgrounds.length} backgrounds.`);
    console.log(`📁 Thư mục lưu trữ: ${downloadDir}\n`);

    let successCount = 0;

    for (const bg of backgrounds) {
        if (!bg.image) {
            console.log(`⏩ Bỏ qua ID ${bg.id} (${bg.name}) vì không có URL hình ảnh.`);
            continue;
        }

        const fileName = getFileNameFromUrl(bg.image, `${bg.name || bg.id}.jpg`);
        // Làm sạch tên file để tránh lỗi lưu trữ trên hệ điều hành
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_ ()]/g, '_');
        const destPath = path.join(downloadDir, safeFileName);

        try {
            console.log(`⬇️  Đang tải: ${bg.name || 'Unknown'} -> ${safeFileName}`);
            await downloadFile(bg.image, destPath);
            successCount++;
        } catch (err) {
            console.error(`❌ Lỗi khi tải ${bg.image}:`, err.message);
        }
    }

    console.log(`\n🎉 Hoàn tất! Đã tải thành công ${successCount}/${backgrounds.length} file hình nền.`);
}

main().catch(console.error);
