import { type IRouter, Router } from "express";
import { listBanks, sendSmsRoute, validateBank, validateMomo } from "../controllers/moolre.controller.js";

const router: IRouter = Router();

router.post("/validate/momo", validateMomo);
router.post("/validate/bank", validateBank);
router.post("/sms", sendSmsRoute);
router.get("/banks", listBanks);

export default router;
