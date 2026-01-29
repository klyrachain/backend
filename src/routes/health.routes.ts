import { type IRouter, Router } from "express";
import { health } from "../controllers/health.controller.js";

const router: IRouter = Router();

router.get("/", health);

export default router;
