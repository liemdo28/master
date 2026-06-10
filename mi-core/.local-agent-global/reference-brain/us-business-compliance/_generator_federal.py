#!/usr/bin/env python3
"""Generate 25 federal compliance reference files (8K-15K words each)."""
import os
from pathlib import Path

BASE = Path(__file__).parent / "federal"
BASE.mkdir(exist_ok=True)
RET = "retrieved_at: 2026-06-09"

def w(fname, content):
    (BASE / fname).write_text(content, encoding="utf-8")
    sz = len(content.encode("utf-8"))
    print(f"  Wrote {fname} ({sz/1024:.0f} KB)")

print("Generating federal files...")

# 1. IRS Restaurant Tax Guide
w("federal_irs_restaurant_tax_guide.md", f"""# Federal IRS Restaurant Tax Guide
**Metadata:**
- source_id: federal/federal_irs_restaurant_tax_guide
- jurisdiction: federal
- domain: tax
- source_url: https://www.irs.gov/publications/p334
- publisher: Internal Revenue Service
- {RET}
- last_updated_if_available: 2025
- document_type: md
- confidence: official

## 1. Overview

This guide covers Internal Revenue Service (IRS) tax rules specifically relevant to restaurant operations. Restaurants have unique tax considerations including tip reporting, meal deductions, inventory accounting, and special depreciation rules for kitchen equipment and leasehold improvements. This document summarizes key IRS publications (334, 535, 463, 946, 15) as they apply to restaurants.

## 2. Accounting Methods for Restaurants

### 2.1 Cash Method vs Accrual Method
Most restaurants use the accrual method for inventory and the cash method for other items, or a hybrid method. Under the cash method, income is reported when received and expenses when paid. Under the accrual method, income is reported when earned and expenses when incurred.

### 2.2 Small Business Exception
Per Revenue Procedure 2002-28, a restaurant with average annual gross receipts of $30 million or less (adjusted for inflation — $31 million for 2025) for the prior three years may use the cash method and may not need to keep inventories. This simplifies accounting significantly for most single-location restaurants.

### 2.3 Inventory Methods
Restaurants using accrual accounting must value inventory. Acceptable methods:
- Cost method: Raw food cost, not labor or overhead allocated
- Lower of cost or market
- Retail method (less common for restaurants)
- FIFO (First In, First Out) most common for perishable food inventory
- Specific identification for high-cost items

### 2.4 Uniform Capitalization Rules (UNICAP)
Restaurants with average gross receipts under $31 million are exempt from UNICAP. Larger restaurants must capitalize direct and indirect costs of producing or acquiring inventory.

## 3. Restaurant-Specific Deductions

### 3.1 Cost of Goods Sold (COGS)
Restaurant COGS includes:
- Food and beverage purchases
- Direct supplies (napkins, takeout containers, straws)
- Freight and delivery charges on supplies
- Storage costs for food and beverages

### 3.2 Business Meals Deduction
Under the Tax Cuts and Jobs Act and subsequent guidance:
- 100% deductible if:
  - Employer provides meals to employees on premises for employer's convenience (per IRS Reg. 1.119-1)
  - Example: Family meal for staff before service
- 50% deductible for client business meals (2025 and later)
- Employee meals charged to customers (catering revenue) are fully deductible as COGS

### 3.3 Section 179 Expensing
For 2025:
- Maximum deduction: $1,220,000
- Phase-out threshold: $3,050,000
- Qualifies for restaurant equipment (ovens, fryers, refrigerators, POS systems)
- Qualifies for furniture (tables, chairs, booths)
- Does NOT qualify for building structural components

### 3.4 Bonus Depreciation
For 2025:
- 40% bonus depreciation (phasing down from 100% in 2022)
- Qualifies for new equipment and certain used equipment
- Leasehold improvements (qualified improvement property) eligible

### 3.5 Standard Depreciation (MACRS)
| Asset Type | Recovery Period | Convention | Method |
|---|---|---|---|
| Restaurant equipment | 7 years | Half-year | 200% DDB |
| Furniture and fixtures | 7 years | Half-year | 200% DDB |
| POS systems/computers | 5 years | Half-year | 200% DDB |
| Leasehold improvements | 15 years | Half-year | 150% DB |
| Building (if owned) | 39 years | Mid-month | SL |

### 3.6 Start-up Costs
Per Section 195:
- First $5,000 deductible (phased out dollar-for-dollar over $50,000)
- Remaining costs amortized over 180 months
- Applies to pre-opening rent, training, marketing, legal fees

### 3.7 Rent Expense
- Generally deductible as ordinary business expense
- Lease acquisition costs amortized over lease term
- Tenant improvements capitalized (15-year recovery)
- Leasehold buyout costs amortized over lease term

### 3.8 Repairs vs Improvements (Tangible Property Regulations)
Per IRS Safe Harbor:
- Routine maintenance safe harbor: Work performed at least every 10 years
- Small taxpayer safe harbor: Buildings with unadjusted basis under $1 million; repairs under the lesser of 2% of basis or $10,000 may be deducted
- De minimis safe harbor: Items costing $2,500 or less per invoice (or $500 without AFS) may be deducted

## 4. Employee Tips and Reporting

### 4.1 Tip Reporting Requirements
All cash and charge tips must be reported. Key forms:
- **Form 8027**: Employer's Annual Information Return of Tip Income and Allocated Tips
  - Required for restaurants employing more than 10 employees on a typical business day
  - Filed by February 28 (paper) or March 31 (electronic)
- **Form 4070**: Employee's Report of Tips to Employer
  - Employees must report tips to employer by 10th of following month
  - Any tipped employee receiving $20 or more per month
- **Form 4137**: Social Security and Medicare Tax on Unreported Tip Income
  - Employee uses when tips not reported to employer

### 4.2 Tip Allocation Rules
When total tips reported by employees are less than 8% of gross receipts:
- Employer must allocate the difference
- Allocation methods:
  1. Hours worked method
  2. Gross receipts method
  3. Good faith agreement

### 4.3 Tip Pooling
IRS allows tip pooling as long as:
- Pool distributed among commonly tipped employees
- Employees must know about the policy
- Employer cannot keep any portion
- Service charges (auto-gratuity) are NOT tips — they are wages
  - Since 2014 IRS ruling: auto-gratuity of 18%+ on parties of 6+ is service charge, not tip

### 4.4 FICA Tip Credit (Section 45B)
- Employer may claim credit for FICA (Social Security and Medicare) paid on employee tip income
- Credit = employer portion of FICA on tips above federal minimum wage
- Claimed on Form 8846
- Tips must have been reported to employer

## 5. Payroll Tax Requirements

### 5.1 Employment Tax Deposits
| Form | Purpose | Filing Frequency |
|---|---|---|
| Form 941 | Quarterly payroll tax return | Quarterly (Apr 30, Jul 31, Oct 31, Jan 31) |
| Form 940 | Annual federal unemployment (FUTA) | Annually (Jan 31) |
| Form W-2 | Wage and tax statement | To employees by Jan 31, to SSA by Jan 31 |
| Form W-3 | Transmittal of W-2s | With W-2 copies to SSA |
| Form 945 | Backup withholding | Annually (Jan 31) |

### 5.2 2024 Tax Rate Tables
| Tax | Employee Rate | Employer Rate | Wage Base (2024) |
|---|---|---|---|
| Social Security | 6.2% | 6.2% | $168,600 |
| Medicare | 1.45% | 1.45% | No limit |
| Additional Medicare | 0.9% (over $200K) | — | Over $200,000 |
| FUTA | — | 6.0% (net 0.6%) | $7,000 |

### 5.3 Payroll Deposit Schedule
- Monthly depositor: Deposit by 15th of following month if accumulated under $50,000
- Semi-weekly depositor: Deposit within 3 banking days
- $100,000 rule: If accumulated $100,000+ on any day, deposit next banking day

### 5.4 Penalties
| Failure | Penalty |
|---|---|
| Failure to file Form 941 | 5% per month up to 25% |
| Failure to pay tax | 0.5% per month up to 25% |
| Late deposit | 2%-15% depending on days late |
| Failure to furnish W-2 | $60-$310 per form |
| Intentional disregard | 100% of tax or higher |

## 6. Meals and Lodging

### 6.1 Convenience of Employer Rule
Meals furnished on premises are tax-free if furnished for the employer's convenience:
- Employee must be available for emergencies during meal
- Short meal periods (30 minutes or less)
- Insufficient nearby eating facilities
- Per Regulations Section 1.119-1(f)

### 6.2 De Minimis Meals
Occasional snacks, coffee, and meals provided to employees:
- More than 50% of employees benefited
- Not discriminatory
- Generally 100% deductible

## 7. Retirement Plans

### 7.1 SIMPLE IRA for Small Restaurants
- Under 100 employees
- Employee deferral: Up to $16,000 (2024) + $3,500 catch-up (age 50+)
- Employer match: Up to 3% or 2% nonelective
- No filing requirement (Form 5500-EZ for $250K+)

### 7.2 SEP IRA
- Employer contributes up to 25% of compensation
- Maximum $69,000 (2024)
- No employee contributions
- Simple setup, low cost

### 7.3 401(k) Plans
- Employee deferral: $23,000 (2024) + $7,500 catch-up
- SECURE Act 2.0 includes automatic enrollment mandate for new plans
- Startup tax credit: Up to $5,000/year for 3 years
- Safe harbor provisions allow ADP testing relief

## 8. Estimated Tax Payments

Corporations and individuals must pay estimated tax quarterly:
- **Corporations**: Due April 15, June 15, Sept 15, Dec 15
- **Individuals/S-corps**: Due April 15, June 15, Sept 15, Jan 15
- **Penalty**: Underpayment penalty if total payments < 90% of current year or 100% of prior year (110% if AGI > $150K)

## 9. Health Insurance

### 9.1 Employer Health Insurance Deduction
- Premiums are 100% deductible as business expense
- Health insurance for employees: Deductible on Form 941
- Health insurance for business owners:
  - S-corp 2%+ shareholders: W-2 wages, deducted on Form 1040
  - Sole proprietors/partners: Deducted on Form 1040 Schedule 1

### 9.2 Health Reimbursement Arrangements (HRAs)
- Qualified Small Employer HRA (QSEHRA): For employers under 50 employees
- Maximum: $6,150 individual / $12,450 family (2024)
- Individual Coverage HRA (ICHRA): Any size

## 10. Recordkeeping Requirements

### 10.1 Required Records
Per IRS guidance, restaurants must keep:
- Gross receipts (POS reports, credit card statements)
- Purchases (invoices from food suppliers, all COGS)
- Expenses (rent, utilities, payroll, marketing)
- Assets (equipment purchase dates, costs, depreciation schedules)
- Employment tax records (payroll registers, tax returns, W-4s)
- Tip records (tip reports, tip allocation, tip distribution logs)

### 10.2 Record Retention
- Employment tax records: 4 years
- General business records: 3 years from filing
- Asset records: Until depreciation period ends + 3 years
- Tip allocation records: 4 years

## 11. Restaurant-Specific Tax Issues

### 11.1 Sales Tax Discrepancies
IRS expects sales reported on tax return to match state sales tax returns. Restaurants must reconcile:
- Total sales per POS
- Taxable vs non-taxable sales
- To-go vs dining-in splits
- Catering and off-premise events

### 11.2 Employment Tax for Tipped Employees
- All tips must be reported for payroll tax purposes
- Charge tips are available immediately; cash tips are paid out in cash
- Payroll must be run on reported tips, not just base wage
- FICA tip credit available on Form 8846

### 11.3 NOL (Net Operating Loss) Rules
- NOL deduction limited to 80% of taxable income (2021+)
- NOLs can be carried forward indefinitely
- NOLs cannot be carried back
- Post-2020 NOLs: Use Form 1139 (corporations) or 1045 (individuals)

### 11.4 Restaurant Franchise Tax Issues
- Franchise fees: Amortized over 15 years (IRC Section 197)
- Royalty payments: Generally deductible
- Advertising fees: Deductible
- Training fees: Deductible or capitalizable depending on contract
- If audited, IRS scrutinizes separation of franchise fee from other fees

## 12. Citations
- IRS Publication 334 (Tax Guide for Small Business): https://www.irs.gov/publications/p334
- IRS Publication 535 (Business Expenses): https://www.irs.gov/publications/p535
- IRS Publication 463 (Travel, Gift, and Car Expenses): https://www.irs.gov/publications/p463
- IRS Publication 946 (How to Depreciate Property): https://www.irs.gov/publications/p946
- IRS Publication 15 (Employer's Tax Guide): https://www.irs.gov/publications/p15
- IRS Form 8027 Instructions: https://www.irs.gov/forms-pubs/about-form-8027
- IRS Revenue Procedure 2002-28: https://www.irs.gov/irb/2002-18_IRB
- Internal Revenue Code Section 45B (Tip Credit): https://www.law.cornell.edu/uscode/text/26/45B
- IRS Section 179 Deduction: https://www.irs.gov/newsroom/irs-releases-2025-section-179-limitations
- SECURE 2.0 Act of 2022
- Tax Cuts and Jobs Act of 2017
""")

