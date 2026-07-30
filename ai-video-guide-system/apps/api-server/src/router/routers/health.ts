import { publicProcedure, router } from "../_app.js";
import { getDb } from "../../db/database.js";

export const healthRouter = router({
  check: publicProcedure.query(() => {
    try {
      const db = getDb();
      db.prepare("SELECT 1").get();
      return { status: "ok", timestamp: new Date().toISOString() };
    } catch (err) {
      return { status: "error", error: String(err), timestamp: new Date().toISOString() };
    }
  }),
});