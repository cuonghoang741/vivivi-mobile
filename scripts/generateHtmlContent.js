#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'src', 'assets', 'html', 'index.html');
const outputPath = path.join(projectRoot, 'src', 'assets', 'html', 'htmlContent.ts');

function generate() {
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Không tìm thấy file HTML: ${htmlPath}`);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  if (html.length < 10000) {
    console.warn('⚠️ Nội dung HTML trông có vẻ quá ngắn, kiểm tra lại file index.html');
  }

  const headerLines = [
    '// Auto-generated from index.html',
    '// Do not edit manually.',
    '// ✅ Regenerate by running: `node scripts/generateHtmlContent.js`',
    ''
  ];

  const contents = `${headerLines.join('\n')}export const HTML_CONTENT = ${JSON.stringify(html)};\n`;
  fs.writeFileSync(outputPath, contents);
  console.log(`✅ htmlContent.ts regenerated (${html.length} chars)`);
}

try {
  generate();
} catch (error) {
  console.error('❌ Lỗi generateHtmlContent:', error.message);
  process.exit(1);
}
