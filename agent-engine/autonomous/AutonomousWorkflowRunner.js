class AutonomousWorkflowRunner {
  async run(task) {
    return { status: 'proposed', task, approvalRequired: true };
  }
  stop() { return { stopped: true }; }
  getStatus() { return { running: false }; }
}
module.exports = { AutonomousWorkflowRunner };