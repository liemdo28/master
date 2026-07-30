# Payroll Pipeline - Raw Sushi Bistro

## Overview
Automated payroll calculation pipeline cho Raw Sushi Bistro (California).

## Data Flow

```
Timesheet CSV + Order Details CSV
         ↓
    [Step 1] CSV Calculator
    - Aggregate hours by employee
    - Calculate tips from orders
    - Apply CalSaver deductions
         ↓
    csv_payroll_report.json
    csv_payroll_report.csv
         ↓
    [Step 2] QB Tax Calculator
    - Add tips to taxable wages
    - Calculate SS, Medicare, CA SDI
    - Calculate employer taxes
         ↓
    qb_payroll_report.json
    qb_payroll_report.csv
         ↓
    [Step 3] Paycheck Generator
    - Format for Sheet Supper
    - Generate manual entry CSV
         ↓
    paycheck.csv
```

## How to Run

```bash
# Step 1: Calculate payroll from CSV files
python scripts/run_csv_payroll.py

# Step 2: Calculate QB-style taxes
python scripts/run_qb_payroll.py

# Step 3: Generate paycheck CSV (Sheet Supper format)
python src/paycheck_generator.py
```

## Output Files

| File | Description |
|------|-------------|
| `csv_payroll_report.json` | Full employee breakdown with all earnings |
| `csv_payroll_report.csv` | CSV format for Excel |
| `qb_payroll_report.json` | QB-style with tax withholding |
| `qb_payroll_report.csv` | QB format with employer costs |
| `paycheck.csv` | Sheet Supper format for manual entry |

## Period
- Current: **June 12, 2026** (06/08/2026 - 06/21/2026)
- 21 employees

## Summary

### CSV Calculator (Employee Take Home)
| Item | Amount |
|------|--------|
| Total Regular Pay | $13,261.02 |
| Total OT Pay | $788.49 |
| Total Tips | $5,145.30 |
| Total CalSaver | -$60.87 |
| **NET PAY** | **$19,133.94** |

### QB Tax Calculator (Employer View)
| Item | Amount |
|------|--------|
| Taxable Wages | $18,931.98 |
| Check Amount (net) | $17,237.57 |
| Company Taxes | $1,651.27 |
| **TOTAL EMPLOYER COST** | **$20,583.25** |

### Difference Explanation
- CSV Net ($19,133.94) vs QB Check ($17,237.57) = **$1,896.37**
- QB includes: SS (6.2%), Medicare (1.45%), CA SDI (1.3%) withholding
- CSV includes: CalSaver deductions

## Tax Rules (2026 California)

| Tax | Employee | Employer |
|-----|----------|----------|
| Social Security | 6.2% | 6.2% |
| Medicare | 1.45% | 1.45% |
| Additional Medicare | 0.9% (over $200K) | - |
| CA SDI | 1.3% | - |
| CA UI | - | 2.2% (varies) |
| CA ETT | - | 0.1% |
| FUTA | - | 0.6% |

## Key Features

### Server Tips Tracking
- Tips extracted from Order Details by server name
- Total tip pool: $5,722.93
- 10 servers with tips
- Tips added to taxable wages for QB calculation

### CalSaver Deduction
- 5% or 7% deduction for participating employees
- Total: $60.87 (4 employees with CalSaver)

### Validation
- Aidan Stone test case passes all values
- QB calculation matches spec exactly

## File Locations

```
Raw/payroll/
├── scripts/
│   ├── run_csv_payroll.py    # Step 1
│   └── run_qb_payroll.py    # Step 2
├── src/
│   ├── csv_calculator.py    # CSV parsing + tip aggregation
│   ├── qb_tax_calculator.py # Tax withholding calculation
│   ├── paycheck_generator.py # Sheet Supper format
│   └── ...
├── data/
│   ├── rate_of_emp.json     # Employee rates from Google Sheet
│   └── ...
└── output/
    ├── csv_payroll_report.json
    ├── qb_payroll_report.json
    └── paycheck.csv
```

## Next Steps

1. **Pool Tip Distribution** - Implement tip pool distribution by position
2. **Kitchen/Sushi Tips** - Track tips by dining area (BCH vs Kitchen vs Bar)
3. **QB Integration** - Connect to QuickBooks for automated entries
4. **Multi-Store** - Support Bandera and other locations
5. **Historical Reports** - Compare periods for anomalies
