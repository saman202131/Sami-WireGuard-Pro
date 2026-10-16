FROM node:22-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PYTHON_BIN=python3
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN python3 -m venv /opt/sticker-venv && /opt/sticker-venv/bin/pip install --no-cache-dir -r /app/stickerbot_worker/requirements.txt
ENV PYTHON_BIN=/opt/sticker-venv/bin/python
EXPOSE 3000
CMD ["npm","start"]
