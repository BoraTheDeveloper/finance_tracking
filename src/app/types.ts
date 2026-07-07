export type Currency = 'USD' | 'KHR';
export type Screen = 'home' | 'add' | 'categories' | 'detail' | 'goals' | 'insights' | 'settings' | 'onboarding';
export type BudgetMode = 'balanced' | 'saver' | 'custom';
export type Sheet = 'income' | 'fixed' | 'loan' | 'method' | 'currency' | 'reminder' | 'category' | 'entry' | 'iou' | 'goal' | 'day' | 'month' | 'formula' | null;

export type Category = {
  key: string;
  label: string;
  icon: string;
  color: string;
  spentUsd: number;
  budgetUsd: number;
};

export type Expense = {
  id: string;
  name: string;
  cat: string;
  amount: number;
  cur: Currency;
  time: string;
  date: string;
  note?: string;
};

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

export type AppModel = {
  onboarded: boolean;
  onbStep: number;
  screen: Screen;
  dark: boolean;
  salary: number;
  salaryCur: Currency;
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
  history: number[];
  rolloverUsd: number;
  lastActiveDay: string;
  lastActiveMonth: string;
  paidBills: Record<string, boolean>;
};

export type Drafts = {
  addText: string;
  addNote: string;
  selectedCat: string;
  selectedExpenseId: string | null;
  entryCur: Currency;
  expenseDate: string;
  selectedDay: number;
  categoryName: string;
  categoryBudget: string;
  categoryIcon: string;
  categoryColor: string;
  categoryEditKey: string | null;
  iouPerson: string;
  iouAmount: string;
  iouDue: string;
  iouEditId: string | null;
  goalName: string;
  goalTarget: string;
  goalPer: string;
};
