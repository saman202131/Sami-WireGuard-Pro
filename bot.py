import asyncio, logging, os, tempfile, shutil
from pathlib import Path
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ContextTypes, filters
from dotenv import load_dotenv
from config import TOKEN, MAX_INPUT_MB, MAX_CONCURRENT_JOBS
from stickerbot.pipeline import probe_media, StickerError
from stickerbot.tgs_pipeline import create_tgs, generate_image_from_prompt, remove_background_from_image, apply_tgs_effect, TGSStickerError
from stickerbot.effects import EFFECTS, EFFECT_DESCRIPTIONS

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("stickerbot")
JOBS = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
MAIN = ReplyKeyboardMarkup([
    [KeyboardButton("🎨 ساخت TGS از عکس"), KeyboardButton("🧠 ساخت TGS از متن")],
    [KeyboardButton("🪄 ساخت مشابه نمونه"), KeyboardButton("✨ افکت‌ها")],
    [KeyboardButton("🧹 حذف پس‌زمینه"), KeyboardButton("🎲 افکت تصادفی")],
    [KeyboardButton("⚙️ تنظیمات"), KeyboardButton("🔄 ساخت نسخه جدید")],
    [KeyboardButton("📖 راهنما")]
], resize_keyboard=True)
def state(context):
    return context.user_data.setdefault("project", {"effect":"classic","motion":"bounce","source":None,"reference":None,"mode":"create"})
def effect_keyboard():
    rows=[]; row=[]
    for key, label in EFFECTS.items():
        row.append(InlineKeyboardButton(label, callback_data=f"fx:{key}"))
        if len(row)==2: rows.append(row); row=[]
    if row: rows.append(row)
    return InlineKeyboardMarkup(rows)
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state(context)
    await update.message.reply_text("سلام! 👋\nبه Sami Premium Sticker Studio خوش آمدی.\n\n🧠 برای ساخت از متن، ایده‌ات را بنویس؛ ربات تصویر می‌سازد و آن را به استیکر متحرک واقعی .TGS تبدیل می‌کند.\n🎨 برای تبدیل عکس، دکمه ساخت TGS از عکس را بزن و تصویر را بفرست.\n\nخروجی TGS برداری، 512×512، حلقه‌ای و 60 FPS است. برای ساخت تصویر از متن، مدیر باید OPENAI_API_KEY را در تنظیمات سرور وارد کرده باشد.", reply_markup=MAIN)
async def help_cmd(update, context):
    await update.message.reply_text("راهنما:\n• متن ایده را بنویس تا تصویر تولید و به .TGS متحرک تبدیل شود.\n• یا «🎨 ساخت TGS از عکس» را بزن و عکس بفرست.\n• فایل خروجی .TGS را به صورت Document دریافت می‌کنی و می‌توانی برای ساخت پک animated stickers به @Stickers بدهی.\n\nTGS با WebM فرق دارد: TGS فایل Lottie برداری فشرده است و محدودیت 512×512، حداکثر 3 ثانیه، 60 FPS و 64KB دارد. تصاویر پیچیده ممکن است برای رعایت سقف حجم ساده‌سازی شوند.\n\nبرای ساخت تصویر از متن، OPENAI_API_KEY لازم است؛ تبدیل عکس به TGS به این کلید نیاز ندارد. حداکثر حجم ورودی: %s مگابایت." % MAX_INPUT_MB, reply_markup=MAIN)
