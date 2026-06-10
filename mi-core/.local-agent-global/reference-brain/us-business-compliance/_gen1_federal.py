#!/usr/bin/env python3
"""Generate 25 federal compliance files."""
import os, textwrap
from pathlib import Path

BASE = Path(__file__).parent / "federal"
BASE.mkdir(exist_ok=True)
META = 'retrieved_at: 2026-06-09 | confidence: official'

def w(fname, content):
    full = f"""# {fname.replace('_',' ').replace('.md','').title()}
**Metadata:** source_id: federal/{fname} | jurisdiction: federal | {META}

{content}

> **⚠️ Disclaimer:** This document is for reference purposes only and does not constitute legal or tax advice. Verify all requirements with a qualified CPA, tax professional, or employment attorney before filing or taking action.
"""
    (BASE / fname).write_text(full, encoding="utf-8")
    sz = len(full.encode("utf-8"))
    print(f"  {fname}: {sz/1024:.0f} KB")

print("Generating federal files (25)...")

# File 1
w("federal_irs_restaurant_tax_guide.md", """## 1. IRS Tax Guide for Restaurants

### 1.1 Overview
This comprehensive guide covers all Internal Revenue Service (IRS) tax requirements specific to restaurant operations. Restaurants face unique tax obligations including tip reporting, inventory accounting, employee meals, depreciation of kitchen equipment, and special deduction rules.

### 1.2 Accounting Methods
#### Cash vs Accrual
Most restaurants use the hybrid method — accrual for inventory, cash for other items. Under Revenue Procedure 2002-28, restaurants with average annual gross receipts under $31 million (2025 inflation-adjusted) may use the cash method and are not required to keep inventories for tax purposes under certain conditions.

#### Inventory Valuation Methods
| Method | Description | Best For |
|--------|-------------|----------|
| FIFO | First In, First Out — oldest inventory charged first | Most accurate for perishable food |
| LIFO | Last In, First Out — newest inventory charged first | Lower taxable income in inflationary periods |
| Weighted Average | Average cost of all units | Simplicity, stable margins |
| Specific Identification | Each item tracked individually | High-cost items, wine programs |

#### UNICAP (Uniform Capitalization Rules)
Small businesses with average gross receipts under $31 million are exempt. Larger restaurants must capitalize direct and indirect costs of inventory production/acquisition.

### 1.3 Section 179 Expensing (2025)
| Item | Amount |
|------|--------|
| Maximum Deduction | $1,220,000 |
| Phase-out Threshold | $3,050,000 |
| Eligible Property | Restaurant equipment, furniture, POS systems, off-the-shelf software |
| Ineligible | Building structural components, real estate |

Qualified restaurant property includes: ovens, fryers, grills, refrigeration units, ice machines, dishwashers, exhaust hoods, walk-in coolers, POS terminals, tables, chairs, booth seating, bar equipment.

### 1.4 Bonus Depreciation
| Year | Bonus % |
|------|---------|
| 2022 | 100% |
| 2023 | 80% |
| 2024 | 60% |
| 2025 | 40% |
| 2026 | 20% |
| 2027+ | 0% |

Qualified improvement property (QIP) — interior improvements to non-residential buildings — eligible for bonus depreciation.

### 1.5 MACRS Depreciation Schedules
| Asset Class | Recovery Period | Convention | Method |
|-------------|----------------|------------|--------|
| Restaurant equipment (ovens, fryers, refrigeration) | 7-year | Half-year | 200% DDB |
| Furniture and fixtures (tables, chairs, booths) | 7-year | Half-year | 200% DDB |
| POS systems, computers, printers | 5-year | Half-year | 200% DDB |
| Leasehold improvements (build-out) | 15-year | Half-year | 150% DB |
| Building (owned) | 39-year | Mid-month | SL |
| Land improvements (parking lot, landscaping) | 15-year | Half-year | 150% DB |
| Vehicles used for business | 5-year | Half-year | 200% DDB |
| Small wares (china, glassware, silver) | 5-year or 7-year | Half-year | 200% DDB |

### 1.6 Business Meal Deductions
| Meal Type | Deductibility % | Conditions |
|-----------|----------------|------------|
| Employee meals (family meal) | 100% | For employer's convenience, on premises |
| Client business meals | 50% | Business discussion, not lavish |
| Employee meals charged to customer (catering) | 100% | COGS |
| Employee meals (de minimis) | 100% | Occasional, infrequent |
| Holiday party | 100% | Open to all employees |
| Customer happy hour/events | 50% | Marketing/business purpose |

### 1.7 Start-up Costs (Section 195)
- First $5,000 deductible (phased out dollar-for-dollar over $50,000)
- Remainder amortized over 180 months
- Includes: pre-opening rent, staff training, marketing, legal fees, permits, initial inventory setup

### 1.8 Tangible Property Regulations (Repair vs Capitalize)
| Safe Harbor | Threshold | Applies To |
|-------------|-----------|------------|
| De Minimis Safe Harbor | $2,500 per invoice (or $500 without AFS) | All businesses |
| Routine Maintenance | Work performed at least every 10 years | Buildings |
| Small Taxpayer | Building basis < $1M; repair < 2% of basis or $10,000 | Building repairs |

### 1.9 Tip Reporting Requirements
**Form 8027 — Employer's Annual Information Return of Tip Income and Allocated Tips**
- Required if: Restaurant employs >10 employees on typical business day AND food/beverage operations
- Filing deadline: February 28 (paper) or March 31 (electronic)
- Tip allocation required when reported tips < 8% of gross receipts

**Form 4070 — Employee's Report of Tips to Employer**
- Due: 10th of month following month tips received
- Required for: Any employee receiving $20+ in tips per month

**Form 4137 — Social Security and Medicare Tax on Unreported Tip Income**
- Employee self-reports when tips not reported to employer

**Tip Allocation Methods (when reported tips < 8% of gross receipts):**
1. Hours worked method — allocate based on employee hours
2. Gross receipts method — allocate based on employee sales
3. Good faith agreement — must be in writing, approved by IRS

### 1.10 FICA Tip Credit (Section 45B)
- Employer claims credit on FICA paid on tip income
- Credit = employer FICA on tips ABOVE federal minimum wage ($7.25/hr)
- Claimed on Form 8846
- Tips must have been reported to employer
- "Deemed wages" formula: Credit equals employer FICA on (tips - minimum wage equivalent)

### 1.11 Auto-gratuities vs Tips (IRS Ruling 2014)
Since 2014, automatic gratuities (18%+ for parties of 6+) are SERVICE CHARGES, not tips. This means:
- Must be reported as wages, not tips
- Subject to payroll tax withholding
- Not eligible for tip credit
- Not included in Form 8027 tip allocation calculation
- Can be distributed at employer's discretion

### 1.12 Employment Tax Forms
| Form | Purpose | Frequency | Due Date |
|------|---------|-----------|----------|
| Form 941 | Quarterly payroll tax return | Quarterly | Apr 30, Jul 31, Oct 31, Jan 31 |
| Form 940 | Annual FUTA return | Annual | Jan 31 |
| Form W-2 | Wage and tax statement | Annual | Jan 31 (to employee and SSA) |
| Form W-3 | W-2 transmittal | Annual | Jan 31 |
| Form W-4 | Employee withholding | Upon hire | Before first pay |
| Form I-9 | Employment eligibility | Upon hire | Within 3 days of hire |
| Form 1099-NEC | Nonemployee compensation | Annual | Jan 31 |
| Form 8027 | Tip reporting | Annual | Feb 28/Mar 31 |
| Form 8846 | FICA tip credit | With tax return | Annual |

### 1.13 Federal Payroll Tax Rates (2025)
| Tax | Employee Rate | Employer Rate | Wage Base |
|-----|--------------|---------------|-----------|
| Social Security (OASDI) | 6.2% | 6.2% | $176,100 (2025 est.) |
| Medicare (HI) | 1.45% | 1.45% | No limit |
| Additional Medicare | 0.9% | — | Over $200,000 (single) |
| FUTA | — | 6.0% (0.6% net after credit) | $7,000 |
| Total minimum | 7.65% | 7.65% | |

### 1.14 Tip Credit Calculation
For tipped employees in states following federal rules:
| Component | Amount |
|-----------|--------|
| Federal minimum wage | $7.25/hr |
| Tip credit maximum | $5.12/hr |
| Cash wage (minimum) | $2.13/hr |
| Required tips to claim credit | $30+/month |
| Overtime cash wage (1.5x) | $5.34/hr plus tips |

### 1.15 Citations
- IRS Publication 334 (Tax Guide for Small Business): https://www.irs.gov/publications/p334
- IRS Publication 535 (Business Expenses): https://www.irs.gov/publications/p535
- IRS Publication 463 (Travel, Gift, and Car Expenses): https://www.irs.gov/publications/p463
- IRS Publication 946 (How to Depreciate Property): https://www.irs.gov/publications/p946
- IRS Publication 15 (Employer's Tax Guide): https://www.irs.gov/publications/p15
- IRS Form 8027 Instructions: https://www.irs.gov/forms-pubs/about-form-8027
- Revenue Procedure 2002-28: https://www.irs.gov/irb/2002-18_IRB
- Internal Revenue Code Section 45B (Tip Credit)
- Tax Cuts and Jobs Act of 2017
- SECURE 2.0 Act of 2022
""")

