class ApprovalGate {
  check(task, risk) {
    return { approved: risk !== 'HIGH', reason: risk === 'HIGH' ? 'requires approval' : 'auto-approved' };
  }
}
module.exports = { ApprovalGate };