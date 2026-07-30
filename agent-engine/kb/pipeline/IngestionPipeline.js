/**
 * IngestionPipeline.js — Massive Knowledge Ingestion
 *
 * Scan, normalize, chunk, embed, and store knowledge from any source.
 * CRITICAL: This is the civilization's learning mechanism.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import fg from 'fast-glob';
const glob = fg;
import { nanoid } from 'nanoid';
import pg from 'pg';
const { Pool } = pg;

export class IngestionPipeline {
    #pool;
    #qdrantUrl;
    #embeddingModel = 'nomic-embed-text';
    #chunkSize = 800;
    #batchSize = 20;

    constructor(postgresUrl, qdrantUrl) {
        this.#pool = new Pool({ connectionString: postgresUrl });
        this.#qdrantUrl = qdrantUrl || 'http://localhost:6333';
    }

    async initialize() {
        // Source tracking table
        await this.#pool.query(`
            CREATE TABLE IF NOT EXISTS ingestion_sources (
                id TEXT PRIMARY KEY,
                source_type TEXT NOT NULL,
                source_path TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                documents_indexed INTEGER DEFAULT 0,
                last_ingested_at TIMESTAMPTZ,
                error TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Knowledge chunks table
        await this.#pool.query(`
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
                id TEXT PRIMARY KEY,
                source_id TEXT REFERENCES ingestion_sources(id),
                source_type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata JSONB DEFAULT '{}',
                file_path TEXT,
                project_name TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await this.#pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chunks_source
            ON knowledge_chunks(source_id)
        `);

        await this.#pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chunks_project
            ON knowledge_chunks(project_name)
        `);

        // Ensure Qdrant collections
        await this.#ensureCollection('code_memory', 768);
        await this.#ensureCollection('docs_memory', 768);
        await this.#ensureCollection('architecture_memory', 768);
        await this.#ensureCollection('filesystem_memory', 768);
    }

    async #ensureCollection(name, dim) {
        try {
            const res = await fetch(`${this.#qdrantUrl}/collections/${name}`);
            if (res.status === 404) {
                await fetch(`${this.#qdrantUrl}/collections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        vectors: { size: dim, distance: 'Cosine' },
                    }),
                });
            }
        } catch {
            // Qdrant unavailable
        }
    }

    // --- Source Registration ---

    async registerSource({ id, sourceType, sourcePath }) {
        const sid = id || `src_${nanoid(8)}`;
        await this.#pool.query(
            `INSERT INTO ingestion_sources (id, source_type, source_path)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO NOTHING`,
            [sid, sourceType, sourcePath]
        );
        return sid;
    }

    // --- Ingest Local Project ---

    async ingestProject(projectPath, projectName) {
        const sourceId = await this.registerSource({
            id: `proj_${nanoid(8)}`,
            sourceType: 'local_project',
            sourcePath: projectPath,
        });

        const stats = { files: 0, chunks: 0, errors: 0 };

        // Scan for code and doc files
        const patterns = [
            '**/*.{js,ts,jsx,tsx,py,go,rs,java,cpp,h,json,yaml,yml,md,txt}',
            '!**/node_modules/**',
            '!**/.git/**',
            '!**/dist/**',
            '!**/build/**',
            '!**/*.min.js',
        ];

        const files = await glob(patterns, { cwd: projectPath, absolute: true });

        for (const file of files) {
            try {
                const stat = statSync(file);
                if (stat.size > 2 * 1024 * 1024) continue; // Skip > 2MB files

                const ext = extname(file).toLowerCase();
                const content = readFileSync(file, 'utf-8');
                if (!content.trim()) continue;

                const collection = this.#getCollection(ext);
                const relPath = relative(projectPath, file);

                await this.#ingestContent({
                    sourceId,
                    content,
                    collection,
                    metadata: {
                        filePath: relPath,
                        extension: ext,
                        projectName,
                        size: stat.size,
                        modified: stat.mtime.toISOString(),
                    },
                });

                stats.files++;
                stats.chunks += this.#countChunks(content);

                // Update progress
                await this.#pool.query(
                    `UPDATE ingestion_sources SET documents_indexed = $1, last_ingested_at = NOW() WHERE id = $2`,
                    [stats.files, sourceId]
                );
            } catch (err) {
                stats.errors++;
            }
        }

        // Mark complete
        await this.#pool.query(
            `UPDATE ingestion_sources SET status = 'completed', last_ingested_at = NOW() WHERE id = $1`,
            [sourceId]
        );

        return stats;
    }

    // --- Ingest Directory ---

    async ingestDirectory(dirPath, options = {}) {
        const { recursive = true, patterns = ['**/*.{js,ts,md,txt}'] } = options;
        const sourceId = await this.registerSource({
            sourceType: 'directory',
            sourcePath: dirPath,
        });

        const stats = { files: 0, chunks: 0, errors: 0 };
        const files = await glob(patterns, {
            cwd: dirPath,
            absolute: true,
            onlyFiles: true,
        });

        for (const file of files.slice(0, 500)) { // Cap at 500 files
            try {
                const content = readFileSync(file, 'utf-8');
                if (!content.trim()) continue;

                const ext = extname(file).toLowerCase();
                const collection = this.#getCollection(ext);
                const relPath = relative(dirPath, file);

                await this.#ingestContent({
                    sourceId,
                    content,
                    collection,
                    metadata: { filePath: relPath, extension: ext },
                });

                stats.files++;
                stats.chunks += this.#countChunks(content);
            } catch {
                stats.errors++;
            }
        }

        await this.#pool.query(
            `UPDATE ingestion_sources SET status = 'completed', documents_indexed = $1, last_ingested_at = NOW() WHERE id = $2`,
            [stats.files, sourceId]
        );

        return stats;
    }

    // --- Core Ingestion ---

    async #ingestContent({ sourceId, content, collection, metadata }) {
        const chunks = this.#chunkText(content);

        for (const chunk of chunks) {
            const embedding = await this.#getEmbedding(chunk);
            if (!embedding) continue;

            const chunkId = `chunk_${nanoid(12)}`;

            // Store in PostgreSQL
            await this.#pool.query(
                `INSERT INTO knowledge_chunks (id, source_id, source_type, content, metadata, file_path, project_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    chunkId,
                    sourceId,
                    collection,
                    chunk,
                    JSON.stringify(metadata),
                    metadata.filePath || null,
                    metadata.projectName || null,
                ]
            );

            // Store in Qdrant
            await this.#storeVector(collection, chunkId, embedding, {
                ...metadata,
                content: chunk.slice(0, 200), // First 200 chars for preview
            });
        }
    }

    async #storeVector(collection, id, vector, payload) {
        try {
            await fetch(`${this.#qdrantUrl}/points`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    points: [{ id, vector, payload }],
                }),
            });
        } catch {
            // Qdrant unavailable — PG is primary
        }
    }

    async #getEmbedding(text) {
        try {
            const res = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: this.#embeddingModel, prompt: text }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.embedding;
        } catch {
            return null;
        }
    }

    #chunkText(text) {
        if (!text || text.length <= this.#chunkSize) return [text];

        const paragraphs = text.split(/\n\n+/);
        const chunks = [];
        let current = '';
        let wordCount = 0;

        for (const para of paragraphs) {
            const paraWords = para.split(/\s+/).length;
            if ((current + '\n\n' + para).length <= this.#chunkSize &&
                wordCount + paraWords <= 200) {
                current = current ? current + '\n\n' + para : para;
                wordCount += paraWords;
            } else {
                if (current) chunks.push(current.trim());
                current = para.slice(0, this.#chunkSize);
                wordCount = paraWords;
            }
        }
        if (current) chunks.push(current.trim());
        return chunks;
    }

    #countChunks(text) {
        return Math.ceil(text.length / this.#chunkSize);
    }

    #getCollection(ext) {
        const map = {
            '.js': 'code_memory',
            '.ts': 'code_memory',
            '.jsx': 'code_memory',
            '.tsx': 'code_memory',
            '.py': 'code_memory',
            '.go': 'code_memory',
            '.rs': 'code_memory',
            '.md': 'docs_memory',
            '.txt': 'docs_memory',
            '.yaml': 'architecture_memory',
            '.yml': 'architecture_memory',
            '.json': 'architecture_memory',
            '.sql': 'architecture_memory',
        };
        return map[ext] || 'docs_memory';
    }

    // --- Semantic Search ---

    async search(query, { collection, limit = 10 } = {}) {
        const embedding = await this.#getEmbedding(query);
        if (!embedding) return [];

        try {
            const body = {
                collection: collection || 'code_memory',
                vector: embedding,
                limit,
                with_payload: true,
            };

            const res = await fetch(`${this.#qdrantUrl}/points/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) return [];
            const data = await res.json();
            return data.result ?? [];
        } catch {
            return [];
        }
    }

    async crossSearch(query, { limit = 5 } = {}) {
        const collections = ['code_memory', 'docs_memory', 'architecture_memory', 'filesystem_memory'];
        const results = [];

        for (const col of collections) {
            const r = await this.search(query, { collection: col, limit });
            results.push(...r);
        }

        return results
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, limit);
    }

    // --- Stats ---

    async getStats() {
        const sources = await this.#pool.query(
            `SELECT source_type, status, COUNT(*) as count, SUM(documents_indexed) as total_docs
             FROM ingestion_sources GROUP BY source_type, status`
        );
        const chunks = await this.#pool.query(
            `SELECT source_type, COUNT(*) as count FROM knowledge_chunks GROUP BY source_type`
        );
        return { sources: sources.rows, chunks: chunks.rows };
    }

    async close() {
        await this.#pool.end();
    }
}
