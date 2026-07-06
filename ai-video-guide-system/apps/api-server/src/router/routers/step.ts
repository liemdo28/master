import { publicProcedure, router } from "../_app.js";
import { getDb } from "../../db/database.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const stepRouter = router({
  // ── List by project ─────────────────────────────────────────────────────
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      return db
        .prepare(
          `SELECT * FROM steps WHERE project_id = ? ORDER BY order_index ASC`
        )
        .all(input.projectId);
    }),

  // ── Get one ─────────────────────────────────────────────────────────────
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const db = getDb();
      const row = db.prepare(`SELECT * FROM steps WHERE id = ?`).get(input.id);
      if (!row) throw new Error(`Step not found: ${input.id}`);
      return row;
    }),

  // ── Create ──────────────────────────────────────────────────────────────
  create: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        description: z.string().min(1),
        orderIndex: z.number().int().min(0).optional(),
        actionType: z
          .enum(["navigate", "click", "fill", "hover", "scroll", "wait", "screenshot"])
          .optional(),
        selector: z.string().optional(),
        selectorType: z.enum(["css", "xpath", "testid", "role"]).optional(),
        value: z.string().optional(),
        delayMs: z.number().int().min(0).optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();

      // Auto-assign orderIndex if not provided
      let orderIndex = input.orderIndex;
      if (orderIndex === undefined) {
        const max = db
          .prepare(
            `SELECT MAX(order_index) as m FROM steps WHERE project_id = ?`
          )
          .get(input.projectId) as { m: number | null };
        orderIndex = (max.m ?? -1) + 1;
      }

      const id = uuidv4();
      db.prepare(
        `INSERT INTO steps
           (id, project_id, order_index, description, action_type, selector, selector_type, value, delay_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        input.projectId,
        orderIndex,
        input.description,
        input.actionType ?? "click",
        input.selector ?? null,
        input.selectorType ?? null,
        input.value ?? null,
        input.delayMs ?? 0
      );
      return db.prepare(`SELECT * FROM steps WHERE id = ?`).get(id);
    }),

  // ── Update ──────────────────────────────────────────────────────────────
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        description: z.string().min(1).optional(),
        orderIndex: z.number().int().min(0).optional(),
        actionType: z.enum(["navigate", "click", "fill", "hover", "scroll", "wait", "screenshot"]).optional(),
        selector: z.string().optional(),
        selectorType: z.enum(["css", "xpath", "testid", "role"]).optional(),
        value: z.string().optional(),
        delayMs: z.number().int().min(0).optional(),
        status: z.enum(["pending", "recording", "completed", "failed"]).optional(),
        screenshotPath: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const { id, ...fields } = input;
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (fields.description !== undefined) { sets.push("description = ?"); vals.push(fields.description); }
      if (fields.orderIndex !== undefined) { sets.push("order_index = ?"); vals.push(fields.orderIndex); }
      if (fields.actionType !== undefined) { sets.push("action_type = ?"); vals.push(fields.actionType); }
      if (fields.selector !== undefined) { sets.push("selector = ?"); vals.push(fields.selector); }
      if (fields.selectorType !== undefined) { sets.push("selector_type = ?"); vals.push(fields.selectorType); }
      if (fields.value !== undefined) { sets.push("value = ?"); vals.push(fields.value); }
      if (fields.delayMs !== undefined) { sets.push("delay_ms = ?"); vals.push(fields.delayMs); }
      if (fields.status !== undefined) { sets.push("status = ?"); vals.push(fields.status); }
      if (fields.screenshotPath !== undefined) { sets.push("screenshot_path = ?"); vals.push(fields.screenshotPath); }
      vals.push(id);
      if (sets.length === 0) return db.prepare(`SELECT * FROM steps WHERE id = ?`).get(id);
      db.prepare(`UPDATE steps SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
      return db.prepare(`SELECT * FROM steps WHERE id = ?`).get(id);
    }),

  // ── Delete ──────────────────────────────────────────────────────────────
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const db = getDb();
      db.prepare(`DELETE FROM steps WHERE id = ?`).run(input.id);
      return { success: true };
    }),

  // ── Reorder ─────────────────────────────────────────────────────────────
  reorder: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        orderedIds: z.array(z.string()),
      })
    )
    .mutation(({ input }) => {
      const db = getDb();
      const update = db.prepare(
        `UPDATE steps SET order_index = ? WHERE id = ? AND project_id = ?`
      );
      const tx = db.transaction(() => {
        input.orderedIds.forEach((id, index) => {
          update.run(index, id, input.projectId);
        });
      });
      tx();
      return { success: true };
    }),
});
