import { v4 as uuidv4 } from 'uuid';

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  allergies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  status: 'active' | 'discontinued' | 'on-hold';
  prescribedBy: string;
  startDate: string;
  endDate?: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  type: 'office-visit' | 'emergency' | 'telehealth' | 'follow-up';
  reason: string;
  notes: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
  };
  date: string;
  provider: string;
}

// In-memory store (replace with DB in production)
const patients: Map<string, Patient> = new Map();
const medications: Map<string, Medication> = new Map();
const encounters: Map<string, Encounter> = new Map();

export function createPatient(data: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>): Patient {
  const patient: Patient = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  patients.set(patient.id, patient);
  return patient;
}

export function getPatient(id: string): Patient | undefined {
  return patients.get(id);
}

export function listPatients(): Patient[] {
  return Array.from(patients.values());
}

export function updatePatient(id: string, data: Partial<Patient>): Patient | undefined {
  const existing = patients.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  patients.set(id, updated);
  return updated;
}

export function addMedication(data: Omit<Medication, 'id'>): Medication {
  const med: Medication = { ...data, id: uuidv4() };
  medications.set(med.id, med);
  return med;
}

export function getPatientMedications(patientId: string): Medication[] {
  return Array.from(medications.values()).filter(m => m.patientId === patientId);
}

export function addEncounter(data: Omit<Encounter, 'id'>): Encounter {
  const encounter: Encounter = { ...data, id: uuidv4() };
  encounters.set(encounter.id, encounter);
  return encounter;
}

export function getPatientEncounters(patientId: string): Encounter[] {
  return Array.from(encounters.values()).filter(e => e.patientId === patientId);
}
