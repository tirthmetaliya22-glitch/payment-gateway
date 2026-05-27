import sys
import os
from dotenv import load_dotenv

# Resolve paths to root and backend directories
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
backend_dir = os.path.join(root_dir, 'backend')

# Add both paths to the python path so absolute imports resolve correctly on Vercel
sys.path.append(root_dir)
sys.path.append(backend_dir)

# Explicitly load environment variables from the backend/.env file
load_dotenv(dotenv_path=os.path.join(backend_dir, '.env'))

# Import FastAPI app from backend.main
from backend.main import app
