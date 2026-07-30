"""
Run Full Payroll Pipeline
Executes all 3 steps in sequence with summary report
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.csv_calculator import CSVPayrollCalculator
from src.qb_tax_calculator import calculate_payroll_qb, save_qb_report
from src.paycheck_generator import generate_paycheck_csv, generate_full_payroll_summary

def main():
    print("=" * 70)
    print("PAYROLL PIPELINE - Raw Sushi Bistro")
    print("=" * 70)
    
    # Configuration
    base_path = r"d:\Project\Master\Raw\documnet"
    timesheet_path = os.path.join(base_path, "Raw Sushi Bistro_2026-06-08_2026-06-21_timesheets.csv")
    order_details_path = os.path.join(base_path, "OrderDetails_2026_06_08-2026_06_21.csv")
    output_dir = "d:/Project/Master/Raw/payroll/output"
    
    # Step 1: CSV Calculator
    print("\n[STEP 1/3] CSV Calculator")
    print("-" * 40)
    
    if not os.path.exists(timesheet_path):
        print(f"ERROR: Timesheet not found: {timesheet_path}")
        return
    
    calc = CSVPayrollCalculator()
    
    if os.path.exists(order_details_path):
        calc.calculate(timesheet_path, order_details_path)
    else:
        calc.timesheet_entries = calc.parse_timesheet(timesheet_path)
        employee_hours = calc.aggregate_hours_by_employee()
        calc.employee_payrolls = {}
        from src.csv_calculator import EmployeePayroll
        for name, hours_data in employee_hours.items():
            rate_reg, rate_ot, has_calsaver, calsaver_rate = calc.get_employee_rate(name, hours_data['role'])
            payroll = EmployeePayroll(
                name=name, role=hours_data['role'],
                total_hours=hours_data['total'], regular_hours=hours_data['regular'], ot_hours=hours_data['ot'],
                rate_reg=rate_reg, rate_ot=rate_ot, has_calsaver=has_calsaver, calsaver_rate=calsaver_rate,
                cash_tips=hours_data['cash_tips']
            )
            payroll.calculate()
            calc.employee_payrolls[name] = payroll
    
    csv_report = calc.save_report(output_dir)
    
    # Step 2: QB Tax Calculator
    print("\n[STEP 2/3] QB Tax Calculator")
    print("-" * 40)
    
    csv_report_path = os.path.join(output_dir, "csv_payroll_report.json")
    if os.path.exists(csv_report_path):
        import json
        with open(csv_report_path, 'r', encoding='utf-8') as f:
            report_data = json.load(f)
        
        qb_report = calculate_payroll_qb(report_data)
        save_qb_report(qb_report, output_dir)
    
    # Step 3: Paycheck Generator
    print("\n[STEP 3/3] Paycheck Generator")
    print("-" * 40)
    
    generate_paycheck_csv(
        csv_report_path=csv_report_path,
        output_path=os.path.join(output_dir, "paycheck.csv")
    )
    
    # Full Summary
    print("\n" + "=" * 70)
    print("PAYROLL COMPLETE")
    print("=" * 70)
    
    try:
        generate_full_payroll_summary(csv_report_path, os.path.join(output_dir, "qb_payroll_report.json"))
    except FileNotFoundError:
        pass
    
    print("\nOutput files:")
    print(f"  - {os.path.join(output_dir, 'csv_payroll_report.csv')}")
    print(f"  - {os.path.join(output_dir, 'qb_payroll_report.csv')}")
    print(f"  - {os.path.join(output_dir, 'paycheck.csv')}")

if __name__ == '__main__':
    main()
    
    # Auto-add to history
    try:
        from src.payroll_history import add_current_to_history
        print("\n" + "=" * 60)
        print("ADDING TO HISTORY")
        print("=" * 60)
        add_current_to_history()
    except Exception as e:
        print(f"Note: Could not add to history: {e}")
