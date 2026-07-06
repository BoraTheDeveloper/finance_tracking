import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  KantumruyPro_400Regular,
  KantumruyPro_500Medium,
  KantumruyPro_600SemiBold,
  KantumruyPro_700Bold,
} from '@expo-google-fonts/kantumruy-pro';
import { saveAppState, loadAppState } from './src/db/appStorage';
import { BALANCED, SAVER, summarizeBudget } from './src/domain/budget';
import { parseExpenseText } from './src/domain/expenseParser';
import { bestAndWorst, buildHeatmap } from './src/domain/insights';
import { formatMoney, formatMoney0, money } from './src/domain/money';

type Currency = 'USD' | 'KHR';
type Screen = 'home' | 'add' | 'categories' | 'detail' | 'goals' | 'insights' | 'settings' | 'onboarding';
type BudgetMode = 'balanced' | 'saver';
type Sheet = 'income' | 'fixed' | 'loan' | 'method' | 'currency' | 'reminder' | 'category' | 'entry' | 'iou' | 'goal' | 'day' | null;

type Category = {
  key: string;
  label: string;
  icon: string;
  color: string;
  spentUsd: number;
  budgetUsd: number;
};

type Expense = {
  id: string;
  name: string;
  cat: string;
  amount: number;
  cur: Currency;
  time: string;
  note?: string;
};

type Goal = {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  perMonth: number;
  cur: Currency;
  celebrated?: boolean;
};

type Iou = {
  id: string;
  person: string;
  amount: number;
  cur: Currency;
  due: string;
};

type AppModel = {
  onboarded: boolean;
  onbStep: number;
  screen: Screen;
  dark: boolean;
  salary: number;
  salaryCur: Currency;
  rate: number;
  rent: number;
  utilities: number;
  loan: number;
  rentDue: number;
  loanDue: number;
  method: BudgetMode;
  notify: string;
  billReminders: boolean;
  categories: Category[];
  expenses: Expense[];
  goals: Goal[];
  ious: Iou[];
  history: number[];
  paidBills: Record<string, boolean>;
};

