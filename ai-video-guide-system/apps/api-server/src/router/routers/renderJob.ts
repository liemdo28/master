import { publicProcedure, router } from "../_app.js";
import { getDb } from "../../db/database.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const renderJobRouter = router({
  // ── List by project ─────────────────────────────────────────────────────
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(
          `SELECT * FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC`
        )
        .all(input.projectId);
    }),

  // ── Get one ─────────────────────────────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      const row = db.prepare(`SELECT * FROM render_jobs WHERE id = ?`).get(input.id);
      if (!row) throw new Error(`Render job not found: ${input.id}`);
      return row;
    }),

  // ── Latest per project ──────────────────────────────────────────────────
  latestByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(
          `SELECT * FROM render_jobs
           WHERE project_id = ?
           ORDER BY created_at DESC LIMIT 1`
        )
        .get(input.projectId);
    }),

  // ── Create ──────────────────────────────────────────────────────────────
  create: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(({ input }) => {
      const db = getDb();
      const id = uuidv4();
      db.prepare(
        `INSERT INTO render_jobs (id, project_id, status, started_at)
         VALUES (?, ?, 'pending', datetime('now'))`
      ).run(id, input.projectId);
      return db.prepare(`SELECT * FROM render_jobs WHERE id = ?`).get(id);
    }),

  // ── Update status ───────────────────────────────────────────────────────
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "rendering", "done", "failed"]),
        videoPath: z.string().optional(),
        thumbnailPath: z.string().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const sets: string[] = ["status = ?"];
      const vals: unknown[] = [fields.status];
      if (fields.status === "done" || fields.status === "failed") {
        sets.push("completed_at = datetime('now')");
      }
      if (fields.videoPath !== undefined) { sets.push("video_path = ?"); vals.push(fields.videoPath); }
      if (fields.thumbnailPath !== undefined) { sets.push("thumbnail_path = ?"); vals.push(fields.thumbnailPath); }
      if (fields.errorMessage !== undefined) { sets.push("error_message = ?"); vals.push(fields.errorMessage); }
      vals.push(id);
      db.prepare(`UPDATE render_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return db.prepare(`SELECT * FROM render_jobs WHERE id = ?`).get(id);
    }),

  // ── Delete ──────────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDb();
      db.prepare(`DELETE FROM render_jobs WHERE id = ?`).run(input.id);
      return { success: true };
    }),
});
