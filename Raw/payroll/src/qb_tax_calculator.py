"""
QuickBooks-style Payroll Tax Calculator
Implements:
- Earnings
- Other Payroll Items (tips)
- Employee Summary (taxes)
- Company Summary (employer taxes)
- Check Amount

Based on 2026 rules:
- Social Security: 6.2% employee + 6.2% employer, wage base $184,500
- Medicare: 1.45% employee + 1.45% employer, no wage base
- Additional Medicare: 0.9% over $200,000 (employee only)
- FUTA: 0.6% on first $7,000
- CA UI: employer rate x first $7,000
- CA ETT: 0.1% on first $7,000
- CA SDI: 1.3% employee
"""
import json
import os
import csv
from dataclasses import dataclass
from typing import Dict, Optional

# 2026 Tax Rules
SS_RATE_EMP = 0.062
SS_RATE_COMP = 0.062
SS_WAGE_BASE = 184500

MEDICARE_RATE_EMP = 0.0145
MEDICARE_RATE_COMP = 0.0145
ADDITIONAL_MEDICARE_RATE = 0.009
ADDITIONAL_MEDICARE_THRESHOLD = 200000

FUTA_RATE = 0.006
FUTA_WAGE_BASE = 7000

CA_SDI_RATE = 0.013
CA_ETT_RATE = 0.001
CA_UI_WAGE_BASE = 7000

DEFAULT_CA_UI_RATE = 0.022


@dataclass
class YTDTracker:
    ss_wages_ytd: float = 0.0
    medicare_wages_ytd: float = 0.0
    futa_wages_ytd: float = 0.0
    ca_ui_wages_ytd: float = 0.0


@dataclass
class EmployeePaycheck:
    name: str = ""
    hourly_rate: float = 0.0
    hours: float = 0.0
    hourly_wage: float = 0.0
    tips_bch: float = 0.0
    tips_kitchen: float = 0.0
    total_tips: float = 0.0
    gross_wages: float = 0.0
    taxable_wages: float = 0.0
    ss_employee: float = 0.0
    medicare_employee: float = 0.0
    additional_medicare: float = 0.0
    ca_sdi: float = 0.0
    federal_withholding: float = 0.0
    ca_income_tax: float = 0.0
    total_employee_taxes: float = 0.0
    check_amount: float = 0.0
    ss_company: float = 0.0
    medicare_company: float = 0.0
    futa: float = 0.0
    ca_ui: float = 0.0
    ca_ett: float = 0.0
    ca_ui_rate: float = DEFAULT_CA_UI_RATE
    total_company_taxes: float = 0.0


def calculate_paycheck(
    name: str,
    hourly_rate: float,
    hours: float,
    tips_bch: float = 0.0,
    tips_kitchen: float = 0.0,
    federal_withholding: float = 0.0,
    ca_income_tax: float = 0.0,
    ca_ui_rate: float = DEFAULT_CA_UI_RATE,
    ytd: Optional[YTDTracker] = None
) -> EmployeePaycheck:
    pc = EmployeePaycheck(
        name=name,
        hourly_rate=hourly_rate,
        hours=hours,
        tips_bch=tips_bch,
        tips_kitchen=tips_kitchen,
        federal_withholding=federal_withholding,
        ca_income_tax=ca_income_tax,
        ca_ui_rate=ca_ui_rate
    )
    
    if ytd is None:
        ytd = YTDTracker()
    
    # Hourly wage
    pc.hourly_wage = round(hourly_rate * hours, 2)
    pc.gross_wages = pc.hourly_wage
    
    # Tips
    pc.total_tips = tips_bch + tips_kitchen
    
    # Taxable wages = Hourly + Tips
    pc.taxable_wages = round(pc.hourly_wage + pc.total_tips, 2)
    
    # SS Employee - capped
    ss_remaining = max(0, SS_WAGE_BASE - ytd.ss_wages_ytd)
    ss_taxable = min(pc.taxable_wages, ss_remaining)
    pc.ss_employee = round(ss_taxable * SS_RATE_EMP, 2)
    
    # Medicare Employee - no cap
    pc.medicare_employee = round(pc.taxable_wages * MEDICARE_RATE_EMP, 2)
    
    # Additional Medicare
    if ytd.medicare_wages_ytd + pc.taxable_wages > ADDITIONAL_MEDICARE_THRESHOLD:
        add_wages = (ytd.medicare_wages_ytd + pc.taxable_wages) - ADDITIONAL_MEDICARE_THRESHOLD
        pc.additional_medicare = round(min(add_wages, pc.taxable_wages) * ADDITIONAL_MEDICARE_RATE, 2)
    
    # CA SDI - 1.3%
    pc.ca_sdi = round(pc.taxable_wages * CA_SDI_RATE, 2)
    
    # Total Employee Taxes
    pc.total_employee_taxes = round(
        pc.ss_employee + pc.medicare_employee + pc.additional_medicare +
        pc.ca_sdi + pc.federal_withholding + pc.ca_income_tax, 2
    )
    
    # Check Amount
    pc.check_amount = round(pc.taxable_wages - pc.total_employee_taxes, 2)
    
    # SS Company
    pc.ss_company = round(ss_taxable * SS_RATE_COMP, 2)
    
    # Medicare Company
    pc.medicare_company = round(pc.taxable_wages * MEDICARE_RATE_COMP, 2)
    
    # FUTA - 0.6% on first $7,000
    futa_remaining = max(0, FUTA_WAGE_BASE - ytd.futa_wages_ytd)
    futa_taxable = min(pc.taxable_wages, futa_remaining)
    pc.futa = round(futa_taxable * FUTA_RATE, 2)
    
    # CA UI
    ca_ui_remaining = max(0, CA_UI_WAGE_BASE - ytd.ca_ui_wages_ytd)
    ca_ui_taxable = min(pc.taxable_wages, ca_ui_remaining)
    pc.ca_ui = round(ca_ui_taxable * ca_ui_rate, 2)
    
    # CA ETT - 0.1%
    pc.ca_ett = round(ca_ui_taxable * CA_ETT_RATE, 2)
    
    # Total Company Taxes
    pc.total_company_taxes = round(
        pc.ss_company + pc.medicare_company + pc.futa + pc.ca_ui + pc.ca_ett, 2
    )
    
    return pc


