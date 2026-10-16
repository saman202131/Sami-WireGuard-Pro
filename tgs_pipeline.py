"""Create Telegram animated .TGS stickers from raster images via vector tracing.

TGS is gzipped Lottie JSON, not a renamed PNG/WebM. Raster pixels are traced to
vector paths; the source bitmap is never embedded in the resulting animation.
"""
from __future__ import annotations
import base64, gzip, json, os
from pathlib import Path
from typing import Any
import cv2
import numpy as np
import requests
from PIL import Image, ImageOps

class TGSStickerError(RuntimeError):
    pass

MAX_TGS_BYTES = 64 * 1024
CANVAS = 512
FPS = 60
DURATION = 3.0
FRAMES = 180


def generate_image_from_prompt(prompt: str, output_path: str) -> str:
    """Generate a transparent sticker illustration using the OpenAI Images API."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise TGSStickerError(
            "برای ساخت تصویر از متن، متغیر OPENAI_API_KEY را در تنظیمات محیطی Render وارد کن. "
            "ساخت TGS از عکس ارسالی بدون این کلید هم قابل انجام است."
        )
    prompt = (prompt or "").strip()
    if not prompt or len(prompt) > 1800:
        raise TGSStickerError("توضیح تصویر باید بین ۱ تا ۱۸۰۰ نویسه باشد.")
    endpoint = os.getenv("OPENAI_IMAGE_ENDPOINT", "https://api.openai.com/v1/images/generations")
    model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
    payload = {
        "model": model,
        "prompt": (
            "Create one polished Telegram sticker illustration based on this idea: " + prompt +
            ". Single centered subject, transparent background, bold clean vector-like shapes, "
            "clear silhouette, limited vivid color palette, thick white sticker outline, no lettering, "
            "no watermark, no scene or background. It must remain readable when small."
        ),
        "size": "1024x1024",
        "quality": "medium",
        "background": "transparent",
        "output_format": "png",
        "n": 1,
    }
    try:
        response = requests.post(endpoint, headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=(20, 180))
        if response.status_code >= 400:
            detail = ""
            try:
                detail = response.json().get("error", {}).get("message", "")
            except Exception:
                pass
            raise TGSStickerError(f"سرویس ساخت تصویر پاسخ {response.status_code} داد. {detail[:350]}")
        data = response.json().get("data") or []
        encoded = data[0].get("b64_json") if data else None
        if not encoded:
            raise TGSStickerError("سرویس تصویر خروجی PNG برنگرداند.")
        Path(output_path).write_bytes(base64.b64decode(encoded))
        return output_path
    except requests.Timeout as exc:
        raise TGSStickerError("ساخت تصویر بیش از زمان مجاز طول کشید؛ دوباره تلاش کن.") from exc
    except requests.RequestException as exc:
        raise TGSStickerError(f"اتصال به سرویس ساخت تصویر ناموفق بود: {exc.__class__.__name__}") from exc



def remove_background_from_image(src: str, output_path: str) -> str:
    """Ask the configured image API to isolate the sticker subject on transparency."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise TGSStickerError("برای حذف پس‌زمینه با هوش مصنوعی، OPENAI_API_KEY را در تنظیمات سرور وارد کن.")
    endpoint = os.getenv("OPENAI_IMAGE_EDIT_ENDPOINT", "https://api.openai.com/v1/images/edits")
    model = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1.5")
    try:
        with open(src, "rb") as fh:
            response = requests.post(
                endpoint,
                headers={"Authorization": f"Bearer {api_key}"},
                data={"model": model, "prompt": "Keep the exact main subject and its details. Remove the entire background and return a clean transparent PNG sticker cutout. Do not add objects, text, or watermark. Add a neat white sticker outline only if it fits the subject.", "background": "transparent", "output_format": "png", "size": "1024x1024", "n": 1},
                files={"image": (Path(src).name, fh, "application/octet-stream")},
                timeout=(20, 180),
            )
        if response.status_code >= 400:
            try: detail = response.json().get("error", {}).get("message", "")
            except Exception: detail = ""
            raise TGSStickerError(f"سرویس حذف پس‌زمینه پاسخ {response.status_code} داد. {detail[:300]}")
        data = response.json().get("data") or []
        encoded = data[0].get("b64_json") if data else None
        if not encoded: raise TGSStickerError("سرویس حذف پس‌زمینه PNG برنگرداند.")
        Path(output_path).write_bytes(base64.b64decode(encoded))
        return output_path
    except requests.Timeout as exc:
        raise TGSStickerError("حذف پس‌زمینه بیش از زمان مجاز طول کشید؛ دوباره تلاش کن.") from exc
    except requests.RequestException as exc:
        raise TGSStickerError(f"اتصال به سرویس حذف پس‌زمینه ناموفق بود: {exc.__class__.__name__}") from exc



