import { isoDayFromDate, isoMonthFromDay } from '../domain/dates';
import type { AppModel, Drafts } from './types';

export const RATE = 4100;

export const INITIAL_DAY = isoDayFromDate(new Date());
export const INITIAL_MONTH = isoMonthFromDay(INITIAL_DAY);

export const PALETTE = [
  '#ef8b4f', '#f0663f', '#e0603a', '#e05a8a', '#ec4899', '#9b6dff', '#7c5cff', '#8b5cf6',
  '#5b8def', '#3ba6d4', '#0ea5b7', '#14b8a6', '#1f9d6b', '#5aa84a', '#d4b03b', '#d98a00',
  '#f59e0b', '#b06a4a', '#8a8d99', '#6d7a8c', '#d45b5b',
];

export const INITIAL_MODEL: AppModel = {
  onboarded: false,
  onbStep: 1,
  screen: 'onboarding',
  dark: false,
  salary: 0,
  salaryCur: 'USD',
  rate: RATE,
  rent: 0,
  utilities: 0,
  loan: 0,
  rentDue: 1,
  loanDue: 15,
  method: 'balanced',
  custom: { needs: 45, wants: 25, save: 30 },
  baseCur: 'USD',
  swept: false,
  notify: '21:00',
  billReminders: true,
  categories: [],
  expenses: [],
  goals: [],
  ious: [],
  history: [],
  rolloverUsd: 0,
  paidBills: {},
  lastActiveDay: INITIAL_DAY,
  lastActiveMonth: INITIAL_MONTH,
};

export const INITIAL_DRAFTS: Drafts = {
  addText: '',
  addNote: '',
  selectedCat: '',
  selectedExpenseId: null,
  entryCur: 'USD',
  expenseDate: INITIAL_DAY,
  selectedDay: 34,
  categoryName: '',
  categoryBudget: '50',
  categoryIcon: 'category',
  categoryColor: PALETTE[0],
  categoryEditKey: null,
  iouPerson: '',
  iouAmount: '',
  iouDue: '',
  iouEditId: null,
  goalName: '',
  goalTarget: '',
  goalPer: '',
};
