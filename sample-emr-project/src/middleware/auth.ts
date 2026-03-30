import { Request, Response, NextFunction } from 'express';

// Simple API key auth middleware for the EMR itself
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check endpoints
  if (req.path === '/health' || req.path.startsWith('/webhooks/health')) {
    return next();
  }

  const apiKey = req.header('X-API-Key');
  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  // In production, validate against a database
  if (apiKey !== process.env.EMR_API_KEY && apiKey !== 'dev-key') {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}
