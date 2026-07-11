export type Currency = 'USD' | 'KHR';
export type Language = 'en' | 'km';
export type Screen = 'home' | 'add' | 'categories' | 'detail' | 'goals' | 'insights' | 'settings' | 'onboarding';
export type BudgetMode = 'balanced' | 'saver' | 'custom';
export type TransactionKind = 'expense' | 'income';
export type Sheet = 'income' | 'fixed' | 'loan' | 'method' | 'cycle' | 'currency' | 'reminder' | 'category' | 'entry' | 'iou' | 'goal' | 'recurring' | 'day' | 'month' | 'formula' | null;

export type Category = {
  key: string;
  label: string;
  icon: string;
  color: string;
  spentUsd: number;
  budgetUsd: number;
};

export type ExpensePredictionSource = 'correction' | 'keyword' | 'classifier' | 'fallback';

export type ExpensePrediction = {
  cleanLabel: string;
  predictedCategoryKey: string;
  predictionSource: ExpensePredictionSource;
  confidence: number;
};

export type Expense = {
  id: string;
  name: string;
  cat: string;
  amount: number;
  cur: Currency;
  time: string;
  date: string;
  kind?: TransactionKind;
  note?: string;
  prediction?: ExpensePrediction;
  importSourceHash?: string;
};

export type CategoryTrainingExample = {
  id: string;
  rawText: string;
  cleanLabel: string;
  categoryKey: string;
  predictedCategoryKey?: string;
  predictionSource?: string;
  confidence?: number;
  corrected: boolean;
  createdAtDay: string;
  sourceType?: 'free_text' | 'aba_statement';
  kindHint?: 'purchase' | 'transfer_in' | 'transfer_out' | 'other';
  localeHint?: 'en' | 'km-Latn' | 'mixed';
};

export type FastEntryMemory = Record<string, { cat: string; lastUsed: string }>;


export type Goal = {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  perMonth: number;
  cur: Currency;
  celebrated?: boolean;
};

export type Iou = {
  id: string;
  person: string;
  amount: number;
  cur: Currency;
  due: string;
};

export type RecurringPayment = {
  id: string;
  name: string;
  amount: number;
  cur: Currency;
  dueDay: number;
};

export type AppModel = {
  onboarded: boolean;
  onbStep: number;
  screen: Screen;
  dark: boolean;
  language: Language;
  salary: number;
  salaryCur: Currency;
  budgetCycleStartDay: number;
  rate: number;
  exchangeRateLastFetchedDay: string | null;
  exchangeRateSource: string;
  rent: number;
  utilities: number;
  loan: number;
  rentDue: number;
  loanDue: number;
  method: BudgetMode;
  custom: { needs: number; wants: number; save: number };
  baseCur: Currency;
  swept: boolean;
  notify: string;
  billReminders: boolean;
  defaultCategoriesSeeded: boolean;
  categories: Category[];
  expenses: Expense[];
  goals: Goal[];
  ious: Iou[];
  recurringPayments: RecurringPayment[];
  history: number[];
  rolloverUsd: number;
  lastActiveDay: string;
  lastActiveMonth: string;
  paidBills: Record<string, boolean>;
  fastEntryMemory: FastEntryMemory;
  merchantCorrections: Record<string, string>;
  categoryTrainingExamples: CategoryTrainingExample[];
  categoryModelVersion: string | null;
};

export type Drafts = {
  addText: string;
  addNote: string;
  transactionKind: TransactionKind;
  selectedCat: string;
  selectedExpenseId: string | null;
  entryCur: Currency;
  expenseDate: string;
  selectedDay: number;
  transactionSearch: string;
  transactionTypeFilter: TransactionKind | 'all';
  transactionCategoryFilter: string;
  transactionMonth: string;
  categoryName: string;
  categoryBudget: string;
  categoryIcon: string;
  categoryColor: string;
  categoryEditKey: string | null;
  iouPerson: string;
  iouAmount: string;
  iouDue: string;
  iouEditId: string | null;
  recurringName: string;
  recurringAmount: string;
  recurringCur: Currency;
  recurringDueDay: number;
  recurringEditId: string | null;
  goalName: string;
  goalTarget: string;
  goalPer: string;
};
