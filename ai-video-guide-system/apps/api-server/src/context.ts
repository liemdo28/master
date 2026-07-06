import type { Request, Response } from "express";

export interface AppContext {
  req: Request;
  res: Response;
  startTime: number;
}

export function createContext({ req, res }: { req: Request; res: Response }): AppContext {
  return { req, res, startTime: Date.now() };
}