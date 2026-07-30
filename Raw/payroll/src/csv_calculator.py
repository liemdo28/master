"""
CSV-based Payroll Calculator
Uses only 2 CSV files: timesheet and order details
"""
import os
import csv
import json
from typing import Dict, List, Tuple
from dataclasses import dataclass
from datetime import datetime
from collections import defaultdict

# Load rates from config file
def _load_rates():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'rate_config.json')
    if os.path.exists(config_path):
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return config.get('employees', {}), config.get('role_defaults', {}), config
    return {}, {}, {}

EMPLOYEE_RATES_CONFIG, ROLE_DEFAULTS_CONFIG, RATE_CONFIG = _load_rates()

# Min rate for 2026
MIN_RATE_REG = RATE_CONFIG.get('min_rate_reg', 16.9)
OT_MULTIPLIER = RATE_CONFIG.get('ot_multiplier', 1.5)

DEFAULT_RATES = {
    'Server': {'reg': 15.0, 'ot': 22.5},
    'Busser': {'reg': 15.0, 'ot': 22.5},
    'Dishwasher': {'reg': 15.0, 'ot': 22.5},
    'Line Cook': {'reg': 15.0, 'ot': 22.5},
    'Fryer': {'reg': 15.0, 'ot': 22.5},
    'Line Prep': {'reg': 15.0, 'ot': 22.5},
    'Sushi': {'reg': 16.0, 'ot': 24.0},
    'Bartender': {'reg': 15.0, 'ot': 22.5},
    'Cashier': {'reg': 15.0, 'ot': 22.5},
    'Floater': {'reg': 15.0, 'ot': 22.5},
}

# Fallback hardcoded rates (if config not found)
EMPLOYEE_RATES = {
    'Alyssa Pham': {'reg': 16.5, 'ot': 24.75, 'calsaver': True, 'calsaver_rate': 0.05},
    'Brianna Udermann': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Carolina': {'reg': 0.0, 'ot': 0.0, 'calsaver': False},
    'Ceasar Trevino': {'reg': 16.5, 'ot': 24.75, 'calsaver': True, 'calsaver_rate': 0.05},
    'Christian': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Correy Cavender': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'David Nguyen': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Denny Nguyen': {'reg': 17.0, 'ot': 25.5, 'calsaver': True, 'calsaver_rate': 0.05},
    'Huy Nguyen': {'reg': 16.0, 'ot': 24.0, 'calsaver': True, 'calsaver_rate': 0.05},
    'Jhianna Nunez': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Joey': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Juan Rauda': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Keyana Gross': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Ma Qida': {'reg': 15.75, 'ot': 23.625, 'calsaver': False},
    'mei wang': {'reg': 17.25, 'ot': 25.875, 'calsaver': True, 'calsaver_rate': 0.05},
    'Nan': {'reg': 17.0, 'ot': 25.5, 'calsaver': False},
    'Phuong Nguyen': {'reg': 20.0, 'ot': 30.0, 'calsaver': True, 'calsaver_rate': 0.05},
    'Peaches': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'reyna Canton': {'reg': 17.25, 'ot': 25.875, 'calsaver': False},
    'Ryse Jaden Donato': {'reg': 15.0, 'ot': 22.5, 'calsaver': True, 'calsaver_rate': 0.05},
    'Ronn Lach': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Samuel': {'reg': 15.0, 'ot': 22.5, 'calsaver': True, 'calsaver_rate': 0.07},
    'Somalia Goodwin': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Steve': {'reg': 17.0, 'ot': 25.5, 'calsaver': False},
    'Steve Server': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Si Nguyen': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Suzanne Ornelas-Pelaez': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Marta C': {'reg': 17.0, 'ot': 25.5, 'calsaver': True, 'calsaver_rate': 0.05},
    'Marta C (Server)': {'reg': 15.5, 'ot': 23.25, 'calsaver': True, 'calsaver_rate': 0.05},
    'Ali Arevalo': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Kaly Loch': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Wendy Flores': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Yami Canton': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Jay Perez': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Wesley Wong': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Cay Nguyen': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Khiem Tran': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Kiko Yago': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Yiwen Guan': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Aidan Stone': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Ian Paige': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Stacy Vallar': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Story Vang': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
    'Lat Do': {'reg': 15.0, 'ot': 22.5, 'calsaver': False},
}

NAME_ALIASES = {
    'Ali Arevalov': 'Ali Arevalo',
    'Kanhchaly Loch': 'Kaly Loch',
    'Wendy Canton': 'Wendy Flores',
    'Yami Yamileth': 'Yami Canton',
    'Jaydyn Perez': 'Jay Perez',
    'Steve Nguyen': 'Steve',
    'Tita Server': 'Tita Romero',
}


