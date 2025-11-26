import { Router, Request, Response } from 'express';
import { HandoffRequestSchema } from '../types/schema';
import { saveHandoffRequest, validateContact } from '../services/handoff';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

const router = Router();

router.post('/handoff/request', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validatedRequest = HandoffRequestSchema.parse(req.body);

    // Validate contact value
    if (!validateContact(validatedRequest.contact_type, validatedRequest.contact_value)) {
      return res.status(400).json({ 
        error: `Invalid ${validatedRequest.contact_type} format` 
      });
    }

    // Get IP hash for logging
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown');
    const ipHash = logger.hashIP(ip);

    // Save handoff request and send email notification
    const record = await saveHandoffRequest(validatedRequest, ipHash);

    res.json({
      success: true,
      id: record.id,
      message: 'Your request has been submitted. Our team will contact you within 1-2 business days.'
    });
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn('handoff_validation_error', {
        errors: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
      });
      res.status(400).json({ error: 'Invalid request format' });
    } else {
      logger.error('handoff_error', { error: String(error) });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
