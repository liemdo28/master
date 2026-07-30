/**
 * Federated Memory — public API
 */

export { OwnerProfileMemory }  from './OwnerProfileMemory.mjs';
export { PeopleMemory }        from './PeopleMemory.mjs';
export { StoreMemory }         from './StoreMemory.mjs';
export { ContactResolver }     from './ContactResolver.mjs';
export { ProjectMemory }       from './ProjectMemory.mjs';
export { DecisionMemory }      from './DecisionMemory.mjs';
export { ContextResolver }     from './ContextResolver.mjs';
export { MemoryConsentLog }    from './MemoryConsentLog.mjs';

// Convenience: resolve everything from a message
export async function resolveMessageContext(message) {
  const { ContextResolver } = await import('./ContextResolver.mjs');
  return ContextResolver.resolve(message);
}
