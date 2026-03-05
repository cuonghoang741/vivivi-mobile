const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // Sử dụng thư viện sharp đã có sẵn trong dự án để xử lý ảnh

const inputFolder = path.resolve(__dirname, 'rooms');
const outputFolder = path.resolve(__dirname, 'thumb_rooms');

async function processImages() {
    console.log('✅ Bắt đầu nén ảnh thumbnail...');

    // Kiểm tra thư mục input
    if (!fs.existsSync(inputFolder)) {
        console.error(`❌ Thư mục không tồn tại: ${inputFolder}`);
        return;
    }

    // Tạo thư mục output nếu chưa có
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
        console.log(`📁 Đã tạo thư mục: ${outputFolder}`);
    }

    const files = fs.readdirSync(inputFolder);

    for (const file of files) {
        // Chỉ xử lý các file hình ảnh
        if (!file.match(/\.(png|jpe?g|webp)$/i)) {
            continue;
        }

        const inputPath = path.join(inputFolder, file);
        const outputPath = path.join(outputFolder, file);

        try {
            // Resize ảnh về bề ngang khoảng 250px (tự động tính chiều cao để giữ tỉ lệ)
            // và giảm chất lượng xuống 60% đối với jpeg/webp (định dạng png có thể tối ưu nén png)
            await sharp(inputPath)
                .resize({ width: 300, withoutEnlargement: true })
                .jpeg({ quality: 60, force: false })
                .png({ quality: 60, compressionLevel: 9, force: false })
                .webp({ quality: 60, force: false })
                .toFile(outputPath);

            console.log(`✅ Đã nén thành công: ${file}`);
        } catch (error) {
            console.error(`❌ Lỗi khi nén ảnh ${file}:`, error);
        }
    }

    console.log('\n🎉 Hoàn tất quá trình tạo thumbnail!');
}

processImages().catch(console.error);