def calculate_payroll_qb(report: Dict, ca_ui_rate: float = DEFAULT_CA_UI_RATE) -> Dict:
    paychecks = []
    ytd = YTDTracker()
    
    for emp in report.get('employees', []):
        regular_hours = emp.get('regular_hours', 0) or 0
        ot_hours = emp.get('ot_hours', 0) or 0
        total_hours = regular_hours + ot_hours
        hourly_rate = emp.get('rate_reg', 15.0) or 15.0
        
        # Support multiple tip formats:
        # 1. tips dict with BCH/Kitchen keys (from structured source)
        # 2. server_tips + cash_tips fields (from CSV calculator)
        # 3. pool_tips field
        tips_dict = emp.get('tips', {})
        if tips_dict and isinstance(tips_dict, dict):
            # Structured format: BCH, Kitchen, Bartender, Sushi Chef
            tips_bch = tips_dict.get('BCH', 0) or 0
            tips_kitchen = tips_dict.get('Kitchen', 0) or 0
        elif emp.get('server_tips') or emp.get('cash_tips') or emp.get('pool_tips'):
            # CSV calculator format: server_tips = tips from orders (BCH area)
            # cash_tips = cash tips reported on timesheet
            # pool_tips = distributed pool tips
            # Default: server_tips go to BCH, cash_tips stay as-is (reported separately)
            server_tips = emp.get('server_tips', 0) or 0
            cash_tips = emp.get('cash_tips', 0) or 0
            pool_tips = emp.get('pool_tips', 0) or 0
            
            # Server tips from order details → BCH (front of house)
            tips_bch = server_tips
            # Kitchen tips = 0 (not tracked separately in current CSV flow)
            tips_kitchen = 0
            # Total tip for display
            total_tips_display = server_tips + cash_tips + pool_tips
        else:
            tips_bch = 0
            tips_kitchen = 0
            total_tips_display = 0
        
        pc = calculate_paycheck(
            name=emp.get('name', ''),
            hourly_rate=hourly_rate,
            hours=total_hours,
            tips_bch=tips_bch,
            tips_kitchen=tips_kitchen,
            federal_withholding=0.0,
            ca_income_tax=0.0,
            ca_ui_rate=ca_ui_rate,
            ytd=ytd
        )
        
        # Add server/cash/pool tips for display
        server_tips = emp.get('server_tips', 0) or 0
        cash_tips = emp.get('cash_tips', 0) or 0
        pool_tips = emp.get('pool_tips', 0) or 0
        
        paychecks.append({
            'name': pc.name,
            'hourly_rate': pc.hourly_rate,
            'hours': pc.hours,
            'hourly_wage': pc.hourly_wage,
            'tips_bch': pc.tips_bch,
            'tips_kitchen': pc.tips_kitchen,
            'total_tips': pc.total_tips,
            'gross_wages': pc.gross_wages,
            'taxable_wages': pc.taxable_wages,
            'ss_employee': pc.ss_employee,
            'medicare_employee': pc.medicare_employee,
            'additional_medicare': pc.additional_medicare,
            'ca_sdi': pc.ca_sdi,
            'federal_withholding': pc.federal_withholding,
            'ca_income_tax': pc.ca_income_tax,
            'total_employee_taxes': pc.total_employee_taxes,
            'check_amount': pc.check_amount,
            'ss_company': pc.ss_company,
            'medicare_company': pc.medicare_company,
            'futa': pc.futa,
            'ca_ui': pc.ca_ui,
            'ca_ett': pc.ca_ett,
            'total_company_taxes': pc.total_company_taxes,
            # Additional fields from CSV
            'server_tips': server_tips,
            'cash_tips': cash_tips,
            'pool_tips': pool_tips,
        })
        
        # Update YTD
        ytd.ss_wages_ytd += pc.taxable_wages
        ytd.medicare_wages_ytd += pc.taxable_wages
        ytd.futa_wages_ytd += pc.taxable_wages
        ytd.ca_ui_wages_ytd += pc.taxable_wages
    
    total_check = sum(p['check_amount'] for p in paychecks)
    total_taxable = sum(p['taxable_wages'] for p in paychecks)
    total_company = sum(p['total_company_taxes'] for p in paychecks)
    
    return {
        'paychecks': paychecks,
        'totals': {
            'total_employees': len(paychecks),
            'total_taxable': round(total_taxable, 2),
            'total_check': round(total_check, 2),
            'total_company_taxes': round(total_company, 2),
            'total_employer_cost': round(total_taxable + total_company, 2),
        },
        'tax_rates': {
            'ss': {'rate': 0.062, 'wage_base': 184500},
            'medicare': {'rate': 0.0145, 'additional_rate': 0.009, 'threshold': 200000},
            'futa': {'rate': 0.006, 'wage_base': 7000},
            'ca_sdi': {'rate': 0.013},
            'ca_ui': {'rate': ca_ui_rate, 'wage_base': 7000},
            'ca_ett': {'rate': 0.001, 'wage_base': 7000},
        }
    }


