import express from 'express';
import dotenv from 'dotenv';
import patientRoutes from './routes/patients';
import medicationRoutes from './routes/medications';
import encounterRoutes from './routes/encounters';
import webhookRoutes from './routes/webhooks';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(authMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'MediTrack EMR',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api', patientRoutes);
app.use('/api', medicationRoutes);
app.use('/api', encounterRoutes);
app.use('/api', webhookRoutes);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Error] ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`MediTrack EMR running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  API:    http://localhost:${PORT}/api/patients`);
});

export default app;
