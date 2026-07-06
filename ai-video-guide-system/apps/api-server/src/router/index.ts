import { router } from "./_app.js";
import { projectRouter } from "./routers/project.js";
import { stepRouter } from "./routers/step.js";
import { captureRouter } from "./routers/capture.js";
import { renderJobRouter } from "./routers/renderJob.js";
import { selectorRegistryRouter } from "./routers/selectorRegistry.js";
import { healthRouter } from "./routers/health.js";
import { walkthroughRouter } from "./routers/walkthrough.js";

export const appRouter = router({
  health: healthRouter,
  project: projectRouter,
  step: stepRouter,
  capture: captureRouter,
  renderJob: renderJobRouter,
  selectorRegistry: selectorRegistryRouter,
  walkthrough: walkthroughRouter,
});

export type AppRouter = typeof appRouter;
