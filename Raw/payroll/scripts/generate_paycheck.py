"""
Generate Paycheck CSV in Sheet Supper format
"""
import sys
import os
import csv
import json

def generate_paycheck():
    # Load report
    report_path = "d:/Project/Master/Raw/payroll/output/csv_payroll_report.json"
    if not os.path.exists(report_path):
        print("No report found. Run run_csv_payroll.py first.")
        return
    
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    # Sheet Supper format
    rows = [
        ["Name", "Regular 2026", "OT", "Mannual Calculation Sum of Total", 
         "BCH", "Kitchen", "Bartender", "Sushi Chef", "", ""]
    ]
    
    for emp in report['employees']:
        name = emp['name']
        regular = emp.get('regular_hours', 0) or 0
        ot = emp.get('ot_hours', 0) or 0
        
        tips = emp.get('tips', {})
        bch = tips.get('BCH', 0) or 0
        kitchen = tips.get('Kitchen', 0) or 0
        bartender = tips.get('Bartender', 0) or 0
        sushi = tips.get('Sushi Chef', 0) or 0
        
        mannual = bch + kitchen + bartender + sushi
        
        row = [
            name,
            f"{regular:.2f}" if regular > 0 else "0.00",
            f"{ot:.2f}" if ot > 0 else "0",
            f"${mannual:.2f}" if mannual > 0 else "",
            f"${bch:.2f}" if bch > 0 else "",
            f"${kitchen:.2f}" if kitchen > 0 else "",
            f"${bartender:.2f}" if bartender > 0 else "",
            f"${sushi:.2f}" if sushi > 0 else "",
            "",
            "x"
        ]
        rows.append(row)
    
    output_path = "d:/Project/Master/Raw/payroll/output/paycheck.csv"
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"Paycheck CSV saved to: {output_path}")
    print(f"Total employees: {len(rows) - 1}")

if __name__ == '__main__':
    generate_paycheck()
