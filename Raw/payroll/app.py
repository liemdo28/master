"""
Payroll Dashboard - Localhost Web Interface
"""
import os
import sys
import json
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename

# Add paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.csv_calculator import CSVPayrollCalculator
from src.qb_tax_calculator import calculate_payroll_qb, save_qb_report
from src.paycheck_generator import generate_paycheck_csv as gen_paycheck
from src.payroll_history import get_history, get_period_summary, add_current_to_history

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'd:/Project/Master/Raw/payroll/uploads'
app.config['OUTPUT_FOLDER'] = 'd:/Project/Master/Raw/payroll/output'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'csv'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_latest_report():
    report_path = os.path.join(app.config['OUTPUT_FOLDER'], 'csv_payroll_report.json')
    if os.path.exists(report_path):
        with open(report_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

@app.route('/')
def index():
    report = load_latest_report()
    return render_template('index.html', report=report)

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'timesheet' not in request.files or 'order_details' not in request.files:
        return jsonify({'error': 'Missing files'}), 400
    
    timesheet = request.files['timesheet']
    order_details = request.files['order_details']
    
    if timesheet.filename == '' or order_details.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    timesheet_path = os.path.join(app.config['UPLOAD_FOLDER'], 'timesheet.csv')
    order_path = os.path.join(app.config['UPLOAD_FOLDER'], 'order_details.csv')
    timesheet.save(timesheet_path)
    order_details.save(order_path)
    
    # Run calculation
    calc = CSVPayrollCalculator()
    calc.calculate(timesheet_path, order_path)
    calc.save_report()
    
    # Generate paycheck CSV
    gen_paycheck(
        csv_report_path=os.path.join(app.config['OUTPUT_FOLDER'], 'csv_payroll_report.json'),
        output_path=os.path.join(app.config['OUTPUT_FOLDER'], 'paycheck.csv')
    )
    
    return jsonify({'success': True, 'message': 'Payroll calculated successfully'})

@app.route('/api/report')
def get_report():
    report = load_latest_report()
    if report:
        return jsonify(report)
    return jsonify({'error': 'No report available'}), 404

@app.route('/download/csv')
def download_csv():
    csv_path = os.path.join(app.config['OUTPUT_FOLDER'], 'csv_payroll_report.csv')
    if os.path.exists(csv_path):
        return send_file(csv_path, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404

@app.route('/download/paycheck')
def download_paycheck():
    paycheck_path = os.path.join(app.config['OUTPUT_FOLDER'], 'paycheck.csv')
    if os.path.exists(paycheck_path):
        return send_file(paycheck_path, as_attachment=True)
    return jsonify({'error': 'Paycheck not found'}), 404

@app.route('/download/json')
def download_json():
    json_path = os.path.join(app.config['OUTPUT_FOLDER'], 'csv_payroll_report.json')
    if os.path.exists(json_path):
        return send_file(json_path, as_attachment=True)
    return jsonify({'error': 'File not found'}), 404

@app.route('/download/qb')
def download_qb():
    qb_path = os.path.join(app.config['OUTPUT_FOLDER'], 'qb_payroll_report.csv')
    if os.path.exists(qb_path):
        return send_file(qb_path, as_attachment=True)
    return jsonify({'error': 'QB Report not found'}), 404

def generate_paycheck_csv():
    """Generate paycheck CSV in Sheet Supper format"""
    report_path = os.path.join(app.config['OUTPUT_FOLDER'], 'csv_payroll_report.json')
    if not os.path.exists(report_path):
        return
    
    import csv
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
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
    
    paycheck_path = os.path.join(app.config['OUTPUT_FOLDER'], 'paycheck.csv')
    with open(paycheck_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    print(f"Paycheck CSV generated: {paycheck_path}")

@app.route('/api/history')
def api_history():
    """Get payroll history"""
    limit = request.args.get('limit', type=int)
    history = get_history(limit=limit)
    summary = get_period_summary()
    return jsonify({'periods': history, 'summary': summary})

@app.route('/api/history/add', methods=['POST'])
def api_add_history():
    """Add current report to history"""
    try:
        add_current_to_history()
        return jsonify({'success': True, 'message': 'Added to history'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("PAYROLL DASHBOARD")
    print("=" * 60)
    print("Open http://localhost:5000 in your browser")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
