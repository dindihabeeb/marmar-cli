import { Router, Request, Response } from 'express';
import { createPatient, getPatient, listPatients, updatePatient } from '../models/store';

const router = Router();

// List all patients
router.get('/patients', (req: Request, res: Response) => {
  const patients = listPatients();
  res.json({ patients, count: patients.length });
});

// Get a single patient by ID
router.get('/patients/:id', (req: Request, res: Response) => {
  const patient = getPatient(req.params.id);
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  res.json(patient);
});

// Create a new patient
router.post('/patients', (req: Request, res: Response) => {
  const { mrn, firstName, lastName, dateOfBirth, sex, phone, allergies } = req.body;

  if (!mrn || !firstName || !lastName || !dateOfBirth || !sex) {
    return res.status(400).json({ error: 'Missing required fields: mrn, firstName, lastName, dateOfBirth, sex' });
  }

  const patient = createPatient({
    mrn,
    firstName,
    lastName,
    dateOfBirth,
    sex,
    phone,
    allergies: allergies || [],
  });

  res.status(201).json(patient);
});

// Update a patient
router.put('/patients/:id', (req: Request, res: Response) => {
  const updated = updatePatient(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  res.json(updated);
});

export default router;
