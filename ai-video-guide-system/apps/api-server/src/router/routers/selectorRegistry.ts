import { publicProcedure, router } from "../_app.js";
import { getDb } from "../../db/database.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const selectorRegistryRouter = router({
  // ── List by project ────────────────────────────────────────────────────
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(`SELECT * FROM selector_registry WHERE project_id = ? ORDER BY priority DESC, name ASC`)
        .all(input.projectId);
    }),

  // ── Get active selectors ────────────────────────────────────────────────
  activeByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(
          `SELECT * FROM selector_registry WHERE project_id = ? AND active = 1 ORDER BY priority DESC`
        )
        .all(input.projectId);
    }),

  // ── Register ────────────────────────────────────────────────────────────
  register: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        selector: z.string(),
        selectorType: z.enum(["css", "xpath", "testid", "role"]),
        name: z.string().min(1),
        description: z.string().optional(),
        priority: z.number().int().min(0).max(10).optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const id = uuidv4();
      db.prepare(
        `INSERT INTO selector_registry
           (id, project_id, selector, selector_type, name, description, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.projectId,
        input.selector,
        input.selectorType,
        input.name,
        input.description ?? null,
        input.priority ?? 5
      );
      return db.prepare(`SELECT * FROM selector_registry WHERE id = ?`).get(id);
    }),

  // ── Toggle active ───────────────────────────────────────────────────────
  toggleActive: publicProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(({ input }) => {
      const db = getDb();
      db.prepare(`UPDATE selector_registry SET active = ? WHERE id = ?`).run(input.active ? 1 : 0, input.id);
      return db.prepare(`SELECT * FROM selector_registry WHERE id = ?`).get(input.id);
    }),

  // ── Delete ─────────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDb();
      db.prepare(`DELETE FROM selector_registry WHERE id = ?`).run(input.id);
      return { success: true };
    }),
});
