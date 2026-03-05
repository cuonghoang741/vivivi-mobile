const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Nối cấu hình Supabase tương tự như add-characters.ts
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://cjtghurczxqheqwegpiy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SOURCE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGdodXJjenhxaGVxd2VncGl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM4MDAxMCwiZXhwIjoyMDc4OTU2MDEwfQ.1gDh3kIlmhl68xAvRO9QUBJxtWcP-UTZ7HINjE1t8zA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// TODO: Đổi BASE_URL thành domain thực tế mà bạn up các ảnh `rooms` lên
// Ví dụ: trên R2 bucket hoặc Supabase Storage
const BASE_URL = 'https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev/BACKGROUNDS';
const BASE_THUMB_URL = 'https://pub-6671ed00c8d945b28ff7d8ec392f60b8.r2.dev/BG_THUMBS';

const folderPath = path.resolve(__dirname, 'rooms');

async function main() {
    console.log('✅ Bắt đầu thêm backgrounds vào database...');

    if (!fs.existsSync(folderPath)) {
        console.error(`❌ Thư mục không tồn tại: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        // Bỏ qua các file không phải ảnh
        if (!file.match(/\.(png|jpe?g)$/i)) {
            continue;
        }

        const ext = path.extname(file);
        const nameWithoutExt = path.basename(file, ext);

        // Tạo URL ảnh, dùng encodeURIComponent để xử lý các khoảng trắng/kí tự đặc biệt trong tên file
        const fileUrl = `${BASE_URL}/${encodeURIComponent(file)}`;

        // Kiểm tra xem background này đã tồn tại trong database chưa (check theo name)
        const { data: existing, error: searchError } = await supabase
            .from('backgrounds')
            .select('id, name')
            .eq('name', nameWithoutExt)
            .limit(1);

        if (searchError) {
            console.error(`❌ Lỗi khi tìm kiếm ${nameWithoutExt}:`, searchError.message);
            continue;
        }

        // Payload dựa trên interface BackgroundItem
        const insertPayload = {
            name: nameWithoutExt,
            image: fileUrl,
            thumbnail: `${BASE_THUMB_URL}/${encodeURIComponent(file)}`,  // Sử dụng cấu hình BASE_THUMB_URL
            public: true,
            available: true,
            tier: 'free',        // Mặc định là free
            is_dark: false
        };

        // Bỏ qua nếu đã tồn tại record cùng tên => Đã thay đổi thành Update Thumbnail
        if (existing && existing.length > 0) {
            console.log(`⏩ Đã tồn tại, đang update lại thumbnail...: ${nameWithoutExt}`);
            const { error: updateError } = await supabase
                .from('backgrounds')
                .update({ thumbnail: insertPayload.thumbnail })
                .eq('id', existing[0].id);

            if (updateError) {
                console.error(`❌ Lỗi update ${nameWithoutExt}:`, updateError.message);
            } else {
                console.log(`✅ Đã cập nhật thành công thumbnail cho: ${nameWithoutExt}`);
            }
            continue;
        }

        const { data: newBg, error: insertError } = await supabase
            .from('backgrounds')
            .insert(insertPayload)
            .select()
            .single();

        if (insertError) {
            console.error(`❌ Lỗi thêm mới ${nameWithoutExt}:`, insertError.message);
        } else {
            console.log(`✅ Đã thêm: ${nameWithoutExt} (ID: ${newBg.id})`);
        }
    }

    console.log('\n🎉 Hoàn tất quá trình thêm Backgrounds!');
}

main().catch(console.error);
