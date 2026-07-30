"""
Main script to calculate payroll
"""
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.calculator import PayrollCalculator

def main():
    print("=" * 60)
    print("PAYROLL CALCULATOR")
    print("=" * 60)
    
    # Initialize calculator
    calculator = PayrollCalculator()
    
    # Load rates
    print("\n1. Loading employee rates...")
    calculator.load_rates()
    
    # Load payroll data
    print("\n2. Loading payroll data...")
    calculator.load_payroll_data()
    
    # Calculate payroll
    print("\n3. Calculating payroll...")
    report = calculator.calculate_payroll()
    
    # Set period (could be parsed from sheet name)
    report.period = datetime.now().strftime("%Y-%m")
    
    # Generate summary
    print("\n" + calculator.generate_summary(report))
    
    # Save report
    output_file = "d:/Project/Master/Raw/payroll/output/payroll_report.json"
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    calculator.save_report(report, output_file)
    
    # Save CSV for easy viewing
    csv_file = "d:/Project/Master/Raw/payroll/output/payroll_report.csv"
    with open(csv_file, 'w', encoding='utf-8') as f:
        f.write("Name,Total Hours,Regular Hours,OT Hours,Rate Reg,Rate OT,Regular Pay,OT Pay,Total Tip,Calsaver,Total Pay\n")
        for emp in report.employees:
            f.write(f"{emp.name},{emp.total_hours},{emp.regular_hours},{emp.ot_hours},")
            f.write(f"{emp.rate_reg},{emp.rate_ot},{emp.regular_pay},{emp.ot_pay},")
            f.write(f"{emp.total_tip},{emp.calsaver_amount},{emp.total_pay}\n")
    print(f"CSV saved to {csv_file}")
    
    print("\nDone!")

if __name__ == '__main__':
    main()
