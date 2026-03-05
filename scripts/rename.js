const fs = require('fs');
const path = require('path');

// Thay đổi đường dẫn này trỏ tới thư mục chứa ảnh của bạn
const folderPath = './rooms';

fs.readdirSync(folderPath).forEach(file => {
    // Chỉ xử lý các file ảnh (bạn có thể thêm định dạng khác nếu cần)
    if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        const ext = path.extname(file);
        let newName = path.basename(file, ext);

        // 1. Xoá chữ "Anime_" hoặc "Anime" ở đầu
        if (newName.startsWith('Anime_')) {
            newName = newName.substring(6); // Xoá 'Anime_'
        } else if (newName.startsWith('Anime')) {
            newName = newName.substring(5); // Xoá 'Anime'
        }

        // 2. Xoá đoạn hash ở cuối cùng (ví dụ: _622de36819 hoặc _6542ed5f8f)
        // Pattern: dấu _ theo sau là các ký tự chữ cái và số nằm ở cuối chuỗi
        newName = newName.replace(/_[a-z0-9]+$/i, '');

        // 3. Thay thế toàn bộ dấu '_' còn lại bằng dấu cách ' '
        newName = newName.replace(/_/g, ' ');

        // 4. Cắt khoảng trắng thừa và viết hoa chữ cái đầu của mỗi từ
        newName = newName
            .trim()
            .split(' ')
            .map(word => {
                if (!word) return '';
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');

        // Thêm lại đuôi file (.png, .jpg)
        const finalName = newName + ext;

        const oldPath = path.join(folderPath, file);
        const newPath = path.join(folderPath, finalName);

        // Đổi tên file thực tế
        if (file !== finalName) {
            fs.renameSync(oldPath, newPath);
            console.log(`Đã đổi tên: ${file} \n-> ${finalName}\n`);
        }
    }
});
