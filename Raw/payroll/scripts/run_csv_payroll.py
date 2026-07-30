"""
Run CSV-based payroll calculation
Usage: python run_csv_payroll.py [timesheet_csv] [order_details_csv]
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.csv_calculator import CSVPayrollCalculator

def main():
    # Default paths (existing files in documnet folder)
    base_path = r"d:\Project\Master\Raw\documnet"
    
    timesheet_path = os.path.join(base_path, "Raw Sushi Bistro_2026-06-08_2026-06-21_timesheets.csv")
    order_details_path = os.path.join(base_path, "OrderDetails_2026_06_08-2026_06_21.csv")
    
    # Allow override via command line
    if len(sys.argv) >= 2:
        timesheet_path = sys.argv[1]
    if len(sys.argv) >= 3:
        order_details_path = sys.argv[2]
    
    print("=" * 60)
    print("CSV-BASED PAYROLL CALCULATOR")
    print("=" * 60)
    print(f"Timesheet: {timesheet_path}")
    print(f"Order Details: {order_details_path}")
    print("=" * 60)
    
    if not os.path.exists(timesheet_path):
        print(f"ERROR: Timesheet file not found: {timesheet_path}")
        print("Please provide the timesheet CSV file path.")
        return
    
    if not os.path.exists(order_details_path):
        print(f"WARNING: Order details file not found: {order_details_path}")
        print("Will calculate without tip data.")
        order_details_path = None
    
    # Initialize calculator
    calc = CSVPayrollCalculator()
    
    # Run calculation
    if order_details_path:
        calc.calculate(timesheet_path, order_details_path)
    else:
        # Calculate with just timesheet
        calc.timesheet_entries = calc.parse_timesheet(timesheet_path)
        employee_hours = calc.aggregate_hours_by_employee()
        calc.employee_payrolls = {}
        for name, hours_data in employee_hours.items():
            rate_reg, rate_ot, has_calsaver, calsaver_rate = calc.get_employee_rate(name, hours_data['role'])
            from src.csv_calculator import EmployeePayroll
            payroll = EmployeePayroll(
                name=name, role=hours_data['role'],
                total_hours=hours_data['total'], regular_hours=hours_data['regular'], ot_hours=hours_data['ot'],
                rate_reg=rate_reg, rate_ot=rate_ot, has_calsaver=has_calsaver, calsaver_rate=calsaver_rate,
                cash_tips=hours_data['cash_tips']
            )
            payroll.calculate()
            calc.employee_payrolls[name] = payroll
    
    # Save report
    calc.save_report()
    
    print("\nDone! Check output folder for reports.")

if __name__ == '__main__':
    main()
