import { Router, Request, Response } from 'express';

const router = Router();

// Webhook receiver for external system notifications
router.post('/webhooks/notifications', (req: Request, res: Response) => {
  const event = req.body;

  console.log(`[Webhook] Received event: ${event.type || 'unknown'}`);

  // TODO: Verify webhook signatures
  // TODO: Handle different event types

  switch (event.type) {
    case 'lab.result.ready':
      console.log(`  Lab result for patient ${event.patientId}`);
      break;
    case 'referral.received':
      console.log(`  Referral from ${event.source}`);
      break;
    default:
      console.log(`  Unhandled event type: ${event.type}`);
  }

  res.status(204).send();
});

// Health check for webhook endpoint
router.get('/webhooks/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
