/**
 * Script chụp ảnh poster pixel-perfect bằng Chrome thật (Puppeteer)
 * 
 * Cách dùng:
 *   node capture.js          → Xuất cả PNG và PDF
 *   node capture.js png      → Chỉ xuất PNG
 *   node capture.js pdf      → Chỉ xuất PDF
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const HTML_FILE = path.join(__dirname, 'index.html');
const OUTPUT_PNG = path.join(__dirname, 'Poster_TuyenSinh_THCS_TTThang.png');
const OUTPUT_PDF = path.join(__dirname, 'Poster_TuyenSinh_THCS_TTThang.pdf');
const PORT = 9877;

// Mini HTTP server để serve file
function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
                '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2'
            };
            if (fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        server.listen(PORT, () => {
            console.log(`📡 Server chạy tại http://localhost:${PORT}`);
            resolve(server);
        });
    });
}

async function capture() {
    const mode = (process.argv[2] || 'all').toLowerCase();
    const server = await startServer();

    console.log('🚀 Khởi động Chrome...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 3 });

    console.log('📄 Đang tải trang...');
    await page.goto(`http://localhost:${PORT}/index.html`, {
        waitUntil: 'networkidle0',
        timeout: 30000
    });

    // Đợi fonts và ảnh load xong
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 2000));

    // Ẩn các UI controls
    await page.evaluate(() => {
        // Ẩn nút chức năng
        document.querySelectorAll('.no-print').forEach(el => el.style.display = 'none');
        // Ẩn file input
        document.querySelectorAll('input[type="file"]').forEach(el => el.style.display = 'none');
        // Ẩn logo overlay
        document.querySelectorAll('#logo-label > div.absolute').forEach(el => el.style.display = 'none');
        // Gỡ contenteditable highlight
        document.querySelectorAll('[contenteditable]').forEach(el => {
            el.removeAttribute('contenteditable');
            el.style.outline = 'none';
            el.style.boxShadow = 'none';
        });
        // Ẩn resize handle
        const lf = document.querySelector('#logo-label');
        if (lf && lf.parentElement) {
            lf.parentElement.style.resize = 'none';
            lf.parentElement.style.border = 'none';
        }
    });

    // Lấy kích thước poster
    const poster = await page.$('#capture-area');
    const box = await poster.boundingBox();

    if (mode === 'all' || mode === 'png') {
        console.log('📸 Đang chụp ảnh PNG...');
        await poster.screenshot({
            path: OUTPUT_PNG,
            type: 'png',
            omitBackground: false
        });
        console.log(`✅ Đã lưu: ${OUTPUT_PNG}`);
    }

    if (mode === 'all' || mode === 'pdf') {
        console.log('📄 Đang tạo PDF...');
        await page.pdf({
            path: OUTPUT_PDF,
            width: `${box.width}px`,
            height: `${box.height}px`,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
        console.log(`✅ Đã lưu: ${OUTPUT_PDF}`);
    }

    await browser.close();
    server.close();
    console.log('\n🎉 Hoàn thành! File đã lưu trong thư mục hiện tại.');
}

capture().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