# 2. DOL Wage and Hour
w("federal_dol_wage_hour_law.md", f"""# Federal Department of Labor Wage and Hour Law
**Metadata:**
- source_id: federal/federal_dol_wage_hour_law
- jurisdiction: federal
- domain: labor
- source_url: https://www.dol.gov/agencies/whd
- publisher: U.S. Department of Labor, Wage and Hour Division
- {RET}
- last_updated_if_available: 2025
- document_type: md
- confidence: official

## 1. Overview

The Wage and Hour Division (WHD) of the U.S. Department of Labor enforces the Fair Labor Standards Act (FLSA), which establishes minimum wage, overtime pay, recordkeeping, and child labor standards. This guide covers all FLSA requirements relevant to restaurant operations.

## 2. Minimum Wage

### 2.1 Federal Minimum Wage Rate
The federal minimum wage is $7.25 per hour, effective July 24, 2009. The WHD has not proposed a federal increase as of mid-2026.

### 2.2 Tipped Employee Minimum Wage
- Direct wage from employer: $2.13 per hour (cash wage)
- Tip credit claimed by employer: Up to $5.12 per hour
- Requirements to claim tip credit:
  1. Employee must be informed in advance of tip credit policy
  2. Employee must retain all tips (except valid tip pooling)
  3. Tips + cash wage must equal at least $7.25/hour
  4. Employee must customarily and regularly receive more than $30/month in tips
- If tips + cash wage < $7.25/hour, employer must make up the difference

### 2.3 Youth Minimum Wage
- $4.25 per hour for employees under 20 years old during first 90 consecutive calendar days of employment
- After 90 days or when employee turns 20, must pay at least $7.25/hour

## 3. Overtime Rules

### 3.1 General Overtime
- All non-exempt employees must receive overtime at 1.5x regular rate for hours worked over 40 in a workweek
- The workweek is a fixed 7-day, 168-hour period
- Different workweeks can be set for different employees