@dataclass
class TimesheetEntry:
    name: str
    date: str
    role: str
    scheduled_hours: float
    total_paid_hours: float
    regular_hours: float
    ot_hours: float
    estimated_wages: float
    cash_tips: float


@dataclass
class OrderEntry:
    order_id: str
    server: str
    table: str
    dining_area: str
    service: str
    amount: float
    tip: float
    gratuity: float
    is_voided: bool


@dataclass
class EmployeePayroll:
    name: str
    role: str = ""
    total_hours: float = 0.0
    regular_hours: float = 0.0
    ot_hours: float = 0.0
    rate_reg: float = 15.0
    rate_ot: float = 22.5
    has_calsaver: bool = False
    calsaver_rate: float = 0.05
    cash_tips: float = 0.0
    server_tips: float = 0.0
    pool_tips: float = 0.0
    total_tips: float = 0.0
    regular_pay: float = 0.0
    ot_pay: float = 0.0
    subtotal: float = 0.0
    calsaver_amount: float = 0.0
    total_pay: float = 0.0
    
    def calculate(self):
        self.regular_pay = self.regular_hours * self.rate_reg
        self.ot_pay = self.ot_hours * self.rate_ot
        self.total_tips = self.cash_tips + self.server_tips + self.pool_tips
        self.subtotal = self.regular_pay + self.ot_pay + self.total_tips
        if self.has_calsaver:
            self.calsaver_amount = self.subtotal * self.calsaver_rate
        self.total_pay = self.subtotal - self.calsaver_amount
        return self
    
    def to_dict(self) -> Dict:
        return {
            'name': self.name, 'role': self.role,
            'total_hours': round(self.total_hours, 2), 'regular_hours': round(self.regular_hours, 2), 'ot_hours': round(self.ot_hours, 2),
            'rate_reg': self.rate_reg, 'rate_ot': self.rate_ot, 'has_calsaver': self.has_calsaver,
            'regular_pay': round(self.regular_pay, 2), 'ot_pay': round(self.ot_pay, 2),
            'cash_tips': round(self.cash_tips, 2), 'server_tips': round(self.server_tips, 2), 'pool_tips': round(self.pool_tips, 2),
            'total_tips': round(self.total_tips, 2), 'calsaver_amount': round(self.calsaver_amount, 2), 'total_pay': round(self.total_pay, 2),
        }


