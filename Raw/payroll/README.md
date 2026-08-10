# Payroll Calculator Project - Raw Sushi Bistro

## Overview
Tính lương và tip cho nhân viên từ 2 file CSV (Timesheet + Order Details), sau đó tính thuế theo QuickBooks.

## Google OAuth setup (`token.json`)

`token.json` (real OAuth token/refresh token/client secret) is **not tracked in git** —
see `.gitignore`. It previously was tracked (removed 2026-08-10, see
`docs/security/PHASE5G_CREDENTIAL_REMEDIATION.md`); that historical exposure requires
manual rotation at the Google Cloud Console (revoke the OAuth grant / rotate the OAuth
client secret) — this has not been done automatically. A placeholder-shaped template is
at `token.example.json`. To regenerate a working `token.json` locally after rotation,
run `python scripts/oauth_auth.py` (or `python scripts/get_token_from_code.py`) and
complete the Google OAuth consent flow; the script writes `token.json` to this
directory.

## Quick Start

```bash
cd d:/Project/Master/Raw/payroll

# Run full pipeline (recommended)
python scripts/run_full_payroll.py

# Or run steps individually:
python scripts/run_csv_payroll.py    # Step 1: Calculate payroll
python scripts/run_qb_payroll.py     # Step 2: Calculate QB taxes
python src/paycheck_generator.py     # Step 3: Generate paycheck CSV
```

## Input Files

### 1. Timesheet CSV
File timesheet từ hệ thống chấm công.
- Columns: Name, Clock in/out, Break, Role, Total paid hours, Regular hours, OT hours, Estimated wages, Cash tips

### 2. Order Details CSV
File chi tiết order từ POS.
- Columns: Order ID, Server, Table, Dining Area, Tip, Gratuity, Voided

## Output Files

| File | Description |
|------|-------------|
| `output/csv_payroll_report.json` | Full employee breakdown with all earnings |
| `output/qb_payroll_report.json` | QB-style with tax withholding |
| `output/paycheck.csv` | Sheet Supper format for manual entry |

## Calculation Formula

### CSV Calculator (Employee Take Home)
```
Regular Pay = Regular Hours × Rate Reg
OT Pay = OT Hours × Rate OT
Total Tips = Cash Tips + Server Tips + Pool Tips
Subtotal = Regular Pay + OT Pay + Total Tips
CalSaver = Subtotal × 5% (nếu có đăng ký)
Total Pay = Subtotal - CalSaver
```

### QB Tax Calculator (Employer Cost)
```
Taxable Wages = Hourly Wage + Tips
SS Employee = Taxable Wages × 6.2%
Medicare Employee = Taxable Wages × 1.45%
CA SDI = Taxable Wages × 1.3%
Check Amount = Taxable Wages - Employee Taxes
Employer Taxes = SS + Medicare + FUTA + CA UI + CA ETT
```

## Employee Rates

Rates được load từ Google Sheet "Rate of Emp" đã extract.

## Tax Rules (2026 California)

| Tax | Employee | Employer |
|-----|----------|----------|
| Social Security | 6.2% | 6.2% |
| Medicare | 1.45% | 1.45% |
| Additional Medicare | 0.9% (over $200K) | - |
| CA SDI | 1.3% | - |
| CA UI | - | 2.2% |
| CA ETT | - | 0.1% |
| FUTA | - | 0.6% |

## Current Period

**June 12, 2026** (06/08/2026 - 06/21/2026)
- 21 employees
- Total tip pool: $5,722.93

## Sample Results

### CSV Calculator
| Item | Amount |
|------|--------|
| Total Regular Pay | $13,261.02 |
| Total OT Pay | $788.49 |
| Total Tips | $5,145.30 |
| CalSaver | -$60.87 |
| **Net Pay** | **$19,133.94** |

### QB Tax Calculator
| Item | Amount |
|------|--------|
| Taxable Wages | $18,931.98 |
| Check Amount | $17,237.57 |
| Company Taxes | $1,651.27 |
| **Total Employer** | **$20,583.25** |

## Folder Structure

```
payroll/
├── README.md
├── PAYROLL_PIPELINE.md
├── VALIDATION_STATUS.md
├── requirements.txt
├── scripts/
│   ├── run_csv_payroll.py    # Step 1
│   ├── run_qb_payroll.py     # Step 2
│   └── run_full_payroll.py   # All steps combined
├── src/
│   ├── csv_calculator.py     # CSV parsing + tip aggregation
│   ├── qb_tax_calculator.py  # Tax withholding calculation
│   ├── paycheck_generator.py # Sheet Supper format
│   └── models.py
└── output/
    ├── csv_payroll_report.json
    ├── qb_payroll_report.json
    └── paycheck.csv
```

## Validation

- Aidan Stone test case passes all 12 values exactly
- Tips correctly added to taxable wages
- Sheet Supper format matches manual entry template
