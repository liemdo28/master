"""
Run QB-style payroll calculation
"""
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.qb_tax_calculator import calculate_paycheck, calculate_payroll_qb, save_qb_report

def main():
    # Load existing report
    report_path = "d:/Project/Master/Raw/payroll/output/csv_payroll_report.json"
    if not os.path.exists(report_path):
        print(f"ERROR: Report not found: {report_path}")
        print("Please run run_csv_payroll.py first.")
        return
    
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    # Calculate QB-style paycheck for all employees
    qb_report = calculate_payroll_qb(report)
    
    # Save
    save_qb_report(qb_report)
    
    # Print Aidan Stone example
    pc = calculate_paycheck(
        name="Aidan Stone",
        hourly_rate=16.90,
        hours=11.3667,
        tips_bch=32.67,
        tips_kitchen=33.77,
        federal_withholding=0.0,
        ca_income_tax=0.0,
        ca_ui_rate=0.022
    )
    
    print("\n" + "=" * 60)
    print("VALIDATION TEST: Aidan Stone (from spec)")
    print("=" * 60)
    print(f"Hourly wage: ${pc.hourly_wage:.2f} (expected: $192.10)")
    print(f"Tips: ${pc.total_tips:.2f}")
    print(f"Taxable wages: ${pc.taxable_wages:.2f} (expected: $258.54)")
    print(f"SS Employee: ${pc.ss_employee:.2f} (expected: $16.03)")
    print(f"Medicare: ${pc.medicare_employee:.2f} (expected: $3.75)")
    print(f"CA SDI: ${pc.ca_sdi:.2f} (expected: $3.36)")
    print(f"Check Amount: ${pc.check_amount:.2f} (expected: $235.40)")
    print(f"SS Company: ${pc.ss_company:.2f} (expected: $16.03)")
    print(f"Medicare Company: ${pc.medicare_company:.2f} (expected: $3.75)")
    print(f"FUTA: ${pc.futa:.2f} (expected: $1.55)")
    print(f"CA UI: ${pc.ca_ui:.2f} (expected: $5.69)")
    print(f"CA ETT: ${pc.ca_ett:.2f} (expected: $0.26)")

if __name__ == '__main__':
    main()