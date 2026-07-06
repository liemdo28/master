FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip ffmpeg
WORKDIR /app
COPY package.json ./
COPY apps/voiceover-service ./apps/voiceover-service
COPY packages/voiceover-core ./packages/voiceover-core
RUN npm install --workspaces
RUN pip install edge-tts
EXPOSE 3010
CMD ["npx", "tsx", "apps/voiceover-service/src/index.ts"]
