import { type IRouter, Router } from "express";
import { getAddressByEnsName, getNameByAddress } from "../controllers/ens.controller.js";

const router: IRouter = Router();

router.get("/name/:address", getNameByAddress);
router.get("/address", getAddressByEnsName);

export default router;
