function summarizeIncident(incident) {
  return {
    agent: 'manager-agent',
    status: incident?.status || 'OPEN',
    priority: incident?.result === 'FAIL' ? 'HIGH' : 'REVIEW',
    recommendation: incident?.result === 'FAIL'
      ? 'Confirm corrective action and require a re-temp.'
      : 'Ask manager to confirm unclear readings.',
  };
}

module.exports = { summarizeIncident };
