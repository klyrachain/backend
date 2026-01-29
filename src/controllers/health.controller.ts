import type { Request, Response } from "express";
import { getHealth } from "../services/health.service.js";

export function health(_req: Request, res: Response): void {
  const data = getHealth();
  res.status(200).json(data);
}