async def text_handler(update, context):
    t=update.message.text or ""; p=state(context)
    if t in ("📖 راهنما","/help"): return await help_cmd(update,context)
    if t in ("🧠 ساخت TGS از متن", "/text"):
        p["mode"]="text"
        await update.message.reply_text("توضیح بده چه تصویری می‌خواهی؛ تصویر ساخته می‌شود و خروجی متحرک .TGS می‌گیری. این قابلیت به OPENAI_API_KEY روی سرور نیاز دارد.")
    elif t=="🎨 ساخت TGS از عکس":
        p["mode"]="create"; p["source"]=None
        await update.message.reply_text("عکس را بفرست؛ ربات آن را به فایل متحرک واقعی .TGS تبدیل می‌کند.")
    elif t=="🪄 ساخت مشابه نمونه":
        p["mode"]="reference"; p["source"]=None; p["reference"]=None
        await update.message.reply_text("اول عکس خودت را بفرست؛ بعد از آن استیکر یا تصویر نمونه را ارسال کن.")
    elif t=="✨ افکت‌ها":
        await update.message.reply_text("یک افکت انتخاب کن:", reply_markup=effect_keyboard())
    elif t=="🧹 حذف پس‌زمینه":
        if not p.get("source") or not Path(p["source"]).exists():
            await update.message.reply_text("اول یک عکس بفرست، بعد گزینه حذف پس‌زمینه را بزن.")
        elif not os.getenv("OPENAI_API_KEY", "").strip():
            await update.message.reply_text("حذف پس‌زمینه هوشمند به OPENAI_API_KEY در تنظیمات سرور نیاز دارد. اگر PNG شفاف داری، آن را مستقیماً بفرست.")
        else:
            try:
                out = Path(p.get("work", tempfile.gettempdir())) / "transparent.png"
                await update.message.reply_text("در حال حذف پس‌زمینه با هوش مصنوعی…")
                await asyncio.to_thread(remove_background_from_image, p["source"], str(out))
                p["source"] = str(out)
                with out.open("rb") as fh: await update.message.reply_document(fh, filename="SamiPremium_transparent.png", caption="پس‌زمینه حذف شد. حالا «ساخت نسخه جدید» را بزن تا TGS بسازی.")
            except Exception as e:
                log.exception("background removal failed")
                await update.message.reply_text(f"حذف پس‌زمینه ناموفق بود: {e}")
    elif t=="⚙️ تنظیمات":
        kb=InlineKeyboardMarkup([
          [InlineKeyboardButton("ضربان",callback_data="motion:pulse"),InlineKeyboardButton("لرزش",callback_data="motion:wobble")],
          [InlineKeyboardButton("پرش",callback_data="motion:bounce"),InlineKeyboardButton("چرخش",callback_data="motion:spin")],
          [InlineKeyboardButton("بدون حرکت",callback_data="motion:none")],
          [InlineKeyboardButton("ساخت خروجی",callback_data="render")]
        ])
        await update.message.reply_text(f"حرکت فعلی: {p.get('motion','pulse')}\nافکت رنگ فعلی: {p.get('effect','classic')}. مدت خروجی TGS مطابق استاندارد ۳ ثانیه است.",reply_markup=kb)
    elif t=="🎲 افکت تصادفی":
        import random
        p["effect"]=random.choice(list(EFFECTS))
        await update.message.reply_text(f"افکت انتخاب شد: {EFFECTS[p['effect']]}. عکس بفرست یا ساخت خروجی را از تنظیمات بزن.")
    elif t=="🔄 ساخت نسخه جدید":
        if not p.get("source"): await update.message.reply_text("اول یک عکس بفرست."); return
        await render_and_send(update,context)
    else:
        # Free-form text is treated as an image-generation prompt, as requested.
        await generate_from_text_and_send(update, context, t)
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
            p["mode"]="create"
            p["source"]=str(dest); p["source_work"]=str(work); p["work"]=str(work)
            await msg.reply_text("عکس دریافت شد. افکت را انتخاب کن یا «🔄 ساخت نسخه جدید» را بزن.",reply_markup=MAIN)
            await msg.reply_text("افکت‌ها:",reply_markup=effect_keyboard())
    except Exception as e:
        shutil.rmtree(work,ignore_errors=True)
        log.exception("media handling failed")
        await msg.reply_text(f"پردازش عکس انجام نشد: {e}")
