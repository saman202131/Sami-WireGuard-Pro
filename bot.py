import asyncio, logging, os, tempfile, shutil
from pathlib import Path
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
from dotenv import load_dotenv
from config import TOKEN, MAX_INPUT_MB, MAX_CONCURRENT_JOBS
from stickerbot.pipeline import render_sticker, probe_media, StickerError
from stickerbot.effects import EFFECTS, EFFECT_DESCRIPTIONS

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("stickerbot")
JOBS = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
MAIN = ReplyKeyboardMarkup([
    [KeyboardButton("🎨 ساخت استیکر"), KeyboardButton("🪄 ساخت مشابه نمونه")],
    [KeyboardButton("✨ افکت‌ها"), KeyboardButton("🧹 حذف پس‌زمینه")],
    [KeyboardButton("⚙️ تنظیمات"), KeyboardButton("🎲 افکت تصادفی")],
    [KeyboardButton("🔄 ساخت نسخه جدید"), KeyboardButton("📖 راهنما")]
], resize_keyboard=True)
def state(context):
    return context.user_data.setdefault("project", {"effect":"bounce","speed":1.0,"intensity":1.0,"duration":2.0,"bg":"transparent","source":None,"reference":None,"mode":"create"})
def effect_keyboard():
    rows=[]; row=[]
    for key, label in EFFECTS.items():
        row.append(InlineKeyboardButton(label, callback_data=f"fx:{key}"))
        if len(row)==2: rows.append(row); row=[]
    if row: rows.append(row)
    return InlineKeyboardMarkup(rows)
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state(context)
    await update.message.reply_text("سلام! 👋\nبه سازنده استیکر متحرک خوش آمدی.\nیک عکس بفرست، افکت انتخاب کن و خروجی WebM را دریافت کن.\n\nنکته: خروجی ویدیوی استیکر است؛ افزودن به پک از طریق @Stickers یا قابلیت‌های رسمی تلگرام انجام می‌شود.", reply_markup=MAIN)
async def help_cmd(update, context):
    await update.message.reply_text("راهنما:\n۱) «🎨 ساخت استیکر» را بزن و عکس را ارسال کن.\n۲) افکت را انتخاب کن.\n۳) سرعت، شدت و مدت را در تنظیمات تغییر بده.\n۴) «ساخت خروجی» را بزن.\n\nبرای مشابه نمونه، ابتدا عکس خودت و سپس نمونه را بفرست. تحلیل نمونه تقریبی و مبتنی بر ویژگی‌های قابل اندازه‌گیری است؛ حرکت دقیق یا هوش مصنوعی تضمین نمی‌شود.\n\nورودی حداکثر %s مگابایت. خروجی برای استاندارد ویدیواستیکر تلگرام تنظیم می‌شود، اما محدودیت حجم ۲۵۶KB ممکن است بسته به عکس/افکت نیازمند کاهش کیفیت باشد." % MAX_INPUT_MB, reply_markup=MAIN)
