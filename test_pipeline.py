import unittest, shutil, tempfile
from pathlib import Path
from PIL import Image
from stickerbot.pipeline import probe_media, render_sticker
@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg/FFprobe not installed")
class PipelineTests(unittest.TestCase):
    def test_render_webm(self):
        with tempfile.TemporaryDirectory() as d:
            src=Path(d)/"sample.png"; dst=Path(d)/"out.webm"
            Image.new("RGBA",(160,120),(255,0,0,255)).save(src)
            render_sticker(str(src),str(dst),"bounce",1,1,1,"transparent")
            self.assertTrue(dst.exists()); self.assertGreater(dst.stat().st_size,0)
            info=probe_media(dst); self.assertEqual(info["width"],512)
if __name__ == "__main__": unittest.main()
