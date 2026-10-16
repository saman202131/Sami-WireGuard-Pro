import os
from dotenv import load_dotenv
load_dotenv()
TOKEN=os.getenv("BOT_TOKEN","").strip()
MAX_INPUT_MB=int(os.getenv("MAX_INPUT_MB","12"))
MAX_CONCURRENT_JOBS=max(1,int(os.getenv("MAX_CONCURRENT_JOBS","1")))
RENDER_TIMEOUT=int(os.getenv("RENDER_TIMEOUT","90"))
