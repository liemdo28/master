interface RagDocument {
  text: string;
  source: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

const docs: RagDocument[] = [];

export async function ingest(text: string, source: string, metadata?: Record<string, unknown>): Promise<boolean> {
  docs.push({ text, source, metadata, created_at: new Date().toISOString() });
  return true;
}

export async function search(query: string, topK = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = docs
    .map(doc => ({
      ...doc,
      score: terms.reduce((sum, term) => sum + (doc.text.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    query,
    count: results.length,
    backend: 'memory-fallback',
    results,
  };
}