async def text_handler(update, context):
    t=update.message.text or ""; p=state(context)
    if t in ("📖 راهنما","/help"): return await help_cmd(update,context)
    if t=="🎨 ساخت استیکر":
        p["mode"]="create"; p["source"]=None
        await update.message.reply_text("عکس موردنظر را به‌صورت عکس یا فایل تصویری بفرست.")
    elif t=="🪄 ساخت مشابه نمونه":
        p["mode"]="reference"; p["source"]=None; p["reference"]=None
        await update.message.reply_text("اول عکس خودت را بفرست؛ بعد از آن استیکر یا تصویر نمونه را ارسال کن.")
    elif t=="✨ افکت‌ها":
        await update.message.reply_text("یک افکت انتخاب کن:", reply_markup=effect_keyboard())
    elif t=="🧹 حذف پس‌زمینه":
        await update.message.reply_text("حذف پس‌زمینه به مدل اختیاری rembg نیاز دارد و در نسخه پایه فعال نیست. این پروژه شفافیت جعلی نمی‌سازد؛ برای خروجی شفاف، عکس دارای آلفا بفرست.")
    elif t=="⚙️ تنظیمات":
        kb=InlineKeyboardMarkup([
          [InlineKeyboardButton("سرعت −",callback_data="speed:-"),InlineKeyboardButton("سرعت +",callback_data="speed:+")],
          [InlineKeyboardButton("شدت −",callback_data="intensity:-"),InlineKeyboardButton("شدت +",callback_data="intensity:+")],
          [InlineKeyboardButton("مدت 1 ثانیه",callback_data="dur:1"),InlineKeyboardButton("مدت 2 ثانیه",callback_data="dur:2"),InlineKeyboardButton("مدت 3 ثانیه",callback_data="dur:3")],
          [InlineKeyboardButton("پس‌زمینه شفاف",callback_data="bg:transparent"),InlineKeyboardButton("مشکی",callback_data="bg:black"),InlineKeyboardButton("سفید",callback_data="bg:white")],
          [InlineKeyboardButton("ساخت خروجی",callback_data="render")]
        ])
        await update.message.reply_text(f"تنظیمات فعلی: سرعت {p['speed']:.1f}، شدت {p['intensity']:.1f}، مدت {p['duration']:.0f} ثانیه، پس‌زمینه {p['bg']}.",reply_markup=kb)
    elif t=="🎲 افکت تصادفی":
        import random
        p["effect"]=random.choice(list(EFFECTS))
        await update.message.reply_text(f"افکت انتخاب شد: {EFFECTS[p['effect']]}. عکس بفرست یا ساخت خروجی را از تنظیمات بزن.")
    elif t=="🔄 ساخت نسخه جدید":
        if not p.get("source"): await update.message.reply_text("اول یک عکس بفرست."); return
        await render_and_send(update,context)
    else:
        await update.message.reply_text("از دکمه‌های منو استفاده کن یا /help را بزن.",reply_markup=MAIN)
async def receive_media(update, context):
    p=state(context); msg=update.message
    media = msg.photo[-1] if msg.photo else msg.document
    if not media: return
    if msg.document and (not msg.document.mime_type or not msg.document.mime_type.startswith("image/")):
        await msg.reply_text("فقط فایل تصویری یا عکس پشتیبانی می‌شود."); return
    if media.file_size and media.file_size > MAX_INPUT_MB*1024*1024:
        await msg.reply_text(f"حجم عکس باید کمتر از {MAX_INPUT_MB} مگابایت باشد."); return
    work=Path(tempfile.mkdtemp(prefix=f"sticker_{update.effective_user.id}_"))
    try:
        f=await context.bot.get_file(media.file_id)
        dest=work/("input"+(Path(media.file_name).suffix if msg.document and media.file_name else ".jpg"))
        await f.download_to_drive(dest)
        info=probe_media(dest)
        if info.get("width",0)>5000 or info.get("height",0)>5000: raise StickerError("ابعاد عکس بیش از حد بزرگ است.")
        if p["mode"]=="reference" and p.get("source"):
            p["reference"]=str(dest)
            # Reference-analysis uses measured file metadata as a simple heuristic, not exact cloning.
            p["effect"]= "pulse" if info.get("animated") else "neon"
            await msg.reply_text(f"نمونه بررسی شد؛ افکت پیشنهادی: {EFFECTS[p['effect']]}. تحلیل حرکت فقط وقتی فایل واقعاً متحرک باشد قابل اتکاتر است. برای تولید، دکمه «🔄 ساخت نسخه جدید» را بزن.")
            # Keep original source directory intact; the reference file is no longer needed after metadata analysis.
            shutil.rmtree(work,ignore_errors=True)
        elif p["mode"]=="reference":
            old=p.get("work")
            if old and old != str(work): shutil.rmtree(old,ignore_errors=True)
            p["source"]=str(dest); p["source_work"]=str(work); p["work"]=str(work)
            await msg.reply_text("عکس اصلی دریافت شد. حالا نمونه استیکر/تصویر را بفرست.")
        else:
            old=p.get("work")
            if old and old != str(work): shutil.rmtree(old,ignore_errors=True)
            p["source"]=str(dest); p["source_work"]=str(work); p["work"]=str(work)
            await msg.reply_text("عکس دریافت شد. افکت را انتخاب کن یا «🔄 ساخت نسخه جدید» را بزن.",reply_markup=MAIN)
            await msg.reply_text("افکت‌ها:",reply_markup=effect_keyboard())
    except Exception as e:
        shutil.rmtree(work,ignore_errors=True)
        log.exception("media handling failed")
        await msg.reply_text(f"پردازش عکس انجام نشد: {e}")
