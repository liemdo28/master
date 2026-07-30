"""
Read payroll data using gspread with OAuth credentials
"""
import os
import json
import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
]

SHEET_ID = "1pGtLcjUp6QrPBYHoN_dtoAzZImr2oaU5MrkRGEHUpdY"

def get_credentials():
    """Get valid credentials from token file"""
    TOKEN_FILE = 'd:/Project/Master/Raw/payroll/token.json'
    
    if not os.path.exists(TOKEN_FILE):
        print("No token file found!")
        return None
    
    with open(TOKEN_FILE, 'r') as f:
        token_data = json.load(f)
    
    # Create credentials object
    creds = Credentials(
        token=token_data.get('token'),
        refresh_token=token_data.get('refresh_token'),
        token_uri=token_data.get('token_uri'),
        client_id=token_data.get('client_id'),
        client_secret=token_data.get('client_secret'),
        scopes=token_data.get('scopes')
    )
    
    # Check if token is still valid
    if not creds.valid:
        try:
            request = Request()
            creds.refresh(request)
            # Save refreshed token
            with open(TOKEN_FILE, 'w') as f:
                json.dump({
                    'token': creds.token,
                    'refresh_token': creds.refresh_token,
                    'token_uri': creds.token_uri,
                    'client_id': creds.client_id,
                    'client_secret': creds.client_secret,
                    'scopes': creds.scopes
                }, f, indent=2)
            print("Token refreshed!")
        except Exception as e:
            print(f"Failed to refresh token: {e}")
            return None
    
    return creds

def read_sheet_data():
    """Read the Current sheet"""
    creds = get_credentials()
    
    if not creds:
        print("No valid credentials.")
        return None
    
    try:
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SHEET_ID)
        
        print("Available sheets:")
        for sheet in spreadsheet.worksheets():
            print(f"  - {sheet.title}")
        
        # Get the "Current" sheet
        worksheet = spreadsheet.worksheet("Current")
        
        # Get all values to understand structure
        all_values = worksheet.get_all_values()
        print(f"\nTotal rows: {len(all_values)}")
        print(f"Total columns: {len(all_values[0]) if all_values else 0}")
        
        # Save all data
        os.makedirs('d:/Project/Master/Raw/payroll/data', exist_ok=True)
        with open('d:/Project/Master/Raw/payroll/data/current_sheet_full.json', 'w', encoding='utf-8') as f:
            json.dump(all_values, f, ensure_ascii=False, indent=2)
        print("Saved full sheet data to data/current_sheet_full.json")
        
        # Read specific payroll range I126:V172
        payroll_range = "I126:V172"
        values = worksheet.get_values(payroll_range)
        print(f"\nPayroll range shape: {len(values)} rows x {len(values[0]) if values else 0} columns")
        
        with open('d:/Project/Master/Raw/payroll/data/payroll_range.json', 'w', encoding='utf-8') as f:
            json.dump(values, f, ensure_ascii=False, indent=2)
        print("Saved payroll range data to data/payroll_range.json")
        
        return all_values, values
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    read_sheet_data()
