// collectors/ResourceCollector.js - Alias for ResourceMonitor (compatibility shim)
// ResourceMonitor is the canonical implementation; this re-exports it under
// the ResourceCollector name expected by the dev script requirements.
export { ResourceMonitor as ResourceCollector } from './ResourceMonitor.js';
export { ResourceMonitor } from './ResourceMonitor.js';