def apply_tgs_effect(src: str, output_path: str, effect: str = "classic") -> str:
    """Apply a real raster color treatment before tracing the result into TGS paths."""
    from PIL import ImageEnhance
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    effect = (effect or "classic").lower()
    if effect == "neon":
        rgb = ImageEnhance.Color(rgb).enhance(1.9)
        rgb = ImageEnhance.Contrast(rgb).enhance(1.25)
    elif effect in {"mono", "classic"}:
        if effect == "mono": rgb = ImageOps.grayscale(rgb).convert("RGB")
        else: rgb = ImageEnhance.Contrast(rgb).enhance(1.08)
    elif effect == "warm":
        rgb = ImageOps.colorize(ImageOps.grayscale(rgb), "#321b18", "#ffd09a")
    elif effect in {"cool", "ice"}:
        rgb = ImageOps.colorize(ImageOps.grayscale(rgb), "#101a42", "#b4f4ff")
    elif effect == "gold":
        rgb = ImageOps.colorize(ImageOps.grayscale(rgb), "#20120a", "#ffda72")
    elif effect == "rainbow":
        hsv = rgb.convert("HSV")
        h, s, v = hsv.split()
        h = h.point(lambda x: (x + 45) % 256)
        rgb = Image.merge("HSV", (h, s, v)).convert("RGB")
    elif effect == "shadow":
        rgb = ImageEnhance.Brightness(rgb).enhance(0.72)
    elif effect == "vivid":
        rgb = ImageEnhance.Color(rgb).enhance(1.8)
        rgb = ImageEnhance.Contrast(rgb).enhance(1.15)
    elif effect == "soft":
        rgb = ImageEnhance.Color(rgb).enhance(0.78)
        rgb = ImageEnhance.Contrast(rgb).enhance(0.88)
    elif effect in {"shine", "sparkles", "stars"}:
        # These are intentionally simple highlight treatments, not particle simulations.
        rgb = ImageEnhance.Brightness(rgb).enhance(1.12)
        rgb = ImageEnhance.Color(rgb).enhance(1.2)
    rgb.putalpha(alpha)
    rgb.save(output_path, format="PNG")
    return output_path


def _ease_keyframe(t: int, start: list[float], end: list[float]) -> dict[str, Any]:
    n = max(len(start), len(end))
    return {"t": t, "s": start, "e": end, "i": {"x": [0.667] * n, "y": [1] * n}, "o": {"x": [0.333] * n, "y": [0] * n}}


def _animated_transform(index: int, motion: str = "pulse") -> dict[str, Any]:
    """Build a small seamless whole-sticker loop; this is not per-limb character animation."""
    if motion == "wobble":
        rotation = [_ease_keyframe(0, [-5.0], [5.0]), _ease_keyframe(90, [5.0], [-5.0]), {"t": 179, "s": [-5.0]}]
        scale = [_ease_keyframe(0, [100, 100, 100], [100, 100, 100]), _ease_keyframe(90, [100, 100, 100], [100, 100, 100]), {"t": 179, "s": [100, 100, 100]}]
        position = {"a": 0, "k": [256, 256, 0]}
    elif motion == "bounce":
        rotation = {"a": 0, "k": 0}
        scale = [_ease_keyframe(0, [96, 96, 100], [100, 100, 100]), _ease_keyframe(90, [100, 100, 100], [96, 96, 100]), {"t": 179, "s": [96, 96, 100]}]
        position = {"a": 1, "k": [_ease_keyframe(0, [256, 256, 0], [256, 238, 0]), _ease_keyframe(90, [256, 238, 0], [256, 256, 0]), {"t": 179, "s": [256, 256, 0]}]}
    elif motion == "spin":
        rotation = [_ease_keyframe(0, [0.0], [180.0]), _ease_keyframe(90, [180.0], [358.0]), {"t": 179, "s": [360.0]}]
        scale = {"a": 0, "k": [100, 100, 100]}
        position = {"a": 0, "k": [256, 256, 0]}
    elif motion == "none":
        rotation = {"a": 0, "k": 0}
        scale = {"a": 0, "k": [100, 100, 100]}
        position = {"a": 0, "k": [256, 256, 0]}
    else:
        rotation = [_ease_keyframe(0, [-2.0], [2.0]), _ease_keyframe(90, [2.0], [-2.0]), {"t": 179, "s": [-2.0]}]
        scale = [_ease_keyframe(0, [92, 92, 100], [100, 100, 100]), _ease_keyframe(90, [100, 100, 100], [92, 92, 100]), {"t": 179, "s": [92, 92, 100]}]
        position = {"a": 0, "k": [256, 256, 0]}
    return {
        "o": {"a": 0, "k": 100}, "r": {"a": 1, "k": rotation} if isinstance(rotation, list) else rotation,
        "p": position, "a": {"a": 0, "k": [0, 0, 0]},
        "s": {"a": 1, "k": scale} if isinstance(scale, list) else scale,
    }


