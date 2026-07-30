'use strict';
/**
 * risk-classifier.js
 * Wraps safety-intelligence.js; classifies overall submission risk.
 */

const safetyIntelligence = require('../safety-intelligence');

function classifySubmission(submission) {
  return safetyIntelligence.validateSubmission(submission);
}

function getRiskLevel(validationResult) {
  if (validationResult.isUnsafe)     return 'HIGH';
  if (validationResult.isWarning)    return 'MEDIUM';
  if (validationResult.needsReview)  return 'REVIEW';
  return 'LOW';
}

function summarizeIssues(validationResult) {
  const issues = validationResult.issues || [];
  const byType = {};
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  }
  return { count: issues.length, byType, riskLevel: getRiskLevel(validationResult) };
}

module.exports = { classifySubmission, getRiskLevel, summarizeIssues };
