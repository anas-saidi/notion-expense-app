#!/usr/bin/env python3
"""Run locally; enter the raw key on the phone and only its hash on the server."""
import hashlib
import secrets

key = secrets.token_urlsafe(32)
print("Enter this device key in the iOS app's Settings (keep it private):")
print(key)
print("\nSet this environment variable on your finance backend, then redeploy:")
print("NATIVE_TOKEN_SHA256=" + hashlib.sha256(key.encode()).hexdigest())
