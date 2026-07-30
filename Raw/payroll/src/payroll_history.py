"""
Payroll History - Track each payroll period
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

HISTORY_FILE = "d:/Project/Master/Raw/payroll/data/payroll_history.json"

def load_history() -> Dict:
    """Load payroll history from file"""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'periods': [], 'last_updated': None}

def save_history(history: Dict):
    """Save payroll history to file"""
    history['last_updated'] = datetime.now().isoformat()
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def add_period(csv_report_path: str, qb_report_path: str, period_name: str = None) -> Dict:
    """Add a new payroll period to history"""
    history = load_history()
    
    # Load CSV report
    with open(csv_report_path, 'r', encoding='utf-8') as f:
        csv_data = json.load(f)
    
    # Load QB report if exists
    qb_data = None
    if os.path.exists(qb_report_path):
        with open(qb_report_path, 'r', encoding='utf-8') as f:
            qb_data = json.load(f)
    
    # Create period record
    period = {
        'id': len(history['periods']) + 1,
        'period_name': period_name or csv_data.get('period', f'Period {len(history["periods"]) + 1}'),
        'added_at': datetime.now().isoformat(),
        'files': {
            'csv_report': csv_report_path,
            'qb_report': qb_report_path if qb_data else None
        },
        'totals': {
            'employee_count': csv_data.get('totals', {}).get('employee_count', 0),
            'total_regular_pay': csv_data.get('totals', {}).get('total_regular_pay', 0),
            'total_ot_pay': csv_data.get('totals', {}).get('total_ot_pay', 0),
            'total_tips': csv_data.get('totals', {}).get('total_tips', 0),
            'total_calsaver': csv_data.get('totals', {}).get('total_calsaver', 0),
            'net_pay': csv_data.get('totals', {}).get('total_payroll', 0),
        },
        'qb_summary': None
    }
    
    if qb_data:
        period['qb_summary'] = {
            'taxable_wages': qb_data.get('totals', {}).get('total_taxable', 0),
            'check_amount': qb_data.get('totals', {}).get('total_check', 0),
            'company_taxes': qb_data.get('totals', {}).get('total_company_taxes', 0),
            'total_employer': qb_data.get('totals', {}).get('total_employer_cost', 0),
        }
    
    # Add to history
    history['periods'].append(period)
    save_history(history)
    
    return period

def get_history(limit: int = None) -> List[Dict]:
    """Get payroll history, optionally limited"""
    history = load_history()
    periods = history.get('periods', [])
    if limit:
        periods = periods[-limit:]
    return periods

def get_period_summary() -> Dict:
    """Get summary of all periods"""
    history = load_history()
    periods = history.get('periods', [])
    
    if not periods:
        return {
            'total_periods': 0,
            'total_payroll': 0,
            'total_employer_cost': 0,
            'average_employees': 0
        }
    
    total_payroll = sum(p.get('totals', {}).get('net_pay', 0) for p in periods)
    total_employer = sum(
        p.get('qb_summary', {}).get('total_employer', 0) 
        for p in periods 
        if p.get('qb_summary')
    )
    avg_employees = sum(p.get('totals', {}).get('employee_count', 0) for p in periods) / len(periods)
    
    return {
        'total_periods': len(periods),
        'total_payroll': round(total_payroll, 2),
        'total_employer_cost': round(total_employer, 2),
        'average_employees': round(avg_employees, 1),
        'last_updated': history.get('last_updated')
    }

def print_history():
    """Print payroll history summary"""
    history = load_history()
    periods = history.get('periods', [])
    
    print("\n" + "=" * 80)
    print("PAYROLL HISTORY")
    print("=" * 80)
    
    if not periods:
        print("No payroll periods recorded yet.")
        return
    
    summary = get_period_summary()
    print(f"\nSummary: {summary['total_periods']} periods")
    print(f"Total Payroll: ${summary['total_payroll']:,.2f}")
    print(f"Total Employer Cost: ${summary['total_employer_cost']:,.2f}")
    print(f"Average Employees: {summary['average_employees']}")
    
    print("\n" + "-" * 80)
    print(f"{'#':<3} {'Period':<25} {'Employees':>10} {'Net Pay':>12} {'Employer':>12}")
    print("-" * 80)
    
    for p in periods:
        period_name = p.get('period_name', 'N/A')[:24]
        employees = p.get('totals', {}).get('employee_count', 0)
        net_pay = p.get('totals', {}).get('net_pay', 0)
        employer = p.get('qb_summary', {}).get('total_employer', 0) if p.get('qb_summary') else 0
        print(f"{p['id']:<3} {period_name:<25} {employees:>10} ${net_pay:>10,.2f} ${employer:>10,.2f}")
    
    print("=" * 80)

def add_current_to_history():
    """Add the current payroll run to history"""
    csv_path = "d:/Project/Master/Raw/payroll/output/csv_payroll_report.json"
    qb_path = "d:/Project/Master/Raw/payroll/output/qb_payroll_report.json"
    
    if not os.path.exists(csv_path):
        print("No current payroll report found. Run payroll first.")
        return
    
    period = add_period(csv_path, qb_path)
    print(f"Added period: {period['period_name']}")
    print_history()

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == '--add':
            add_current_to_history()
        elif sys.argv[1] == '--summary':
            print(json.dumps(get_period_summary(), indent=2))
        else:
            print("Usage: python payroll_history.py [--add|--summary]")
    else:
        print_history()
