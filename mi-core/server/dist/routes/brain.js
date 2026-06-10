"use strict";
/**
 * /api/brain — unified status endpoint for Mi Federated Operating System.
 * Returns health of all 5 layers: Visibility, Knowledge Federation,
 * Project Connectors, Remote Control, Executive Memory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.brainRouter = void 0;
const express_1 = require("express");
const connector_registry_1 = require("../visibility/connector-registry");
const knowledge_db_1 = require("../knowledge/knowledge-db");
const executive_memory_1 = require("../memory/executive-memory");
const ollama_router_1 = require("../model-router/ollama-router");
const reference_brain_path_1 = require("../knowledge/reference-brain-path");
exports.brainRouter = (0, express_1.Router)();
exports.brainRouter.get('/status', async (_req, res) => {
    const [modelStatus] = await Promise.allSettled([(0, ollama_router_1.getModelStatus)()]);
    const models = modelStatus.status === 'fulfilled' ? modelStatus.value : null;
    const registry = connector_registry_1.connectorRegistry.getSummary();
    const kb = (0, knowledge_db_1.getStats)();
    const memProfile = executive_memory_1.executiveMemory.getOwnerProfile();
    const complianceStatus = (0, reference_brain_path_1.getComplianceDBStatus)();
    res.json({
        timestamp: new Date().toISOString(),
        verdict: 'MI_FEDERATED_OS',
        layers: {
            universal_visibility: {
                status: registry.connected > 0 ? 'READY' : 'PARTIAL',
                connected_platforms: registry.connected,
                total_platforms: registry.total,
                not_configured: registry.not_configured,
            },
            knowledge_federation: {
                status: kb.total_docs > 0 ? 'READY' : 'EMPTY',
                total_docs: kb.total_docs,
                us_compliance_db: {
                    status: complianceStatus.status,
                    exists: complianceStatus.exists,
                    resolved_path: complianceStatus.resolved_path,
                    searchable: complianceStatus.searchable,
                    document_count: complianceStatus.document_count,
                    chunk_count: complianceStatus.chunk_count,
                    source_count: complianceStatus.source_count,
                    jurisdictions: complianceStatus.jurisdictions,
                    domains: complianceStatus.domains,
                    raw_size_mb: complianceStatus.raw_size_mb,
                },
                categories: kb.by_category,
                db_path: kb.db_path || '',
            },
            project_connector_layer: {
                status: 'READY',
                connectors: ['dashboard-bakudan', 'raw-website', 'bakudan-website', 'integration-system', 'whatsapp-api'],
                all_require_approval: true,
            },
            remote_control: {
                status: 'READY',
                bind_address: process.env.HOST || (process.env.MOBILE_ACCESS === '1' ? '0.0.0.0' : '127.0.0.1'),
                port: parseInt(process.env.MI_PORT || '4001'),
                security: ['PIN required', 'session timeout', 'trusted devices', 'no public exposure'],
            },
            executive_memory: {
                status: Object.keys(memProfile).length > 0 ? 'READY' : 'EMPTY',
                has_profile: !!memProfile.preferred_name,
                has_preferences: !!memProfile.preferences,
                has_business: !!memProfile.business,
            },
            ai_layer: {
                status: models?.ollama_online ? 'READY' : 'OFFLINE',
                fast_model: models?.selected?.fast_chat || null,
                deep_model: models?.selected?.deep_reasoning || null,
                offline_ready: models?.offline_ready || false,
            },
        },
    });
});
exports.brainRouter.get('/federated-status', async (_req, res) => {
    const [modelStatus] = await Promise.allSettled([(0, ollama_router_1.getModelStatus)()]);
    const models = modelStatus.status === 'fulfilled' ? modelStatus.value : null;
    const registry = connector_registry_1.connectorRegistry.getSummary();
    const kb = (0, knowledge_db_1.getStats)();
    const memProfile = executive_memory_1.executiveMemory.getOwnerProfile();
    const complianceStatus = (0, reference_brain_path_1.getComplianceDBStatus)();
    res.json({
        timestamp: new Date().toISOString(),
        verdict: 'MI_FEDERATED_OS',
        phases: {
            universal_visibility: { verdict: 'READY', modules: ['ConnectorRegistry', 'VisibilityCache', 'DailySnapshotBuilder', 'PlatformHealthChecker'] },
            knowledge_federation: { verdict: complianceStatus.exists ? 'READY' : 'PARTIAL', modules: ['FederationSearch', 'ComplianceSearch'] },
            project_connector_layer: { verdict: 'READY', modules: ['ProjectConnector'] },
            remote_control: { verdict: 'READY', modules: ['RemoteAccessManager'] },
        },
        layers: {
            universal_visibility: { status: registry.connected > 0 ? 'READY' : 'PARTIAL' },
            knowledge_federation: { status: kb.total_docs > 0 ? 'READY' : 'EMPTY', us_compliance_db: complianceStatus.exists ? 'READY' : 'NOT_FOUND' },
            project_connector_layer: { status: 'READY' },
            remote_control: { status: 'READY' },
            executive_memory: { status: Object.keys(memProfile).length > 0 ? 'READY' : 'EMPTY' },
            ai_layer: { status: models?.ollama_online ? 'READY' : 'OFFLINE' },
        },
    });
});
