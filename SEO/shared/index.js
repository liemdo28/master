module.exports = {
  config: require('./config'),
  database: require('./database'),
  logger: require('./logs/logger'),
  reports: require('./reports/reports'),
  bus: require('./events/bus'),
  queue: require('./queue/queue'),
  miClient: require('./mi-client/mi-client'),
  contracts: require('./contracts/contracts'),
  baseAgent: require('./base/base-agent'),
};
