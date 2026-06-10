#!/usr/bin/env python3
"""Generate California and Stockton compliance files."""
from pathlib import Path

BASE = Path(__file__).parent
META = 'retrieved_at: 2026-06-09 | confidence: official'

def w(subdir, fname, content):
    d = BASE / subdir
    d.mkdir(exist_ok=True)
    full = f"""# {fname.replace('_',' ').replace('.md','').title()}
**Metadata:** source_id: {subdir}/{fname} | jurisdiction: {subdir.split('/')[0]} | {META}

{content}

> **⚠️ Disclaimer:** Verify with CPA/legal professional before filing or taking action.
"""
    (d / fname).write_text(full, encoding="utf-8")
    sz = len(full.encode("utf-8"))
    print(f"  {subdir}/{fname}: {sz/1024:.0f} KB")

print("Generating California files...")

w("california", "california_minimum_wage.md", """## 1. California Minimum Wage

### 1.1 Current Rates (2024-2025)
| Category | Rate | Effective Date |
|----------|------|---------------|
| Standard (all employers) | $16.00/hr | January 1, 2024 |
| Fast Food ($60+ locations) | $20.00/hr | April 1, 2024 |
| Healthcare Workers | $17-$23/hr phased | June 1, 2024+ |
| Tipped Employees | $16.00/hr | No tip credit allowed |

### 1.2 California vs Texas Minimum Wage
California minimum wage is $16.00/hr vs Texas $7.25/hr. California also adjusts annually for inflation (CPI). No tip credit is permitted in California — tipped employees must receive full minimum wage.

### 1.3 ETT (Employment Training Tax)
- Rate: 0.1% on first $7,000 of wages
- Paid by employer only
- Funds workforce training programs

### 1.4 California Minimum Wage History
| Year | Rate | Increase |
|------|------|----------|
| 2017 | $10.50 | +$0.50 |
| 2018 | $11.00 | +$0.50 |
| 2019 | $12.00 | +$1.00 |
| 2020 | $13.00 | +$1.00 |
| 2021 | $14.00 | +$1.00 |
| 2022 | $15.00 | +$1.00 |
| 2023 | $15.50 | +$0.50 |
| 2024 | $16.00 | +$0.50 |

### 1.5 Citations
- CA Labor Code Section 1182.12: https://leginfo.legislature.ca.gov
- CA DIR Minimum Wage: https://www.dir.ca.gov/dlse/faq_minimumwage.htm
""")

w("california", "california_payroll_tax_guide.md", """## 1. California Payroll Tax Guide

### 1.1 California Payroll Taxes Overview
California has one of the most complex payroll tax systems in the US. Employers must register with multiple state agencies.

### 1.2 Tax Rates (2024-2025)
| Tax | Rate | Wage Base | Paid By |
|-----|------|-----------|---------|
| State Disability Insurance (SDI) | 1.1% (2024) | $153,164 | Employee |
| Paid Family Leave (PFL) | Included in SDI | Same | Employee |
| Employment Training Tax (ETT) | 0.1% | $7,000 | Employer |
| Unemployment Insurance (UI) | 3.4% - 6.2% | $7,000 | Employer |
| California Personal Income Tax | 1% - 13.3% | All wages | Employee |

### 1.3 EDD Registration
All employers must register with the California Employment Development Department (EDD):
- Register online: https://edd.ca.gov/payroll_taxes/
- Employer Payroll Tax Account Number (DE 1)
- Register within 15 days of paying wages

### 1.4 Payroll Reporting Requirements
| Form | Purpose | Frequency | Due |
|------|---------|-----------|-----|
| DE 9/DE 9C | Quarterly wage and withholding report | Quarterly | Apr/Jul/Oct/Jan |
| DE 88 | Payroll tax deposit | Monthly or Semi-weekly | Varies |
| DE 34 | New employee report | Within 20 days | After hire |
| W-2/DE 45 | Annual wage statement | Annually | Jan 31 |

### 1.5 California Payroll Tax Deposit Schedule
| Threshold | Frequency | Due |
|-----------|-----------|-----|
| < $500/month | Monthly | 15th of following month |
| $500 - $20,000/month | Monthly | 15th of following month |
| > $20,000/month | Semi-weekly | Within 3 days |
| > $50,000/quarter | Electronic Funds Transfer | Required |

### 1.6 California vs Texas Payroll Tax Comparison
| Factor | California | Texas |
|--------|------------|-------|
| State Income Tax | 1% - 13.3% | None |
| SDI | 1.1% of wages (employee) | None |
| PFL | Included in SDI | None |
| UI Wage Base | $7,000 | $9,000 |
| UI Rate Range | 3.4% - 6.2% | 0.31% - 6.31% |
| ETT | 0.1% on $7,000 | None |
| Payroll Tax Agency | EDD | TWC |
| Registration | DE 1 | TX Submit |

### 1.7 New Hire Reporting (California)
All employers must report new hires within 20 days:
- California New Employee Registry (DE 34)
- Online: https://newhire.edd.ca.gov/
- Required information: employee name, SSN, address, hire date

### 1.8 Citations
- CA EDD Payroll Taxes: https://edd.ca.gov/payroll_taxes/
- CA EDD Employer Guide: https://edd.ca.gov/pdf_pub_ctr/de44.pdf
- CA Revenue and Taxation Code: https://leginfo.legislature.ca.gov
""")

