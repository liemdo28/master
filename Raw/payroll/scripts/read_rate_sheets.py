"""
Read rate and calculation sheets from Google Sheets
"""
import os
import json
import gspread
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

SHEET_ID = "1pGtLcjUp6QrPBYHoN_dtoAzZImr2oaU5MrkRGEHUpdY"

def get_credentials():
    """Get valid credentials from token file"""
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
        request = Request()
        creds.refresh(request)
    
    return creds

def read_rate_sheets():
    """Read rate and calculation sheets"""
    creds = get_credentials()
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SHEET_ID)
    
    os.makedirs('d:/Project/Master/Raw/payroll/data', exist_ok=True)
    
    # Read "Rate of Emp" sheet
    try:
        worksheet = spreadsheet.worksheet("Rate of Emp")
        rate_data = worksheet.get_all_values()
        with open('d:/Project/Master/Raw/payroll/data/rate_of_emp.json', 'w', encoding='utf-8') as f:
            json.dump(rate_data, f, ensure_ascii=False, indent=2)
        print(f"Rate of Emp: {len(rate_data)} rows")
    except Exception as e:
        print(f"Error reading Rate of Emp: {e}")
    
    # Read "Calsaver Rate" sheet
    try:
        worksheet = spreadsheet.worksheet("Calsaver Rate")
        calsaver_data = worksheet.get_all_values()
        with open('d:/Project/Master/Raw/payroll/data/calsaver_rate.json', 'w', encoding='utf-8') as f:
            json.dump(calsaver_data, f, ensure_ascii=False, indent=2)
        print(f"Calsaver Rate: {len(calsaver_data)} rows")
    except Exception as e:
        print(f"Error reading Calsaver Rate: {e}")
    
    # Read the "Current" sheet with formulas (to understand calculations)
    try:
        worksheet = spreadsheet.worksheet("Current")
        # Get first 50 rows to understand headers and formulas
        data_with_formulas = worksheet.get_values("A1:AB50", value_render_option='FORMATTED_VALUE')
        with open('d:/Project/Master/Raw/payroll/data/current_headers.json', 'w', encoding='utf-8') as f:
            json.dump(data_with_formulas, f, ensure_ascii=False, indent=2)
        print(f"Current headers (first 50 rows): {len(data_with_formulas)} rows")
        
        # Get formulas for payroll range
        formulas = worksheet.get_values("I126:V172", value_render_option='FORMULA')
        with open('d:/Project/Master/Raw/payroll/data/payroll_formulas.json', 'w', encoding='utf-8') as f:
            json.dump(formulas, f, ensure_ascii=False, indent=2)
        print(f"Payroll formulas saved")
    except Exception as e:
        print(f"Error reading Current sheet: {e}")

if __name__ == '__main__':
    read_rate_sheets()
