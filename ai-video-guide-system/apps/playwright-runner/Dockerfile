FROM node:20-alpine
RUN apk add --no-cache chromium ffmpeg
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx playwright install chromium --with-deps || true
EXPOSE 3002
CMD ["node", "dist/index.js"]
