// kb/unified/index.js — Unified Knowledge Database V2 entry point
export { openUKV, getUKVStats, listProjects, getProject, normalizeText, normalizeText as removeAccents } from './UnifiedKnowledgeDatabase.js';
export { IngestionEngine } from './IngestionEngine.js';
export { searchKnowledge, searchProjects, searchReports, searchDecisions, searchWorkflows, searchSourceCode, fuzzySearchProjects, searchConnectors, searchWhatsApp } from './SearchEngine.js';
export { RetrievalLayer, retrieveForMi, answerForMi } from './RetrievalLayer.js';