def _path_shape(points: np.ndarray) -> dict[str, Any]:
    # Lottie path coordinates are local to the 512x512 canvas center.
    verts = [[round(float(x) - 256, 1), round(float(y) - 256, 1)] for x, y in points]
    count = len(verts)
    return {
        "i": [[0, 0] for _ in range(count)],
        "o": [[0, 0] for _ in range(count)],
        "v": verts,
        "c": True,
    }


def _rgba_image(path: str) -> Image.Image:
    try:
        im = Image.open(path).convert("RGBA")
    except Exception as exc:
        raise TGSStickerError("فایل تصویری خوانده نشد؛ PNG یا JPG بفرست.") from exc
    if im.width > 5000 or im.height > 5000:
        raise TGSStickerError("ابعاد تصویر نباید از ۵۰۰۰ پیکسل بیشتر باشد.")
    # Trim transparent margins while preserving transparent subject edges.
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        im = im.crop(bbox)
    if im.width == 0 or im.height == 0:
        raise TGSStickerError("تصویر خالی یا کاملاً شفاف است.")
    im.thumbnail((440, 440), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2))
    return canvas


def _trace_shapes(im: Image.Image, max_shapes: int = 48) -> list[tuple[np.ndarray, tuple[int, int, int, int]]]:
    rgba = np.array(im, dtype=np.uint8)
    rgb = Image.fromarray(rgba[:, :, :3], "RGB")
    # Quantization converts a raster illustration to a compact, limited-color vector sticker.
    quant = np.array(rgb.quantize(colors=6, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB"))
    alpha = rgba[:, :, 3]
    alpha_mask = (alpha > 20).astype(np.uint8) * 255
    if cv2.countNonZero(alpha_mask) < 30:
        raise TGSStickerError("تصویر پس از آماده‌سازی تقریباً خالی است.")
    # A white outer silhouette gives the sticker a recognizable cutout border.
    contours, _ = cv2.findContours(alpha_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    shapes: list[tuple[np.ndarray, tuple[int, int, int, int]]] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:8]:
        if cv2.contourArea(contour) < 10:
            continue
        approx = cv2.approxPolyDP(contour, 2.8, True).reshape(-1, 2)
        if len(approx) >= 3:
            shapes.append((approx, (1, 1, 1, 255)))
    # For each quantized color, trace outer regions. Alpha remains the cutout mask.
    palette_img = Image.fromarray(quant, "RGB").quantize(colors=6, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    labels = np.array(palette_img, dtype=np.uint8)
    palette = palette_img.getpalette() or []
    for color_index in range(6):
        mask = ((labels == color_index) & (alpha > 30)).astype(np.uint8) * 255
        if cv2.countNonZero(mask) == 0:
            continue
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        color = tuple(int(palette[color_index * 3 + j]) for j in range(3)) + (255,)
        for contour in sorted(contours, key=cv2.contourArea, reverse=True):
            if len(shapes) >= max_shapes:
                break
            area = cv2.contourArea(contour)
            if area < 18:
                continue
            approx = cv2.approxPolyDP(contour, 3.2, True).reshape(-1, 2)
            if len(approx) >= 3:
                shapes.append((approx, color))
        if len(shapes) >= max_shapes:
            break
    if not shapes:
        raise TGSStickerError("نتوانستم تصویر را به شکل‌های برداری تبدیل کنم. تصویر ساده‌تر را امتحان کن.")
    return shapes


def create_tgs(src: str, dst: str, motion: str = "pulse") -> dict[str, Any]:
    """Vectorize a PNG/JPG into an animated, gzip-compressed Lottie .TGS file."""
    if motion not in {"pulse", "wobble", "bounce", "spin", "none"}:
        motion = "pulse"
    im = _rgba_image(src)
    traced = _trace_shapes(im)
    layers = []
    for idx, (points, rgba) in enumerate(traced, 1):
        rgb = [round(c / 255.0, 4) for c in rgba[:3]]
        shape = {
            "ty": "gr",
            "it": [
                {"ty": "sh", "ind": 0, "ks": {"a": 0, "k": _path_shape(points)}, "nm": f"Vector path {idx}", "mn": "ADBE Vector Shape - Group", "hd": False},
                {"ty": "fl", "c": {"a": 0, "k": rgb}, "o": {"a": 0, "k": 100}, "r": 1, "bm": 0, "nm": "Fill", "mn": "ADBE Vector Graphic - Fill", "hd": False},
                {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]}, "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0}, "o": {"a": 0, "k": 100}, "sk": {"a": 0, "k": 0}, "sa": {"a": 0, "k": 0}, "nm": "Transform"},
            ],
            "nm": f"Vector group {idx}", "np": 2, "cix": 2, "bm": 0, "ix": idx, "mn": "ADBE Vector Group", "hd": False,
        }
        layers.append({
            "ddd": 0, "ind": idx, "ty": 4, "nm": f"Sticker shape {idx}", "sr": 1,
            "ks": _animated_transform(idx, motion), "ao": 0, "shapes": [shape],
            "ip": 0, "op": FRAMES, "st": 0, "bm": 0,
        })
    document = {
        "v": "5.7.4", "fr": FPS, "ip": 0, "op": FRAMES, "w": CANVAS, "h": CANVAS,
        "nm": "Sami Premium Animated Sticker", "ddd": 0, "assets": [], "layers": layers,
    }
    raw = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    if len(compressed) > MAX_TGS_BYTES:
        # Retry with fewer vector contours and stronger simplification.
        traced = _trace_shapes(im, max_shapes=24)
        layers = []
        for idx, (points, rgba) in enumerate(traced, 1):
            # Coarsen points for a smaller and simpler Lottie file.
            if len(points) > 16:
                points = cv2.approxPolyDP(points.reshape(-1, 1, 2), 5.0, True).reshape(-1, 2)
            if len(points) < 3:
                continue
            rgb = [round(c / 255.0, 4) for c in rgba[:3]]
            group = {"ty": "gr", "it": [
                {"ty": "sh", "ind": 0, "ks": {"a": 0, "k": _path_shape(points)}, "nm": "Path", "mn": "ADBE Vector Shape - Group", "hd": False},
                {"ty": "fl", "c": {"a": 0, "k": rgb}, "o": {"a": 0, "k": 100}, "r": 1, "bm": 0, "nm": "Fill", "mn": "ADBE Vector Graphic - Fill", "hd": False},
                {"ty": "tr", "p": {"a": 0, "k": [0, 0]}, "a": {"a": 0, "k": [0, 0]}, "s": {"a": 0, "k": [100, 100]}, "r": {"a": 0, "k": 0}, "o": {"a": 0, "k": 100}, "sk": {"a": 0, "k": 0}, "sa": {"a": 0, "k": 0}, "nm": "Transform"}], "nm": f"Group {idx}", "np": 2, "cix": 2, "bm": 0, "ix": idx, "mn": "ADBE Vector Group", "hd": False}
            layers.append({"ddd": 0, "ind": idx, "ty": 4, "nm": f"Shape {idx}", "sr": 1, "ks": _animated_transform(idx, motion), "ao": 0, "shapes": [group], "ip": 0, "op": FRAMES, "st": 0, "bm": 0})
        document["layers"] = layers
        raw = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    if len(compressed) > MAX_TGS_BYTES:
        raise TGSStickerError("تصویر بیش از حد پیچیده است و فایل TGS از سقف ۶۴ کیلوبایت عبور می‌کند؛ تصویر ساده‌تر یا لوگوی کم‌جزئیات بفرست.")
    Path(dst).write_bytes(compressed)
    # Self-check the exact deliverable structure before reporting success.
    try:
        check = json.loads(gzip.decompress(Path(dst).read_bytes()))
        assert check["w"] == 512 and check["h"] == 512 and check["fr"] == 60 and check["op"] <= 180
        assert check["layers"] and not check.get("assets")
    except Exception as exc:
        Path(dst).unlink(missing_ok=True)
        raise TGSStickerError("اعتبارسنجی داخلی فایل TGS ناموفق بود.") from exc
    return {"size": len(compressed), "width": CANVAS, "height": CANVAS, "duration": 3, "shapes": len(layers)}
