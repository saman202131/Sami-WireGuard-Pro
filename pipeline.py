import json, os, subprocess, shutil, tempfile, math
from pathlib import Path
from .effects import EFFECTS
class StickerError(RuntimeError): pass
def require_ffmpeg():
    ff=shutil.which("ffmpeg"); probe=shutil.which("ffprobe")
    if not ff or not probe: raise StickerError("FFmpeg/FFprobe پیدا نشد. در Termux دستور pkg install ffmpeg را اجرا کن.")
    return ff,probe
def probe_media(path):
    ff,pr=require_ffmpeg()
    cmd=[pr,"-v","error","-show_entries","stream=codec_type,width,height,codec_name,pix_fmt,duration","-of","json",str(path)]
    r=subprocess.run(cmd,capture_output=True,text=True,timeout=15)
    if r.returncode: raise StickerError("فایل تصویری قابل خواندن نیست.")
    data=json.loads(r.stdout); streams=data.get("streams",[])
    if not streams: raise StickerError("فایل رسانه‌ای خالی است.")
    s=next((x for x in streams if x.get("codec_type")=="video"),streams[0])
    return {"width":s.get("width",0),"height":s.get("height",0),"codec":s.get("codec_name"),"pix_fmt":s.get("pix_fmt",""),"animated":len(streams)>1 or s.get("codec_name") in ("vp9","gif")}
def render_sticker(src,dst,effect="bounce",duration=2,speed=1,intensity=1,bg="transparent"):
    ff,_=require_ffmpeg()
    if effect=="random":
        import random; effect=random.choice([k for k in EFFECTS if k not in ("random","sparkles","stars")])
    if effect not in EFFECTS: raise StickerError("افکت ناشناخته است.")
    duration=max(1,min(3,float(duration))); speed=max(.5,min(2,float(speed))); intensity=max(.3,min(2,float(intensity)))
    info=probe_media(src); w,h=info["width"],info["height"]
    if not w or not h: raise StickerError("ابعاد عکس تشخیص داده نشد.")
    # Preserve aspect ratio, center inside 512x512 transparent canvas.
    bgcol={"transparent":"black@0.0","black":"black","white":"white"}.get(bg,"black@0.0")
    scale="scale=512:512:force_original_aspect_ratio=decrease"
    pad=f"pad=512:512:(ow-iw)/2:(oh-ih)/2:color={bgcol}"
    t="t"
    amp=round(8*intensity)
    if effect in ("bounce","vertical","float"): move=f"y='(H-h)/2+{amp}*sin(2*PI*t*{speed}/{duration})'"
    elif effect=="horizontal": move=f"x='(W-w)/2+{amp}*sin(2*PI*t*{speed}/{duration})'"
    elif effect=="shake": move=f"x='(W-w)/2+{max(2,amp//2)}*sin(2*PI*t*{speed}*6/{duration})'"
    elif effect in ("pulse","heartbeat","zoom"): move=f"scale=iw*(1+{0.035*intensity}*sin(2*PI*t*{speed}/{duration})):ih*(1+{0.035*intensity}*sin(2*PI*t*{speed}/{duration})),scale=512:512:force_original_aspect_ratio=decrease"
    elif effect=="spin": move=f"rotate=0.08*sin(2*PI*t*{speed}/{duration}):c=black@0.0"
    else: move=""
    filters=[f"fps=24,trim=duration={duration},setpts=PTS/{speed}",scale,pad]
    if move:
        if move.startswith("scale="): filters=[f"fps=24,trim=duration={duration},setpts=PTS/{speed}",move,pad]
        elif move.startswith("rotate="): filters.append(move)
        else: filters.append(f"crop=512:512:x='(iw-512)/2':y='(ih-512)/2'") if False else None
    if effect=="neon": filters += ["eq=contrast=1.12:saturation=1.35","colorbalance=rs=0.12:bs=0.18"]
    elif effect=="shine": filters += ["eq=brightness=0.04*sin(2*PI*t*1.5):saturation=1.1"]
    elif effect=="glitch": filters += ["eq=contrast=1.2:saturation=1.4"]
    elif effect=="ice": filters += ["colorbalance=bs=0.25:gs=0.05"]
    elif effect=="shadow": filters += ["eq=brightness=-0.05:contrast=1.15"]
    elif effect=="rainbow": filters += ["hue=h=360*t"]
    elif effect=="gold": filters += ["colorbalance=rs=0.25:gs=0.12:bs=-0.18:saturation=1.25"]
    elif effect=="classic": filters += ["eq=saturation=1.05"]
    vf=",".join(filters)
    # Try alpha-preserving VP9 first. Target <=256 KB with constrained bitrate.
    cmd=[ff,"-y","-hide_banner","-loglevel","error","-loop","1","-i",str(src),"-t",str(duration),"-vf",vf,"-an","-c:v","libvpx-vp9","-pix_fmt","yuva420p","-r","24","-deadline","realtime","-cpu-used","8","-b:v","650k","-maxrate","750k","-bufsize","1500k","-auto-alt-ref","0","-metadata:s:v:0","alpha_mode=1",str(dst)]
    try: r=subprocess.run(cmd,capture_output=True,text=True,timeout=90)
    except subprocess.TimeoutExpired: raise StickerError("زمان پردازش تمام شد؛ عکس ساده‌تر یا مدت کوتاه‌تر امتحان کن.")
    if r.returncode: raise StickerError("FFmpeg نتوانست خروجی بسازد: "+(r.stderr[-500:] or "خطای نامشخص"))
    if Path(dst).stat().st_size > 256*1024:
        # Re-encode smaller; alpha support depends on FFmpeg build.
        tmp=str(dst)+".small.webm"
        cmd2=cmd.copy(); cmd2[cmd2.index("-b:v")+1]="220k"; cmd2[cmd2.index("-maxrate")+1]="250k"; cmd2[-1]=tmp
        r=subprocess.run(cmd2,capture_output=True,text=True,timeout=90)
        if r.returncode==0 and Path(tmp).exists(): os.replace(tmp,dst)
        elif Path(tmp).exists(): os.remove(tmp)
    return {"size":Path(dst).stat().st_size,"width":512,"height":512,"duration":duration}
