"""Test chat endpoint"""
import httpx
import urllib.request
import json

# Method 1: urllib
data = json.dumps({"message": "你好", "history": []}).encode('utf-8')
req = urllib.request.Request(
    "http://localhost:8000/api/chat",
    data=data,
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print(f"urllib Status: {resp.status}")
        print(f"urllib Body: {resp.read().decode('utf-8')}")
except Exception as e:
    print(f"urllib Error: {e}")

# Method 2: httpx without proxy
print("---")
try:
    with httpx.Client(proxy=None) as client:
        r = client.post(
            "http://localhost:8000/api/chat",
            json={"message": "你好", "history": []},
            timeout=30
        )
        print(f"httpx Status: {r.status_code}")
        print(f"httpx Body: {r.text}")
except Exception as e:
    print(f"httpx Error: {e}")