class CSVPayrollCalculator:
    def __init__(self):
        self.timesheet_entries: List[TimesheetEntry] = []
        self.order_entries: List[OrderEntry] = []
        self.employee_payrolls: Dict[str, EmployeePayroll] = {}
        self.period = ""
        
    def normalize_name(self, name: str) -> str:
        if not name:
            return ""
        return NAME_ALIASES.get(name.strip(), name.strip())
    
    def get_employee_rate(self, name: str, role: str) -> Tuple[float, float, bool, float]:
        # First check config file (from rate_config.json)
        if EMPLOYEE_RATES_CONFIG:
            if name in EMPLOYEE_RATES_CONFIG:
                r = EMPLOYEE_RATES_CONFIG[name]
                rate_reg = r.get('rate_reg', MIN_RATE_REG)
                # Enforce minimum rate
                rate_reg = max(rate_reg, MIN_RATE_REG)
                rate_ot = rate_reg * OT_MULTIPLIER
                return (rate_reg, rate_ot, r.get('calsaver', False), r.get('calsaver_rate', 0.05))
        
        # Fallback to hardcoded EMPLOYEE_RATES
        if name in EMPLOYEE_RATES:
            r = EMPLOYEE_RATES[name]
            return (r['reg'], r['ot'], r.get('calsaver', False), r.get('calsaver_rate', 0.05))
        first_name = name.split()[0] if name else ""
        for emp_name, rates in EMPLOYEE_RATES.items():
            if emp_name.split()[0].lower() == first_name.lower():
                return (rates['reg'], rates['ot'], rates.get('calsaver', False), rates.get('calsaver_rate', 0.05))
        
        # Default role rates (enforce minimum)
        role_rates = DEFAULT_RATES.get(role, {'reg': MIN_RATE_REG, 'ot': MIN_RATE_REG * OT_MULTIPLIER})
        rate_reg = max(role_rates['reg'], MIN_RATE_REG)
        return (rate_reg, rate_reg * OT_MULTIPLIER, False, 0.0)
    
    def _safe_float(self, val: str) -> float:
        if not val or val.strip() == '':
            return 0.0
        try:
            return float(val.replace(',', '').replace('$', '').strip())
        except ValueError:
            return 0.0
    
    def parse_timesheet(self, csv_path: str) -> List[TimesheetEntry]:
        entries = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        header_idx = -1
        for i, row in enumerate(rows):
            if row and 'Name' in row[0]:
                header_idx = i
                break
        
        if header_idx == -1:
            print(f"Warning: Could not find header row in {csv_path}")
            return entries
        
        header = rows[header_idx]
        col_map = {}
        for i, col in enumerate(header):
            col_lower = col.lower().strip()
            if 'name' in col_lower and col_map.get('name') is None: col_map['name'] = i
            elif 'role' in col_lower: col_map['role'] = i
            elif 'total paid' in col_lower: col_map['total_paid'] = i
            elif 'regular' in col_lower and col_map.get('regular') is None: col_map['regular'] = i
            elif 'ot' in col_lower and col_map.get('ot') is None: col_map['ot'] = i
            elif 'cash tip' in col_lower: col_map['cash_tip'] = i
        
        for row in rows[:5]:
            for cell in row:
                if '2026' in cell:
                    self.period = cell.strip()
                    break
        
        i = header_idx + 1
        while i < len(rows):
            row = rows[i]
            if not row or row[0] == '-' or 'Totals for' in str(row[0]) or not row[0] or row[0].strip() == '' or row[0] == 'Name' or row[0] == 'Totals':
                i += 1
                continue
            try:
                name = row[col_map.get('name', 0)]
                if not name or name.strip() == '':
                    i += 1
                    continue
                entry = TimesheetEntry(
                    name=self.normalize_name(name),
                    date="",
                    role=row[col_map.get('role', 10)].strip() if len(row) > 10 else "",
                    scheduled_hours=0.0,
                    total_paid_hours=self._safe_float(row[col_map.get('total_paid', 12)]) if len(row) > 12 else 0.0,
                    regular_hours=self._safe_float(row[col_map.get('regular', 13)]) if len(row) > 13 else 0.0,
                    ot_hours=self._safe_float(row[col_map.get('ot', 14)]) if len(row) > 14 else 0.0,
                    estimated_wages=0.0,
                    cash_tips=self._safe_float(row[col_map.get('cash_tip', 15)]) if len(row) > 15 else 0.0,
                )
                entries.append(entry)
            except (ValueError, IndexError):
                pass
            i += 1
        return entries
    
    def parse_order_details(self, csv_path: str) -> List[OrderEntry]:
        entries = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        if not rows:
            return entries
        
        header = rows[0]
        col_map = {}
        for i, col in enumerate(header):
            col_lower = col.lower().strip()
            if 'order' in col_lower and 'id' in col_lower: col_map['order_id'] = i
            elif 'server' in col_lower: col_map['server'] = i
            elif 'table' in col_lower: col_map['table'] = i
            elif 'dining' in col_lower and 'area' in col_lower: col_map['dining_area'] = i
            elif 'service' in col_lower: col_map['service'] = i
            elif 'amount' in col_lower: col_map['amount'] = i
            elif 'tip' in col_lower and 'gratuity' not in col_lower: col_map['tip'] = i
            elif 'gratuity' in col_lower: col_map['gratuity'] = i
            elif 'void' in col_lower: col_map['voided'] = i
        
        for row in rows[1:]:
            if not row or len(row) < 2:
                continue
            try:
                voided = False
                if col_map.get('voided') and len(row) > col_map['voided']:
                    voided = str(row[col_map['voided']]).lower() == 'true'
                entry = OrderEntry(
                    order_id=row[col_map.get('order_id', 0)] if len(row) > 0 else "",
                    server=self.normalize_name(row[col_map.get('server', 5)]) if len(row) > 5 else "",
                    table=row[col_map.get('table', 6)] if len(row) > 6 else "",
                    dining_area=row[col_map.get('dining_area', 9)] if len(row) > 9 else "",
                    service=row[col_map.get('service', 12)] if len(row) > 12 else "",
                    amount=self._safe_float(row[col_map.get('amount', 13)]) if len(row) > 13 else 0.0,
                    tip=self._safe_float(row[col_map.get('tip', 16)]) if len(row) > 16 else 0.0,
                    gratuity=self._safe_float(row[col_map.get('gratuity', 17)]) if len(row) > 17 else 0.0,
                    is_voided=voided,
                )
                entries.append(entry)
            except (ValueError, IndexError):
                pass
        return entries
    
    def aggregate_hours_by_employee(self) -> Dict[str, Dict]:
        employee_hours = defaultdict(lambda: {'total': 0.0, 'regular': 0.0, 'ot': 0.0, 'cash_tips': 0.0, 'role': '', 'count': 0})
        for entry in self.timesheet_entries:
            emp = employee_hours[entry.name]
            emp['total'] += entry.total_paid_hours
            emp['regular'] += entry.regular_hours
            emp['ot'] += entry.ot_hours
            emp['cash_tips'] += entry.cash_tips
            if entry.role and not emp['role']: emp['role'] = entry.role
            emp['count'] += 1
        return dict(employee_hours)
    
    def aggregate_tips_by_employee(self) -> Dict[str, Dict]:
        server_tips = defaultdict(float)
        total_tip_pool = 0.0
        for order in self.order_entries:
            if order.is_voided:
                continue
            tip_amount = order.tip + order.gratuity
            total_tip_pool += tip_amount
            if order.server and order.server.strip():
                server_tips[order.server] += tip_amount
        return {'server_tips': dict(server_tips), 'total_tip_pool': total_tip_pool}
    
    def calculate(self, timesheet_path: str, order_details_path: str) -> List[EmployeePayroll]:
        print(f"Parsing timesheet: {timesheet_path}")
        self.timesheet_entries = self.parse_timesheet(timesheet_path)
        print(f"  Found {len(self.timesheet_entries)} timesheet entries")
        
        print(f"Parsing order details: {order_details_path}")
        self.order_entries = self.parse_order_details(order_details_path)
        print(f"  Found {len(self.order_entries)} order entries")
        
        employee_hours = self.aggregate_hours_by_employee()
        print(f"  {len(employee_hours)} unique employees in timesheet")
        
        tip_data = self.aggregate_tips_by_employee()
        print(f"  Total tip pool: ${tip_data['total_tip_pool']:.2f}")
        print(f"  {len(tip_data['server_tips'])} servers with tips")
        
        self.employee_payrolls = {}
        for name, hours_data in employee_hours.items():
            rate_reg, rate_ot, has_calsaver, calsaver_rate = self.get_employee_rate(name, hours_data['role'])
            payroll = EmployeePayroll(
                name=name, role=hours_data['role'],
                total_hours=hours_data['total'], regular_hours=hours_data['regular'], ot_hours=hours_data['ot'],
                rate_reg=rate_reg, rate_ot=rate_ot, has_calsaver=has_calsaver, calsaver_rate=calsaver_rate,
                cash_tips=hours_data['cash_tips'], server_tips=tip_data['server_tips'].get(name, 0.0),
            )
            payroll.calculate()
            self.employee_payrolls[name] = payroll
        
        return list(self.employee_payrolls.values())
    
    def get_report(self) -> Dict:
        employees = sorted(self.employee_payrolls.values(), key=lambda x: x.total_pay, reverse=True)
        totals = {
            'total_regular_pay': sum(e.regular_pay for e in employees),
            'total_ot_pay': sum(e.ot_pay for e in employees),
            'total_tips': sum(e.total_tips for e in employees),
            'total_calsaver': sum(e.calsaver_amount for e in employees),
            'total_payroll': sum(e.total_pay for e in employees),
            'employee_count': len(employees),
        }
        return {
            'period': self.period, 'generated_at': datetime.now().isoformat(),
            'totals': {k: round(v, 2) for k, v in totals.items()},
            'employees': [e.to_dict() for e in employees]
        }
    
    def save_report(self, output_dir: str = "d:/Project/Master/Raw/payroll/output"):
        os.makedirs(output_dir, exist_ok=True)
        report = self.get_report()
        
        json_path = os.path.join(output_dir, "csv_payroll_report.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"Saved JSON: {json_path}")
        
        csv_path = os.path.join(output_dir, "csv_payroll_report.csv")
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Name', 'Role', 'Total Hours', 'Regular Hours', 'OT Hours', 'Rate Reg', 'Rate OT', 'Has CalSaver', 'Regular Pay', 'OT Pay', 'Cash Tips', 'Server Tips', 'Pool Tips', 'Total Tips', 'CalSaver', 'Total Pay'])
            for emp in report['employees']:
                writer.writerow([emp['name'], emp['role'], emp['total_hours'], emp['regular_hours'], emp['ot_hours'], emp['rate_reg'], emp['rate_ot'], emp['has_calsaver'], emp['regular_pay'], emp['ot_pay'], emp['cash_tips'], emp['server_tips'], emp['pool_tips'], emp['total_tips'], emp['calsaver_amount'], emp['total_pay']])
        print(f"Saved CSV: {csv_path}")
        
        print("\n" + "=" * 60)
        print("PAYROLL SUMMARY (CSV-based)")
        print("=" * 60)
        print(f"Period: {report['period']}")
        print(f"Total Employees: {report['totals']['employee_count']}")
        print(f"Total Regular Pay: ${report['totals']['total_regular_pay']:,.2f}")
        print(f"Total OT Pay: ${report['totals']['total_ot_pay']:,.2f}")
        print(f"Total Tips: ${report['totals']['total_tips']:,.2f}")
        print(f"Total CalSaver: -${report['totals']['total_calsaver']:,.2f}")
        print(f"GRAND TOTAL: ${report['totals']['total_payroll']:,.2f}")
        print("=" * 60)
        return report
