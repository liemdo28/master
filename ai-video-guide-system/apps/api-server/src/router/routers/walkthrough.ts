import { publicProcedure, router } from "../_app.js";
import { z } from "zod";
import axios from "axios";

const RUNNER_URL = process.env.PLAYWRIGHT_RUNNER_URL ?? "http://localhost:3002";

export const walkthroughRouter = router({
  // Start a new walkthrough job
  create: publicProcedure
    .input(
      z.object({
        targetUrl: z.string().url(),
        username: z.string().optional(),
        password: z.string().optional(),
        subtitles: z.boolean().default(false),
        voice: z.boolean().default(false),
        voiceName: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const jobId = `wt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      try {
        await axios.post(`${RUNNER_URL}/walkthrough`, {
          jobId,
          targetUrl: input.targetUrl,
          username: input.username ?? "",
          password: input.password ?? "",
          subtitles: input.subtitles,
          voice: input.voice,
          voiceName: input.voiceName,
          label: input.label,
        });
      } catch (err) {
        // Runner may not be running — still create the job locally
        console.warn("[walkthrough router] runner unreachable:", String(err));
      }

      return { jobId, status: "queued" };
    }),

  // Poll job status
  status: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      try {
        const res = await axios.get(`${RUNNER_URL}/walkthrough/status/${input.jobId}`);
        return res.data;
      } catch (err) {
        return {
          id: input.jobId,
          status: "unknown",
          progress: 0,
          message: "Unable to reach runner service",
          steps: [],
          error: String(err),
        };
      }
    }),

  // Get video download URL
  videoUrl: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      return `${RUNNER_URL}/walkthrough/file/${input.jobId}`;
    }),
});
