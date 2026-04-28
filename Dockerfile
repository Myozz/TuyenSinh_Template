FROM ghcr.io/puppeteer/puppeteer:latest

# Bỏ qua cảnh báo chạy Puppeteer bằng quyền root (nếu cần thiết, dù image này đã dùng user pptruser)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

USER root

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Đổi quyền sở hữu cho pptruser
RUN chown -R pptruser:pptruser /usr/src/app

# Trở lại user mặc định của image puppeteer
USER pptruser

EXPOSE 3000

CMD ["node", "server.js"]
