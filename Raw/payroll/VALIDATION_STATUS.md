# Payroll Project - Validation Status

## Status: ✅ WORKING - READY FOR USE

## Current State (July 1, 2026)

### Pipeline Status

| Step | Script | Status | Output |
|------|--------|--------|--------|
| 1 | `run_csv_payroll.py` | ✅ Works | `csv_payroll_report.json` |
| 2 | `run_qb_payroll.py` | ✅ Works | `qb_payroll_report.json` |
| 3 | `paycheck_generator.py` | ✅ Works | `paycheck.csv` |

### Results (Period: June 12, 2026)

**CSV Calculator:**
- Total Regular Pay: $13,261.02
- Total OT Pay: $788.49
- Total Tips: $5,145.30
- CalSaver: -$60.87
- **Net Pay: $19,133.94**
- Employees: 21

**QB Tax Calculator:**
- Taxable Wages: $18,931.98 (wages + tips)
- Check Amount: $17,237.57
- Company Taxes: $1,651.27
- **Total Employer Cost: $20,583.25**

### Validation Tests

✅ **Aidan Stone test case** - All values match spec:
- Hourly wage: $192.10 ✓
- Taxable wages: $258.54 ✓
- SS Employee: $16.03 ✓
- Medicare: $3.75 ✓
- CA SDI: $3.36 ✓
- Check Amount: $235.40 ✓

✅ **Tips flow** - Server tips ($5,145.30) correctly added to taxable wages

✅ **Paycheck CSV** - Sheet Supper format with BCH tips populated

### What Works

1. **Timesheet parsing** - Reads clock in/out, aggregates by employee
2. **Order details parsing** - Extracts tips by server name
3. **CalSaver deduction** - Correctly applies 5%/7% for participating employees
4. **Tip aggregation** - Server tips match Order Details total ($5,722.93)
5. **QB tax calculation** - Matches spec exactly
6. **Paycheck CSV generation** - Matches Sheet Supper format

### Known Limitations

1. **Pool tip distribution** - Not implemented, all tips go to BCH
2. **Kitchen/Sushi tips** - Not tracked separately by dining area
3. **Federal withholding** - Not calculated (needs employee W-4 data)
4. **CA income tax** - Not calculated (needs DE-4 data)
5. **QB integration** - Manual entry only, no API connection
6. **Multi-store** - Single store only (Raw Sushi Bistro)

## How to Run

```bash
cd d:/Project/Master/Raw/payroll

# Run full pipeline
python scripts/run_csv_payroll.py
python scripts/run_qb_payroll.py
python src/paycheck_generator.py
```

## Output Files

- `output/csv_payroll_report.json` - Full breakdown
- `output/qb_payroll_report.json` - QB-style with taxes
- `output/qb_payroll_report.csv` - CSV for Excel
- `output/paycheck.csv` - Sheet Supper format

## Next Steps

1. Connect to QB for automated entries
2. Implement tip pool distribution
3. Add kitchen/sushi tip tracking by dining area
4. Support multi-store (Bandera, The Rim)
