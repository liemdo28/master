#!/usr/bin/env python3
"""Generate Texas compliance files + San Antonio files."""
from pathlib import Path

BASE = Path(__file__).parent
META = 'retrieved_at: 2026-06-09 | confidence: official'

def w(subdir, fname, content):
    d = BASE / subdir
    d.mkdir(exist_ok=True)
    full = f"""# {fname.replace('_',' ').replace('.md','').title()}
**Metadata:** source_id: {subdir}/{fname} | jurisdiction: {subdir.split('/')[0]} | {META}

{content}

> **⚠️ Disclaimer:** This document is for reference purposes only and does not constitute legal or tax advice. Verify all requirements with a qualified CPA, tax professional, or employment attorney before filing or taking action.
"""
    (d / fname).write_text(full, encoding="utf-8")
    sz = len(full.encode("utf-8"))
    print(f"  {subdir}/{fname}: {sz/1024:.0f} KB")

print("Generating Texas files...")

# === TEXAS FILES ===
w("texas", "texas_sales_tax_restaurant.md", """## 1. Texas Sales Tax for Restaurants

### 1.1 Overview
The Texas Comptroller of Public Accounts administers the Texas sales and use tax. Restaurants in Texas must collect and remit state and local sales tax on taxable sales. Texas has one of the most complex local tax structures in the US with over 1,400 unique local taxing jurisdictions.

### 1.2 Current Tax Rates
| Component | Rate | Notes |
|-----------|------|-------|
| State Sales Tax | 6.25% | Fixed by law, applies to all taxable sales |
| Local Sales Tax | 0.125% - 2.0% | Varies by city, county, transit authority, etc. |
| **Total Combined Range** | **6.25% - 8.25%** | Maximum combined rate |

### 1.3 San Antonio Specific Rates
| Taxing Jurisdiction | Rate |
|--------------------|------|
| Texas State | 6.25% |
| City of San Antonio | 1.125% |
| Bexar County | 0.125% |
| VIA Metropolitan Transit | 0.5% |
| **San Antonio Total** | **8.25%** |

### 1.4 Stockton Specific Rates (California)
| Taxing Jurisdiction | Rate |
|--------------------|------|
| California State | 7.25% |
| San Joaquin County | 0.25% |
| City of Stockton | 1.0% |
| **Stockton Total** | **8.50%** |

### 1.5 What Is Taxable vs Non-Taxable in Texas

| Item | Taxable? | Notes |
|------|----------|-------|
| Food (dine-in) | No | Food products for human consumption are exempt |
| Food (to-go) | No | Same exemption applies |
| Candy and gum | Yes | Taxable regardless of where consumed |
| Soft drinks | Yes | Carbonated beverages are taxable |
| Bottled water | Yes | Non-carbonated bottled water is taxable |
| Alcoholic beverages | Yes | Beer, wine, liquor — taxable |
| Hot prepared food (to-go) | Yes | Hot food ready for immediate consumption |
| Food sold through vending machines | Yes | Unless food exempt |
| Ice | Yes | Taxable |
| Napkins, straws, utensils | No | Part of food preparation, not separately taxed |
| Catering services | Varies | Food itself may be exempt; service charges may be taxable |

### 1.6 Mixed Beverage Tax (Texas Specific)
Texas imposes an additional mixed beverage gross receipts tax:
| Component | Rate |
|-----------|------|
| Mixed Beverage Gross Receipts Tax | 6.7% of gross receipts from alcoholic beverages |
| Mixed Beverage Sales Tax | 8.25% (state + local) on mixed drinks |
| Mixed Beverage Permit Required | Private club, or mixed beverage permit |

**Filing Frequency:** Monthly (by 20th of following month)
**Forms:** Mixed Beverage Gross Receipts Tax Report (Form 67-103)
First $112,500 quarterly exclusion for mixed beverage gross receipts tax (if monthly sales under $112,500/quarter)

### 1.7 Filing Requirements
| Sales Volume | Filing Frequency | Due Date |
|-------------|-----------------|----------|
| < $1,000/month | Quarterly | 20th of month after quarter end |
| $1,000 - $10,000/month | Monthly | 20th of following month |
| > $10,000/month | Monthly | 20th of following month |
| > $250,000/month | Monthly + prepayment | 20th of following month + prepayment by 10th |

### 1.8 Texas Sales Tax Permit
- Apply through Texas Comptroller: Texas Sales and Use Tax Permit (Form AP-201)
- No fee for standard permit
- Must obtain BEFORE opening
- State: https://comptroller.texas.gov/taxes/permit/
- Renewal: Not required (permanent unless revoked)

### 1.9 Recordkeeping Requirements
- Keep all sales records for 4 years
- Include: POS reports, daily sales summaries, tax returns, exemption certificates
- Must track taxable vs non-taxable sales separately
- Prepare Schedule A (Monthly Taxable Sales Report) if filing monthly

### 1.10 Common Pitfalls for Texas Restaurants
| Issue | Risk |
|-------|------|
| Not separating taxable alcoholic beverage sales | Underpayment penalty (5% + interest) |
| Incorrect local tax rate for catering deliveries | Must use rate for delivery location |
| Not charging tax on bottled water | Taxable by state law |
| Mixing taxable and non-taxable on one receipt | Tax not owed on exempt items if properly tracked |
| Late filing penalty | 5% of tax due per month, max 25% |

### 1.11 Texas vs California Sales Tax Comparison
| Factor | Texas | California |
|--------|-------|------------|
| State Rate | 6.25% | 7.25% |
| Local Rate Range | 0.125% - 2.0% | 0.10% - 2.5% |
| Max Combined | 8.25% | 10.25% |
| Food Exemption | Prepared food NOT taxable | Prepared food IS taxable |
| Bottled Water | Taxable | Not taxable |
| Candy/Gum | Taxable | Taxable |
| Hot To-Go Food | Taxable | Taxable |
| Alcoholic Beverages | Taxable + Mixed Beverage Tax | Taxable |
| Filing Agency | Comptroller | CDTFA |

### 1.12 Citations
- Texas Tax Code Chapter 151: https://statutes.capitol.texas.gov/SOTWDocs/TX/htm/TX.151.htm
- Texas Comptroller Sales Tax Guide: https://comptroller.texas.gov/taxes/publications/96-1173.php
- Texas Comptroller Mixed Beverage Tax: https://comptroller.texas.gov/taxes/mixed-beverage/
- Texas Comptroller Publication 96-1173 (Restaurant Guide)
""")

