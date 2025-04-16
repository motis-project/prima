import requests
import os
from dotenv import load_dotenv

load_dotenv()

token = os.getenv('INTERNAL_API_TOKEN')
origin = os.getenv('ORIGIN')
if not token:
    raise ValueError("INTERNAL_API_TOKEN not found in environment")
if not origin:
    raise ValueError("ORIGIN not found in environment")

url = origin + "/api/anonymizeRequests"
response = requests.post(url, headers={"internal-token": token})