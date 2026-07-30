"""
Paycheck CSV Generator
Output format matches Sheet Supper - the manual entry template used by David
"""
import os
import csv
import json
from datetime import datetime

def generate_paycheck_csv(
    csv_report_path: str = "d:/Project/Master/Raw/payroll/output/csv_payroll_report.json",
    output_path: str = "d:/Project/Master/Raw/payroll/output/paycheck.csv"
):
    """Generate paycheck CSV in Sheet Supper format"""
    
    # Load CSV report
    if not os.path.exists(csv_report_path):
        print(f"No report found: {csv_report_path}")
        return
    
    with open(csv_report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    # Sheet Supper format:
    # Name | Regular 2026 | OT | Mannual Calculation Sum of Total | BCH | Kitchen | Bartender | Sushi Chef | (blank) | Check
    rows = [
        ["Name", "Regular 2026", "OT", "Mannual Calculation Sum of Total", 
         "BCH", "Kitchen", "Bartender", "Sushi Chef", "", ""]
    ]
    
    for emp in report.get('employees', []):
        name = emp.get('name', '')
        regular = emp.get('regular_hours', 0) or 0
        ot = emp.get('ot_hours', 0) or 0
        
        # Get all tip types
        cash_tips = emp.get('cash_tips', 0) or 0
        server_tips = emp.get('server_tips', 0) or 0
        pool_tips = emp.get('pool_tips', 0) or 0
        
        # Tips dict format (from structured source)
        tips_dict = emp.get('tips', {})
        # Check if tips dict has actual data (not just empty {})
        has_tips_data = tips_dict and isinstance(tips_dict, dict) and any(tips_dict.values())
        
        if has_tips_data:
            bch_tips = tips_dict.get('BCH', 0) or 0
            kitchen_tips = tips_dict.get('Kitchen', 0) or 0
            bartender_tips = tips_dict.get('Bartender', 0) or 0
            sushi_tips = tips_dict.get('Sushi Chef', 0) or 0
        else:
            # From CSV calculator: server tips = BCH (FOH)
            # Pool tips stay as-is, cash tips reported separately
            bch_tips = server_tips
            kitchen_tips = 0
            bartender_tips = pool_tips  # Pool distributed to bartenders
            sushi_tips = 0
        
        # Mannual calculation = sum of all tips
        mannual = bch_tips + kitchen_tips + bartender_tips + sushi_tips
        
        # Format values
        regular_str = f"{regular:.2f}" if regular > 0 else "0.00"
        ot_str = f"{ot:.2f}" if ot > 0 else "0"
        
        # Format money values - only if > 0
        mannual_str = f"${mannual:.2f}" if mannual > 0 else ""
        bch_str = f"${bch_tips:.2f}" if bch_tips > 0 else ""
        kitchen_str = f"${kitchen_tips:.2f}" if kitchen_tips > 0 else ""
        bartender_str = f"${bartender_tips:.2f}" if bartender_tips > 0 else ""
        sushi_str = f"${sushi_tips:.2f}" if sushi_tips > 0 else ""
        
        row = [
            name,
            regular_str,
            ot_str,
            mannual_str,
            bch_str,
            kitchen_str,
            bartender_str,
            sushi_str,
            "",
            "x"  # Checked by default
        ]
        rows.append(row)
    
    # Write CSV
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"Paycheck CSV saved to: {output_path}")
    print(f"Total employees: {len(rows) - 1}")
    
    # Summary
    total_regular = sum(float(r[1]) for r in rows[1:])
    total_ot = sum(float(r[2]) if r[2] and r[2] != "0" else 0 for r in rows[1:])
    total_bch = sum(
        float(r[4].replace('$','').replace(',','')) 
        for r in rows[1:] if r[4]
    )
    print(f"\nSummary:")
    print(f"  Total Regular Hours: {total_regular:.2f}")
    print(f"  Total OT Hours: {total_ot:.2f}")
    print(f"  Total BCH Tips: ${total_bch:.2f}")
    
    return output_path


def generate_full_payroll_summary(
    csv_report_path: str = "d:/Project/Master/Raw/payroll/output/csv_payroll_report.json",
    qb_report_path: str = "d:/Project/Master/Raw/payroll/output/qb_payroll_report.json"
):
    """Generate full payroll summary comparing CSV and QB reports"""
    
    with open(csv_report_path, 'r', encoding='utf-8') as f:
        csv_report = json.load(f)
    
    with open(qb_report_path, 'r', encoding='utf-8') as f:
        qb_report = json.load(f)
    
    print("\n" + "=" * 70)
    print("PAYROLL SUMMARY - Period: " + csv_report.get('period', 'N/A'))
    print("=" * 70)
    
    print("\n[CSV CALCULATOR - Employee Take Home]")
    csv_totals = csv_report.get('totals', {})
    print(f"  Total Regular Pay:   ${csv_totals.get('total_regular_pay', 0):>12,.2f}")
    print(f"  Total OT Pay:       ${csv_totals.get('total_ot_pay', 0):>12,.2f}")
    print(f"  Total Tips:         ${csv_totals.get('total_tips', 0):>12,.2f}")
    print(f"  Total CalSaver:    -${csv_totals.get('total_calsaver', 0):>12,.2f}")
    print(f"  NET PAY (employees):${csv_totals.get('total_payroll', 0):>12,.2f}")
    
    print("\n[QB TAX CALCULATOR - Withholding Breakdown]")
    qb_totals = qb_report.get('totals', {})
    print(f"  Taxable Wages:      ${qb_totals.get('total_taxable', 0):>12,.2f}")
    print(f"  CHECK AMOUNT:       ${qb_totals.get('total_check', 0):>12,.2f} (net to employees)")
    print(f"  Company Taxes:      ${qb_totals.get('total_company_taxes', 0):>12,.2f}")
    print(f"  TOTAL EMPLOYER:    ${qb_totals.get('total_employer_cost', 0):>12,.2f}")
    
    # Difference explanation
    csv_net = csv_totals.get('total_payroll', 0)
    qb_check = qb_totals.get('total_check', 0)
    diff = csv_net - qb_check
    
    print("\n[RECONCILIATION]")
    print(f"  CSV Net Pay:       ${csv_net:>12,.2f}")
    print(f"  QB Check Amount:   ${qb_check:>12,.2f}")
    print(f"  Difference:        ${diff:>12,.2f}")
    
    if abs(diff) > 1:
        print(f"\n  NOTE: Difference due to:")
        print(f"    - QB includes: SS, Medicare, CA SDI withholding")
        print(f"    - CSV includes: CalSaver deductions")
        print(f"    - QB also has employer-side taxes in total")
    
    print("\n" + "=" * 70)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)


if __name__ == '__main__':
    # Generate paycheck CSV
    generate_paycheck_csv()
    
    # Generate full summary
    try:
        generate_full_payroll_summary()
    except FileNotFoundError as e:
        print(f"QB report not found: {e}")
        print("Run run_qb_payroll.py first to generate QB report.")
