import { initSentry } from "./lib/sentry";
import { WhatsAppService } from "./services/whatsapp.service";
import app from "./app";
import { logger } from "./lib/logger";

// Initialize Sentry first
// Temporarily disabled to fix OTP verification serialization issue
// initSentry();

// Initialize WhatsApp service (optional - only if enabled)
console.log("🔍 ENABLE_WHATSAPP:", process.env.ENABLE_WHATSAPP);
if (process.env.ENABLE_WHATSAPP === "true") {
  console.log("🚀 Starting WhatsApp service initialization...");
  WhatsAppService.initialize()
    .then(() => logger.info("WhatsApp service initialized"))
    .catch((err) => logger.error({ err }, "Failed to initialize WhatsApp"));
} else {
  console.log("⚠️  WhatsApp service disabled (ENABLE_WHATSAPP not set to 'true')");
}

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
