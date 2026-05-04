import { Router, type IRouter } from "express";
import { callCohereChat, type ChatMessage } from "../services/cohereService.js";
import { buildChatMessages, sanitizeUserMessage } from "../utils/chatPromptBuilder.js";

const router: IRouter = Router();

// Simple in-memory rate limiter: max 30 requests per IP per minute
const rateBuckets: Map<string, { count: number; resetAt: number }> = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || now > b.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

/**
 * @openapi
 * /chatbot/message:
 *   post:
 *     tags:
 *       - Chatbot
 *     summary: Send message to AI chatbot
 *     description: Send a message to the gym AI assistant and receive a response. Rate limited to 30 requests per minute per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: What are your gym hours?
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Chatbot response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *       400:
 *         description: Invalid request
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Chatbot service error
 */
router.post("/chatbot/message", async (req, res) => {
  const ip = (req.ip || req.socket?.remoteAddress || "unknown").toString();
  if (!rateLimitOk(ip)) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  try {
    const { message, history } = req.body || {};
    const userMessage = sanitizeUserMessage(String(message || ""));
    if (!userMessage) {
      return res.status(400).json({ error: "Message is required." });
    }

    const safeHistory: ChatMessage[] = Array.isArray(history) ? history : [];
    const messages = buildChatMessages(userMessage, safeHistory);

    const result = await callCohereChat(messages);
    if (!result.text) {
      return res.status(502).json({
        error: "The assistant did not return a response. Please try again.",
      });
    }
    return res.json({ reply: result.text });
  } catch (err: any) {
    const isAbort = err?.name === "AbortError";
    return res.status(isAbort ? 504 : 500).json({
      error: isAbort
        ? "The assistant took too long to respond. Please try again."
        : "Sorry, the assistant is temporarily unavailable. Please try again in a moment.",
    });
  }
});

export default router;