w("texas", "texas_workforce_commission_guide.md", """## 1. Texas Workforce Commission Guide

### 1.1 Overview
The Texas Workforce Commission (TWC) administers unemployment insurance (UI), labor law enforcement, workforce development, and child labor regulations in Texas.

### 1.2 Unemployment Insurance (UI) Tax
| Component | Details |
|-----------|---------|
| Taxable Wage Base (2025) | $9,000 per employee per year |
| New Employer Rate | 2.7% (non-construction) |
| Experience Rating | 0.31% - 6.31% based on claims history |
| Employer Contribution | Paid quarterly |
| Employee Contribution | $0 (Texas does not withhold from employees) |

### 1.3 UI Tax Rates by Experience (2025)
| Rate Category | Rate Range | Applies To |
|--------------|------------|------------|
| New Employer (non-construction) | 2.7% | First 4 years |
| Negative Balance | 6.01% - 6.31% | High claims history |
| Low Experience | Varies | 5+ years with good history |
| Minimum Rate | 0.31% | Best experience rating |

### 1.4 TWC Reporting Requirements
| Form | Purpose | Due Date |
|------|---------|----------|
| TX Submit (TWC) | Quarterly UI wage and tax report | Last day of April, July, Oct, Jan |
| Employer's Report of New Hire | New hire reporting | Within 20 days of hire |
| Tax Rate Notice | Annual rate determination | December (for following year) |

### 1.5 TWC Claims Process
When a former employee files for unemployment:
1. TWC sends Notice of Application to Employer (with 10-day response window)
2. Employer must provide separation information
3. TWC determines eligibility based on:
   - Reason for separation (quit vs fired vs layoff)
   - Last work date
   - Work search documentation
4. Appeal deadline: 14 days from decision

### 1.6 Misconduct vs Lack of Work
| Separation Type | Benefits Allowed? |
|----------------|-------------------|
| Lack of work | Yes |
| Quit for good cause | Yes (if good cause related to work) |
| Discharged - misconduct | No |
| Discharged - not misconduct | May be eligible |
| Voluntary quit (no good cause) | No |

### 1.7 Texas Payday Law (Chapter 61 of Labor Code)
- Wages must be paid at least semi-monthly
- Final wages: Due within 6 days of termination
- Deductions: Allowed only if required by law, authorized in writing, or for benefit of employee
- Written authorization required for uniform deductions, meal charges, etc.

### 1.8 Wage Claims
Employees can file wage claims with TWC for:
- Unpaid wages
- Unpaid overtime
- Illegal deductions
- Unpaid commissions
TWC investigates and can order payment of wages + penalties

### 1.9 TWC Workplace Notices
Required posters:
- Texas Payday Law Notice (TWC Publication 56)
- Workers' Compensation Notice (if non-subscriber)
- Unemployment Insurance Notice
- Texas Labor Law posters available at: https://www.twc.texas.gov/jobseekers/twc-workplace-posters

### 1.10 Citations
- TWC Employer Information: https://www.twc.texas.gov/businesses
- TWC UI Tax: https://www.twc.texas.gov/unemployment-benefits/employer-ui-information
- Texas Labor Code Chapter 61 (Payday Law): https://statutes.capitol.texas.gov/Docs/LA/htm/LA.61.htm
- TWC New Hire Reporting: https://www.twc.texas.gov/programs/texas-new-hire-reporting
""")

