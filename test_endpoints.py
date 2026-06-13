"""Test generate-image and other endpoints"""
import urllib.request
import json

# Test generate-image
data = json.dumps({"prompt": "A cute cat in a garden"}).encode('utf-8')
req = urllib.request.Request(
    "http://localhost:8000/api/generate-image",
    data=data,
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read().decode('utf-8')
        print(f"generate-image Status: {resp.status}")
        print(f"generate-image Body (first 200 chars): {body[:200]}")
except Exception as e:
    print(f"generate-image Error: {e}")

print("---")

# Test streaming chat
data2 = json.dumps({"message": "你好", "history": []}).encode('utf-8')
req2 = urllib.request.Request(
    "http://localhost:8000/api/chat/stream",
    data=data2,
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req2, timeout=30) as resp:
        body = resp.read().decode('utf-8')
        print(f"chat/stream Status: {resp.status}")
        print(f"chat/stream Body (first 300 chars): {body[:300]}")
except Exception as e:
    print(f"chat/stream Error: {e}")

print("---")

# Test query (should work with empty history even if no docs)
data3 = json.dumps({"question": "你好", "history": []}).encode('utf-8')
req3 = urllib.request.Request(
    "http://localhost:8000/api/query",
    data=data3,
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req3, timeout=30) as resp:
        body = resp.read().decode('utf-8')
        print(f"query Status: {resp.status}")
        print(f"query Body (first 200 chars): {body[:200]}")
except Exception as e:
    print(f"query Error: {e}")
