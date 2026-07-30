"""
Payroll Calculator - Core calculation logic
"""
import json
import os
from typing import Dict, List, Optional
from src.models import EmployeeRate, PayrollEntry, PayrollReport
from src.config import DEFAULT_RATE_REG, DEFAULT_RATE_OT, DEFAULT_CALSAVER_RATE

class PayrollCalculator:
    """Main payroll calculation class"""
    
    def __init__(self, data_dir: str = "d:/Project/Master/Raw/payroll/data"):
        self.data_dir = data_dir
        self.employee_rates: Dict[str, EmployeeRate] = {}
        self.payroll_data: List[List[str]] = []
        
    def load_rates(self) -> Dict[str, EmployeeRate]:
        """Load employee rates from rate_of_emp.json"""
        rate_file = os.path.join(self.data_dir, "rate_of_emp.json")
        
        if not os.path.exists(rate_file):
            print(f"Warning: {rate_file} not found")
            return {}
        
        with open(rate_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Skip header row
        for row in data[1:]:
            if len(row) >= 5 and row[0]:  # Has name
                name = row[0].strip()
                if name:
                    rate = EmployeeRate(
                        name=name,
                        has_calsaver=row[1].strip().lower() == 'y' if row[1] else False,
                        calsaver_rate=float(row[2].replace('%', '')) / 100 if row[2] and '%' in row[2] else 0.0,
                        rate_reg=float(row[3]) if row[3] else DEFAULT_RATE_REG,
                        rate_ot=float(row[4]) if row[4] else DEFAULT_RATE_OT
                    )
                    self.employee_rates[name] = rate
        
        print(f"Loaded {len(self.employee_rates)} employee rates")
        return self.employee_rates
    
    def load_payroll_data(self) -> List[List[str]]:
        """Load payroll data from payroll_range.json"""
        payroll_file = os.path.join(self.data_dir, "payroll_range.json")
        
        if not os.path.exists(payroll_file):
            print(f"Warning: {payroll_file} not found")
            return []
        
        with open(payroll_file, 'r', encoding='utf-8') as f:
            self.payroll_data = json.load(f)
        
        print(f"Loaded {len(self.payroll_data)} payroll rows")
        return self.payroll_data
    
    def parse_money(self, value: str) -> float:
        """Parse money string to float"""
        if not value:
            return 0.0
        # Remove $ and commas
        cleaned = value.replace('$', '').replace(',', '').strip()
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    def parse_hours(self, value: str) -> float:
        """Parse hours string to float"""
        if not value:
            return 0.0
        try:
            return float(value)
        except ValueError:
            return 0.0
    
    def get_rate(self, name: str) -> EmployeeRate:
        """Get employee rate by name, with fallback to defaults"""
        name_lower = name.lower().strip()
        
        # Try exact match first
        if name in self.employee_rates:
            return self.employee_rates[name]
        
        # Try case-insensitive match
        for emp_name, rate in self.employee_rates.items():
            if emp_name.lower().strip() == name_lower:
                return rate
        
        # Return default rate
        return EmployeeRate(
            name=name,
            has_calsaver=False,
            calsaver_rate=DEFAULT_CALSAVER_RATE,
            rate_reg=DEFAULT_RATE_REG,
            rate_ot=DEFAULT_RATE_OT
        )
    
    def calculate_payroll(self) -> PayrollReport:
        """Calculate payroll from loaded data"""
        if not self.payroll_data:
            self.load_payroll_data()
        
        if not self.employee_rates:
            self.load_rates()
        
        report = PayrollReport()
        entries: List[PayrollEntry] = []
        
        # Skip header row (index 0)
        for row in self.payroll_data[1:]:
            if len(row) < 14:
                continue
            
            # Extract basic info
            search_name = row[0].strip() if row[0] else ""
            name = row[1].strip() if row[1] else row[0].strip() if row[0] else ""
            
            # Skip empty rows
            if not name:
                continue
            
            # Parse hours
            total_hours = self.parse_hours(row[3]) if len(row) > 3 else 0.0
            regular_hours = self.parse_hours(row[4]) if len(row) > 4 else total_hours
            ot_hours = self.parse_hours(row[5]) if len(row) > 5 else 0.0
            
            # Skip employees with 0 hours and 0 tips
            if total_hours == 0 and all(self.parse_money(row[i]) == 0 for i in [9, 10, 11, 12, 13]):
                continue
            
            # Get rate
            rate = self.get_rate(name)
            
            # Create entry
            entry = PayrollEntry(
                name=name,
                search_name=search_name,
                total_hours=total_hours,
                regular_hours=regular_hours,
                ot_hours=ot_hours,
                rate_reg=rate.rate_reg,
                rate_ot=rate.rate_ot,
                has_calsaver=rate.has_calsaver,
                calsaver_rate=rate.calsaver_rate,
                pool_tip_qb=self.parse_money(row[9]) if len(row) > 9 else 0.0,
                cash_tip=self.parse_money(row[10]) if len(row) > 10 else 0.0,
                tip_bch=self.parse_money(row[12]) if len(row) > 12 else 0.0,
                tip_kitchen=self.parse_money(row[13]) if len(row) > 13 else 0.0,
                tip_bartender=self.parse_money(row[14]) if len(row) > 14 else 0.0,
                tip_sushi_chef=self.parse_money(row[15]) if len(row) > 15 else 0.0
            )
            
            # Calculate
            entry.calculate()
            entries.append(entry)
        
        report.employees = entries
        report.calculate_totals()
        
        print(f"Calculated payroll for {len(entries)} employees")
        print(f"Total payroll: ${report.total_payroll:,.2f}")
        
        return report
    
    def save_report(self, report: PayrollReport, output_file: str):
        """Save report to JSON file"""
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        print(f"Report saved to {output_file}")
    
    def generate_summary(self, report: PayrollReport) -> str:
        """Generate text summary of payroll"""
        lines = [
            "=" * 60,
            "PAYROLL SUMMARY",
            "=" * 60,
            f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Period: {report.period or 'N/A'}",
            "",
            f"Total Employees: {len(report.employees)}",
            "-" * 40,
            f"Total Regular Pay:  ${report.total_regular_pay:>12,.2f}",
            f"Total OT Pay:        ${report.total_ot_pay:>12,.2f}",
            f"Total Tips:          ${report.total_tips:>12,.2f}",
            f"Total CalSaver:      -${report.total_calsaver:>12,.2f}",
            "-" * 40,
            f"GRAND TOTAL:         ${report.total_payroll:>12,.2f}",
            "=" * 60,
            "",
            "EMPLOYEE DETAILS:",
            "-" * 60
        ]
        
        for emp in sorted(report.employees, key=lambda x: x.total_pay, reverse=True):
            lines.append(f"{emp.name}:")
            lines.append(f"  Hours: {emp.total_hours:.2f} (Reg: {emp.regular_hours:.2f}, OT: {emp.ot_hours:.2f})")
            lines.append(f"  Pay: ${emp.regular_pay:.2f} + ${emp.ot_pay:.2f} OT = ${emp.regular_pay + emp.ot_pay:.2f}")
            lines.append(f"  Tips: ${emp.total_tip:.2f}")
            if emp.has_calsaver:
                lines.append(f"  CalSaver: -${emp.calsaver_amount:.2f}")
            lines.append(f"  TOTAL: ${emp.total_pay:.2f}")
            lines.append("")
        
        return "\n".join(lines)