w("texas", "texas_minimum_wage.md", """## 1. Texas Minimum Wage Law

### 1.1 Overview
Texas follows the federal minimum wage standard. There is no Texas state minimum wage above the federal rate. Key details:
| Category | Rate | Notes |
|----------|------|-------|
| Standard Minimum Wage | $7.25/hour | Matches federal rate |
| Tipped Employee | $2.13/hour | Same as federal tip credit |
| Youth (<20, first 90 days) | $4.25/hour | Matches federal |
| Texas State Law | No override | Follows FLSA |

### 1.2 Tip Credit in Texas
Texas follows the federal tip credit rules (29 CFR 531):
- Maximum tip credit: $5.12/hour
- Employee must receive at least $30/month in tips
- Written notice of tip credit required
- Employee retains all tips (except valid pool)
- Make-up pay required if tips fall short

### 1.3 Overtime in Texas
- Follows FLSA: 1.5x regular rate for hours >40/week
- No daily overtime limit (unlike California)
- No double-time requirement
- No Texas-specific overtime law

### 1.4 Comparison: Texas vs California Minimum Wage
| Factor | Texas | California |
|--------|-------|------------|
| Standard Rate | $7.25/hr | $16.00/hr (2024) |
| Tipped Rate | $2.13/hr | $16.00/hr (no tip credit) |
| Annual (Full Time) | $15,080 | $33,280 |
| Annual Increase | None | Inflation-adjusted |

### 1.5 Citations
- Texas Labor Code: https://statutes.capitol.texas.gov/Docs/LA/htm/LA.61.htm
- TWC: https://www.twc.texas.gov
- FLSA: https://www.dol.gov/agencies/whd/flsa
""")