def save_qb_report(qb_report: Dict, output_dir: str = "d:/Project/Master/Raw/payroll/output"):
    os.makedirs(output_dir, exist_ok=True)
    
    json_path = os.path.join(output_dir, "qb_payroll_report.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(qb_report, f, ensure_ascii=False, indent=2)
    print(f"Saved: {json_path}")
    
    csv_path = os.path.join(output_dir, "qb_payroll_report.csv")
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Name', 'Hours', 'Hourly Wage', 'Tips BCH', 'Tips Kitchen', 'Total Taxable Tips',
            'Cash Tips', 'Pool Tips', 'Server Tips',
            'Taxable Wages', 'SS Emp', 'Medicare Emp', 'CA SDI', 'Check Amount',
            'SS Co', 'Medicare Co', 'FUTA', 'CA UI', 'CA ETT', 'Total Co Tax'
        ])
        for p in qb_report['paychecks']:
            writer.writerow([
                p['name'], round(p['hours'], 2), p['hourly_wage'], p['tips_bch'], p['tips_kitchen'],
                p['total_tips'], p.get('cash_tips', 0), p.get('pool_tips', 0), p.get('server_tips', 0),
                p['taxable_wages'], p['ss_employee'], p['medicare_employee'],
                p['ca_sdi'], p['check_amount'], p['ss_company'], p['medicare_company'],
                p['futa'], p['ca_ui'], p['ca_ett'], p['total_company_taxes']
            ])
    print(f"Saved: {csv_path}")
    
    t = qb_report['totals']
    print(f"\nTotal Employees: {t['total_employees']}")
    print(f"Total Taxable Wages: ${t['total_taxable']:,.2f}")
    print(f"CHECK AMOUNT (net pay): ${t['total_check']:,.2f}")
    print(f"Company Taxes: ${t['total_company_taxes']:,.2f}")
    print(f"TOTAL EMPLOYER COST: ${t['total_employer_cost']:,.2f}")


if __name__ == '__main__':
    # Test Aidan Stone
    pc = calculate_paycheck(
        name='Aidan Stone',
        hourly_rate=16.90,
        hours=11.3667,
        tips_bch=32.67,
        tips_kitchen=33.77,
        ca_ui_rate=0.022
    )
    
    print("Test: Aidan Stone")
    print(f"Hourly wage: ${pc.hourly_wage:.2f} (expected: $192.10)")
    print(f"Tips: ${pc.total_tips:.2f} (expected: $66.44)")
    print(f"Taxable wages: ${pc.taxable_wages:.2f} (expected: $258.54)")
    print(f"SS Employee: ${pc.ss_employee:.2f} (expected: $16.03)")
    print(f"Medicare: ${pc.medicare_employee:.2f} (expected: $3.75)")
    print(f"CA SDI: ${pc.ca_sdi:.2f} (expected: $3.36)")
    print(f"Check: ${pc.check_amount:.2f} (expected: $235.40)")
