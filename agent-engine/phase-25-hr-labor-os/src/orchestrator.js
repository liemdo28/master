// Phase 25 - HR / Staffing / Labor OS. Modules: EmployeeRegistry Â· LaborCostEngine Â· ScheduleRiskEngine Â· AttendanceSignalEngine Â· TrainingComplianceEngine Â· StaffPerformanceScorecard Â· HRLaborOS
// OSS: OrangeHRM (TCP 8002). Fallback: in-engine classes.
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class EmployeeRegistry {
  constructor(opts) { this.store = new JsonStore('hr-employees', opts); }
  onboard(e) { return this.store.insert({ id: makeId('EMP'), timestamp: Date.now(), employeeId: e.employeeId, name: e.name, role: e.role, storeId: e.storeId, status: 'active', hourlyRate: e.hourlyRate ?? 0 }); }
  terminate(employeeId) { const emp = this.store.find((r) => r.employeeId === employeeId); if (emp) this.store.update(emp.id, { status: 'terminated' }); return emp; }
  all() { return this.store.all(); }
  active() { return this.store.filter((e) => e.status === 'active'); }
}

export class LaborCostEngine {
  constructor(opts) { this.store = new JsonStore('hr-labor-cost', opts); }
  record(storeId, spend, budget) {
    const ratio = budget > 0 ? spend / budget : 1;
    const level = ratio > 1 ? 'OVER_BUDGET' : ratio > 0.85 ? 'AT_RISK' : 'OK';
    const rec = { id: makeId('LAB'), timestamp: Date.now(), storeId, spend, budget, ratio: Number(ratio.toFixed(2)), level };
    this.store.insert(rec);
    return rec;
  }
  all() { return this.store.all(); }
}

export class ScheduleRiskEngine {
  evaluate(store) {
    const ratio = store.scheduledStaff / Math.max(1, store.requiredStaff);
    const level = ratio < 0.6 ? 'CRITICAL' : ratio < 0.85 ? 'HIGH' : ratio < 1 ? 'MEDIUM' : 'LOW';
    const recommendation = level === 'CRITICAL' || level === 'HIGH' ? 'call in additional staff / offer overtime (approval required)' : level === 'MEDIUM' ? 'monitor coverage' : 'coverage adequate';
    return { storeId: store.storeId, ratio: Number(ratio.toFixed(2)), level, recommendation, approvalRequired: level === 'CRITICAL' || level === 'HIGH' };
  }
}

export class AttendanceSignalEngine {
  constructor(opts) { this.store = new JsonStore('hr-attendance', opts); }
  record(employeeId, status) { return this.store.insert({ id: makeId('ATT'), timestamp: Date.now(), employeeId, status }); }
  riskFor(employeeId) {
    const recent = this.store.filter((a) => a.employeeId === employeeId).slice(0, 5);
    const absences = recent.filter((a) => a.status === 'absent').length;
    const level = absences >= 3 ? 'HIGH' : absences === 2 ? 'MEDIUM' : 'LOW';
    return { employeeId, recentTracked: recent.length, absences, level };
  }
}

export class TrainingComplianceEngine {
  constructor(opts) { this.store = new JsonStore('hr-training', opts); }
  assign(employeeId, course) { return this.store.insert({ id: makeId('TR'), timestamp: Date.now(), employeeId, course, completed: false }); }
  complete(employeeId, course) { const rec = this.store.find((r) => r.employeeId === employeeId && r.course === course && !r.completed); if (rec) this.store.update(rec.id, { completed: true }); return rec; }
  missing(employeeId, required) { const done = new Set(this.store.filter((t) => t.employeeId === employeeId && t.completed).map((t) => t.course)); return required.filter((c) => !done.has(c)); }
}

export class StaffPerformanceScorecard {
  constructor(opts) { this.store = new JsonStore('hr-performance', opts); }
  record(employeeId, score) { const level = score < 50 ? 'BELOW' : score < 75 ? 'MEETS' : 'EXCEEDS'; const rec = { id: makeId('PERF'), timestamp: Date.now(), employeeId, score, level }; this.store.insert(rec); return rec; }
  all() { return this.store.all(); }
}

export class HRLaborOS {
  constructor(opts = {}) { this.employees = new EmployeeRegistry(opts); this.labor = new LaborCostEngine(opts); this.schedule = new ScheduleRiskEngine(opts); this.attendance = new AttendanceSignalEngine(opts); this.training = new TrainingComplianceEngine(opts); this.performance = new StaffPerformanceScorecard(opts); }
  assessStoreShift({ store, laborSpend, laborBudget, attendanceByEmployee }) {
    const labor = this.labor.record(store.storeId, laborSpend, laborBudget);
    const sched = this.schedule.evaluate(store);
    const attRisks = (attendanceByEmployee || []).map((id) => this.attendance.riskFor(id));
    const highAtt = attRisks.filter((a) => a.level === 'HIGH').length;
    const materialRisk = labor.level !== 'OK' || sched.approvalRequired || highAtt > 0;
    let task = null;
    if (materialRisk) {
      const reasons = [labor.level !== 'OK' ? 'labor ' + labor.level + ' (' + Math.round(labor.ratio * 100) + '% of budget)' : null, sched.approvalRequired ? 'schedule ' + sched.level + ' (' + store.scheduledStaff + '/' + store.requiredStaff + ')' : null, highAtt > 0 ? highAtt + ' high-attendance-risk' : null].filter(Boolean);
      task = { title: 'Address labor/scheduling risk at ' + store.storeId, division: 'operations', owner: 'store-manager', reasons, recommendation: sched.recommendation, approvalRequired: true, status: 'pending_approval' };
    }
    return { labor, schedule: sched, attendanceRisks: attRisks, task, approvalRecommendation: materialRisk };
  }
  dashboard() { const labor = this.labor.all(); const over = labor.filter((l) => l.level === 'OVER_BUDGET').length; return { status: over > 0 ? 'AT_RISK' : labor.some((l) => l.level === 'AT_RISK') ? 'WATCH' : 'HEALTHY', employees: this.employees.active().length, laborRecords: labor.length, overBudgetStores: over, performanceReviews: this.performance.all().length }; }
}

export default HRLaborOS;