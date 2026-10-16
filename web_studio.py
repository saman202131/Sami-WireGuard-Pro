#!/usr/bin/env python3
"""CLI worker for Sami Premium website TGS generation."""
from __future__ import annotations
import argparse
from pathlib import Path
from stickerbot.tgs_pipeline import create_tgs, generate_image_from_prompt, remove_background_from_image, TGSStickerError

def main() -> int:
    p=argparse.ArgumentParser()
    p.add_argument('--mode',choices=['prompt','image','removebg'],required=True)
    p.add_argument('--prompt',default='')
    p.add_argument('--input',default='')
    p.add_argument('--output',required=True)
    p.add_argument('--motion',choices=['pulse','wobble','bounce','spin','none'],default='pulse')
    a=p.parse_args()
    try:
        src=a.input
        if a.mode=='prompt':
            if not a.prompt.strip(): raise TGSStickerError('توضیح تصویر خالی است.')
            generated=str(Path(a.output).with_suffix('.source.png'))
            generate_image_from_prompt(a.prompt,generated)
            src=generated
        if not src or not Path(src).is_file(): raise TGSStickerError('فایل ورودی تصویر پیدا نشد.')
        if a.mode=='removebg':
            remove_background_from_image(src,a.output)
            print(f'OK png_bytes={Path(a.output).stat().st_size}')
        else:
            result=create_tgs(src,a.output,a.motion)
            print(f"OK bytes={result['size']} shapes={result['shapes']} duration={result['duration']}")
        return 0
    except Exception as e:
        print(str(e))
        return 2
if __name__=='__main__':
    raise SystemExit(main())