async def render_and_send(update, context):
    p=state(context)
    if not p.get("source") or not Path(p["source"]).exists():
        target=update.effective_message
        await target.reply_text("اول یک عکس بفرست."); return
    async with JOBS:
        await update.effective_message.reply_text("در حال ساخت پیش‌نمایش متحرک…")
        out=Path(p.get("work",tempfile.gettempdir()))/"preview.webm"
        try:
            await asyncio.to_thread(render_sticker, p["source"],str(out),p["effect"],p["duration"],p["speed"],p["intensity"],p["bg"])
            if not out.exists() or out.stat().st_size==0: raise StickerError("خروجی ساخته نشد.")
            await update.effective_message.reply_document(document=out.open("rb"),filename="sticker_preview.webm",caption=f"پیش‌نمایش: {EFFECTS[p['effect']]}\nبرای افزودن به پک، از @Stickers استفاده کن.")
        except Exception as e:
            log.exception("render failed")
            await update.effective_message.reply_text(f"ساخت خروجی ناموفق بود: {e}\nمطمئن شو FFmpeg با پشتیبانی libvpx-vp9 نصب شده است.")
async def callbacks(update, context):
    q=update.callback_query; await q.answer(); p=state(context); data=q.data
    if data.startswith("fx:"):
        p["effect"]=data.split(":",1)[1]
        await q.edit_message_text(f"افکت انتخاب شد: {EFFECTS[p['effect']]}\n{EFFECT_DESCRIPTIONS[p['effect']]}")
    elif data.startswith("speed:"):
        p["speed"]=max(.5,min(2.0,p["speed"]+(.25 if data.endswith("+") else -.25)))
        await q.edit_message_text(f"سرعت: {p['speed']:.2f}x")
    elif data.startswith("intensity:"):
        p["intensity"]=max(.3,min(2.0,p["intensity"]+(.2 if data.endswith("+") else -.2)))
        await q.edit_message_text(f"شدت: {p['intensity']:.1f}")
    elif data.startswith("dur:"):
        p["duration"]=float(data.split(":")[1]); await q.edit_message_text(f"مدت روی {p['duration']:.0f} ثانیه تنظیم شد.")
    elif data.startswith("bg:"):
        p["bg"]=data.split(":")[1]; await q.edit_message_text(f"پس‌زمینه: {p['bg']}")
    elif data=="render":
        await render_and_send(update,context)
async def error_handler(update, context):
    log.error("Unhandled exception",exc_info=context.error)
def main():
    load_dotenv()
    if not TOKEN or TOKEN=="put_your_bot_token_here":
        raise SystemExit("توکن تنظیم نشده است؛ فایل .env را از روی .env.example بساز و BOT_TOKEN را وارد کن.")
    app=Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start",start)); app.add_handler(CommandHandler("help",help_cmd))
    app.add_handler(CallbackQueryHandler(callbacks))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND,text_handler))
    app.add_handler(MessageHandler(filters.PHOTO | filters.Document.ALL,receive_media))
    app.add_error_handler(error_handler)
    log.info("ربات آماده اجراست. برای توقف Ctrl+C را بزن.")
    app.run_polling(drop_pending_updates=True)
if __name__=="__main__": main()
