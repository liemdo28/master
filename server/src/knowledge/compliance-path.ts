/**
 * US Compliance DB — Re-export shim.
 *
 * The canonical path resolver lives in `reference-brain-path.ts`.
 * This file is kept only so existing imports keep working.
 * New code MUST import from './reference-brain-path' directly.
 */

export {
  getMiCoreRoot,
  getWorkspaceRoot,
  getReferenceBrainRoot,
  getUSComplianceDBPath,
  getUSComplianceManifestPath,
  getUSComplianceCatalogPath,
  checkUSComplianceDBHealth,
  resolveCompliancePath,
  getComplianceDBStatus,
} from './reference-brain-path';
export type { USComplianceDBHealth } from './reference-brain-path';