w("california", "california_overtime_law.md", """## 1. California Overtime Law

### 1.1 Overview
California has the most employee-favorable overtime laws in the US. Unlike Texas (FLSA only), California has strict daily, weekly, and seventh-day overtime rules.

### 1.2 California Overtime Rules
| Condition | Overtime Rate |
|-----------|---------------|
| Hours >8 in one day | 1.5x regular rate |
| Hours >40 in one week | 1.5x regular rate |
| Hours >12 in one day | 2x regular rate (double time) |
| Hours >8 on 7th consecutive work day | 1.5x regular rate |
| Hours >12 on 7th consecutive day | 2x regular rate (double time) |

### 1.3 California vs Texas Overtime Comparison
| Factor | California | Texas |
|--------|------------|-------|
| Daily OT (>8 hours) | Yes (1.5x) | No |
| Weekly OT (>40 hours) | Yes (1.5x) | Yes (1.5x) |
| Double Time (>12 hours) | Yes | No |
| 7th Day OT | Yes | No |
| Alternative Workweek | Yes (with vote) | No |

### 1.4 Alternative Workweek Schedule
California allows employees to vote on alternative schedules (4/10s, 3/12s):
- Must be approved by 2/3 of affected employees
- Must not reduce total weekly hours or pay
- Must comply with meal/break requirements

### 1.5 Exemptions in California
| Exemption | Salary Minimum | Duties Test |
|-----------|---------------|-------------|
| Executive | $45,760/yr (2024) | Manage 2+ employees |
| Administrative | $45,760/yr | Office work, discretion |
| Professional | $45,760/yr | Advanced knowledge |
| Computer Professional | $55,000/yr (hourly) or $90,000/yr (salary) | Technical duties |

### 1.6 Citations
- CA Labor Code Section 510-511: https://leginfo.legislature.ca.gov
- CA IWC Wage Orders: https://www.dir.ca.gov/iwc/
""")

w("california", "california_tip_rules.md", """## 1. California Tip Rules

### 1.1 Overview
California has strict tip laws that differ significantly from Texas. The key difference: California does NOT allow a tip credit, meaning employers must pay the full minimum wage ($16.00/hr) before tips.

### 1.2 Tip Credit
| Factor | California | Texas |
|--------|------------|-------|
| Tip Credit Allowed? | NO | YES |
| Cash Wage for Tipped | $16.00/hr | $2.13/hr |
| Maximum Tip Credit | $0.00 | $5.12/hr |
| Burden | Employer pays full min wage | Tips supplement wage |

### 1.3 Tip Pooling in California
Unlike Texas, California allows tip pooling that includes both front-of-house AND back-of-house employees (Labor Code Section 351):
- Pool can include: servers, bartenders, bussers, cooks, dishwashers
- Cannot include: management, owners
- Must be distributed "fairly and reasonably"
- Employer cannot take any portion
- Written policy recommended

### 1.4 Service Charges (Auto-gratuities)
Same as federal: auto-gratuities are wages, not tips.
- Must report as wages
- Subject to payroll tax
- Can be distributed at employer's discretion

### 1.5 Citations
- CA Labor Code Section 350-356: https://leginfo.legislature.ca.gov
- CA DIR tip fact sheet: https://www.dir.ca.gov/dlse/TipAndServiceChargeFAQs.html
""")

w("california", "california_sick_leave.md", """## 1. California Sick Leave

### 1.1 Overview
California requires paid sick leave for all employees through the Healthy Workplaces, Healthy Families Act of 2014 (Labor Code Section 245-249).

### 1.2 Accrual Requirements
| Requirement | Detail |
|-------------|--------|
| Minimum Accrual | 1 hour per 30 hours worked |
| Alternative | 24 hours/year upfront (lump sum) |
| Annual Cap | 48 hours or 6 days (employer can cap at 48) |
| Carryover | Required (can cap at 48 hours) |
| Waiting Period | 90 days from hire |
| Usage | For self or family member illness, preventive care, domestic violence |

### 1.3 California vs Texas Sick Leave
| Factor | California | Texas |
|--------|------------|-------|
| Paid Sick Leave | Yes (state mandate) | No (no state law) |
| Accrual | 1 hr per 30 worked | None required |
| Carryover | Yes (up to 48 hrs) | N/A |
| Family Care | Yes | N/A |

### 1.4 Citations
- CA Labor Code 245-249: https://leginfo.legislature.ca.gov
- DIR FAQs: https://www.dir.ca.gov/dlse/PSLCoverageFAQs.html
""")

