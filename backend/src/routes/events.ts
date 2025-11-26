import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { saveEvent } from '../services/analytics';

const router = Router();

// Event schema for analytics - comprehensive event types
const EventSchema = z.object({
  event_type: z.enum([
    'session_started',
    'session_ended',
    'button_clicked',
    'intake_flow_started',
    'intake_step_completed',
    'intake_flow_completed',
    'intake_flow_abandoned',
    'faq_category_viewed',
    'faq_question_viewed',
    'faq_resolution_feedback',
    'back_button_used',
    'phi_warning_triggered',
    'error_occurred',
    'chat_opened',
    'chat_closed',
  ]),
  session_id: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

router.post('/events', async (req: Request, res: Response) => {
  try {
    const validated = EventSchema.parse(req.body);

    // Get hashed IP
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown');
    const ipHash = logger.hashIP(ip);

    // Save event to database (also logs it)
    const saved = await saveEvent({
      session_id: validated.session_id,
      event_type: validated.event_type,
      metadata: validated.metadata,
      ip_hash: ipHash,
    });

    if (saved) {
      res.json({ success: true });
    } else {
      // Event was logged but not saved to DB
      res.json({ success: true, warning: 'Event logged but not persisted' });
    }
  } catch (error) {
    logger.error('events_error', { error: String(error) });
    res.status(400).json({ error: 'Invalid event format' });
  }
});

export default router;
