#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
pkg update -y
pkg install -y python ffmpeg
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if [ ! -f .env ]; then cp .env.example .env; echo "فایل .env ساخته شد؛ BOT_TOKEN را در آن وارد کن و دوباره اجرا کن."; exit 1; fi
python bot.py
