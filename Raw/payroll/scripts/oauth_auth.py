"""
OAuth flow to authenticate with Google Sheets using local server
"""
import os
import json
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from google_auth_oauthlib.flow import Flow

# If modifying these scopes, delete the file token.json
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
]

# Path to client secrets
CLIENT_SECRETS_FILE = 'd:/Project/Master/Raw/payroll/client_secret.json'
TOKEN_FILE = 'd:/Project/Master/Raw/payroll/token.json'

authorization_code = None

class OAuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global authorization_code
        if '/?code=' in self.path:
            authorization_code = self.path.split('code=')[1].split('&')[0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<html><body><h1>Authorization successful!</h1><p>You can close this window.</p></body></html>')
            # Signal server to stop
            threading.Thread(target=lambda: self.server.shutdown()).start()
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass  # Suppress logging

def run_auth_server(port):
    """Run local server to receive OAuth callback"""
    server = HTTPServer(('localhost', port), OAuthHandler)
    server.handle_request()  # Handle just one request
    server.server_close()

def authenticate():
    """Run OAuth flow to get access token"""
    global authorization_code
    
    # Copy client secret to working directory
    client_secret_source = r'C:\Users\liemdo\Downloads\client_secret_1051940384561-lc0ieu6ef6pch4en166tk2rfjtdkhm7v.apps.googleusercontent.com.json'
    
    if os.path.exists(client_secret_source):
        with open(client_secret_source, 'r') as f:
            secret_data = json.load(f)
        
        with open(CLIENT_SECRETS_FILE, 'w') as f:
            json.dump(secret_data, f)
        print(f"Copied client secrets to {CLIENT_SECRETS_FILE}")
    
    # Create flow
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri='http://localhost:8080'
    )
    
    # Get authorization URL
    auth_url, _ = flow.authorization_url(prompt='consent')
    
    print(f"\n{'='*60}")
    print("OPEN THIS URL IN YOUR BROWSER:")
    print(f"{'='*60}")
    print(auth_url)
    print(f"{'='*60}\n")
    
    # Start local server in background
    server_thread = threading.Thread(target=run_auth_server, args=(8080,))
    server_thread.daemon = True
    server_thread.start()
    
    # Open browser
    webbrowser.open(auth_url)
    
    print("Waiting for authorization...")
    print("(Complete the authorization in your browser)")
    
    # Wait for the code
    import time
    while authorization_code is None:
        time.sleep(1)
        if not server_thread.is_alive() and authorization_code is None:
            # Server stopped without getting code, try again
            print("No code received, server stopped")
            break
    
    if authorization_code:
        print(f"\nGot authorization code!")
        
        # Fetch token
        flow.fetch_token(code=authorization_code)
        credentials = flow.credentials
        
        # Save token
        with open(TOKEN_FILE, 'w') as f:
            token_data = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes
            }
            json.dump(token_data, f, indent=2)
        
        print(f"Saved token to {TOKEN_FILE}")
        print("Authentication successful!")
        return credentials
    
    return None

if __name__ == '__main__':
    authenticate()
