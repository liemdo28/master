FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3 make g++
RUN pip3 install edge-tts
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3005
CMD ["node", "dist/index.js"]
