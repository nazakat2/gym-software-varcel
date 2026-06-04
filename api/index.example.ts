import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "dotenv";

// Load environment variables
config();

// Middleware
import { corsOptions, securityHeaders, apiLimiter, authLimiter } from "./lib/middleware/security";
import { errorHandler, notFoundHandler } from "./lib/middleware/error-handler";

// Routes
import authRouter from "./routes/auth";
import profileRouter from "./routes/profile";
import membersRouter from "./routes/members.example";
import invoicesRouter from "./routes/invoices";
import attendanceRouter from "./routes/attendance";
import employeesRouter from "./routes/employees";

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════════════════════
// Global Middleware
// ═══════════════════════════════════════════════════════════════════════════

// Security
app.use(helmet());
app.use(cors(corsOptions));
app.use(securityHeaders);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth/", authLimiter);

// Request logging (development only)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════════════

app.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// API Routes
// ═══════════════════════════════════════════════════════════════════════════

// Authentication (public routes)
app.use("/api/auth", authRouter);
app.use("/api/auth", profileRouter); // Profile routes (protected)

// Protected routes (require authentication)
app.use("/api/members", membersRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/employees", employeesRouter);
// app.use("/api/inventory", inventoryRouter);
// app.use("/api/reports", reportsRouter);
// app.use("/api/settings", settingsRouter);

// ═══════════════════════════════════════════════════════════════════════════
// Error Handling (must be last)
// ═══════════════════════════════════════════════════════════════════════════

app.use(notFoundHandler);
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║   🏋️  Gym Management System API                                          ║
║                                                                           ║
║   Environment: ${process.env.NODE_ENV || "development"}                                                  ║
║   Port:        ${PORT}                                                        ║
║   Database:    ${process.env.DATABASE_URL ? "Connected" : "Not configured"}                                              ║
║                                                                           ║
║   API Docs:    http://localhost:${PORT}/health                              ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});

export default app;