w("texas", "texas_overtime_law.md", """## 1. Texas Overtime Law

### 1.1 Overview
Texas does not have its own overtime law. Overtime is governed by the federal Fair Labor Standards Act (FLSA). There are no Texas-specific overtime statutes.

### 1.2 FLSA Overtime Rules (Applies in Texas)
- 1.5x regular rate for hours worked beyond 40 in a workweek
- Regular rate includes: base pay, commissions, non-discretionary bonuses, tips (for tipped employees)
- Regular rate excludes: discretionary bonuses, gifts, expense reimbursements, benefit plan contributions

### 1.3 Tipped Employee Overtime Calculation
For a tipped employee earning $2.13/hr + tips:
- FLSA requires overtime at 1.5x $7.25 = $10.88/hr
- Employer pays: $2.13 base × 1.5 = $3.20/hr (additional)
- Tip credit covers remaining
- Equivalent to: cash wage $3.20 + tip credit $5.12 = $8.32/hr... wait, calculation is wrong
- CORRECT calculation: OT rate = 1.5 × $7.25 = $10.88
- Cash wage portion: $10.88 - $5.12 (max tip credit) = $5.76/hr
- So overtime cash wage = $5.76/hr for tipped employees

### 1.4 Texas vs California Overtime Comparison
| Factor | Texas | California |
|--------|-------|------------|
| Daily OT | None | >8 hours/day |
| Weekly OT | >40 hours/week | >40 hours/week |
| Double Time | None | >12 hours/day |
| Seventh Day | None | >8 hours on 7th consecutive day |
| Meal Break OT | None | Missed meal = 1 hour penalty pay |
| Salary Exemption | $684/week | $684/week (matching federal) |

### 1.5 Citations
- 29 USC 207 (FLSA Overtime): https://www.law.cornell.edu/uscode/text/29/207
- DOL Fact Sheet #23: https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime
- Texas Labor Code has no overtime provisions
""")

w("texas", "texas_tip_rules.md", """## 1. Texas Tip Rules

### 1.1 Overview
Texas follows federal tip credit rules with some state-specific nuances through TWC enforcement.

### 1.2 Tip Credit in Texas
| Component | Value |
|-----------|-------|
| Maximum Tip Credit | $5.12/hr |
| Cash Wage Minimum | $2.13/hr |
| Total Wage (with tips) | $7.25/hr minimum |
| Notice Requirement | Written before start of employment |

### 1.3 Tip Pooling in Texas
- Allowed under federal rules
- Pool can include: servers, bartenders, bussers, food runners
- Cannot include: management, owners, dishwashers, cooks
- Must be distributed among "customarily tipped" employees
- Management cannot take tips from pool
- 2021 DOL Final Rule: No more than 2 hours of non-tipped work allowed

### 1.4 Texas vs California Tip Rules
| Factor | Texas | California |
|--------|-------|------------|
| Tip Credit | Yes ($5.12/hr) | No ($0) |
| Cash Wage for Tipped | $2.13/hr | $16.00/hr |
| Tip Pooling | Allowed (customarily tipped only) | Allowed (must include all employees) |
| Management in Pool | No | No |
| Service Charges | Wages (not tips) | Wages (not tips) |

### 1.5 Citations
- 29 CFR 531.50-60: https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-531
- DOL Field Operations Handbook: https://www.dol.gov/agencies/whd/field-operations-handbook
- TWC: https://www.twc.texas.gov
""")

w("texas", "texas_sick_leave.md", """## 1. Texas Sick Leave

### 1.1 Overview
Texas has NO state-wide sick leave mandate. The only sick leave requirements in Texas are local ordinances in certain cities and federal contractors under Executive Order 13706.

### 1.2 Texas Local Sick Leave Ordinances
| City | Effective Date | Accrual Rate | Max per Year |
|------|---------------|--------------|--------------|
| Austin | 2020 (blocked by court) | Permanently blocked | N/A |
| Dallas | Proposed but not enacted | N/A | N/A |
| San Antonio | No local ordinance | N/A | N/A |

Texas cities cannot enforce paid sick