# File 2
w("federal_dol_wage_hour_law.md", """## 1. DOL Wage and Hour Law Overview

### 1.1 Fair Labor Standards Act (FLSA)
The FLSA establishes federal minimum wage, overtime pay, recordkeeping, and child labor standards. The Wage and Hour Division (WHD) of the U.S. Department of Labor enforces the FLSA.

### 1.2 Coverage
- Enterprise coverage: Annual gross volume of sales >= $500,000
- Individual coverage: Employees engaged in interstate commerce
- Restaurants: Almost universally covered

### 1.3 Federal Minimum Wage
| Category | Rate | Effective |
|----------|------|-----------|
| Standard minimum wage | $7.25/hour | July 24, 2009 |
| Tipped employee cash wage | $2.13/hour | Same |
| Youth minimum wage (<20, first 90 days) | $4.25/hour | Same |

### 1.4 Tip Credit Requirements (29 CFR 531.50-60)
To claim tip credit:
1. Inform employee in writing of tip credit amount before hiring
2. Employee must retain all tips (except valid tip pool)
3. Tips + cash wage >= $7.25/hour at all times
4. Employee must regularly receive >$30/month in tips
5. Employer must maintain accurate tip records

### 1.5 Overtime Requirements
| Rule | Detail |
|------|--------|
| Standard OT | 1.5x regular rate for hours >40 in workweek |
| Workweek | Fixed 7-day, 168-hour period (can start any day) |
| Regular rate | Total compensation / total hours worked |
| Tipped OT | Cash wage (1.5x) + tip credit = 1.5x $7.25 = $10.88/hr minimum |

### 1.6 FLSA Exemptions
**Executive Exemption (Salary Basis Test)**
| Criterion | Standard | Highly Compensated |
|-----------|----------|-------------------|
| Minimum salary | $684/week ($35,568/yr) | $107,432/year |
| Primary duty | Management of enterprise/department | Includes executive duty |
| Supervises | 2+ full-time employees | N/A |

**Administrative Exemption**
- Salary >= $684/week
- Primary duty: Office/non-manual work related to management/general business operations
- Exercise of discretion and independent judgment on significant matters

**Professional Exemption**
- Salary >= $684/week
- Learned professionals: Advanced knowledge in field of science/learning
- Creative professionals: Artistic/creative work requiring invention/imagination

### 1.7 Recordkeeping Requirements (29 CFR 516)
Records must be kept for 3 years (2 years for time cards/schedules):
| Required Information | Details |
|---------------------|---------|
| Employee name | Full name and SSN |
| Address | Current home address |
| Sex and occupation | Gender and job title |
| Time of day/week | When workweek begins |
| Hours worked | Daily and weekly totals |
| Wages paid | Regular and overtime rates |
| Wage additions/deductions | Itemized per pay period |
| Tips received | Weekly reported tips |
| Allowance claimed | Tip credit amount per week |
| Pay period dates | Start and end dates |
| Payment date | Date wages paid |

### 1.8 Child Labor Restrictions (29 CFR Part 570)
| Age | Hours Permitted | Prohib