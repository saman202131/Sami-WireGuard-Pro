import gzip
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw
from stickerbot.tgs_pipeline import create_tgs, MAX_TGS_BYTES, apply_tgs_effect

class TGSPipelineTests(unittest.TestCase):
    def test_creates_real_gzipped_lottie_tgs(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'input.png'
            dst = Path(tmp) / 'output.tgs'
            im = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
            draw = ImageDraw.Draw(im)
            draw.ellipse((100, 90, 410, 410), fill=(255, 90, 50, 255))
            draw.ellipse((180, 180, 220, 225), fill=(20, 20, 30, 255))
            draw.ellipse((290, 180, 330, 225), fill=(20, 20, 30, 255))
            im.save(src)
            info = create_tgs(str(src), str(dst))
            raw = dst.read_bytes()
            data = json.loads(gzip.decompress(raw))
            self.assertLessEqual(len(raw), MAX_TGS_BYTES)
            self.assertEqual((data['w'], data['h'], data['fr'], data['op']), (512, 512, 60, 180))
            self.assertTrue(data['layers'])
            self.assertEqual(data['assets'], [])
            self.assertGreater(info['shapes'], 0)


    def test_supported_motion_modes_produce_valid_tgs(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'input.png'
            im = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
            ImageDraw.Draw(im).ellipse((20, 20, 108, 108), fill=(20, 170, 240, 255))
            im.save(src)
            for motion in ('pulse', 'wobble', 'bounce', 'spin', 'none'):
                dst = Path(tmp) / f'{motion}.tgs'
                create_tgs(str(src), str(dst), motion)
                data = json.loads(gzip.decompress(dst.read_bytes()))
                self.assertEqual((data['w'], data['h'], data['fr'], data['op']), (512, 512, 60, 180))
                self.assertTrue(data['layers'])

    def test_color_effect_preserves_alpha_channel(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / 'input.png'
            dst = Path(tmp) / 'gold.png'
            im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
            ImageDraw.Draw(im).rectangle((4, 4, 27, 27), fill=(100, 30, 20, 180))
            im.save(src)
            apply_tgs_effect(str(src), str(dst), 'gold')
            result = Image.open(dst).convert('RGBA')
            self.assertEqual(result.getpixel((0, 0))[3], 0)
            self.assertEqual(result.getpixel((10, 10))[3], 180)

if __name__ == '__main__':
    unittest.main()
