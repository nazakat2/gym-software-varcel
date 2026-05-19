import { initSentry } from "./lib/sentry";
import { WhatsAppService } from "./services/whatsapp.service";
import app from "./app";
import { logger } from "./lib/logger";

// Initialize Sentry first
initSentry();

// Initialize WhatsApp service (optional - only if enabled)
if (process.env.ENABLE_WHATSAPP === "true") {
  WhatsAppService.initialize()
    .then(() => logger.info("WhatsApp service initialized"))
    .catch((err) => logger.error({ err }, "Failed to initialize WhatsApp"));
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
