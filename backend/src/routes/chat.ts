import { Router, Request, Response } from 'express';
import { ChatRequestSchema, BotResponseSchema } from '../types/schema';
import { handleChatMessage } from '../services/chat';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    // DEBUG: Log every request to /api/chat
    logger.info('chat_endpoint_hit', {
      message_preview: req.body.message?.substring(0, 50),
      session_id: req.body.session_id,
      state: req.body.session_data?.state,
    });

    // Validate request
    const validatedRequest = ChatRequestSchema.parse(req.body);

    // Get IP hash for logging
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown');
    const ipHash = logger.hashIP(ip);

    // Handle chat message
    const response = await handleChatMessage(validatedRequest, ipHash);

    // Validate response against schema
    const validatedResponse = BotResponseSchema.parse(response);

    res.json(validatedResponse);
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('validation_error', {
        errors: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
      });
      res.status(400).json({ error: 'Invalid request format' });
    } else {
      logger.error('chat_error', { error: String(error) });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
