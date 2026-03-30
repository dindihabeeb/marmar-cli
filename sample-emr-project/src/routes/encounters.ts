import { Router, Request, Response } from 'express';
import { addEncounter, getPatientEncounters, getPatient } from '../models/store';

const router = Router();

// List encounters for a patient
router.get('/patients/:patientId/encounters', (req: Request, res: Response) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const encounters = getPatientEncounters(req.params.patientId);
  res.json({ encounters, count: encounters.length });
});

// Record a new clinical encounter
router.post('/patients/:patientId/encounters', (req: Request, res: Response) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const { type, reason, notes, vitals, provider } = req.body;

  if (!type || !reason || !provider) {
    return res.status(400).json({ error: 'Missing required fields: type, reason, provider' });
  }

  const encounter = addEncounter({
    patientId: req.params.patientId,
    type,
    reason,
    notes: notes || '',
    vitals,
    date: new Date().toISOString(),
    provider,
  });

  res.status(201).json(encounter);
});

export default router;