type Drafts = {
  addText: string;
  addNote: string;
  selectedCat: string;
  selectedExpenseId: string | null;
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

const RATE = 4100;

const PALETTE = [
  '#ef8b4f', '#f0663f', '#e0603a', '#e05a8a', '#ec4899', '#9b6dff', '#7c5cff', '#8b5cf6',
  '#5b8def', '#3ba6d4', '#0ea5b7', '#14b8a6', '#1f9d6b', '#5aa84a', '#d4b03b', '#d98a00',
  '#f59e0b', '#b06a4a', '#8a8d99', '#6d7a8c', '#d45b5b',
];

const INITIAL_MODEL: AppModel = {
  onboarded: false,
  onbStep: 1,
  screen: 'onboarding',
  dark: false,
  salary: 1200,
  salaryCur: 'USD',
  rate: RATE,
  rent: 350,
  utilities: 35,
  loan: 150,
  rentDue: 1,
  loanDue: 15,
  method: 'balanced',
  notify: '21:00',
  billReminders: true,
  categories: [
    { key: 'food', label: 'Food', icon: 'restaurant', color: '#ef8b4f', spentUsd: 23.5, budgetUsd: 140 },
    { key: 'ent', label: 'Entertainment', icon: 'movie', color: '#7c5cff', spentUsd: 15, budgetUsd: 110 },
    { key: 'transport', label: 'Transport', icon: 'directions-bus', color: '#3ba6d4', spentUsd: 4.18, budgetUsd: 50 },
    { key: 'bills', label: 'Bills', icon: 'receipt-long', color: '#d98a00', spentUsd: 17, budgetUsd: 60 },
    { key: 'shopping', label: 'Shopping', icon: 'shopping-bag', color: '#e05a8a', spentUsd: 10, budgetUsd: 60 },
    { key: 'health', label: 'Health', icon: 'medical-services', color: '#1f9d6b', spentUsd: 5, budgetUsd: 40 },
    { key: 'other', label: 'Other', icon: 'category', color: '#8a8d99', spentUsd: 0, budgetUsd: 25 },
  ],
  expenses: [
    { id: 'seed-phone', name: 'Phone top-up', cat: 'bills', amount: 2, cur: 'USD', time: '6:05 PM' },
    { id: 'seed-lunch', name: 'Lunch', cat: 'food', amount: 3, cur: 'USD', time: '12:30 PM' },
    { id: 'seed-bus', name: 'Bus to work', cat: 'transport', amount: 4000, cur: 'KHR', time: '8:40 AM' },
    { id: 'seed-coffee', name: 'Morning coffee', cat: 'food', amount: 2.5, cur: 'USD', time: '8:15 AM' },
  ],
  goals: [{ id: 'seed-goal', name: 'Malaysia trip', icon: 'flight', target: 600, saved: 180, perMonth: 100, cur: 'USD' }],
  ious: [{ id: 'seed-iou', person: 'Sokha', amount: 25, cur: 'USD', due: 'early Aug' }],
  history: [12, 8, 0, 17, 22, 9, 14, 6, 19, 11, 0, 25, 7, 13, 10, 8, 16, 21, 5, 0, 12, 9, 28, 7, 14, 11, 6, 18, 8, 0, 13, 19, 24, 10, 9],
  paidBills: {},
};

const INITIAL_DRAFTS: Drafts = {
  addText: '',
  addNote: '',
  selectedCat: 'food',
  selectedExpenseId: null,
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

const LIGHT = {
  page: '#f5f6f8',
  surface: '#ffffff',
  surface2: '#f0f1f6',
  text: '#1a1b22',
  muted: '#71727e',
  faint: '#a4a5af',
  line: '#ecedf1',
  primary: '#4f46e5',
  primaryWash: '#ecebfd',
  ringTrack: '#e3e5ee',
  green: '#1f8a5b',
  amber: '#c8820a',
  red: '#d84c3f',
};

const DARK = {
  page: '#0f1117',
  surface: '#191b22',
  surface2: '#20222c',
  text: '#eceef4',
  muted: '#9498a6',
  faint: '#5f616d',
  line: '#262932',
  primary: '#8b83ff',
  primaryWash: '#26243f',
  ringTrack: '#2b2e3a',
  green: '#3fbc86',
  amber: '#e0a63a',
  red: '#f0685c',
};

// Plus Jakarta Sans — the primary (Latin/English) type family.
const FONT = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

// Kantumruy Pro — used for Khmer script (e.g. the riel sign ៛). Kantumruy has no
// 800 weight, so the extrabold tier maps to its 700 Bold.
const KHMER_FONT = {
  regular: 'KantumruyPro_400Regular',
  medium: 'KantumruyPro_500Medium',
  semibold: 'KantumruyPro_600SemiBold',
  bold: 'KantumruyPro_700Bold',
  extrabold: 'KantumruyPro_700Bold',
};

// Maps each Jakarta family to its Kantumruy counterpart so a Khmer-bearing string
// keeps its weight while switching script family. RN has no CSS-style per-glyph
// fallback, so we route the whole Text node.
const JAKARTA_TO_KHMER: Record<string, string> = {
  [FONT.regular]: KHMER_FONT.regular,
  [FONT.medium]: KHMER_FONT.medium,
  [FONT.semibold]: KHMER_FONT.semibold,
  [FONT.bold]: KHMER_FONT.bold,
  [FONT.extrabold]: KHMER_FONT.extrabold,
};

const KHMER_RANGE = /[ក-៿᧠-᧿]/;

function hasKhmer(node: ReactNode): boolean {
  if (typeof node === 'string' || typeof node === 'number') return KHMER_RANGE.test(String(node));
  if (Array.isArray(node)) return node.some(hasKhmer);
  return false;
}

// Drop-in Text that renders Khmer content (the riel sign, etc.) in Kantumruy Pro
// while leaving Latin content in Plus Jakarta Sans.
function AppText({ style, children, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) as { fontFamily?: string } | undefined;
  const family = flat?.fontFamily;
  const khmerStyle = family && hasKhmer(children) && JAKARTA_TO_KHMER[family] ? { fontFamily: JAKARTA_TO_KHMER[family] } : null;
  return <Text style={[style, khmerStyle]} {...rest}>{children}</Text>;
}

type IconName = keyof typeof MaterialIcons.glyphMap;

// Older persisted state (and pre-icon-picker categories) stored emoji; map them to
// Material Symbol names so the vector icons render consistently.
const ICON_ALIASES: Record<string, IconName> = {
  '🍜': 'restaurant',
  '🎬': 'movie',
  '🚌': 'directions-bus',
  '🧾': 'receipt-long',
  '🛍️': 'shopping-bag',
  '🛍': 'shopping-bag',
  '➕': 'medical-services',
  '✨': 'category',
  '✈️': 'flight',
  '✈': 'flight',
  '👛': 'account-balance-wallet',
  '🎯': 'savings',
};

function iconName(value: string): IconName {
  if (!value) return 'category';
  if (value in ICON_ALIASES) return ICON_ALIASES[value];
  const normalized = value.replace(/_/g, '-') as IconName;
  return normalized in MaterialIcons.glyphMap ? normalized : 'category';
}

function Glyph({ name, size = 22, color }: { name: string; size?: number; color: string }) {
  return <MaterialIcons name={iconName(name)} size={size} color={color} />;
}

// Full picker set from the design, filtered to icons that exist in MaterialIcons.
const ICON_SET: IconName[] = ([
  'category', 'restaurant', 'local-cafe', 'fastfood', 'local-bar', 'cake', 'shopping-bag', 'shopping-cart',
  'checkroom', 'card-giftcard', 'directions-bus', 'directions-car', 'local-gas-station', 'train', 'flight',
  'receipt-long', 'bolt', 'water-drop', 'wifi', 'phone-iphone', 'movie', 'sports-esports', 'music-note',
  'fitness-center', 'spa', 'self-improvement', 'medical-services', 'medication', 'pets', 'school', 'book',
  'home', 'chair', 'savings', 'wallet', 'work', 'brush', 'celebration',
] as IconName[]).filter((n) => n in MaterialIcons.glyphMap);

function usd(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function usd0(amount: number) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

function khr(amount: number) {
  return `${Math.round(amount).toLocaleString('en-US')}៛`;
}

function amountUsd(amount: number, cur: Currency, rate: number) {
  return cur === 'KHR' ? amount / rate : amount;
}

function amountLabel(amount: number, cur: Currency) {
  return cur === 'KHR' ? khr(amount) : usd(amount);
}

function ordinal(n: number) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = n % 100;
  return `${n}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

// Days until the next occurrence of a monthly due-day (1–31), from today.
function daysUntilDue(dueDay: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  let due = new Date(year, month, dueDay);
  if (due.getTime() < new Date(year, month, today.getDate()).getTime()) due = new Date(year, month + 1, dueDay);
  return Math.round((due.getTime() - new Date(year, month, today.getDate()).getTime()) / 86400000);
}

function dueText(dueDay: number) {
  const days = daysUntilDue(dueDay);
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

// "21:00" -> a Date today at that time (for the time picker).
function notifyToDate(hhmm: string) {
  const [hour, minute] = (hhmm || '21:00').split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isFinite(hour) ? hour : 21, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date;
}

// "21:00" -> "9:00 PM"
function formatClock(hhmm: string) {
  const [rawHour, rawMinute] = (hhmm || '21:00').split(':');
  let hour = Number(rawHour);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${(rawMinute ?? '00').padStart(2, '0')} ${suffix}`;
}

function nowTime() {
  const date = new Date();
  let hour = date.getHours();
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

function categoryFor(categories: Category[], key: string) {
  return categories.find((category) => category.key === key) ?? categories[categories.length - 1];
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function RingBudget({ pct, color, bg }: { pct: number; color: string; bg: string }) {
  const size = 236;
  const radius = 100;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.max(0, Math.min(1, pct)));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={bg} strokeWidth={15} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={15}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function App() {
  const [model, setModel] = useState<AppModel>(INITIAL_MODEL);
  const [drafts, setDrafts] = useState<Drafts>(INITIAL_DRAFTS);
  const [hydrated, setHydrated] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [heatWidth, setHeatWidth] = useState(0);
  const [draggingGoal, setDraggingGoal] = useState<string | null>(null);
  const goalHeights = useRef<Record<string, number>>({}).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    KantumruyPro_400Regular,
    KantumruyPro_500Medium,
    KantumruyPro_600SemiBold,
    KantumruyPro_700Bold,
  });
  const theme = model.dark ? DARK : LIGHT;

  useEffect(() => {
    try {
      const saved = loadAppState<AppModel>();
      if (saved) setModel({ ...INITIAL_MODEL, ...saved.state });
    } catch (error) {
      console.warn('Could not load Luy Khnom state', error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveAppState(model);
    } catch (error) {
      console.warn('Could not save Luy Khnom state', error);
    }
  }, [model, hydrated]);

  const method = model.method === 'balanced' ? BALANCED : SAVER;
  const categorySpend = model.categories.map((category) => ({
    key: category.key,
    spent: money(Math.round(category.spentUsd * 100), 'USD' as const),
    budget: money(Math.round(category.budgetUsd * 100), 'USD' as const),
  }));
  const todayMoney = model.expenses.map((expense) => money(expense.cur === 'USD' ? Math.round(expense.amount * 100) : Math.round(expense.amount), expense.cur));
  const budget = summarizeBudget({
    salary: money(model.salaryCur === 'USD' ? Math.round(model.salary * 100) : Math.round(model.salary), model.salaryCur),
    fixedCosts: [money(Math.round(model.rent * 100), 'USD'), money(Math.round(model.utilities * 100), 'USD'), money(Math.round(model.loan * 100), 'USD')],
    savedSoFar: money(23200, 'USD'),
    categorySpend,
    todayExpenses: todayMoney,
    method,
    rate: { khrPerUsd: model.rate },
    daysLeftIncludingToday: 27,
    rolloverYesterday: money(700, 'USD'),
  });
  const parsed = parseExpenseText(drafts.addText);
  const parsedCat = categoryFor(model.categories, drafts.selectedCat || parsed.categoryKey);
  const parsedAmount = parsed.amount;
  const ringColor = budget.status === 'over' ? theme.red : budget.ringPct < 0.35 ? theme.amber : theme.green;
  const selectedCategory = categoryFor(model.categories, drafts.selectedCat);
  const selectedExpense = model.expenses.find((expense) => expense.id === drafts.selectedExpenseId) ?? null;
  const heatmap = buildHeatmap(model.history, budget.dailyBudgetUsd.amountMinor / 100);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }

  function updateModel(recipe: (current: AppModel) => AppModel) {
    setModel((current) => recipe(current));
  }

  function go(screen: Screen) {
    updateModel((current) => ({ ...current, screen }));
  }

  function addExpense() {
    if (!parsedAmount) return;
    const chosenKey = drafts.selectedCat || parsed.categoryKey;
    const category = categoryFor(model.categories, chosenKey);
    const amount = parsedAmount.currency === 'USD' ? parsedAmount.amountMinor / 100 : parsedAmount.amountMinor;
    const expense: Expense = {
      id: `expense-${Date.now()}`,
      name: parsed.label || category.label,
      cat: chosenKey,
      amount,
      cur: parsedAmount.currency,
      time: nowTime(),
      note: drafts.addNote.trim() || undefined,
    };
    const usdValue = amountUsd(expense.amount, expense.cur, model.rate);
    updateModel((current) => ({
      ...current,
      screen: 'home',
      expenses: [expense, ...current.expenses],
      categories: current.categories.map((item) => (item.key === chosenKey ? { ...item, spentUsd: item.spentUsd + usdValue } : item)),
    }));
    setDrafts((current) => ({ ...current, addText: '', addNote: '', selectedCat: 'food' }));
    showToast(`Added ${amountLabel(expense.amount, expense.cur)}`);
  }

  function deleteExpense(id: string) {
    const expense = model.expenses.find((item) => item.id === id);
    if (!expense) return;
    const usdValue = amountUsd(expense.amount, expense.cur, model.rate);
    updateModel((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => item.id !== id),
      categories: current.categories.map((item) => (item.key === expense.cat ? { ...item, spentUsd: Math.max(0, item.spentUsd - usdValue) } : item)),
    }));
    showToast(`Removed ${expense.name}`);
  }

  function saveEntry() {
    const amount = Number(drafts.iouAmount);
    if (!selectedExpense || !Number.isFinite(amount) || amount <= 0) return;
    const oldUsd = amountUsd(selectedExpense.amount, selectedExpense.cur, model.rate);
    const newUsd = amountUsd(amount, selectedExpense.cur, model.rate);
    updateModel((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => (expense.id === selectedExpense.id ? { ...expense, amount, cat: drafts.selectedCat || expense.cat } : expense)),
      categories: current.categories.map((category) => {
        let spentUsd = category.spentUsd;
        if (category.key === selectedExpense.cat) spentUsd -= oldUsd;
        if (category.key === (drafts.selectedCat || selectedExpense.cat)) spentUsd += newUsd;
        return { ...category, spentUsd: Math.max(0, spentUsd) };
      }),
    }));
    setSheet(null);
    showToast('Entry updated');
  }

  function openCatSheet(key: string | null) {
    if (key) {
      const category = categoryFor(model.categories, key);
      setDrafts((current) => ({ ...current, categoryEditKey: key, categoryName: category.label, categoryBudget: String(category.budgetUsd), categoryIcon: category.icon, categoryColor: category.color }));
    } else {
      const usedColors = model.categories.map((category) => category.color);
      const nextColor = PALETTE.find((color) => !usedColors.includes(color)) ?? PALETTE[model.categories.length % PALETTE.length];
      setDrafts((current) => ({ ...current, categoryEditKey: null, categoryName: '', categoryBudget: '50', categoryIcon: 'category', categoryColor: nextColor }));
    }
    setSheet('category');
  }

  function saveCategory() {
    const name = drafts.categoryName.trim();
    const budgetUsd = Number(drafts.categoryBudget);
    if (!name || !Number.isFinite(budgetUsd) || budgetUsd < 0) return;
    const icon = drafts.categoryIcon || 'category';
    const color = drafts.categoryColor || PALETTE[0];
    updateModel((current) => ({
      ...current,
      categories: drafts.categoryEditKey
        ? current.categories.map((category) => (category.key === drafts.categoryEditKey ? { ...category, label: name, icon, color, budgetUsd } : category))
        : [...current.categories, { key: `cat-${Date.now()}`, label: name, icon, color, spentUsd: 0, budgetUsd }],
    }));
    setDrafts((current) => ({ ...current, categoryName: '', categoryBudget: '50', categoryIcon: 'category', categoryColor: PALETTE[0], categoryEditKey: null }));
    setSheet(null);
    showToast(drafts.categoryEditKey ? 'Category updated' : 'Category added');
  }

  function saveGoal() {
    const target = Number(drafts.goalTarget);
    const perMonth = Number(drafts.goalPer || 0);
    const name = drafts.goalName.trim();
    if (!name || !Number.isFinite(target) || target <= 0) return;
    updateModel((current) => ({
      ...current,
      goals: [...current.goals, { id: `goal-${Date.now()}`, name, icon: 'savings', target, saved: 0, perMonth, cur: 'USD' }],
    }));
    setDrafts((current) => ({ ...current, goalName: '', goalTarget: '', goalPer: '' }));
    setSheet(null);
    showToast('Goal created');
  }

  function addGoalContribution(goalId: string) {
    updateModel((current) => ({
      ...current,
      goals: current.goals.map((goal) => {
        if (goal.id !== goalId) return goal;
        const saved = Math.min(goal.target, goal.saved + goal.perMonth);
        return { ...goal, saved, celebrated: saved >= goal.target ? true : goal.celebrated };
      }),
    }));
    showToast('Added to goal');
  }

  // Drop the dragged goal card at the position implied by the drag distance,
  // walking neighbour card heights (measured via onLayout) half-card by half-card.
  function finishGoalDrag(index: number, dy: number) {
    setDraggingGoal(null);
    const items = model.goals;
    let target = index;
    let remaining = dy;
    if (dy < 0) {
      while (target > 0) {
        const h = (goalHeights[items[target - 1].id] ?? 170) + 12;
        if (-remaining > h / 2) { target -= 1; remaining += h; } else break;
      }
    } else {
      while (target < items.length - 1) {
        const h = (goalHeights[items[target + 1].id] ?? 170) + 12;
        if (remaining > h / 2) { target += 1; remaining -= h; } else break;
      }
    }
    if (target !== index) {
      updateModel((current) => {
        const goals = [...current.goals];
        const [moved] = goals.splice(index, 1);
        goals.splice(target, 0, moved);
        return { ...current, goals };
      });
      showToast(`Moved to priority ${target + 1}`);
    }
  }

  function markBillPaid(key: string, label: string) {
    updateModel((current) => ({ ...current, paidBills: { ...current.paidBills, [key]: true } }));
    showToast(`${label} marked paid`);
  }

  function settleIou(id: string, person: string) {
    updateModel((current) => ({ ...current, ious: current.ious.filter((item) => item.id !== id) }));
    showToast(`Settled up with ${person}`);
  }

  function saveIou() {
    const amount = Number(drafts.iouAmount);
    const person = drafts.iouPerson.trim();
    if (!person || !Number.isFinite(amount) || amount <= 0) return;
    const due = drafts.iouDue.trim() || 'next month';
    updateModel((current) => ({
      ...current,
      ious: drafts.iouEditId
        ? current.ious.map((item) => (item.id === drafts.iouEditId ? { ...item, person, amount, due } : item))
        : [...current.ious, { id: `iou-${Date.now()}`, person, amount, cur: 'USD', due }],
    }));
    setDrafts((current) => ({ ...current, iouPerson: '', iouAmount: '', iouDue: '', iouEditId: null }));
    setSheet(null);
    showToast(drafts.iouEditId ? 'Borrowed money updated' : 'Borrowed money saved');
  }

  const reminderBody = `Today: spent ${formatMoney(budget.spentTodayUsd)} · saved ${formatMoney(money(Math.max(budget.leftTodayUsd.amountMinor, 0), 'USD'))}.`;

  // The daily reminder is a real background feature: it (re)schedules automatically
  // whenever the reminder time is set or bill reminders are toggled.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (!model.billReminders) return;
        const status = await Notifications.getPermissionsAsync();
        const granted = status.granted || (status.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
        if (!granted || cancelled) return;
        const [hourRaw, minuteRaw] = model.notify.split(':');
        const hour = Number(hourRaw);
        const minute = Number(minuteRaw);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Luy Khnom', body: reminderBody },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
      } catch (error) {
        console.warn('Could not schedule daily reminder', error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.notify, model.billReminders, hydrated]);

  async function previewNotification() {
    const status = await Notifications.getPermissionsAsync();
    const granted = status.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      showToast('Notifications not enabled');
      return;
    }
    await Notifications.scheduleNotificationAsync({ content: { title: 'Luy Khnom', body: reminderBody }, trigger: null });
    showToast('Preview sent');
  }

  async function exportCsv() {
    const rows = [['Date', 'Description', 'Category', 'Amount', 'Currency', 'Note']];
    model.expenses.forEach((expense) => {
      rows.push(['Today', expense.name, categoryFor(model.categories, expense.cat).label, String(expense.amount), expense.cur, expense.note ?? '']);
    });
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const uri = `${FileSystem.documentDirectory}luy-khnom-export.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Luy Khnom CSV' });
    }
    showToast('CSV exported');
  }

  function renderTopBar(title: string, subtitle?: string, back?: Screen, right?: ReactNode) {
    return (
      <View style={styles.topRow}>
        {back ? (
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => go(back)}>
            <MaterialIcons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText style={[back ? styles.title : styles.pageTitle, { color: theme.text }]}>{title}</AppText>
          {subtitle ? <AppText style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</AppText> : null}
        </View>
        {right ?? null}
      </View>
    );
  }

  function renderOnboarding() {
    const step = model.onbStep;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.headerRow, { marginTop: 4, marginBottom: 20 }]}>
            <View style={{ width: 40 }}>{step > 1 ? <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, onbStep: current.onbStep - 1 }))}><MaterialIcons name="arrow-back" size={20} color={theme.text} /></TouchableOpacity> : null}</View>
            <View style={styles.dots}>
              {[1, 2, 3].map((item) => <View key={item} style={[styles.dot, { backgroundColor: item <= step ? theme.primary : theme.surface2, width: item <= step ? 22 : 8 }]} />)}
            </View>
            <View style={{ width: 40 }} />
          </View>
          {step === 1 ? <View style={[styles.brandRow, { marginBottom: 4 }]}>
            <View style={[styles.logo, { backgroundColor: theme.primary }]}><AppText style={styles.logoText}>៛</AppText></View>
            <AppText style={[styles.brandName, { color: theme.text }]}>Luy Khnom</AppText>
          </View> : null}
          {step === 1 ? (
            <View>
              <AppText style={[styles.heroTitle, { color: theme.text }]}>What's your monthly income?</AppText>
              <AppText style={[styles.subtitle, { color: theme.muted }]}>We'll plan around this — nothing leaves your phone.</AppText>
              <AppText style={[styles.label, { color: theme.muted }]}>Monthly salary</AppText>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.salary)} onChangeText={(value) => updateModel((current) => ({ ...current, salary: Number(value) || 0 }))} />
              <AppText style={[styles.label, { color: theme.muted }]}>Currency</AppText>
              <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>
                {(['USD', 'KHR'] as Currency[]).map((cur) => <TouchableOpacity key={cur} style={[styles.segmentButton, model.salaryCur === cur && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, salaryCur: cur }))}><AppText style={[styles.segmentText, { color: model.salaryCur === cur ? theme.text : theme.muted }]}>{cur === 'USD' ? 'USD ($)' : 'KHR (៛)'}</AppText></TouchableOpacity>)}
              </View>
              <AppText style={[styles.help, { color: theme.muted }]}>You spend in both — set your rate anytime. Right now 1 USD ≈ {khr(model.rate)}.</AppText>
            </View>
          ) : null}
          {step === 2 ? (
            <View>
              <AppText style={[styles.heroTitle, { color: theme.text }]}>Your fixed monthly costs</AppText>
              <AppText style={[styles.subtitle, { color: theme.muted }]}>Rent and loan come out first — these are your Needs.</AppText>
              <AppText style={[styles.label, { color: theme.muted }]}>Rent</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.rent)} onChangeText={(value) => updateModel((current) => ({ ...current, rent: Number(value) || 0 }))} />
                <View style={[styles.duePillBig, { backgroundColor: theme.surface, ...CARD_SHADOW }]}><AppText style={[styles.segmentText, { color: theme.text }]}>Due {ordinal(model.rentDue)}</AppText></View>
              </View>
              <AppText style={[styles.label, { color: theme.muted }]}>Utilities (monthly avg)</AppText>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.utilities)} onChangeText={(value) => updateModel((current) => ({ ...current, utilities: Number(value) || 0 }))} />
              <AppText style={[styles.label, { color: theme.muted }]}>Loan repayment</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.loan)} onChangeText={(value) => updateModel((current) => ({ ...current, loan: Number(value) || 0 }))} />
                <View style={[styles.duePillBig, { backgroundColor: theme.surface, ...CARD_SHADOW }]}><AppText style={[styles.segmentText, { color: theme.text }]}>Due {ordinal(model.loanDue)}</AppText></View>
              </View>
              <View style={[styles.card, { backgroundColor: theme.primaryWash, borderColor: theme.primaryWash }, styles.row, { marginBottom: 0 }]}><AppText style={[styles.rowValue, { color: theme.text }]}>Fixed each month</AppText><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 18, marginTop: 0 }]}>{formatMoney0(budget.fixedUsd)}</AppText></View>
            </View>
          ) : null}
          {step === 3 ? (
            <View>
              <AppText style={[styles.heroTitle, { color: theme.text }]}>Pick a budgeting method</AppText>
              <AppText style={[styles.subtitle, { color: theme.muted }]}>Based on the 50/30/20 rule — savings come first.</AppText>
              {(['balanced', 'saver'] as BudgetMode[]).map((mode) => <TouchableOpacity key={mode} style={[styles.methodCard, { borderColor: model.method === mode ? theme.primary : theme.line, backgroundColor: model.method === mode ? theme.primaryWash : theme.surface }]} onPress={() => updateModel((current) => ({ ...current, method: mode }))}><View style={styles.row}><AppText style={[styles.itemTitle, { color: theme.text }]}>{mode === 'balanced' ? 'Balanced · 50/30/20' : 'Saver · 40/30/30'}</AppText>{mode === 'balanced' ? <View style={[styles.duePill, { backgroundColor: theme.primary }]}><AppText style={[styles.duePillText, { color: '#fff' }]}>Recommended</AppText></View> : null}</View><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 2 }]}>{mode === 'balanced' ? '50% Needs · 30% Wants · 20% Savings' : 'Tighter spending, faster savings'}</AppText></TouchableOpacity>)}
              <AppText style={[styles.label, { color: theme.muted }]}>Your plan</AppText>
              <View style={{ flexDirection: 'row', height: 14, borderRadius: 99, overflow: 'hidden' }}>
                <View style={{ flex: method.needsPct, backgroundColor: theme.primary }} />
                <View style={{ flex: method.wantsPct, backgroundColor: theme.amber }} />
                <View style={{ flex: method.savePct, backgroundColor: theme.green }} />
              </View>
              <View style={[styles.row, { marginTop: 10 }]}>
                <AppText style={[styles.duePillText, { color: theme.primary, fontFamily: FONT.bold }]}>Needs {formatMoney0(money(Math.round((budget.salaryUsd.amountMinor * method.needsPct) / 100), 'USD'))}</AppText>
                <AppText style={[styles.duePillText, { color: theme.amber, fontFamily: FONT.bold }]}>Wants {formatMoney0(money(Math.round((budget.salaryUsd.amountMinor * method.wantsPct) / 100), 'USD'))}</AppText>
                <AppText style={[styles.duePillText, { color: theme.green, fontFamily: FONT.bold }]}>Save {formatMoney0(budget.savingsTargetUsd)}</AppText>
              </View>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Row label="Salary" value={formatMoney0(budget.salaryUsd)} theme={theme} />
                <Row label="− Rent + Loan" value={`−${formatMoney0(budget.fixedUsd)}`} theme={theme} />
                <Row label="− Savings first" value={`−${formatMoney0(budget.savingsTargetUsd)}`} theme={theme} />
                <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 10 }} />
                <Row label="Free to spend" value={formatMoney0(budget.spendableMonthUsd)} theme={theme} strong />
                <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 8 }]}>≈ <AppText style={{ fontFamily: FONT.bold, color: theme.text }}>{formatMoney0(budget.baseDailyUsd)}/day</AppText> across the month.</AppText>
              </View>
              <AppText style={[styles.label, { color: theme.muted }]}>Daily reminder</AppText>
              <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{([['8:00 PM', '20:00'], ['9:00 PM', '21:00'], ['10:00 PM', '22:00']] as const).map(([label, val]) => <TouchableOpacity key={val} style={[styles.segmentButton, model.notify === val && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, notify: val }))}><AppText style={[styles.segmentText, { color: model.notify === val ? theme.text : theme.muted }]}>{label}</AppText></TouchableOpacity>)}</View>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: theme.page, borderColor: theme.line }]}>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => updateModel((current) => current.onbStep < 3 ? { ...current, onbStep: current.onbStep + 1 } : { ...current, onboarded: true, screen: 'home' })}>
            <AppText style={styles.buttonText}>{step < 3 ? 'Continue' : 'Start budgeting'}</AppText>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function renderHome() {
    const topGoals = model.goals.slice(0, 3);
    const leftFmt = formatMoney(money(Math.abs(budget.leftTodayUsd.amountMinor), 'USD'));
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}><View style={[styles.logo, { backgroundColor: theme.primary }]}><AppText style={styles.logoText}>៛</AppText></View><View><AppText style={[styles.greet, { color: theme.muted }]}>Good evening</AppText><AppText style={[styles.title, { color: theme.text }]}>Today's budget</AppText></View></View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, dark: !current.dark }))}><MaterialIcons name={model.dark ? 'light-mode' : 'dark-mode'} size={20} color={theme.muted} /></TouchableOpacity>
        </View>
        <View style={styles.ringWrap}>
          <RingBudget pct={budget.ringPct} color={ringColor} bg={theme.ringTrack} />
          <View style={styles.ringCenter}>
            <AppText style={[styles.ringLabel, { color: theme.muted }]}>{budget.leftTodayUsd.amountMinor < 0 ? 'Over budget today' : 'Left to spend today'}</AppText>
            <AppText numberOfLines={1} style={[styles.ringAmount, { color: budget.leftTodayUsd.amountMinor < 0 ? theme.red : theme.text, fontSize: leftFmt.length > 8 ? 32 : leftFmt.length > 6 ? 40 : 50 }]}>{leftFmt}</AppText>
            <AppText style={[styles.ringKhr, { color: theme.muted }]}>≈ {khr(Math.abs(budget.leftTodayUsd.amountMinor / 100) * model.rate)}</AppText>
          </View>
        </View>
        <Pill icon="bolt" text={`${formatMoney(budget.baseDailyUsd)} base + $7.00 rolled over`} theme={theme} />
        <Pill icon="trending-up" text={`Tomorrow ≈ ${formatMoney(budget.tomorrowUsd)} at this pace`} theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.row, { marginBottom: 16 }]}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>This month</AppText><View style={[styles.duePill, { backgroundColor: theme.surface2 }]}><AppText style={[styles.duePillText, { color: theme.muted }]}>27 days left</AppText></View></View>
          <Progress label="Spent" value={formatMoney(budget.spentMonthUsd)} total={formatMoney0(budget.spendableMonthUsd)} pct={budget.monthPct} color={theme.primary} theme={theme} />
          <Progress label="Saved so far" value="$232" total={formatMoney0(budget.savingsTargetUsd)} pct={budget.savingsPct} color={theme.green} theme={theme} />
        </View>
        {topGoals.length > 0 ? <><SectionHeader title={topGoals.length > 1 ? 'Top goals' : 'Goal'} action="All goals" theme={theme} onAction={() => go('goals')} />{topGoals.map((goal) => <TouchableOpacity key={goal.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line, marginTop: 0, marginBottom: 10 }]} onPress={() => go('goals')}><View style={[styles.expenseRow, { borderBottomWidth: 0, paddingVertical: 0, marginBottom: 12 }]}><View style={[styles.bubble, { backgroundColor: `${theme.primary}1f` }]}><Glyph name={goal.icon} color={theme.primary} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text }]}>{goal.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{amountLabel(goal.perMonth, goal.cur)}/mo</AppText></View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(goal.saved, goal.cur)}</AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`, backgroundColor: theme.primary }]} /></View></TouchableOpacity>)}</> : null}
        <SectionHeader title="Coming up" action="+ Borrowed money" theme={theme} onAction={() => { setDrafts((current) => ({ ...current, iouPerson: '', iouAmount: '', iouDue: '', iouEditId: null })); setSheet('iou'); }} />
        {model.billReminders && !model.paidBills.loan ? <Upcoming icon="savings" color="#7c5cff" title="Loan repayment" subtitle={dueText(model.loanDue)} amount={usd(model.loan)} theme={theme} onPress={() => setSheet('loan')} onDone={() => markBillPaid('loan', 'Loan repayment')} /> : null}
        {model.billReminders && !model.paidBills.rent ? <Upcoming icon="receipt-long" color="#d98a00" title="Rent & utilities" subtitle={dueText(model.rentDue)} amount={usd(model.rent + model.utilities)} theme={theme} onPress={() => setSheet('fixed')} onDone={() => markBillPaid('rent', 'Rent & utilities')} /> : null}
        {model.ious.map((iou) => <Upcoming key={iou.id} icon="account-balance-wallet" color="#3ba6d4" title={`Pay back ${iou.person}`} subtitle={`Borrowed · due ${iou.due}`} amount={amountLabel(iou.amount, iou.cur)} theme={theme} onPress={() => { setDrafts((current) => ({ ...current, iouPerson: iou.person, iouAmount: String(iou.amount), iouDue: iou.due, iouEditId: iou.id })); setSheet('iou'); }} onDone={() => settleIou(iou.id, iou.person)} />)}
        <SectionHeader title="Today" action="Summary" theme={theme} onAction={() => go('insights')} />
        {model.expenses.map((expense) => {
          const cat = categoryFor(model.categories, expense.cat);
          return <TouchableOpacity key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]} onPress={() => { setDrafts((current) => ({ ...current, selectedExpenseId: expense.id, selectedCat: expense.cat, iouAmount: String(expense.amount) })); setSheet('entry'); }}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Glyph name={cat.icon} color={cat.color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{expense.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{cat.label} · {expense.time}</AppText>{expense.note ? <AppText style={[styles.itemNote, { color: theme.faint }]}>{expense.note}</AppText> : null}</View><View style={{ alignItems: 'flex-end' }}><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</AppText></View><TouchableOpacity onPress={() => deleteExpense(expense.id)} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="close" size={18} color={theme.faint} /></TouchableOpacity></TouchableOpacity>;
        })}
      </ScrollView>
    );
  }

  function renderAdd() {
    const hasAmount = Boolean(parsedAmount);
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {renderTopBar('Add expense', undefined, 'home')}
        <TextInput style={[styles.addInput, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} placeholder="Try: netflix, 10$  or  food, 1000 riels" placeholderTextColor={theme.faint} value={drafts.addText} onChangeText={(value) => { const next = parseExpenseText(value); setDrafts((current) => ({ ...current, addText: value, selectedCat: next.categoryKey })); }} />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={styles.aiHeader}><MaterialIcons name="auto-awesome" size={17} color={theme.primary} /><AppText style={[styles.aiHeaderText, { color: theme.primary }]}>Understood</AppText></View>
          <View style={[styles.headerRow, { alignItems: 'flex-end', marginTop: 6 }]}><View style={{ flex: 1 }}><AppText style={[styles.parsedAmount, { color: theme.text }]}>{parsedAmount ? formatMoney(parsedAmount) : '—'}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{parsedAmount ? parsedAmount.currency === 'KHR' ? `≈ ${usd((parsedAmount.amountMinor / model.rate))}` : `≈ ${khr((parsedAmount.amountMinor / 100) * model.rate)}` : 'Start typing above'}</AppText></View><View style={[styles.bubbleLarge, { backgroundColor: `${parsedCat.color}22` }]}><Glyph name={parsedCat.icon} size={27} color={parsedCat.color} /></View></View>
          <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 16 }]}>Category — tap to change</AppText>
        </View>
        <View style={styles.chipRow}>{model.categories.map((cat) => { const on = drafts.selectedCat === cat.key; return <TouchableOpacity key={cat.key} style={[styles.chip, { borderColor: on ? cat.color : theme.line, backgroundColor: on ? cat.color : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, selectedCat: cat.key }))}><Glyph name={cat.icon} size={18} color={on ? '#fff' : cat.color} /><AppText style={[styles.chipText, { color: on ? '#fff' : theme.muted }]}>{cat.label}</AppText></TouchableOpacity>; })}</View>
        <AppText style={[styles.label, { color: theme.muted }]}>Note (optional)</AppText>
        <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text, fontFamily: FONT.semibold, fontSize: 16 }]} placeholder="e.g. team lunch" placeholderTextColor={theme.faint} value={drafts.addNote} onChangeText={(value) => setDrafts((current) => ({ ...current, addNote: value }))} />
        <TouchableOpacity disabled={!hasAmount} style={[styles.button, { backgroundColor: theme.primary, opacity: hasAmount ? 1 : 0.35, marginTop: 24 }]} onPress={addExpense}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Add {parsedAmount ? formatMoney(parsedAmount) : ''}</AppText></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderCategories() {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar('Categories', 'Where your Wants budget is going this month.')}
        <View style={styles.grid}>{model.categories.filter((cat) => cat.budgetUsd > 0).map((cat) => { const pct = Math.round((cat.spentUsd / cat.budgetUsd) * 100); const over = cat.spentUsd > cat.budgetUsd; return <TouchableOpacity key={cat.key} style={[styles.catCard, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => { setDrafts((current) => ({ ...current, selectedCat: cat.key })); go('detail'); }}><View style={styles.row}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Glyph name={cat.icon} color={cat.color} /></View><MaterialIcons name="chevron-right" size={20} color={theme.faint} /></View><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14, marginTop: 10 }]}>{cat.label}</AppText><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 2 }]}>{usd(cat.spentUsd)} of {usd0(cat.budgetUsd)}</AppText><View style={[styles.track, { backgroundColor: theme.surface2, height: 7, marginTop: 11 }]}><View style={[styles.fill, { backgroundColor: over ? theme.red : cat.color, width: `${Math.min(100, pct)}%` }]} /></View><AppText style={[styles.itemSub, { color: over ? theme.red : theme.muted, fontFamily: FONT.bold, marginTop: 8 }]}>{pct}% used</AppText></TouchableOpacity>; })}</View>
        <TouchableOpacity style={[styles.dashed, { borderColor: theme.faint }]} onPress={() => openCatSheet(null)}><MaterialIcons name="add" size={20} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>Add category</AppText></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDetail() {
    const txns = model.expenses.filter((expense) => expense.cat === selectedCategory.key);
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar(selectedCategory.label, undefined, 'categories', <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => openCatSheet(selectedCategory.key)}><MaterialIcons name="edit" size={19} color={theme.muted} /></TouchableOpacity>)}
        <View style={[styles.card, styles.row, { backgroundColor: theme.surface, borderColor: theme.line, marginBottom: 0 }]}><View style={{ flex: 1 }}><AppText style={[styles.label, { color: theme.muted, marginTop: 0, marginBottom: 6 }]}>Spent this month</AppText><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 32, marginTop: 0 }]}>{usd(selectedCategory.spentUsd)}</AppText><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 2 }]}>of {usd0(selectedCategory.budgetUsd)} budget</AppText></View><View style={[styles.bubbleLarge, { backgroundColor: `${selectedCategory.color}22`, width: 56, height: 56, borderRadius: 18 }]}><Glyph name={selectedCategory.icon} size={30} color={selectedCategory.color} /></View></View>
        <SectionHeader title="Transactions" theme={theme} />
        {txns.map((expense) => <View key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]}><View style={[styles.bubble, { backgroundColor: `${selectedCategory.color}22` }]}><Glyph name={selectedCategory.icon} color={selectedCategory.color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{expense.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{expense.time}</AppText></View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</AppText></View>)}
      </ScrollView>
    );
  }

  function renderGoals() {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} scrollEnabled={draggingGoal === null}>
        {renderTopBar('Savings goals', model.goals.length > 1 ? 'Drag the handle to set priority — top goal shows first.' : undefined, 'home')}
        {model.goals.map((goal, index) => {
          const isDragging = draggingGoal === goal.id;
          const pan = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => { dragY.setValue(0); setDraggingGoal(goal.id); },
            onPanResponderMove: (_event, gesture) => dragY.setValue(gesture.dy),
            onPanResponderRelease: (_event, gesture) => finishGoalDrag(index, gesture.dy),
            onPanResponderTerminate: () => setDraggingGoal(null),
          });
          return <Animated.View key={goal.id} onLayout={(event) => { goalHeights[goal.id] = event.nativeEvent.layout.height; }} style={[styles.card, { backgroundColor: theme.surface, borderColor: isDragging ? theme.primary : theme.line }, isDragging && { transform: [{ translateY: dragY }], zIndex: 20, elevation: 10, shadowColor: '#191c3a', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }]}><View style={[styles.expenseRow, { borderBottomWidth: 0, paddingVertical: 0 }]}>{model.goals.length > 1 ? <View {...pan.panHandlers} style={{ paddingVertical: 8, paddingRight: 6, marginLeft: -4 }}><MaterialIcons name="drag-indicator" size={22} color={theme.faint} /></View> : null}<View style={[styles.bubble, { backgroundColor: `${theme.primary}1f` }]}><Glyph name={goal.icon} color={theme.primary} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text }]}>{goal.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>Priority {index + 1} · {amountLabel(goal.perMonth, goal.cur)}/mo</AppText></View><TouchableOpacity onPress={() => updateModel((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== goal.id) }))} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="delete" size={20} color={theme.faint} /></TouchableOpacity></View><View style={[styles.row, { marginTop: 14, marginBottom: 7 }]}><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 18, marginTop: 0 }]}>{amountLabel(goal.saved, goal.cur)}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>of {amountLabel(goal.target, goal.cur)} · {Math.round((goal.saved / goal.target) * 100)}%</AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`, backgroundColor: theme.primary }]} /></View>{goal.saved < goal.target && goal.perMonth > 0 ? <TouchableOpacity style={[styles.sweep, { backgroundColor: theme.primaryWash }]} onPress={() => addGoalContribution(goal.id)}><MaterialIcons name="savings" size={18} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>Add {amountLabel(goal.perMonth, goal.cur)} this month</AppText></TouchableOpacity> : <View style={[styles.goalBadge, { backgroundColor: `${theme.green}1f` }]}><MaterialIcons name="celebration" size={18} color={theme.green} /><AppText style={[styles.chipText, { color: theme.green, fontFamily: FONT.bold }]}>Goal reached 🎉</AppText></View>}</Animated.View>;
        })}
        <TouchableOpacity style={[styles.dashed, { borderColor: theme.faint }]} onPress={() => setSheet('goal')}><MaterialIcons name="add" size={20} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>New goal</AppText></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderInsights() {
    const dailyBudget = budget.dailyBudgetUsd.amountMinor / 100;
    const week = model.history.slice(-7);
    const weekLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const chartH = 120;
    const labelOffset = 20;
    const maxVal = Math.max(dailyBudget, ...week, 1) * 1.15;
    const budgetBottom = labelOffset + (dailyBudget / maxVal) * chartH;
    const heatGap = 5;
    const heatSize = heatWidth > 0 ? (heatWidth - heatGap * 6) / 7 : 0;
    const { spentMost, savedMost } = bestAndWorst(model.history, dailyBudget);
    const dayLabel = (index: number) => {
      const date = new Date();
      date.setDate(date.getDate() - (model.history.length - 1 - index));
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    };
    const exportMonths = [0, 1, 2].map((back) => {
      const date = new Date();
      date.setMonth(date.getMonth() - back);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    });
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
        {renderTopBar('Insights', 'Your end-of-day summary, all in one place.')}
        <View style={[styles.statusCard, { backgroundColor: budget.status === 'over' ? theme.red : theme.green }]}><View style={styles.statusPill}><MaterialIcons name="schedule" size={15} color="#fff" /><AppText style={styles.statusPillText}>End of day · today</AppText></View><AppText style={styles.statusHeadline}>{budget.status === 'over' ? 'A little over today — tomorrow adjusts for you.' : "You're under budget today — nice work."}</AppText><View style={styles.statRow}><Stat label="Spent today" value={formatMoney(budget.spentTodayUsd)} /><Stat label="Saved today" value={formatMoney(money(Math.max(budget.leftTodayUsd.amountMinor, 0), 'USD'))} /></View><View style={styles.tip}><MaterialIcons name="lightbulb" size={20} color="#fff" /><AppText style={styles.tipText}>Food is your top spend this week. Cooking one dinner at home could add ~$6 to savings.</AppText></View></View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={[styles.row, { marginBottom: 14 }]}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>This week</AppText><View style={[styles.duePill, { backgroundColor: theme.surface2 }]}><AppText style={[styles.duePillText, { color: theme.muted }]}>Daily budget {formatMoney(budget.dailyBudgetUsd)}</AppText></View></View>
          <View style={{ position: 'relative' }}>
            <View style={[styles.chart, { height: chartH + labelOffset }]}>{week.map((value, index) => <TouchableOpacity key={index} activeOpacity={0.7} style={styles.barCol} onPress={() => showToast(`${weekLabels[index]} · ${usd(value)}`)}><View style={[styles.bar, { height: Math.max(6, (value / maxVal) * chartH), backgroundColor: value > dailyBudget ? theme.amber : theme.primary }]} /><AppText style={[styles.barDay, { color: theme.muted }]}>{weekLabels[index]}</AppText></TouchableOpacity>)}</View>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: budgetBottom, borderTopWidth: 2, borderStyle: 'dashed', borderColor: theme.faint }} />
            <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: budgetBottom - 8 }}><AppText style={{ fontFamily: FONT.bold, fontSize: 10, color: theme.faint, backgroundColor: theme.surface, paddingHorizontal: 4 }}>budget</AppText></View>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={[styles.row, { marginBottom: 12 }]}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Spending activity</AppText><View style={[styles.duePill, { backgroundColor: theme.surface2 }]}><AppText style={[styles.duePillText, { color: theme.muted }]}>last 5 weeks</AppText></View></View>
          <View style={styles.heat} onLayout={(event) => setHeatWidth(event.nativeEvent.layout.width)}>{heatSize > 0 ? heatmap.map((cell) => <TouchableOpacity key={cell.index} style={{ width: heatSize, height: heatSize, borderRadius: 5, backgroundColor: heatColor(cell.status, theme) }} onPress={() => showToast(`${cell.label} · ${usd(cell.spentUsdCents / 100)}`)} />) : null}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}><AppText style={[styles.itemSub, { color: theme.muted }]}>saved</AppText>{['#1f8a5b', '#a9dcc4', '#e0a63a', '#e0603a'].map((c) => <View key={c} style={{ width: 13, height: 13, borderRadius: 4, backgroundColor: c }} />)}<AppText style={[styles.itemSub, { color: theme.muted }]}>over</AppText></View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={[styles.statMini, { backgroundColor: theme.surface2 }]}><AppText style={[styles.label, { color: theme.muted, marginTop: 0, marginBottom: 4, fontSize: 11 }]}>Spent most</AppText><AppText style={[styles.amount, { color: theme.text, textAlign: 'left' }]}>{spentMost >= 0 ? `${dayLabel(spentMost)} · ${usd(model.history[spentMost])}` : '—'}</AppText></View>
            <View style={[styles.statMini, { backgroundColor: theme.surface2 }]}><AppText style={[styles.label, { color: theme.muted, marginTop: 0, marginBottom: 4, fontSize: 11 }]}>Best saving day</AppText><AppText style={[styles.amount, { color: theme.text, textAlign: 'left' }]}>{savedMost >= 0 ? `${dayLabel(savedMost)} · ${usd(model.history[savedMost])}` : '—'}</AppText></View>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14, marginBottom: 12 }]}>Export data</AppText>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TouchableOpacity style={[styles.input, { flex: 1, paddingVertical: 13, backgroundColor: theme.surface, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setExportOpen((open) => !open)}><AppText style={{ fontFamily: FONT.semibold, fontSize: 14, color: theme.text }}>{exportMonth}</AppText><MaterialIcons name="expand-more" size={20} color={theme.muted} /></TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, minHeight: 48, paddingHorizontal: 20 }]} onPress={exportCsv}><MaterialIcons name="download" size={18} color="#fff" /><AppText style={styles.buttonText}>CSV</AppText></TouchableOpacity>
          </View>
          {exportOpen ? <View style={{ marginTop: 8, borderWidth: 1, borderColor: theme.line, borderRadius: 14, overflow: 'hidden' }}>{exportMonths.map((month) => <TouchableOpacity key={month} style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: month === exportMonth ? theme.primaryWash : theme.surface }} onPress={() => { setExportMonth(month); setExportOpen(false); }}><AppText style={{ fontFamily: FONT.semibold, fontSize: 14, color: month === exportMonth ? theme.primary : theme.text }}>{month}</AppText></TouchableOpacity>)}</View> : null}
        </View>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.surface2, marginTop: 16 }]} onPress={previewNotification}><MaterialIcons name="notifications" size={20} color={theme.text} /><AppText style={[styles.buttonText, { color: theme.text }]}>Preview tonight's reminder</AppText></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderSettings() {
    const rows: readonly [string, string, Sheet | 'categories', IconName][] = [
      ['Monthly income', `${amountLabel(model.salary, model.salaryCur)} / month`, 'income', 'account-balance-wallet'],
      ['Rent & utilities', `${usd(model.rent + model.utilities)} · due ${ordinal(model.rentDue)}`, 'fixed', 'receipt-long'],
      ['Loan repayment', `${usd(model.loan)} · due ${ordinal(model.loanDue)}`, 'loan', 'savings'],
      ['Budgeting method', model.method === 'balanced' ? 'Balanced (50/30/20)' : 'Saver (40/30/30)', 'method', 'pie-chart'],
      ['Currencies', `USD · KHR (1$ = ${khr(model.rate)})`, 'currency', 'currency-exchange'],
      ['Categories', `${model.categories.length} categories`, 'categories', 'grid-view'],
      ['Daily reminder', formatClock(model.notify), 'reminder', 'schedule'],
    ];
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar('Settings', 'Adjust anything — your budget recalculates instantly.')}
        {rows.map((row) => <TouchableOpacity key={row[0]} style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => (row[2] === 'categories' ? go('categories') : setSheet(row[2]))}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name={row[3]} size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>{row[0]}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{row[1]}</AppText></View><MaterialIcons name="chevron-right" size={22} color={theme.faint} /></TouchableOpacity>)}
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, billReminders: !current.billReminders }))}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name="notifications" size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Bill reminders</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{model.billReminders ? 'On' : 'Off'}</AppText></View><MaterialIcons name={model.billReminders ? 'toggle-on' : 'toggle-off'} size={30} color={model.billReminders ? theme.primary : theme.faint} /></TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, dark: !current.dark }))}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name={model.dark ? 'dark-mode' : 'light-mode'} size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Appearance</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{model.dark ? 'Dark mode' : 'Light mode'}</AppText></View><MaterialIcons name={model.dark ? 'toggle-on' : 'toggle-off'} size={30} color={model.dark ? theme.primary : theme.faint} /></TouchableOpacity>
        <View style={{ alignItems: 'center', marginTop: 32, gap: 6, opacity: 0.7 }}><View style={styles.brandRow}><View style={[styles.logo, { backgroundColor: theme.primary, width: 26, height: 26, borderRadius: 9 }]}><AppText style={[styles.logoText, { fontSize: 14 }]}>៛</AppText></View><AppText style={[styles.brandName, { color: theme.text, fontSize: 14 }]}>Luy Khnom</AppText></View><AppText style={[styles.itemSub, { color: theme.muted }]}>Spend calm · v1.0</AppText></View>
      </ScrollView>
    );
  }

  function renderSheet() {
    return (
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.page }]}>
            <View style={[styles.grab, { backgroundColor: theme.faint }]} />
            <View style={[styles.headerRow, { marginBottom: 4 }]}><AppText style={[styles.sheetTitle, { color: theme.text }]}>{sheet === 'category' && drafts.categoryEditKey ? 'Edit category' : sheetTitle(sheet)}</AppText><TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => setSheet(null)}><MaterialIcons name="close" size={20} color={theme.muted} /></TouchableOpacity></View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            {sheet === 'income' ? <View><SheetInput label="Monthly salary" value={String(model.salary)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, salary: Number(value) || 0 }))} /><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 7 }]}>{model.salaryCur === 'KHR' ? `≈ ${usd(model.salary / model.rate)}` : `≈ ${khr(model.salary * model.rate)}`}</AppText><AppText style={[styles.label, { color: theme.muted }]}>Currency</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{(['USD', 'KHR'] as Currency[]).map((cur) => <TouchableOpacity key={cur} style={[styles.segmentButton, model.salaryCur === cur && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, salaryCur: cur }))}><AppText style={[styles.segmentText, { color: model.salaryCur === cur ? theme.text : theme.muted }]}>{cur === 'USD' ? 'USD ($)' : 'KHR (៛)'}</AppText></TouchableOpacity>)}</View></View> : null}
            {sheet === 'fixed' ? <View><SheetInput label="Rent" value={String(model.rent)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, rent: Number(value) || 0 }))} /><SheetInput label="Utilities (monthly avg)" value={String(model.utilities)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, utilities: Number(value) || 0 }))} /><AppText style={[styles.label, { color: theme.muted }]}>Both due each month</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{[1, 5, 15, 25].map((d) => <TouchableOpacity key={d} style={[styles.segmentButton, model.rentDue === d && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, rentDue: d }))}><AppText style={[styles.segmentText, { color: model.rentDue === d ? theme.text : theme.muted }]}>{ordinal(d)}</AppText></TouchableOpacity>)}</View></View> : null}
            {sheet === 'loan' ? <View><SheetInput label="Monthly repayment" value={String(model.loan)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, loan: Number(value) || 0 }))} /><AppText style={[styles.label, { color: theme.muted }]}>Due each month</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{[1, 5, 15, 25].map((d) => <TouchableOpacity key={d} style={[styles.segmentButton, model.loanDue === d && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, loanDue: d }))}><AppText style={[styles.segmentText, { color: model.loanDue === d ? theme.text : theme.muted }]}>{ordinal(d)}</AppText></TouchableOpacity>)}</View></View> : null}
            {sheet === 'method' ? <View>{(['balanced', 'saver'] as BudgetMode[]).map((mode) => <TouchableOpacity key={mode} style={[styles.methodCard, { backgroundColor: model.method === mode ? theme.primaryWash : theme.surface, borderColor: model.method === mode ? theme.primary : theme.line }]} onPress={() => updateModel((current) => ({ ...current, method: mode }))}><AppText style={[styles.itemTitle, { color: theme.text }]}>{mode === 'balanced' ? 'Balanced · 50/30/20' : 'Saver · 40/30/30'}</AppText><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 5 }]}>{mode === 'balanced' ? '50% Needs · 30% Wants · 20% Savings' : 'Tighter spending, faster savings'}</AppText></TouchableOpacity>)}</View> : null}
            {sheet === 'currency' ? <View><AppText style={[styles.label, { color: theme.muted }]}>Base currency</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{(['USD', 'KHR'] as Currency[]).map((cur) => <TouchableOpacity key={cur} style={[styles.segmentButton, model.salaryCur === cur && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, salaryCur: cur }))}><AppText style={[styles.segmentText, { color: model.salaryCur === cur ? theme.text : theme.muted }]}>{cur === 'USD' ? 'USD ($)' : 'KHR (៛)'}</AppText></TouchableOpacity>)}</View><SheetInput label="Conversion rate — KHR per $1" value={String(model.rate)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, rate: Number(value) || RATE }))} /></View> : null}
            {sheet === 'reminder' ? <View><AppText style={[styles.label, { color: theme.muted }]}>Quick pick</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{([['8:00 PM', '20:00'], ['9:00 PM', '21:00'], ['10:00 PM', '22:00']] as const).map(([label, val]) => <TouchableOpacity key={val} style={[styles.segmentButton, model.notify === val && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, notify: val }))}><AppText style={[styles.segmentText, { color: model.notify === val ? theme.text : theme.muted }]}>{label}</AppText></TouchableOpacity>)}</View><AppText style={[styles.label, { color: theme.muted }]}>Or choose your own time</AppText><TouchableOpacity style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setTimePickerOpen(true)}><AppText style={{ fontFamily: FONT.bold, fontSize: 18, color: theme.text }}>{formatClock(model.notify)}</AppText><MaterialIcons name="schedule" size={22} color={theme.muted} /></TouchableOpacity>{timePickerOpen ? <DateTimePicker value={notifyToDate(model.notify)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_event, date) => { setTimePickerOpen(Platform.OS === 'ios'); if (date) updateModel((current) => ({ ...current, notify: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` })); }} /> : null}</View> : null}
            {sheet === 'category' ? <View>
              <View style={[styles.headerRow, { marginTop: 14, gap: 12 }]}><View style={[styles.bubbleLarge, { backgroundColor: `${drafts.categoryColor}22` }]}><Glyph name={drafts.categoryIcon} size={27} color={drafts.categoryColor} /></View><TextInput style={[styles.input, { flex: 1, fontSize: 18, backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} placeholder="Category name" placeholderTextColor={theme.faint} value={drafts.categoryName} onChangeText={(value) => setDrafts((current) => ({ ...current, categoryName: value }))} /></View>
              <SheetInput label="Monthly budget (USD)" value={drafts.categoryBudget} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, categoryBudget: value }))} />
              <AppText style={[styles.label, { color: theme.muted }]}>Icon</AppText>
              <View style={styles.pickWrap}>{ICON_SET.map((ic) => { const on = drafts.categoryIcon === ic; return <TouchableOpacity key={ic} style={[styles.iconPick, { borderColor: on ? drafts.categoryColor : theme.line, backgroundColor: on ? `${drafts.categoryColor}22` : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, categoryIcon: ic }))}><Glyph name={ic} size={22} color={on ? drafts.categoryColor : theme.muted} /></TouchableOpacity>; })}</View>
              <AppText style={[styles.label, { color: theme.muted }]}>Color</AppText>
              <View style={styles.pickWrap}>{PALETTE.map((color) => <TouchableOpacity key={color} style={[styles.swatch, { backgroundColor: color, borderColor: drafts.categoryColor === color ? theme.text : 'transparent' }]} onPress={() => setDrafts((current) => ({ ...current, categoryColor: color }))} />)}</View>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveCategory}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>{drafts.categoryEditKey ? 'Save changes' : 'Add category'}</AppText></TouchableOpacity>
            </View> : null}
            {sheet === 'entry' && selectedExpense ? <View><SheetInput label="Amount" value={drafts.iouAmount} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouAmount: value }))} /><AppText style={[styles.label, { color: theme.muted }]}>Category</AppText><View style={styles.chipRow}>{model.categories.map((cat) => { const on = drafts.selectedCat === cat.key; return <TouchableOpacity key={cat.key} style={[styles.chip, { borderColor: on ? cat.color : theme.line, backgroundColor: on ? cat.color : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, selectedCat: cat.key }))}><Glyph name={cat.icon} size={18} color={on ? '#fff' : cat.color} /><AppText style={[styles.chipText, { color: on ? '#fff' : theme.muted }]}>{cat.label}</AppText></TouchableOpacity>; })}</View><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveEntry}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Save entry</AppText></TouchableOpacity></View> : null}
            {sheet === 'iou' ? <View><SheetInput label="Who did you borrow from?" value={drafts.iouPerson} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouPerson: value }))} /><SheetInput label="Amount" value={drafts.iouAmount} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouAmount: value }))} /><SheetInput label="Pay back by" value={drafts.iouDue} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouDue: value }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveIou}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Save</AppText></TouchableOpacity></View> : null}
            {sheet === 'goal' ? <View><SheetInput label="What are you saving for?" value={drafts.goalName} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalName: value }))} /><SheetInput label="Target amount" value={drafts.goalTarget} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalTarget: value }))} /><SheetInput label="Save per month" value={drafts.goalPer} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalPer: value }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveGoal}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Create goal</AppText></TouchableOpacity></View> : null}
            {sheet === 'day' ? <View><View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><AppText style={[styles.label, { color: theme.muted, marginTop: 0 }]}>Spent</AppText><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 26 }]}>{usd(model.history[drafts.selectedDay] ?? 0)}</AppText></View></View> : null}
            {sheet && ['income', 'fixed', 'loan', 'method', 'currency', 'reminder'].includes(sheet) ? <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={() => setSheet(null)}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Done</AppText></TouchableOpacity> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  let screen: ReactNode;
  if (!hydrated || !fontsLoaded) {
    screen = <SafeAreaView style={[styles.safe, { backgroundColor: theme.page, alignItems: 'center', justifyContent: 'center' }]}><AppText style={[styles.itemTitle, { color: theme.text }]}>Loading Luy Khnom…</AppText></SafeAreaView>;
  } else if (!model.onboarded || model.screen === 'onboarding') {
    screen = renderOnboarding();
  } else {
    let content = renderHome();
    if (model.screen === 'add') content = renderAdd();
    if (model.screen === 'categories') content = renderCategories();
    if (model.screen === 'detail') content = renderDetail();
    if (model.screen === 'goals') content = renderGoals();
    if (model.screen === 'insights') content = renderInsights();
    if (model.screen === 'settings') content = renderSettings();
    screen = (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <StatusBar style={model.dark ? 'light' : 'dark'} />
        <View style={{ flex: 1 }}>{content}</View>
        {['home', 'categories', 'insights', 'settings'].includes(model.screen) ? <BottomNav screen={model.screen} theme={theme} onGo={go} /> : null}
        {toast ? <View style={[styles.toast, { backgroundColor: theme.text }]}><MaterialIcons name="check-circle" size={18} color={theme.green} /><AppText style={[styles.toastText, { color: theme.page }]}>{toast}</AppText></View> : null}
        {renderSheet()}
      </SafeAreaView>
    );
  }

  return <SafeAreaProvider>{screen}</SafeAreaProvider>;
}

