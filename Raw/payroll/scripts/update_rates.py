"""
Update Employee Rates
Usage: python scripts/update_rates.py
"""
import json
import os

CONFIG_PATH = "d:/Project/Master/Raw/payroll/data/rate_config.json"

def load_config():
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

def validate_rate(rate, min_rate=16.9):
    """Validate rate - minimum $16.9/hr for 2026"""
    if rate < min_rate:
        print(f"  ⚠️  Rate ${rate:.2f} is below minimum ${min_rate:.2f}")
        return False
    return True

def update_employee_rate(name, new_rate):
    """Update rate for an employee"""
    config = load_config()
    
    if name not in config['employees']:
        print(f"Employee '{name}' not found. Adding new...")
        config['employees'][name] = {'rate_reg': new_rate, 'calsaver': False}
    else:
        config['employees'][name]['rate_reg'] = new_rate
    
    # Calculate OT rate
    ot_rate = round(new_rate * config['ot_multiplier'], 2)
    config['employees'][name]['rate_ot'] = ot_rate
    
    save_config(config)
    print(f"✓ Updated {name}: Reg=${new_rate:.2f}, OT=${ot_rate:.2f}")
    return True

def list_employees():
    """List all employees with their rates"""
    config = load_config()
    
    print("\n" + "=" * 60)
    print("EMPLOYEE RATES (2026)")
    print("=" * 60)
    print(f"Minimum Rate: ${config['min_rate_reg']:.2f}")
    print(f"OT Multiplier: {config['ot_multiplier']}x")
    print("=" * 60)
    print(f"{'Name':<30} {'Reg':>8} {'OT':>8} {'CalSaver':>10}")
    print("-" * 60)
    
    for name, data in sorted(config['employees'].items()):
        rate_reg = data.get('rate_reg', 0)
        rate_ot = data.get('rate_ot', rate_reg * config['ot_multiplier'])
        calsaver = "Yes" if data.get('calsaver') else "-"
        
        valid = validate_rate(rate_reg, config['min_rate_reg'])
        marker = "✓" if valid else "⚠️"
        
        print(f"{marker} {name:<28} ${rate_reg:>6.2f} ${rate_ot:>6.2f} {calsaver:>10}")
    
    print("-" * 60)

def main():
    print("PAYROLL RATE CONFIGURATION")
    print("=" * 60)
    
    while True:
        print("\nOptions:")
        print("  1. List all employees")
        print("  2. Update employee rate")
        print("  3. Show config info")
        print("  4. Exit")
        
        choice = input("\nSelect option (1-4): ").strip()
        
        if choice == '1':
            list_employees()
        
        elif choice == '2':
            name = input("Employee name: ").strip()
            rate_str = input(f"New rate (min ${load_config()['min_rate_reg']:.2f}): $").strip()
            try:
                rate = float(rate_str)
                update_employee_rate(name, rate)
            except ValueError:
                print("Invalid rate. Please enter a number.")
        
        elif choice == '3':
            config = load_config()
            print(f"\nConfig Info:")
            print(f"  Year: {config['year']}")
            print(f"  Min Rate: ${config['min_rate_reg']:.2f}")
            print(f"  OT Multiplier: {config['ot_multiplier']}x")
            print(f"  Total Employees: {len(config['employees'])}")
        
        elif choice == '4':
            print("Goodbye!")
            break
        
        else:
            print("Invalid option. Please select 1-4.")

if __name__ == '__main__':
    main()
