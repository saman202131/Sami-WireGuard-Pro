# SAMI — Colorful Star Heart

A mobile-friendly animated heart webpage with colorful neon rays, twinkling stars, and Sami branding.

## Deploy on Render
1. Upload all files in this folder to a GitHub repository (keep `app.py`, `requirements.txt`, `render.yaml`, and the `templates` folder).
2. In Render, choose **New + → Web Service** and connect the GitHub repository.
3. Render can use `render.yaml` automatically. If entering settings manually:
   - Runtime: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
4. Deploy. Open the `.onrender.com` URL Render gives you.

## Run locally
```bash
pip install -r requirements.txt
python app.py
```
Then open `http://127.0.0.1:5000`.

No API keys or environment variables are required.
