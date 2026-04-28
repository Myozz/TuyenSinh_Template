/**
 * Server hỗ trợ xuất poster pixel-perfect bằng Puppeteer
 * 
 * Chạy: node server.js
 * Sau đó mở http://localhost:3000 để xem poster
 * Bấm nút "Tải Ảnh" hoặc "Lưu PDF" → server chụp bằng Chrome thật
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, 'index.html');

let browser = null;

// Khởi tạo browser 1 lần để dùng lại
async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        });
    }
    return browser;
}

// Chụp poster
async function capturePosters(format, draftHtml) {
    const b = await getBrowser();
    const page = await b.newPage();

    try {
        await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 3 });
        await page.goto(`http://localhost:${PORT}/index.html`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        if (draftHtml) {
            await page.evaluate((html) => {
                const container = document.querySelector('.poster-container');
                if(container) container.innerHTML = html;
            }, draftHtml);
        }

        await page.evaluate(() => document.fonts.ready);
        await new Promise(r => setTimeout(r, 1500));

        // Ẩn UI
        await page.evaluate(() => {
            document.querySelectorAll('.no-print').forEach(el => el.style.display = 'none');
            document.querySelectorAll('input[type="file"]').forEach(el => el.style.display = 'none');
            document.querySelectorAll('#logo-label > div.absolute').forEach(el => el.style.display = 'none');
            document.querySelectorAll('[contenteditable]').forEach(el => {
                el.removeAttribute('contenteditable');
                el.style.outline = 'none';
                el.style.boxShadow = 'none';
            });
            const lf = document.querySelector('#logo-label');
            if (lf && lf.parentElement) {
                lf.parentElement.style.resize = 'none';
                lf.parentElement.style.border = 'none';
            }
            // Ẩn sidebar nút bấm
            const sidebar = document.querySelector('.fixed.right-6');
            if (sidebar) sidebar.style.display = 'none';
        });

        const poster = await page.$('#capture-area');
        const box = await poster.boundingBox();

        if (format === 'pdf') {
            const pdfBuffer = await page.pdf({
                width: `${Math.ceil(box.width)}px`,
                height: `${Math.ceil(box.height)}px`,
                printBackground: true,
                margin: { top: 0, right: 0, bottom: 0, left: 0 }
            });
            return { buffer: pdfBuffer, contentType: 'application/pdf', filename: 'Poster_TuyenSinh.pdf' };
        } else {
            const pngBuffer = await poster.screenshot({ type: 'png', omitBackground: false });
            return { buffer: pngBuffer, contentType: 'image/png', filename: 'Poster_TuyenSinh.png' };
        }
    } finally {
        await page.close();
    }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // API endpoint: /api/capture?format=png|pdf
    if (pathname === '/api/capture') {
        const format = parsedUrl.query.format || 'png';
        let body = '';
        if (req.method === 'POST') {
            for await (const chunk of req) {
                body += chunk;
            }
        }
        
        console.log(`📸 Đang chụp ${format.toUpperCase()}...`);
        try {
            const result = await capturePosters(format, body);
            res.writeHead(200, {
                'Content-Type': result.contentType,
                'Content-Disposition': `attachment; filename="${result.filename}"`,
                'Content-Length': result.buffer.length
            });
            res.end(result.buffer);
            console.log(`✅ Đã xuất ${format.toUpperCase()} thành công!`);
        } catch (err) {
            console.error('❌ Lỗi:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml', '.json': 'application/json',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
    };

    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 Poster Server đang chạy!`);
    console.log(`📄 Mở trình duyệt: http://localhost:${PORT}`);
    console.log(`📸 API PNG:  http://localhost:${PORT}/api/capture?format=png`);
    console.log(`📄 API PDF:  http://localhost:${PORT}/api/capture?format=pdf`);
    console.log(`\nNhấn Ctrl+C để dừng.\n`);
});

process.on('SIGINT', async () => {
    if (browser) await browser.close();
    process.exit();
});
