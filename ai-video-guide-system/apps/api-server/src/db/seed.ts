import { getDb, closeDb } from "./database.js";
import { config } from "../config.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function seed() {
  console.log(`Seeding database: ${config.databaseUrl}`);
  const db = getDb();

  const projectId = uuidv4();
  db.prepare(`INSERT OR IGNORE INTO video_projects (id, name, description, status, target_url)
    VALUES (?, ?, ?, ?, ?)`).run(
    projectId,
    "Demo: Getting Started with GitHub",
    "A walkthrough of the GitHub dashboard and repository creation flow.",
    "draft",
    "https://github.com/login"
  );

  const stepIds = [uuidv4(), uuidv4(), uuidv4()];
  const insertStep = db.prepare(`INSERT OR IGNORE INTO steps
    (id, project_id, order_index, description, action_type, selector, selector_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  insertStep.run(stepIds[0], projectId, 0, "Navigate to GitHub login", "navigate", null, null, "completed");
  insertStep.run(stepIds[1], projectId, 1, "Click the sign-in button", "click", "#login form button[type=submit]", "css", "pending");
  insertStep.run(stepIds[2], projectId, 2, "Enter username and password", "fill", "#login_field", "css", "pending");

  closeDb();
  console.log("Seed data inserted successfully.");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});