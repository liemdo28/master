"""
Script to read payroll data from Google Sheets
"""
import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import gspread
from google.oauth2.service_account import Credentials

# Sheet ID from the URL
SHEET_ID = "1pGtLcjUp6QrPBYHoN_dtoAzZImr2oaU5MrkRGEHUpdY"

def get_sheets_client():
    """Get authenticated Google Sheets client"""
    # Try service account JSON from env
    service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    
    if service_account_json:
        # Parse the JSON string
        try:
            service_account_info = json.loads(service_account_json)
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
            credentials = Credentials.from_service_account_info(
                service_account_info, 
                scopes=scopes
            )
            return gspread.authorize(credentials)
        except Exception as e:
            print(f"Error parsing service account JSON: {e}")
    
    # Try to use default credentials file
    try:
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
        ]
        credentials = Credentials.from_service_account_file(
            'credentials.json',
            scopes=scopes
        )
        return gspread.authorize(credentials)
    except FileNotFoundError:
        print("No credentials file found")
        return None

def read_current_sheet():
    """Read the Current sheet and extract payroll data"""
    client = get_sheets_client()
    if not client:
        print("Could not authenticate with Google Sheets")
        return None
    
    try:
        # Open spreadsheet by ID
        spreadsheet = client.open_by_key(SHEET_ID)
        
        # List all sheets
        print("Available sheets:")
        for sheet in spreadsheet.worksheets():
            print(f"  - {sheet.title}")
        
        # Get the "Current" sheet
        worksheet = spreadsheet.worksheet("Current")
        
        # Read the payroll range I126:V172
        # Column I = 9, Column V = 22, Row 126 to 172
        payroll_range = "I126:V172"
        print(f"\nReading range: {payroll_range}")
        
        values = worksheet.get_values(payroll_range)
        
        print(f"Data shape: {len(values)} rows x {len(values[0]) if values else 0} columns")
        
        return values
        
    except Exception as e:
        print(f"Error accessing sheet: {e}")
        return None

def read_all_sheet_data():
    """Read entire Current sheet to understand structure"""
    client = get_sheets_client()
    if not client:
        print("Could not authenticate with Google Sheets")
        return None
    
    try:
        spreadsheet = client.open_by_key(SHEET_ID)
        worksheet = spreadsheet.worksheet("Current")
        
        # Get all values
        all_values = worksheet.get_all_values()
        
        print(f"Total rows: {len(all_values)}")
        print(f"Total columns: {len(all_values[0]) if all_values else 0}")
        
        return all_values
        
    except Exception as e:
        print(f"Error accessing sheet: {e}")
        return None

if __name__ == "__main__":
    print("Reading Google Sheets data...")
    
    # First, read all data to understand structure
    all_data = read_all_sheet_data()
    
    if all_data:
        # Save all data for analysis
        with open('d:/Project/Master/Raw/payroll/data/current_sheet_full.json', 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        print("Saved full sheet data to current_sheet_full.json")
    
    # Read payroll range
    payroll_data = read_current_sheet()
    
    if payroll_data:
        with open('d:/Project/Master/Raw/payroll/data/payroll_range.json', 'w', encoding='utf-8') as f:
            json.dump(payroll_data, f, ensure_ascii=False, indent=2)
        print("Saved payroll range to payroll_range.json")
