"""
Configuration for Payroll Calculator
"""

# Google Sheets ID
SHEET_ID = "1pGtLcjUp6QrPBYHoN_dtoAzZImr2oaU5MrkRGEHUpdY"

# Paths
DATA_DIR = "d:/Project/Master/Raw/payroll/data"
TOKEN_FILE = "d:/Project/Master/Raw/payroll/token.json"
OUTPUT_DIR = "d:/Project/Master/Raw/payroll/output"

# Payroll range
PAYROLL_RANGE = "I126:V172"

# OAuth Scopes
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
]

# Tip Pool Distribution Percentages
TIP_POOL_DISTRIBUTION = {
    'Sushi Chef': 0.50,
    'Bartender': 0.08,
    'Kitchen': 0.3728,
    'BCH': 0.12
}

# Position Multipliers
POSITION_MULTIPLIERS = {
    'Bartender': 3.5,
    'Busser': 4.5,
    'Cashier': 8.0,
    'Kitchen': 1.0,
    'Sushi Chef': 1.0  # varies by employee
}

# Rate Defaults
DEFAULT_RATE_REG = 15.0  # $/hour
DEFAULT_RATE_OT = 22.5   # $/hour (1.5x)
DEFAULT_CALSAVER_RATE = 0.05  # 5%
