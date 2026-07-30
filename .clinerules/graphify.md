# Mandatory Graphify-first workflow

For every repository task:

1. Verify and read the Graphify mapping first.
2. Query Graphify before broad filesystem or repository search.
3. Identify relevant graph nodes, neighbors, dependencies, and paths.
4. Produce a GRAPHIFY ORIENTATION checkpoint.
5. Create an explicit file allowlist.
6. Read only allowlisted files.
7. Do not scan unrelated folders to gather additional context.
8. Expand scope only after another Graphify query and a stated reason.
9. Verify final conclusions against current source.
10. Refresh Graphify after structural changes.

Never load the complete graph JSON into the conversation unless a small,
targeted fragment is strictly necessary.
