"""
Read Sheet Supper from Google Sheets
"""
import os
import json
import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

SHEET_ID = "1pGtLcjUp6QrPBYHoN_dtoAzZImr2oaU5MrkRGEHUpdY"

def get_credentials():
    TOKEN_FILE = 'd:/Project/Master/Raw/payroll/token.json'
    with open(TOKEN_FILE, 'r') as f:
        token_data = json.load(f)
    creds = Credentials(
        token=token_data.get('token'),
        refresh_token=token_data.get('refresh_token'),
        token_uri=token_data.get('token_uri'),
        client_id=token_data.get('client_id'),
        client_secret=token_data.get('client_secret'),
        scopes=token_data.get('scopes')
    )
    if not creds.valid:
        creds.refresh(Request())
    return creds

def main():
    creds = get_credentials()
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SHEET_ID)
    
    # Read Sheet Supper
    worksheet = spreadsheet.worksheet("Sheet Supper")
    all_values = worksheet.get_all_values()
    
    print(f"Sheet Supper - {len(all_values)} rows, {len(all_values[0]) if all_values else 0} columns")
    
    # Save to file
    os.makedirs('d:/Project/Master/Raw/payroll/data', exist_ok=True)
    with open('d:/Project/Master/Raw/payroll/data/sheet_supper.json', 'w', encoding='utf-8') as f:
        json.dump(all_values, f, ensure_ascii=False, indent=2)
    print("Saved to data/sheet_supper.json")
    
    # Print first 30 rows
    for i, row in enumerate(all_values[:30]):
        print(f"Row {i+1}: {row}")

if __name__ == '__main__':
    main()
