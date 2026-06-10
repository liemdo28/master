#!/usr/bin/env python3
"""Generate ALL reference files for US Business Compliance DB."""
import os
from pathlib import Path

BASE = Path(__file__).parent
RET = "retrieved_at: 2026-06-09"
SUFFIX = """\n\n> **⚠️ Disclaimer:** This document is for reference purposes only and does not constitute legal or tax advice. Verify all requirements with a qualified CPA, tax professional, or employment attorney before filing or taking action based on this information.\n"""

def w(fname, content):
    path = BASE / fname
    path.parent.mkdir(exist_ok=True)
    path.write_text(content.strip() + f"\n{SUFFIX}", encoding="utf-8")
    sz = len(content.encode("utf-8"))
    print(f"  {fname}: {sz/1024:.0f} KB")

def make_tables():
    """Write all table-heavy reference files."""
    # === ACCOUNTING ===
    base = "accounting/"
    
    w(base + "restaurant_chart_of_accounts.md", f"""# Restaurant Chart of Accounts Reference
**Metadata:** source_id: accounting/restaurant_chart_of_accounts | jurisdiction: federal | domain: accounting | source_url: https://www.aicpa.org | publisher: AICPA | {RET} | confidence: trusted_reference

## 1. Standard Restaurant COA Structure

A restaurant chart of accounts should be organized to support operational analysis by store, by category (food/beverage), and by profit center.

| Account # | Account Name | Type | Description |
|-----------|-------------|------|-------------|
| 1000-1999 | Assets | Balance Sheet | Cash, inventory, equipment, leasehold improvements |
| 2000-2999 | Liabilities | Balance Sheet | AP, sales tax payable, payroll liabilities, accrued expenses |
| 3000-3999 | Equity | Balance Sheet | Owner capital, retained earnings, draws |
| 4000-4999 | Revenue | Income Statement | Food sales, beverage sales, catering, other income |
| 5000-5999 | COGS | Income Statement | Food cost, beverage cost, paper supplies |
| 6000-6999 | Labor | Income Statement | Salaries, wages, payroll taxes, benefits, workers comp |
| 7000-7999 | Operating Expenses | Income Statement | Rent, utilities, marketing, repairs, licenses |
| 8000-8999 | Other Income/Expense | Income Statement | Interest, misc income, depreciation, amortization |

### 1.1 Detailed Revenue Accounts

| Number | Account Name | Description |
|--------|-------------|-------------|
| 4010 | Food Sales - Dine-In | All food served in-house |
| 4015 | Food Sales - Takeout | To-go food orders |
| 4020 | Food Sales - Delivery | Third-party delivery (DoorDash, Uber Eats) |
| 4025 | Food Sales - Catering | Off-premise catering and events |
| 4100 | Beverage Sales - Alcoholic | Beer, wine, liquor sales |
| 4110 | Beverage Sales - Non-Alcoholic | Soda, juice, coffee, tea |
| 4200 | Service Charges | Auto-gratuity (parties of 6+, private events) |
| 4250 | Delivery Fees | Fees charged for delivery service |
| 4300 | Gift Certificate Sales | Liability until redeemed |
| 4310 | Gift Certificate Redemption | Revenue recognition upon redemption |
| 4400 | Vending/Retail Sales | Branded merchandise, packaged goods |
| 4500 | Other Income | Interest income, rebates, miscellaneous |

### 1.2 Detailed COGS Accounts

| Number | Account Name | Description |
|--------|-------------|-------------|
| 5010 | Food Cost - Meat & Seafood | Protein purchases |
| 5020 | Food Cost - Produce | Fruits and vegetables |
| 5030 | Food Cost - Dry Goods | Pasta, rice, spices, shelf-stable items |
| 5040 | Food Cost - Dairy | Milk, cheese, eggs, butter |
| 5050 | Food Cost - Bakery | Bread, pastries (in-house or purchased) |
| 5100 | Beverage Cost - Beer | Beer purchases (kegs, bottles, cans) |
| 5110 | Beverage Cost - Wine | Wine purchases |
| 5120 | Beverage Cost - Liquor | Spirits and mixers |
| 5130 | Beverage Cost - Non-Alcoholic | Soda syrup, coffee beans, tea bags |
| 5200 | Paper & Disposables | Takeout containers, napkins, straws, gloves |
| 5210 | Cleaning Supplies | Degreasers, sanitizers, dish soap |
| 5300 | Freight & Shipping | Inbound freight cost on supplies |
| 5400 | Inventory Adjustments | Theft, spoilage, waste, comps |

### 1.3 Detailed Labor Accounts

| Number | Account Name | Description |
|--------|-------------|-------------|
| 6010 | Salaried Management | GM, AGM, kitchen manager salaries |
| 6020 | Hourly FOH - Full Time | Servers, bartenders, hosts (non-tipped base wage) |
| 6030 | Hourly BOH - Full Time | Cooks, dishwashers, prep (hourly wages) |
| 6040 | Hourly FOH - Part Time | Part-time front-of-house staff |
| 6050 | Hourly BOH - Part Time | Part-time back-of-house staff |
| 6100 | Overtime Premium | Overtime pay (1.5x base) tracked separately |
| 6150 | Tips - Reported | Employee-reported tips (for payroll) |
| 6160 | Tip Credit | Tip credit claimed against minimum wage |
| 6200 | Payroll Taxes - Employer | FICA (Social Security + Medicare) employer portion |
| 6210 | Federal Unemployment (FUTA) | Federal unemployment tax |
| 6220 | State Unemployment (SUTA) | State unemployment tax |
| 6230 | State Payroll Taxes | State-specific (CA ETT, etc.) |
| 6250 | Workers Compensation | Workers comp insurance premium |
| 6300 | Health Insurance - Employer | Employer portion of health premiums |
| 6310 | Dental/Vision Insurance | Employer portion |
| 6320 | 401(k) Match | Employer matching contributions |
| 6350 | Paid Time Off | Accrual for vacation, sick pay |
| 6400 | Recruiting & Training | Job ads, onboarding, training materials |
| 6450 | Uniforms | Employee uniforms, aprons, shoes |
| 6500 | Meals - Employee | Cost of employee meals (family meal) |

### 1.4 Detailed Operating Expense Accounts

| Number | Account Name | Description |
|--------|-------------|-------------|
| 7010 | Rent - Building | Base rent for restaurant space |
| 7015 | Rent - Percentage | Percentage rent (if applicable) |
| 7020 | CAM Charges | Common area maintenance |
| 7030 | Property Tax | Real estate tax (if triple-net lease) |
| 7100 | Utilities - Electric | Electricity |
| 7110 | Utilities - Gas | Natural gas/propane |
| 7120 | Utilities - Water | Water and sewer |
| 7130 | Utilities - Trash | Waste disposal service |
| 7150 | Telephone & Internet | Phone, internet, cable |
| 7200 | Marketing - Digital | Social media ads, Google, Yelp |
| 7210 | Marketing - Print | Menus, flyers, signage |
| 7220 | Marketing - PR | Public relations, events |
| 7230 | Marketing - Loyalty | Loyalty program costs |
| 7250 | Delivery Service Commission | DoorDash/Uber Eats/Grubhub commissions |
| 7300 | Repairs & Maintenance - Equipment | Repair of kitchen equipment, POS |
| 7310 | Repairs & Maintenance - Building | Facility maintenance |
| 7320 | Pest Control | Exterminator service |
| 7330 | Janitorial Service | Third-party cleaning (if used) |
| 7350 | POS System | Monthly software fee, credit card processing |
| 7360 | Credit Card Processing Fees | Merchant service fees |
| 7400 | Insurance - General Liability | GL insurance premium |
| 7410 | Insurance - Property | Property/contents insurance |
| 7420 | Insurance - Liquor Liability | Liquor liability coverage |
| 7450 | Legal & Professional Fees | Attorney, accountant, consultant fees |
| 7460 | Licenses & Permits | Business license, health permit, liquor license, music license |
| 7500 | Office Supplies | Administrative supplies |
| 7510 | Bank Charges | Bank fees, NSF fees |
| 7550 | Dues & Subscriptions | Trade association memberships, industry pubs |
| 7600 | Travel & Entertainment | Business travel, client meals |
| 7700 | Training & Development | Staff training, certifications |
| 7800 | Miscellaneous | General misc under $100 |

### 1.5 Balance Sheet Accounts

| Number | Account Name | Description |
|--------|-------------|-------------|
| 1010 | Cash - Operating | Checking account |
| 1020 | Cash - Payroll | Payroll checking account |
| 1030 | Cash - Savings | Savings/money market |
| 1040 | Petty Cash | Cash drawer/float |
| 1100 | Accounts Receivable | Catering invoices, event deposits due |
| 1200 | Food Inventory | Raw food value |
| 1210 | Beverage Inventory | Beer/wine/liquor inventory |
| 1220 | Supplies Inventory | Paper/cleaning supplies |
| 1300 | Prepaid Expenses | Prepaid rent, insurance, licenses |
| 1400 | Fixed Assets - Equipment | Kitchen equipment at cost |
| 1410 | Accumulated Depreciation - Equipment | Depreciation taken on equipment |
| 1420 | Fixed Assets - Furniture | Tables, chairs, booths at cost |
| 1430 | Accumulated Depreciation - Furniture | Depreciation taken on furniture |
| 1440 | Leasehold Improvements | Build-out at cost |
| 1450 | Accumulated Amortization - Leasehold | Amortization taken |
| 1460 | POS System | Hardware, installation |
| 1500 | Security Deposits | Lease deposits, utility deposits |
| 1600 | Goodwill | If acquired a going concern |
| 2010 | Accounts Payable | Vendor invoices due |
| 2100 | Accrued Payroll | Unpaid wages at period end |
| 2110 | Accrued PTO | Accrued vacation/sick pay |
| 2200 | Sales Tax Payable | Sales tax collected (state + local) |
| 2210 | Mixed Beverage Tax Payable | Texas mixed beverage tax |
| 2220 | Liquor Tax Payable | State liquor taxes |
| 2300 | Payroll Taxes Payable | FICA, FUTA, SUTA withheld |
| 2310 | Income Tax Withholding | Federal/state income tax |
| 2320 | Tips Payable | Tips held for distribution |
| 2400 | Gift Certificate Liability | Unredeemed gift certificates |
| 2500 | Notes Payable | Loans, equipment financing |
| 2510 | Shareholder/Partner Loans | Loans from owners |
| 2600 | Accrued Rent | Accrued but unpaid rent |
| 3000 | Owner Capital | Owner initial investment |
| 3010 | Retained Earnings | Cumulative profits/losses |
| 3020 | Current Period Net Income | Current period profit/loss |

## 2. Month-End Close Checklist

### 2.1 Daily Tasks
- [ ] Reconcile POS sales to bank deposits
- [ ] Enter tips into payroll system
- [ ] Record cash paid outs
- [ ] Verify credit card tips match POS reports

### 2.2 Weekly Tasks
- [ ] Process payroll
- [ ] Review labor cost as % of sales
- [ ] Monitor food cost variance
- [ ] Track inventory usage

### 2.3 Month-End Tasks
- [ ] Count and value ending inventory (physical or periodic)
- [ ] Reconcile all bank accounts
- [ ] Reconcile credit card statements
- [ ] Process month-end payroll accruals
- [ ] Accrue for unpaid wages and PTO
- [ ] Record depreciation/amortization
- [ ] Accrue for rent and utilities
- [ ] Calculate and accrue sales tax liability
- [ ] Reconcile tip allocations
- [ ] Review prepaid expenses
- [ ] Record fixed asset additions
- [ ] Reconcile intercompany transfers
- [ ] Review P&L for anomalies
- [ ] Generate financial statements
- [ ] File sales tax return (state-dependent)
- [ ] Pay payroll taxes (941/etc.)

### 2.4 Quarterly Tasks
- [ ] File Form 941 (Apr 30, Jul 31, Oct 31, Jan 31)
- [ ] Pay estimated quarterly taxes
- [ ] Review workers comp audit
- [ ] Adjust inventory valuation if needed
- [ ] Review asset depreciation schedules

### 2.5 Annual Tasks
- [ ] File Form 940 (FUTA) by Jan 31
- [ ] File Form W-2/W-3 by Jan 31
- [ ] File Form 1099-NEC by Jan 31
- [ ] File Form 8027 (tip allocation) by Feb 28/Mar 31
- [ ] File annual business tax return (1040/1120/1120-S)
- [ ] File annual report with Secretary of State
- [ ] Conduct physical inventory
- [ ] Review all fixed assets for impairment
- [ ] Prepare annual budget
- [ ] Schedule equipment maintenance

## 3. Standard Financial Ratios for Restaurants

| Metric | Formula | Target Range |
|--------|---------|-------------|
| Food Cost % | (COGS / Food Sales) × 100 | 28-35% |
| Beverage Cost % | (Beverage COGS / Beverage Sales) × 100 | 20-30% |
| Total COGS % | (Total COGS / Total Sales) × 100 | 30-35% |
| Labor Cost % | (Total Labor / Total Sales) × 100 | 30-35% |
| Prime Cost % | (COGS + Labor) / Total Sales × 100 | 60-65% |
| Rent % | (Rent / Total Sales) × 100 | 6-10% |
| Occupancy Cost % | (Rent + CAM + Utilities) / Sales × 100 | 10-15% |
| EBITDA Margin | EBITDA / Total Sales × 100 | 10-20% |
| Net Profit Margin | Net Profit / Total Sales × 100 | 3-10% |
| Average Check | Total Sales / Total Covers | Varies by concept |
| Turnover Rate | (# Server Table Turns / Shift) | 2-4x |
| RevPASH | Revenue / Available Seat Hour | Concept-specific |

## 4. Citations
- AICPA Restaurant Accounting Guide: https://www.aicpa.org
- Uniform System of Accounts for Restaurants (NRA)
- Restaurant Finance & Accounting Reference (NRA)
""")

    w(base + "gaap_summary_restaurant.md", f"""# GAAP Summary for Restaurant Accounting
**Metadata:** source_id: accounting/gaap_summary_restaurant | jurisdiction: federal | domain: accounting | publisher: FASB / AICPA | {RET} | confidence: trusted_reference

## 1. Applicable GAAP Principles

Restaurants preparing GAAP-basis financial statements must follow these key principles:

### 1.1 Revenue Recognition (ASC 606)
- Revenue recognized when control of goods/services transfers to customer
- For restaurants: at point of sale for dine-in/takeout
- Gift certificates: recognize when redeemed (defer liability)
- Loyalty points: allocate transaction price between current sale and future points
- Catering: recognize upon completion of event
- Third-party delivery: recognize net of delivery fee if agent, gross if principal

### 1.2 Inventory (ASC 330)
- Food inventory valued at lower of cost or net realizable value
- Write-down for spoilage, theft, obsolescence
- FIFO or weighted average cost flow assumption

### 1.3 Property and Equipment (ASC 360)
- Capitalize significant purchases (>$2,500 per IRS de minimis)
- Depreciate over estimated useful life
- Test for impairment when indicators exist

### 1.4 Leases (ASC 842)
- **Operating leases**: Recognize ROU asset and lease liability at lease commencement
- Lease expense recognized straight-line over lease term
- Practical expedients: Short-term lease exemption (<12 months)
- Requires disclosure of lease terms, renewal options, variable payments
- Impact on restaurants: Significant ROU assets and lease liabilities on balance sheet

### 1.5 ASC 842 - Restaurant Lease Impact
Most restaurants have significant lease obligations:
- Initial term typically 10-15 years