import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@ai-video-guide/api-server/router";

export const trpc = createTRPCReact<AppRouter>();