async def generate_from_text_and_send(update, context, prompt):
    msg = update.effective_message
    work = Path(tempfile.mkdtemp(prefix=f"tgs_prompt_{update.effective_user.id}_"))
    try:
        async with JOBS:
            status = await msg.reply_text("🧠 در حال ساخت تصویر از توضیحت و تبدیل آن به استیکر متحرک .TGS…")
            image_path = work / "generated.png"
            tgs_path = work / "SamiPremium_animated.tgs"
            await asyncio.to_thread(generate_image_from_prompt, prompt, str(image_path))
            p = state(context)
            effect = p.get("effect", "classic")
            source_path = str(image_path)
            if effect in {"neon", "mono", "warm", "cool", "ice", "gold", "rainbow", "shadow", "vivid", "soft", "shine", "sparkles", "stars"}:
                treated = work / "treated.png"
                await asyncio.to_thread(apply_tgs_effect, source_path, str(treated), effect)
                source_path = str(treated)
            result = await asyncio.to_thread(create_tgs, source_path, str(tgs_path), p.get("motion", "pulse"))
            await msg.reply_document(
                document=tgs_path.open("rb"), filename="SamiPremium_animated.tgs",
                caption=f"✅ استیکر متحرک TGS آماده شد\n512×512 • 60 FPS • 3 ثانیه • {result['size'] // 1024} KB\nحالا فایل را به @Stickers بده و نوع Animated Stickers را انتخاب کن."
            )
            try: await status.delete()
            except Exception: pass
    except (TGSStickerError, Exception) as e:
        log.exception("text-to-TGS failed")
        await msg.reply_text(f"ساخت استیکر انجام نشد: {e}")
    finally:
        shutil.rmtree(work, ignore_errors=True)

async def render_and_send(update, context):
    p=state(context)
    if not p.get("source") or not Path(p["source"]).exists():
        await update.effective_message.reply_text("اول یک عکس بفرست یا ایده‌ات را به‌صورت متن بنویس."); return
    async with JOBS:
        status = await update.effective_message.reply_text("🎨 در حال تبدیل تصویر به بردارهای Lottie و ساخت فایل .TGS…")
        out=Path(p.get("work",tempfile.gettempdir()))/"SamiPremium_animated.tgs"
        try:
            effect = p.get("effect", "classic")
            source_path = p["source"]
            if effect in {"neon", "mono", "warm", "cool", "ice", "gold", "rainbow", "shadow", "vivid", "soft", "shine", "sparkles", "stars"}:
                treated = Path(p.get("work", tempfile.gettempdir())) / "treated.png"
                await asyncio.to_thread(apply_tgs_effect, source_path, str(treated), effect)
                source_path = str(treated)
            result = await asyncio.to_thread(create_tgs, source_path, str(out), p.get("motion", "pulse"))
            with out.open("rb") as fh:
                await update.effective_message.reply_document(
                    document=fh, filename="SamiPremium_animated.tgs",
                    caption=f"✅ فایل متحرک .TGS آماده است\n512×512 • 60 FPS • 3 ثانیه • {result['size'] // 1024} KB • {result['shapes']} شکل برداری\nبرای ساخت پک، فایل را به @Stickers بده و Animated Stickers را انتخاب کن."
                )
            try: await status.delete()
            except Exception: pass
        except Exception as e:
            log.exception("TGS render failed")
            await update.effective_message.reply_text(f"ساخت فایل TGS ناموفق بود: {e}")

async def callbacks(update, context):
    q=update.callback_query; await q.answer(); p=state(context); data=q.data
    if data.startswith("fx:"):
        p["effect"]=data.split(":",1)[1]
        motion_map={"bounce":"bounce","pulse":"pulse","heartbeat":"pulse","zoom":"pulse","shake":"wobble","horizontal":"wobble","spin":"spin","float":"bounce","vertical":"bounce"}
        if p["effect"] in motion_map: p["motion"]=motion_map[p["effect"]]
        await q.edit_message_text(f"افکت انتخاب شد: {EFFECTS[p['effect']]}\n{EFFECT_DESCRIPTIONS[p['effect']]}\nحرکت: {p.get('motion','pulse')}")
    elif data.startswith("motion:"):
        p["motion"]=data.split(":",1)[1]
        await q.edit_message_text(f"حرکت روی {p['motion']} تنظیم شد. مدت TGS طبق استاندارد ۳ ثانیه است.")
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
