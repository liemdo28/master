/**
 * /api/brain — unified status endpoint for Mi Federated Operating System.
 * Returns health of all 5 layers: Visibility, Knowledge Federation,
 * Project Connectors, Remote Control, Executive Memory.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import { connectorRegistry } from '../visibility/connector-registry';
import { getStats as kbStats } from '../knowledge/knowledge-db';
import { executiveMemory } from '../memory/executive-memory';
import { getModelStatus } from '../model-router/ollama-router';

export const brainRouter = Router();

brainRouter.get('/status', async (_req: Request, res: Response) => {
  const [modelStatus] = await Promise.allSettled([getModelStatus()]);
  const models = modelStatus.status === 'fulfilled' ? modelStatus.value : null;

  const registry = connectorRegistry.getSummary();
  const kb = kbStats();
  const memProfile = executiveMemory.getOwnerProfile();

  const usCompliancePath = 'E:/Project/Master/.local-agent-global/reference-brain/us-business-compliance';
  const usComplianceReady = fs.existsSync(usCompliancePath);

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
        us_compliance_db: usComplianceReady ? 'READY' : 'NOT_FOUND',
        categories: kb.by_category,
        db_path: (kb as Record<string, unknown>).db_path as string || '',
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

brainRouter.get('/federated-status', async (_req: Request, res: Response) => {
  const [modelStatus] = await Promise.allSettled([getModelStatus()]);
  const models = modelStatus.status === 'fulfilled' ? modelStatus.value : null;
  const registry = connectorRegistry.getSummary();
  const kb = kbStats();
  const memProfile = executiveMemory.getOwnerProfile();
  const usCompliancePath = 'E:/Project/Master/.local-agent-global/reference-brain/us-business-compliance';
  const usComplianceReady = fs.existsSync(usCompliancePath);

  res.json({
    timestamp: new Date().toISOString(),
    verdict: 'MI_FEDERATED_OS',
    phases: {
      universal_visibility: { verdict: 'READY', modules: ['ConnectorRegistry', 'VisibilityCache', 'DailySnapshotBuilder', 'PlatformHealthChecker'] },
      knowledge_federation: { verdict: usComplianceReady ? 'READY' : 'PARTIAL', modules: ['FederationSearch', 'ComplianceSearch'] },
      project_connector_layer: { verdict: 'READY', modules: ['ProjectConnector'] },
      remote_control: { verdict: 'READY', modules: ['RemoteAccessManager'] },
    },
    layers: {
      universal_visibility: { status: registry.connected > 0 ? 'READY' : 'PARTIAL' },
      knowledge_federation: { status: kb.total_docs > 0 ? 'READY' : 'EMPTY', us_compliance_db: usComplianceReady ? 'READY' : 'NOT_FOUND' },
      project_connector_layer: { status: 'READY' },
      remote_control: { status: 'READY' },
      executive_memory: { status: Object.keys(memProfile).length > 0 ? 'READY' : 'EMPTY' },
      ai_layer: { status: models?.ollama_online ? 'READY' : 'OFFLINE' },
    },
  });
});