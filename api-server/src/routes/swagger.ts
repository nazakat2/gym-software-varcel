import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../config/swagger";

const router = Router();

/**
 * @openapi
 * /doc:
 *   get:
 *     tags:
 *       - Documentation
 *     summary: API Documentation
 *     description: Interactive Swagger UI documentation for all API endpoints
 *     responses:
 *       200:
 *         description: Swagger UI page
 */
router.use("/doc", swaggerUi.serve);
router.get("/doc", swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Gym Management API Docs",
}));

// JSON endpoint for the OpenAPI spec
router.get("/doc.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

export default router;
