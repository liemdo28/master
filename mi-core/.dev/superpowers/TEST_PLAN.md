# Test Plan

## Unit
- Provider router fallback behavior
- Queue enqueue/retry/dead-letter transitions
- Memory router canonical writes
- Browser router provider selection
- Secret redaction and permission checks

## Integration
- Heavy operations enqueue jobs
- Postgres/MinIO/Qdrant health checks
- CEO query engine against normalized events
- Connector sample ingest

## Manual
- Approval gate for writes, deploys, financial actions, and browser mutations
- Dashboard health view
- Open WebUI and RAGFlow external integrations after deployment
