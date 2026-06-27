from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

STORAGE_ROOT = Path(os.getenv("STORAGE_DIR", "storage")).resolve()
SHIFTS = 2
OVERLAP = 0.5
