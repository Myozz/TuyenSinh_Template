FROM ghcr.io/puppeteer/puppeteer:latest

# Bỏ qua cảnh báo chạy Puppeteer bằng quyền root (nếu cần thiết, dù image này đã dùng user pptruser)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

# Copy source code với quyền của user hiện tại
COPY --chown=pptruser:pptruser . .

EXPOSE 3000

CMD ["node", "server.js"]