function Row({ label, value, theme, strong }: { label: string; value: string; theme: typeof LIGHT; strong?: boolean }) {
  return <View style={styles.row}><AppText style={[styles.rowLabel, { color: theme.muted }]}>{label}</AppText><AppText style={[styles.rowValue, { color: strong ? theme.primary : theme.text }]}>{value}</AppText></View>;
}

function SectionHeader({ title, action, theme, onAction }: { title: string; action?: string; theme: typeof LIGHT; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><AppText style={[styles.sectionTitle, { color: theme.muted }]}>{title}</AppText>{action ? <TouchableOpacity onPress={onAction}><AppText style={[styles.sectionAction, { color: theme.primary }]}>{action}</AppText></TouchableOpacity> : null}</View>;
}

function Pill({ text, icon, theme }: { text: string; icon: IconName; theme: typeof LIGHT }) {
  return <View style={[styles.pill, { backgroundColor: theme.surface2 }]}><MaterialIcons name={icon} size={15} color={theme.muted} /><AppText style={[styles.pillText, { color: theme.muted }]}>{text}</AppText></View>;
}

function Progress({ label, value, total, pct, color, theme }: { label: string; value: string; total: string; pct: number; color: string; theme: typeof LIGHT }) {
  return <View style={{ marginBottom: 14 }}><View style={styles.row}><AppText style={[styles.rowLabel, { color: theme.muted }]}>{label}</AppText><AppText style={[styles.rowValue, { color: theme.text }]}>{value} <AppText style={{ color: theme.faint }}>/ {total}</AppText></AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(1, pct)) * 100}%`, backgroundColor: color }]} /></View></View>;
}

function Upcoming({ icon, color, title, subtitle, amount, theme, onPress, onDone }: { icon: string; color: string; title: string; subtitle: string; amount: string; theme: typeof LIGHT; onPress?: () => void; onDone: () => void }) {
  return <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={[styles.expenseRow, { borderColor: theme.line }]}><View style={[styles.bubble, { backgroundColor: `${color}22` }]}><Glyph name={icon} color={color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{title}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{subtitle}</AppText></View><AppText style={[styles.amount, { color: theme.text }]}>{amount}</AppText><TouchableOpacity onPress={onDone} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="done" size={20} color={theme.green} /></TouchableOpacity></TouchableOpacity>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.statBox}><AppText style={styles.statValue}>{value}</AppText><AppText style={styles.statLabel}>{label}</AppText></View>;
}

function SheetInput({ label, value, theme, onChange }: { label: string; value: string; theme: typeof LIGHT; onChange: (value: string) => void }) {
  return <View><AppText style={[styles.label, { color: theme.muted }]}>{label}</AppText><TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} value={value} onChangeText={onChange} placeholderTextColor={theme.faint} keyboardType={label.toLowerCase().includes('amount') || label.toLowerCase().includes('salary') || label.toLowerCase().includes('budget') || label.includes('$') || label.includes('Rent') || label.includes('Utilities') || label.includes('Loan') ? 'decimal-pad' : 'default'} /></View>;
}

const NAV_ITEMS: readonly (readonly [Screen, IconName, string])[] = [
  ['home', 'home', 'Home'],
  ['categories', 'grid-view', 'Categories'],
  ['insights', 'insights', 'Insights'],
  ['settings', 'settings', 'Settings'],
];

function BottomNav({ screen, theme, onGo }: { screen: Screen; theme: typeof LIGHT; onGo: (screen: Screen) => void }) {
  return <View style={[styles.nav, { backgroundColor: theme.surface, borderColor: theme.line }]}>{NAV_ITEMS.slice(0, 2).map((item) => <NavItem key={item[0]} item={item} active={screen === item[0]} theme={theme} onGo={onGo} />)}<TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 }]} onPress={() => onGo('add')}><MaterialIcons name="add" size={28} color="#fff" /></TouchableOpacity>{NAV_ITEMS.slice(2).map((item) => <NavItem key={item[0]} item={item} active={screen === item[0]} theme={theme} onGo={onGo} />)}</View>;
}

function NavItem({ item, active, theme, onGo }: { item: readonly [Screen, IconName, string]; active: boolean; theme: typeof LIGHT; onGo: (screen: Screen) => void }) {
  return <TouchableOpacity style={styles.navItem} onPress={() => onGo(item[0])}><View style={[styles.navIcon, { backgroundColor: active ? theme.primaryWash : 'transparent' }]}><MaterialIcons name={item[1]} size={23} color={active ? theme.primary : theme.muted} /></View><AppText style={[styles.navLabel, { color: active ? theme.primary : theme.muted }]}>{item[2]}</AppText></TouchableOpacity>;
}

function heatColor(status: string, theme: typeof LIGHT) {
  if (status === 'none') return theme.surface2;
  if (status === 'saved-high') return '#1f8a5b';
  if (status === 'saved') return '#57b98a';
  if (status === 'near') return '#a9dcc4';
  if (status === 'over') return '#e0a63a';
  return '#e0603a';
}

function sheetTitle(sheet: Sheet) {
  if (sheet === 'income') return 'Monthly income';
  if (sheet === 'fixed') return 'Rent & utilities';
  if (sheet === 'loan') return 'Loan repayment';
  if (sheet === 'method') return 'Budgeting method';
  if (sheet === 'currency') return 'Currencies';
  if (sheet === 'reminder') return 'Daily reminder';
  if (sheet === 'category') return 'New category';
  if (sheet === 'entry') return 'Edit entry';
  if (sheet === 'iou') return 'Borrowed money';
  if (sheet === 'goal') return 'New goal';
  if (sheet === 'day') return 'Day view';
  return '';
}

const CARD_SHADOW = {
  shadowColor: '#191c3a',
  shadowOpacity: 0.05,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 130 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontFamily: FONT.extrabold, fontSize: 19 },
  brandName: { fontFamily: FONT.extrabold, fontSize: 17, letterSpacing: -0.2 },
  greet: { fontFamily: FONT.bold, fontSize: 13 },
  title: { fontSize: 21, fontFamily: FONT.extrabold, letterSpacing: -0.4 },
  pageTitle: { fontSize: 26, fontFamily: FONT.extrabold, letterSpacing: -0.5 },
  heroTitle: { fontSize: 26, fontFamily: FONT.extrabold, letterSpacing: -0.5, marginTop: 18 },
  subtitle: { fontSize: 14, fontFamily: FONT.medium, marginTop: 6, lineHeight: 20 },
  iconButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 14, marginBottom: 4 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringLabel: { fontSize: 11, fontFamily: FONT.bold, textTransform: 'uppercase', letterSpacing: 1 },
  ringAmount: { fontSize: 50, fontFamily: FONT.extrabold, letterSpacing: -1.6, marginTop: 4, fontVariant: ['tabular-nums'] },
  ringKhr: { fontSize: 13, fontFamily: FONT.semibold, marginTop: 4 },
  pill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginTop: 8 },
  pillText: { fontSize: 12, fontFamily: FONT.semibold },
  duePill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  duePillText: { fontSize: 11, fontFamily: FONT.semibold },
  duePillBig: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14 },
  card: { borderWidth: 1, borderRadius: 24, padding: 20, marginTop: 16, ...CARD_SHADOW },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontFamily: FONT.bold, fontSize: 13 },
  sectionAction: { fontFamily: FONT.bold, fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel: { fontSize: 13, fontFamily: FONT.medium },
  rowValue: { fontSize: 13, fontFamily: FONT.bold, fontVariant: ['tabular-nums'] },
  track: { height: 9, borderRadius: 99, overflow: 'hidden', marginTop: 7 },
  fill: { height: '100%', borderRadius: 99 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  bubble: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubbleLarge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: FONT.semibold, fontSize: 14 },
  itemTitle: { fontFamily: FONT.bold, fontSize: 15 },
  itemSub: { fontFamily: FONT.medium, fontSize: 12, marginTop: 1 },
  itemNote: { fontFamily: FONT.medium, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  amount: { fontFamily: FONT.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  amountSub: { fontFamily: FONT.medium, fontSize: 11, textAlign: 'right', marginTop: 1 },
  addInput: { borderWidth: 2, borderRadius: 20, padding: 18, fontSize: 18, fontFamily: FONT.semibold },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 12 },
  aiHeaderText: { fontFamily: FONT.bold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  parsedAmount: { fontSize: 38, fontFamily: FONT.extrabold, letterSpacing: -1.1, marginTop: 8, fontVariant: ['tabular-nums'] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  chipText: { fontFamily: FONT.semibold, fontSize: 13 },
  label: { fontSize: 12, fontFamily: FONT.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 9 },
  input: { borderWidth: 2, borderRadius: 16, padding: 16, fontSize: 18, fontFamily: FONT.bold, fontVariant: ['tabular-nums'] },
  button: { minHeight: 56, borderRadius: 18, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { color: '#fff', fontFamily: FONT.bold, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  catCard: { width: '48%', borderWidth: 1, borderRadius: 22, padding: 15, ...CARD_SHADOW },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 20, padding: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  sweep: { borderRadius: 14, padding: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  goalBadge: { borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  statusCard: { borderRadius: 24, padding: 22, marginTop: 14, shadowColor: '#191c3a', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: 'rgba(255,255,255,.22)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  statusPillText: { color: '#fff', fontFamily: FONT.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusHeadline: { color: '#fff', fontFamily: FONT.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3, marginTop: 14, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,.16)', borderRadius: 16, padding: 13 },
  statValue: { color: '#fff', fontFamily: FONT.extrabold, fontSize: 22, fontVariant: ['tabular-nums'] },
  statLabel: { color: '#fff', fontFamily: FONT.semibold, fontSize: 11, opacity: 0.9, marginTop: 2 },
  tip: { flexDirection: 'row', gap: 11, backgroundColor: 'rgba(255,255,255,.15)', borderRadius: 16, padding: 14, marginTop: 12 },
  tipText: { color: '#fff', fontFamily: FONT.medium, fontSize: 13, lineHeight: 19, flex: 1 },
  chart: { height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 9, paddingTop: 8 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  barDay: { fontFamily: FONT.semibold, fontSize: 10 },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  statMini: { flex: 1, borderRadius: 14, padding: 12 },
  heatCell: { width: '13.0%', aspectRatio: 1, borderRadius: 5 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1 },
  settingsIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 6, marginVertical: 14 },
  dot: { height: 8, borderRadius: 99 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segmentButton: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  segmentText: { fontFamily: FONT.bold, fontSize: 13 },
  help: { fontSize: 12, fontFamily: FONT.medium, lineHeight: 18, marginTop: 12 },
  methodCard: { borderWidth: 2, borderRadius: 18, padding: 16, marginTop: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingBottom: 28, borderTopWidth: 1 },
  nav: { height: 76, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', paddingBottom: 12, paddingTop: 6, paddingHorizontal: 6 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIcon: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  navLabel: { fontFamily: FONT.semibold, fontSize: 11 },
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: -24, marginHorizontal: 10 },
  toast: { position: 'absolute', alignSelf: 'center', bottom: 100, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  toastText: { fontFamily: FONT.bold, fontSize: 13 },
  scrim: { flex: 1, backgroundColor: 'rgba(10,10,20,.42)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 28, maxHeight: '88%' },
  grab: { width: 40, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14, opacity: 0.55 },
  sheetTitle: { fontSize: 19, fontFamily: FONT.extrabold, letterSpacing: -0.2 },
  swatch: { width: 38, height: 38, borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
  iconPick: { width: 46, height: 46, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pickWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
