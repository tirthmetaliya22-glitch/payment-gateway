import sys
import os

# Add the project root directory to the python path so it can import the backend folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import FastAPI app from backend.main
from backend.main import app
