/**
 * Security module barrel export.
 */
const apiKeyManager = require('./api-key-manager');
const projectClientRegistry = require('./project-client-registry');
const apiKeyAuditLog = require('./api-key-audit-log');
const approvalService = require('./approval-service');

module.exports = {
  apiKeyManager,
  projectClientRegistry,
  apiKeyAuditLog,
  approvalService,
};
