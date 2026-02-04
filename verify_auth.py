import requests
import sys
import time

BASE_URL = "http://127.0.0.1:8000"

def test_auth():
    print("Testing Authentication...")
    
    # 1. Test Default User Login
    print("\n1. Testing Default User Login (Qiyas/1208)...")
    try:
        resp = requests.post(f"{BASE_URL}/api/auth/token", data={
            "username": "Qiyas",
            "password": "1208"
        })
        if resp.status_code == 200:
            print("✅ Default user login successful")
            token = resp.json()["access_token"]
        else:
            print(f"❌ Default user login failed: {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    # 2. Test Protected Route without Token
    print("\n2. Testing Protected Route (Chat) without Token...")
    resp = requests.post(f"{BASE_URL}/api/chat", data={"message": "hi"})
    if resp.status_code == 401:
        print("✅ Protected route correctly rejected request (401 Unauthorized)")
    else:
        print(f"❌ Protected route failed to reject: {resp.status_code}")

    # 3. Test Protected Route WITH Token
    print("\n3. Testing Protected Route (Chat) WITH Token...")
    headers = {"Authorization": f"Bearer {token}"}
    # Note: It might fail due to missing Azure keys, but it should pass Auth
    resp = requests.post(f"{BASE_URL}/api/chat", data={"message": "hi"}, headers=headers)
    if resp.status_code != 401: # It might be 500 or 200, but NOT 401
        print(f"✅ Protected route accepted token (Status: {resp.status_code})")
    else:
        print(f"❌ Protected route rejected valid token: {resp.text}")

    # 4. Test Registration
    print("\n4. Testing Registration (New User)...")
    new_user = f"user_{int(time.time())}"
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "username": new_user,
        "password": "password123"
    })
    if resp.status_code == 200:
        print(f"✅ Registration successful for {new_user}")
        new_token = resp.json()["access_token"]
        
        # Test login with new user
        resp_login = requests.post(f"{BASE_URL}/api/auth/token", data={
            "username": new_user,
            "password": "password123"
        })
        if resp_login.status_code == 200:
             print("✅ Login with new user successful")
        else:
             print("❌ Login with new user failed")
    else:
        print(f"❌ Registration failed: {resp.text}")

if __name__ == "__main__":
    # Wait for server to start
    time.sleep(2)
    test_auth()
