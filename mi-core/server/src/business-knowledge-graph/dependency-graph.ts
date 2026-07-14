import { getAllRelationships } from './entity-registry';
export function getDependencyGraph() { return { adapter: 'safe-in-memory-graph-adapter', ossStatus: 'CONFIGURED_NOT_INSTALLED', relationships: getAllRelationships().filter(r => ['depends_on','uses_connector','feeds_into'].includes(r.type)) }; }
