import { publicProcedure, router } from "../_app.js";
import { getDb } from "../../db/database.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const captureRouter = router({
  // ── List by step ────────────────────────────────────────────────────────
  listByStep: publicProcedure
    .input(z.object({ stepId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(`SELECT * FROM captures WHERE step_id = ? ORDER BY created_at ASC`)
        .all(input.stepId);
    }),

  // ── List by project ─────────────────────────────────────────────────────
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(`SELECT * FROM captures WHERE project_id = ? ORDER BY created_at ASC`)
        .all(input.projectId);
    }),

  // ── Get one ─────────────────────────────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      const row = db.prepare(`SELECT * FROM captures WHERE id = ?`).get(input.id);
      if (!row) throw new Error(`Capture not found: ${input.id}`);
      return row;
    }),

  // ── Create ──────────────────────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        stepId: z.string(),
        projectId: z.string(),
        type: z.enum(["screenshot", "clip", "thumbnail"]).optional(),
        filePath: z.string(),
        thumbnailPath: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const id = uuidv4();
      db.prepare(
        `INSERT INTO captures
           (id, step_id, project_id, type, file_path, thumbnail_path, width, height)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.stepId,
        input.projectId,
        input.type ?? "screenshot",
        input.filePath,
        input.thumbnailPath ?? null,
        input.width ?? null,
        input.height ?? null
      );
      return db.prepare(`SELECT * FROM captures WHERE id = ?`).get(id);
    }),

  // ── Delete ──────────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDb();
      db.prepare(`DELETE FROM captures WHERE id = ?`).run(input.id);
      return { success: true };
    }),
});
