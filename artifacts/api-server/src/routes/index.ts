import { Router, type IRouter } from "express";
import healthRouter from "./health";
import energyRouter from "./energy";
import authRouter from "./auth";
import changesetsRouter from "./changesets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(energyRouter);
router.use(authRouter);
router.use(changesetsRouter);

export default router;