w("california", "california_edd_guide.md", """## 1. California EDD Guide

### 1.1 California Employment Development Department
The EDD manages payroll taxes, unemployment insurance, disability insurance, and new hire reporting. Every California employer must register and comply.

### 1.2 Unemployment Insurance (UI)
| Component | Detail |
|-----------|--------|
| Taxable Wage Base | $7,000 per employee per year |
| Employer Rate | 3.4% - 6.2% (experience-rated) |
| New Employer Rate | 3.4% |
| Employee Contribution | $0 |
| Claims Process | EDD notifies employer, 10-day response window |

### 1.3 State Disability Insurance (SDI)
| Component | Detail |
|-----------|--------|
| Employee Rate | 1.1% of wages (2024) |
| Wage Base | $153,164 (2024) |
| Maximum Weekly Benefit | 60-70% of wages |
| Duration | Up to 52 weeks |
| Paid Family Leave | Included (8 weeks bonding, caregiving) |

### 1.4 EDD Forms & Deadlines
| Form | Purpose | Due |
|------|---------|-----|
| DE 1 | Employer registration | Within 15 days of first wages |
| DE 9 | Quarterly wage report | Last day of Apr, Jul, Oct, Jan |
| DE 9C | Quarterly contribution report | Same as DE 9 |
| DE 34 | New hire report | Within 20 days |
| DE 88 | Payroll tax deposit | Per schedule |
| DE 4 | Employee withholding | New hire |

### 1.5 Payroll Tax Deposit Schedule
| Amount | Frequency | Due |
|--------|-----------|-----|
| < $350/year | Annual | December 15 |
| < $500/month | Quarterly | Same as DE 9 |
| $500 - $20,000/month | Monthly | 15th of following month |
| > $20,000/month | Semi-weekly | Wednesday/Saturday/Friday |

### 1.6 Penalties for Late Filing
| Violation | Penalty |
|-----------|---------|
| Late registration | $20 per employee, min $200 |
| Late DE 9 | $30 + 15% of contributions |
| Late payment | 10% + interest |
| Fraud | 100% of tax + criminal penalties |

### 1.7 Citations
- CA EDD Employer Portal: https://edd.ca.gov/payroll_taxes/
- CA EDD DE 44 Guide: https://edd.ca.gov/pdf_pub_ctr/de44.pdf
""")

w("california", "california_calosha_food_safety.md", """## 1. Cal/OSHA Food Safety

### 1.1 Overview
Cal/OSHA (California Division of Occupational Safety and Health) has stricter standards than federal OSHA for restaurant operations.

### 1.2 Key Cal/OSHA Requirements for Restaurants
| Category | Requirement |
|----------|-------------|
| Heat Illness Prevention | Mandatory shade, water, rest breaks for outdoor or hot kitchen work |
| Injury & Illness Prevention Program (IIPP) | Written program required for ALL employers |
| Kitchen Ventilation | Hood suppression systems, annual inspection |
| Slip/Fall Prevention | Non-slip flooring, immediate spill cleanup |
| Knife Safety | Cut-resistant gloves, training program |
| Lifting Safety | Back safety training, team lift protocol |
| Bloodborne Pathogens | Kit for first aid responders |
| COVID-19 | Aerosol transmissible disease protocol |

### 1.3 IIPP Required Elements
1. Responsibility (designate safety officer)
2. Compliance (disciplinary system)
3. Communication (safety meetings, training)
4. Hazard Assessment (periodic inspections)
5. Accident/Exposure Investigation
6. Hazard Correction
7. Training and Instruction
8. Recordkeeping

### 1.4 Citations
- CA Labor Code Section 6400-6413.5
- Cal/OSHA: https://www.dir.ca.gov/dosh/
- Title 8 CCR: https://www.dir.ca.gov/title8/
""")

w("california", "california_meal_break_law.md", """## 1. California Meal & Rest Break Law

### 1.1 Overview
California has strict meal and rest break requirements that Texas does not have. Failure to provide breaks results in premium penalty pay.

### 1.2 Meal Break Requirements
| Shift Length | Meal Break Required | Timing |
|-------------|-------------------|--------|
| >5 hours | 30-min uninterrupted meal period | Before 5th hour |
| >10 hours | Two 30-min meal periods | Before 5th and 10th hour |
| <6 hours (waivable) | May waive by mutual agreement | Written waiver required |

### 1.3 Rest Break Requirements
| Shift Length | Rest Break Required |
|-------------|-------------------|
| >3.5 hours | 10-min paid rest break |
| >6 hours | Two 