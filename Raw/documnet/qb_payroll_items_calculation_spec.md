# QuickBooks Payroll — Items and Calculation Logic

## Goal
Create a payroll formula layer that can reproduce the QuickBooks Review Paycheck sections:

1. Earnings
2. Other Payroll Items
3. Employee Summary
4. Company Summary
5. Check Amount

## Core rule
Employee Summary affects the employee paycheck. Company Summary is employer payroll tax cost and does not reduce the employee check.

## Items

| Section | Item | Owner | Calculation |
|---|---|---:|---|
| Earnings | Hourly wage {2} | Employee | hourly rate × hours decimal |
| Other Payroll Items | Reported Pool Tips - BCH | Employee | entered tip amount |
| Other Payroll Items | Reported Pool Tips - Kitchen | Employee | entered tip amount |
| Employee Summary | Social Security Employee | Employee tax | -(SS taxable wages capped by annual wage base × 6.2%) |
| Employee Summary | Medicare Employee | Employee tax | -(Medicare taxable wages × 1.45%) |
| Employee Summary | Medicare Employee Additional | Employee tax | -(wages above additional Medicare threshold × 0.9%) |
| Employee Summary | Federal Withholding | Employee tax | manual/import from QuickBooks payroll table |
| Employee Summary | CA - Income Tax | Employee tax | manual/import from QuickBooks payroll table |
| Employee Summary | CA - Disability | Employee tax | -(CA SDI taxable wages × 1.3%) |
| Company Summary | Social Security Company | Employer tax | SS taxable wages capped by annual wage base × 6.2% |
| Company Summary | Medicare Company | Employer tax | Medicare taxable wages × 1.45% |
| Company Summary | Federal Unemployment | Employer tax | FUTA taxable wages capped at $7,000 × 0.6% if full FUTA credit |
| Company Summary | CA - Unemployment | Employer tax | CA UI taxable wages capped at $7,000 × employer CA UI rate |
| Company Summary | CA - Employment Training Tax | Employer tax | CA ETT taxable wages capped at $7,000 × 0.1% |

## Screenshot example

Inputs:

```text
Hourly rate = 16.90
Hours = 11:22 = 11.3667 hours
Reported Pool Tips - BCH = 32.67
Reported Pool Tips - Kitchen = 33.77
Federal Withholding = 0.00
CA Income Tax = 0.00
CA UI rate = 2.2%
```

Calculations:

```text
Hourly wage = 16.90 × 11.3667 = 192.10
Taxable wages = 192.10 + 32.67 + 33.77 = 258.54

Employee Social Security = -(258.54 × 6.2%) = -16.03
Employee Medicare = -(258.54 × 1.45%) = -3.75
CA Disability / SDI = -(258.54 × 1.3%) = -3.36

Check amount = 258.54 - 16.03 - 3.75 - 3.36 = 235.40

Company Social Security = 258.54 × 6.2% = 16.03
Company Medicare = 258.54 × 1.45% = 3.75
FUTA = 258.54 × 0.6% = 1.55
CA UI = 258.54 × 2.2% = 5.69
CA ETT = 258.54 × 0.1% = 0.26
```

## Notes
Federal Withholding and CA Income Tax cannot be safely reconstructed from the screenshot alone. They need QuickBooks payroll tax table, employee W-4/DE-4 setup, filing status, extra withholding, and payroll frequency.

Reported tips must be configured carefully:

- If paid through paycheck: include in gross paid-in-check and taxable wages.
- If report-only: include in taxable wages but do not add to check amount.
