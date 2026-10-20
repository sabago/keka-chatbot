import { Router, Request, Response } from 'express';
import { ChatRequestSchema, BotResponseSchema } from '../types/schema';
import { handleChatMessage } from '../services/chat';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validatedRequest = ChatRequestSchema.parse(req.body);

    // Older frontend builds sent the full chat transcript inside session_data.
    // Drop it so text a visitor typed is never processed or echoed back.
    if (validatedRequest.session_data) {
      delete validatedRequest.session_data.chat_transcript;
    }

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
        // Path and code only: some zod messages repeat the submitted value.
        errors: error.errors.map(e => ({ path: e.path.join('.'), code: e.code })),
      });
      res.status(400).json({ error: 'Invalid request format' });
    } else {
      logger.error('chat_error', { error: String(error) });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
