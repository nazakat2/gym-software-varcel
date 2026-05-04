import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gymRouter from "./gym";
import gymAdminRouter from "./gym-admin";
import chatbotRouter from "./chatbot";
import swaggerRouter from "./swagger";

const router: IRouter = Router();

router.use(swaggerRouter);
router.use(healthRouter);
router.use(chatbotRouter);
router.use(gymAdminRouter);
router.use(gymRouter);

export default router;
