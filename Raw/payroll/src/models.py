"""
Data models for Payroll Calculator
"""
from dataclasses import dataclass, field
from typing import Optional, Dict
from datetime import datetime

@dataclass
class EmployeeRate:
    """Employee rate information from Rate of Emp sheet"""
    name: str
    has_calsaver: bool = False
    calsaver_rate: float = 0.0
    rate_reg: float = 0.0
    rate_ot: float = 0.0
    
    def __post_init__(self):
        # Parse boolean from string
        if isinstance(self.has_calsaver, str):
            self.has_calsaver = self.has_calsaver.lower() == 'y'
        # Parse percentage
        if isinstance(self.calsaver_rate, str) and '%' in self.calsaver_rate:
            self.calsaver_rate = float(self.calsaver_rate.replace('%', '')) / 100
        # Parse numeric values
        if isinstance(self.rate_reg, str):
            self.rate_reg = float(self.rate_reg) if self.rate_reg else 0.0
        if isinstance(self.rate_ot, str):
            self.rate_ot = float(self.rate_ot) if self.rate_ot else 0.0

@dataclass
class TimesheetEntry:
    """Timesheet entry for an employee"""
    name: str
    total_hours: float = 0.0
    regular_hours: float = 0.0
    ot_hours: float = 0.0

@dataclass
class TipAllocation:
    """Tip allocation by position"""
    bch: float = 0.0
    kitchen: float = 0.0
    bartender: float = 0.0
    sushi_chef: float = 0.0
    pool_tip_qb: float = 0.0
    cash_tip: float = 0.0

@dataclass
class PayrollEntry:
    """Complete payroll entry for an employee"""
    name: str
    search_name: str = ""
    total_hours: float = 0.0
    regular_hours: float = 0.0
    ot_hours: float = 0.0
    
    # Rates
    rate_reg: float = 15.0
    rate_ot: float = 22.5
    has_calsaver: bool = False
    calsaver_rate: float = 0.05
    
    # Tips by position
    tip_bch: float = 0.0
    tip_kitchen: float = 0.0
    tip_bartender: float = 0.0
    tip_sushi_chef: float = 0.0
    pool_tip_qb: float = 0.0
    cash_tip: float = 0.0
    
    # Calculated fields
    regular_pay: float = 0.0
    ot_pay: float = 0.0
    total_tip: float = 0.0
    subtotal: float = 0.0
    calsaver_amount: float = 0.0
    total_pay: float = 0.0
    
    def calculate(self):
        """Calculate all payroll fields"""
        # Calculate pay
        self.regular_pay = self.regular_hours * self.rate_reg
        self.ot_pay = self.ot_hours * self.rate_ot
        
        # Calculate total tip
        self.total_tip = (
            self.tip_bch + 
            self.tip_kitchen + 
            self.tip_bartender + 
            self.tip_sushi_chef + 
            self.pool_tip_qb + 
            self.cash_tip
        )
        
        # Calculate subtotal
        self.subtotal = self.regular_pay + self.ot_pay + self.total_tip
        
        # Calculate CalSaver
        if self.has_calsaver:
            self.calsaver_amount = self.subtotal * self.calsaver_rate
        
        # Calculate total pay
        self.total_pay = self.subtotal - self.calsaver_amount
        
        return self
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'name': self.name,
            'search_name': self.search_name,
            'total_hours': self.total_hours,
            'regular_hours': self.regular_hours,
            'ot_hours': self.ot_hours,
            'rate_reg': self.rate_reg,
            'rate_ot': self.rate_ot,
            'has_calsaver': self.has_calsaver,
            'calsaver_rate': self.calsaver_rate,
            'regular_pay': round(self.regular_pay, 2),
            'ot_pay': round(self.ot_pay, 2),
            'total_tip': round(self.total_tip, 2),
            'subtotal': round(self.subtotal, 2),
            'calsaver_amount': round(self.calsaver_amount, 2),
            'total_pay': round(self.total_pay, 2),
            'tips': {
                'BCH': round(self.tip_bch, 2),
                'Kitchen': round(self.tip_kitchen, 2),
                'Bartender': round(self.tip_bartender, 2),
                'Sushi Chef': round(self.tip_sushi_chef, 2),
                'Pool Tip QB': round(self.pool_tip_qb, 2),
                'Cash Tip': round(self.cash_tip, 2)
            }
        }

@dataclass
class PayrollReport:
    """Complete payroll report"""
    period: str = ""
    generated_at: datetime = field(default_factory=datetime.now)
    employees: list = field(default_factory=list)
    total_regular_pay: float = 0.0
    total_ot_pay: float = 0.0
    total_tips: float = 0.0
    total_calsaver: float = 0.0
    total_payroll: float = 0.0
    
    def calculate_totals(self):
        """Calculate totals from employee entries"""
        self.total_regular_pay = sum(e.regular_pay for e in self.employees)
        self.total_ot_pay = sum(e.ot_pay for e in self.employees)
        self.total_tips = sum(e.total_tip for e in self.employees)
        self.total_calsaver = sum(e.calsaver_amount for e in self.employees)
        self.total_payroll = sum(e.total_pay for e in self.employees)
        return self
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'period': self.period,
            'generated_at': self.generated_at.isoformat(),
            'summary': {
                'total_regular_pay': round(self.total_regular_pay, 2),
                'total_ot_pay': round(self.total_ot_pay, 2),
                'total_tips': round(self.total_tips, 2),
                'total_calsaver': round(self.total_calsaver, 2),
                'total_payroll': round(self.total_payroll, 2),
                'employee_count': len(self.employees)
            },
            'employees': [e.to_dict() for e in self.employees]
        }
