"""
Get access token from authorization code
"""
import json
import requests

# The authorization code from the URL
AUTH_CODE = "4/0AdkVLPyQT6MZF0fPeD-pcSmofQnwBzXn-cGsqjWAuz5g_oI5T7VlffSHoyhoHghCg9OdoA"

# Client info
CLIENT_ID = "1051940384561-lc0ieu6ef6pch4en166tk2rfjtdkhm7v.apps.googleusercontent.com"
CLIENT_SECRET = "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"
TOKEN_URI = "https://oauth2.googleapis.com/token"
REDIRECT_URI = "http://localhost:8080"

def exchange_code_for_token():
    """Exchange authorization code for access token"""
    data = {
        'code': AUTH_CODE,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code'
    }
    
    response = requests.post(TOKEN_URI, data=data)
    
    if response.status_code == 200:
        token_data = response.json()
        print("Got token!")
        print(f"Access token: {token_data.get('access_token', '')[:50]}...")
        print(f"Refresh token: {token_data.get('refresh_token', '')[:50] if token_data.get('refresh_token') else 'N/A'}...")
        print(f"Expires in: {token_data.get('expires_in')} seconds")
        
        # Save to token.json
        TOKEN_FILE = 'd:/Project/Master/Raw/payroll/token.json'
        with open(TOKEN_FILE, 'w') as f:
            json.dump({
                'token': token_data.get('access_token'),
                'refresh_token': token_data.get('refresh_token'),
                'token_uri': TOKEN_URI,
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET,
                'scopes': [
                    'https://www.googleapis.com/auth/spreadsheets.readonly',
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.readonly'
                ]
            }, f, indent=2)
        
        print(f"\nToken saved to {TOKEN_FILE}")
        return token_data
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

if __name__ == '__main__':
    exchange_code_for_token()
