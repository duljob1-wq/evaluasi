import { Training, Response, GlobalQuestion, Contact, AppSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

const TRAININGS_KEY = 'evalapp_trainings';
const RESPONSES_KEY = 'evalapp_responses';
const GLOBAL_QUESTIONS_KEY = 'evalapp_global_questions';
const CONTACTS_KEY = 'evalapp_contacts';
const SETTINGS_KEY = 'evalapp_settings';

// Helper to generate 5-char code
const generateCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export const getTrainings = (): Training[] => {
  const data = localStorage.getItem(TRAININGS_KEY);
  if (!data) return [];
  
  const trainings: Training[] = JSON.parse(data);
  
  // Migration: Ensure all trainings have an access code
  let hasChanges = false;
  const updated = trainings.map(t => {
      let tModified = { ...t };
      if (!tModified.accessCode) {
          hasChanges = true;
          tModified.accessCode = generateCode();
      }
      // Ensure targets array exists
      if (!tModified.targets) {
          tModified.targets = [];
      }
      if (!tModified.reportedTargets) {
          tModified.reportedTargets = {};
      }
      return tModified;
  });

  if (hasChanges) {
      localStorage.setItem(TRAININGS_KEY, JSON.stringify(updated));
  }

  return updated;
};

export const saveTraining = (training: Training): void => {
  const trainings = getTrainings();
  
  // Check if updating or new
  const index = trainings.findIndex(t => t.id === training.id);
  if (index >= 0) {
      // Preserve reportedTargets if updating existing training to avoid re-sending
      const existing = trainings[index];
      training.reportedTargets = existing.reportedTargets || {}; 
      trainings[index] = training;
  } else {
      if (!training.accessCode) training.accessCode = generateCode();
      if (!training.targets) training.targets = [];
      if (!training.reportedTargets) training.reportedTargets = {};
      trainings.push(training);
  }
  
  localStorage.setItem(TRAININGS_KEY, JSON.stringify(trainings));
};

export const deleteTraining = (id: string): void => {
  const trainings = getTrainings().filter(t => t.id !== id);
  localStorage.setItem(TRAININGS_KEY, JSON.stringify(trainings));
};

export const getTrainingById = (id: string): Training | undefined => {
  return getTrainings().find(t => t.id === id);
};

export const getTrainingByCode = (code: string): Training | undefined => {
  return getTrainings().find(t => t.accessCode === code.toUpperCase());
};

export const getResponses = (trainingId: string): Response[] => {
  const allResponses = localStorage.getItem(RESPONSES_KEY);
  const parsed: Response[] = allResponses ? JSON.parse(allResponses) : [];
  return parsed.filter(r => r.trainingId === trainingId);
};

export const saveResponse = (response: Response): void => {
  const allResponses = localStorage.getItem(RESPONSES_KEY);
  const parsed: Response[] = allResponses ? JSON.parse(allResponses) : [];
  parsed.push(response);
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(parsed));
};

// --- GLOBAL VARIABLES (DATABASE) ---

const DEFAULT_QUESTIONS: GlobalQuestion[] = [
    { id: 'def-1', label: 'Penguasaan Materi', type: 'star', category: 'facilitator', isDefault: true },
    { id: 'def-2', label: 'Metode Penyampaian', type: 'star', category: 'facilitator', isDefault: true },
    { id: 'def-3', label: 'Interaksi dengan Peserta', type: 'slider', category: 'facilitator', isDefault: true },
    { id: 'def-4', label: 'Kenyamanan Ruangan', type: 'star', category: 'process', isDefault: true },
    { id: 'def-5', label: 'Kualitas Konsumsi', type: 'star', category: 'process', isDefault: true },
];

export const getGlobalQuestions = (): GlobalQuestion[] => {
    const data = localStorage.getItem(GLOBAL_QUESTIONS_KEY);
    if (!data) {
        // Initialize with hardcoded defaults if empty
        localStorage.setItem(GLOBAL_QUESTIONS_KEY, JSON.stringify(DEFAULT_QUESTIONS));
        return DEFAULT_QUESTIONS;
    }
    return JSON.parse(data);
};

export const saveGlobalQuestion = (question: GlobalQuestion): void => {
    const questions = getGlobalQuestions();
    const idx = questions.findIndex(q => q.id === question.id);
    if (idx >= 0) {
        questions[idx] = question;
    } else {
        questions.push(question);
    }
    localStorage.setItem(GLOBAL_QUESTIONS_KEY, JSON.stringify(questions));
};

export const deleteGlobalQuestion = (id: string): void => {
    const questions = getGlobalQuestions().filter(q => q.id !== id);
    localStorage.setItem(GLOBAL_QUESTIONS_KEY, JSON.stringify(questions));
};

// --- CONTACTS / FACILITATORS DATABASE ---

export const getContacts = (): Contact[] => {
    const data = localStorage.getItem(CONTACTS_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveContact = (contact: Contact): void => {
    const contacts = getContacts();
    const idx = contacts.findIndex(c => c.id === contact.id);
    if (idx >= 0) {
        contacts[idx] = contact;
    } else {
        contacts.push(contact);
    }
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
};

export const deleteContact = (id: string): void => {
    const contacts = getContacts().filter(c => c.id !== id);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
};

// --- SETTINGS ---

const DEFAULT_SETTINGS: AppSettings = {
    waApiKey: 'EK2EfGtaTtnQxdwTnWW7',
    waBaseUrl: 'https://api.fonnte.com/send',
    waFooter: 'Terima kasih telah memberikan yang terbaik!'
};

export const getSettings = (): AppSettings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings): void => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};