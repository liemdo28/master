class FailureStopper {
  check(failures, threshold) {
    return { stopped: failures >= threshold, reason: failures >= threshold ? 'threshold reached' : null };
  }
}
module.exports = { FailureStopper };