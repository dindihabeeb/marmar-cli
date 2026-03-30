import { Router, Request, Response } from 'express';
import { addMedication, getPatientMedications, getPatient } from '../models/store';

const router = Router();

// List medications for a patient
router.get('/patients/:patientId/medications', (req: Request, res: Response) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const medications = getPatientMedications(req.params.patientId);
  res.json({ medications, count: medications.length });
});

// Prescribe a new medication
router.post('/patients/:patientId/prescriptions', (req: Request, res: Response) => {
  const patient = getPatient(req.params.patientId);
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const { name, dosage, frequency, route, prescribedBy } = req.body;

  if (!name || !dosage || !frequency) {
    return res.status(400).json({ error: 'Missing required fields: name, dosage, frequency' });
  }

  const medication = addMedication({
    patientId: req.params.patientId,
    name,
    dosage,
    frequency,
    route: route || 'oral',
    status: 'active',
    prescribedBy: prescribedBy || 'system',
    startDate: new Date().toISOString(),
  });

  // TODO: This is where medication safety checks should happen
  // before confirming the prescription

  res.status(201).json({
    medication,
    message: 'Prescription created successfully',
  });
});

// Discontinue a medication
router.post('/patients/:patientId/medications/:medId/discontinue', (req: Request, res: Response) => {
  // Simplified — in production would update the medication status
  res.json({ message: 'Medication discontinued' });
});

export default router;
