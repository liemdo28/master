import { publicProcedure, router } from "../_app.js";
import { getDb } from "../../db/database.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const projectRouter = router({
  // ── List ────────────────────────────────────────────────────────────────
  list: publicProcedure.query(() => {
    const db = getDb();
    return db
      .prepare(
        `SELECT * FROM video_projects ORDER BY created_at DESC`
      )
      .all();
  }),

  // ── Get one ─────────────────────────────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      const row = db
        .prepare(`SELECT * FROM video_projects WHERE id = ?`)
        .get(input.id);
      if (!row) throw new Error(`Project not found: ${input.id}`);
      return row;
    }),

  // ── Create ──────────────────────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        targetUrl: z.string().url(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const id = uuidv4();
      db.prepare(
        `INSERT INTO video_projects (id, name, description, target_url, metadata)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        id,
        input.name,
        input.description ?? null,
        input.targetUrl,
        input.metadata ? JSON.stringify(input.metadata) : null
      );
      return db.prepare(`SELECT * FROM video_projects WHERE id = ?`).get(id);
    }),

  // ── Update ─────────────────────────────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.enum(["draft", "recording", "rendering", "done", "archived"]).optional(),
        targetUrl: z.string().url().optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (fields.name !== undefined) { sets.push("name = ?"); vals.push(fields.name); }
      if (fields.description !== undefined) { sets.push("description = ?"); vals.push(fields.description); }
      if (fields.status !== undefined) { sets.push("status = ?"); vals.push(fields.status); }
      if (fields.targetUrl !== undefined) { sets.push("target_url = ?"); vals.push(fields.targetUrl); }
      sets.push("updated_at = datetime('now')");
      vals.push(id);
      db.prepare(
        `UPDATE video_projects SET ${sets.join(", ")} WHERE id = ?`
      ).run(...vals);
      return db.prepare(`SELECT * FROM video_projects WHERE id = ?`).get(id);
    }),

  // ── Delete ──────────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDb();
      db.prepare(`DELETE FROM video_projects WHERE id = ?`).run(input.id);
      return { success: true };
    }),
});
