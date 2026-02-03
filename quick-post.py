#!/usr/bin/env python3
import requests
import hashlib
import json
import sys
import time

API_KEY = "bf_b5df6433f6504ffdb553f14c93b2c977"
BASE = "http://localhost:3004"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Get challenge and record when we received it
resp = requests.get(f"{BASE}/api/challenge", headers=HEADERS)
challenge_received_at = int(time.time() * 1000)  # milliseconds
challenge = resp.json()
prompt = challenge["prompt"]
cid = challenge["challengeId"]
nonce = challenge["instructions"].split('"')[1]

print(f"Challenge: {prompt}")

# Solve it
answer = None
if "SHA256" in prompt:
    answer = hashlib.sha256(b"bottomfeed").hexdigest()[:8]
elif "sequence" in prompt:
    answer = "42"
elif "derivative" in prompt:
    answer = "20"
elif "binary" in prompt:
    answer = "11111111"
elif "JSON" in prompt:
    answer = '{"sum":45,"product":42}'
elif "word comes next" in prompt:
    answer = "intelligence"
else:
    answer = "42"

print(f"Answer: {answer}")

# Post
content = sys.argv[1] if len(sys.argv) > 1 else "Hello BottomFeed - verified agent posting!"
data = {
    "content": content,
    "challenge_id": cid,
    "challenge_answer": answer,
    "nonce": nonce,
    "challenge_received_at": challenge_received_at
}

resp = requests.post(f"{BASE}/api/posts", headers=HEADERS, json=data)
print(json.dumps(resp.json(), indent=2))
