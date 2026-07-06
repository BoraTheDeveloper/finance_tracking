import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { saveAppState, loadAppState } from './src/db/appStorage';
import { BALANCED, SAVER, summarizeBudget } from './src/domain/budget';
import { parseExpenseText } from './src/domain/expenseParser';
import { buildHeatmap } from './src/domain/insights';
import { formatMoney, formatMoney0, money } from './src/domain/money';

type Currency = 'USD' | 'KHR';
type Screen = 'home' | 'add' | 'categories' | 'detail' | 'goals' | 'insights' | 'settings' | 'onboarding';
type BudgetMode = 'balanced' | 'saver';
type Sheet = 'income' | 'fixed' | 'method' | 'currency' | 'reminder' | 'category' | 'entry' | 'iou' | 'goal' | 'day' | null;

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
  iouPerson: string;
  iouAmount: string;
  iouDue: string;
  goalName: string;
  goalTarget: string;
  goalPer: string;
};

const RATE = 4100;

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
  method: 'balanced',
  notify: '21:00',
  billReminders: true,
  categories: [
    { key: 'food', label: 'Food', icon: '🍜', color: '#ef8b4f', spentUsd: 23.5, budgetUsd: 140 },
    { key: 'ent', label: 'Entertainment', icon: '🎬', color: '#7c5cff', spentUsd: 15, budgetUsd: 110 },
    { key: 'transport', label: 'Transport', icon: '🚌', color: '#3ba6d4', spentUsd: 4.18, budgetUsd: 50 },
    { key: 'bills', label: 'Bills', icon: '🧾', color: '#d98a00', spentUsd: 17, budgetUsd: 60 },
    { key: 'shopping', label: 'Shopping', icon: '🛍️', color: '#e05a8a', spentUsd: 10, budgetUsd: 60 },
    { key: 'health', label: 'Health', icon: '➕', color: '#1f9d6b', spentUsd: 5, budgetUsd: 40 },
    { key: 'other', label: 'Other', icon: '✨', color: '#8a8d99', spentUsd: 0, budgetUsd: 25 },
  ],
  expenses: [
    { id: 'seed-phone', name: 'Phone top-up', cat: 'bills', amount: 2, cur: 'USD', time: '6:05 PM' },
    { id: 'seed-lunch', name: 'Lunch', cat: 'food', amount: 3, cur: 'USD', time: '12:30 PM' },
    { id: 'seed-bus', name: 'Bus to work', cat: 'transport', amount: 4000, cur: 'KHR', time: '8:40 AM' },
    { id: 'seed-coffee', name: 'Morning coffee', cat: 'food', amount: 2.5, cur: 'USD', time: '8:15 AM' },
  ],
  goals: [{ id: 'seed-goal', name: 'Malaysia trip', icon: '✈️', target: 600, saved: 180, perMonth: 100, cur: 'USD' }],
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
  iouPerson: '',
  iouAmount: '',
  iouDue: '',
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
  green: '#3fbc86',
  amber: '#e0a63a',
  red: '#f0685c',
};

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
  const size = 216;
  const radius = 92;
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
  const theme = model.dark ? DARK : LIGHT;

  useEffect(() => {
    try {
      const saved = loadAppState<AppModel>();
      if (saved) setModel(saved.state);
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

  function saveCategory() {
    const name = drafts.categoryName.trim();
    const budgetUsd = Number(drafts.categoryBudget);
    if (!name || !Number.isFinite(budgetUsd) || budgetUsd < 0) return;
    const key = `cat-${Date.now()}`;
    const color = ['#ef8b4f', '#7c5cff', '#3ba6d4', '#d98a00', '#e05a8a', '#1f9d6b'][model.categories.length % 6];
    updateModel((current) => ({
      ...current,
      categories: [...current.categories, { key, label: name, icon: '✨', color, spentUsd: 0, budgetUsd }],
    }));
    setDrafts((current) => ({ ...current, categoryName: '', categoryBudget: '50' }));
    setSheet(null);
    showToast('Category added');
  }

  function saveGoal() {
    const target = Number(drafts.goalTarget);
    const perMonth = Number(drafts.goalPer || 0);
    const name = drafts.goalName.trim();
    if (!name || !Number.isFinite(target) || target <= 0) return;
    updateModel((current) => ({
      ...current,
      goals: [...current.goals, { id: `goal-${Date.now()}`, name, icon: '🎯', target, saved: 0, perMonth, cur: 'USD' }],
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

  function saveIou() {
    const amount = Number(drafts.iouAmount);
    const person = drafts.iouPerson.trim();
    if (!person || !Number.isFinite(amount) || amount <= 0) return;
    updateModel((current) => ({
      ...current,
      ious: [...current.ious, { id: `iou-${Date.now()}`, person, amount, cur: 'USD', due: drafts.iouDue.trim() || 'next month' }],
    }));
    setDrafts((current) => ({ ...current, iouPerson: '', iouAmount: '', iouDue: '' }));
    setSheet(null);
    showToast('Borrowed money saved');
  }

  async function scheduleNotification() {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      showToast('Notifications not enabled');
      return;
    }
    const [hourRaw, minuteRaw] = model.notify.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    const body = `Today: spent ${formatMoney(budget.spentTodayUsd)} · saved ${formatMoney(money(Math.max(budget.leftTodayUsd.amountMinor, 0), 'USD'))}.`;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Luy Khnom', body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Luy Khnom', body },
      trigger: null,
    });
    showToast('Daily reminder scheduled');
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

  function renderTopBar(title: string, subtitle?: string, back?: Screen) {
    return (
      <View style={styles.topRow}>
        {back ? (
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => go(back)}>
            <Text style={{ color: theme.text, fontSize: 20 }}>‹</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>
      </View>
    );
  }

  function renderOnboarding() {
    const step = model.onbStep;
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}> 
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.dots}>
            {[1, 2, 3].map((item) => <View key={item} style={[styles.dot, { backgroundColor: item <= step ? theme.primary : theme.surface2, width: item === step ? 24 : 8 }]} />)}
          </View>
          <View style={styles.brandRow}>
            <View style={[styles.logo, { backgroundColor: theme.primary }]}><Text style={styles.logoText}>៛</Text></View>
            <Text style={[styles.brandName, { color: theme.text }]}>Luy Khnom</Text>
          </View>
          {step === 1 ? (
            <View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>What's your monthly income?</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>We'll plan around this — nothing leaves your phone.</Text>
              <Text style={[styles.label, { color: theme.muted }]}>Monthly salary</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.salary)} onChangeText={(value) => updateModel((current) => ({ ...current, salary: Number(value) || 0 }))} />
              <Text style={[styles.label, { color: theme.muted }]}>Currency</Text>
              <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>
                {(['USD', 'KHR'] as Currency[]).map((cur) => <TouchableOpacity key={cur} style={[styles.segmentButton, model.salaryCur === cur && { backgroundColor: theme.surface }]} onPress={() => updateModel((current) => ({ ...current, salaryCur: cur }))}><Text style={{ color: theme.text, fontWeight: '800' }}>{cur === 'USD' ? 'USD ($)' : 'KHR (៛)'}</Text></TouchableOpacity>)}
              </View>
              <Text style={[styles.help, { color: theme.muted }]}>You spend in both — set your rate anytime. Right now 1 USD ≈ {khr(model.rate)}.</Text>
            </View>
          ) : null}
          {step === 2 ? (
            <View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Your fixed monthly costs</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>Rent and loan come out first — these are your Needs.</Text>
              <Text style={[styles.label, { color: theme.muted }]}>Rent</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.rent)} onChangeText={(value) => updateModel((current) => ({ ...current, rent: Number(value) || 0 }))} />
              <Text style={[styles.label, { color: theme.muted }]}>Utilities</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.utilities)} onChangeText={(value) => updateModel((current) => ({ ...current, utilities: Number(value) || 0 }))} />
              <Text style={[styles.label, { color: theme.muted }]}>Loan repayment</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} keyboardType="decimal-pad" value={String(model.loan)} onChangeText={(value) => updateModel((current) => ({ ...current, loan: Number(value) || 0 }))} />
              <View style={[styles.card, { backgroundColor: theme.primaryWash, borderColor: theme.primaryWash }]}><Text style={{ color: theme.text, fontWeight: '800' }}>Fixed each month {formatMoney0(budget.fixedUsd)}</Text></View>
            </View>
          ) : null}
          {step === 3 ? (
            <View>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Pick a budgeting method</Text>
              <Text style={[styles.subtitle, { color: theme.muted }]}>Based on the 50/30/20 rule — savings come first.</Text>
              {(['balanced', 'saver'] as BudgetMode[]).map((mode) => <TouchableOpacity key={mode} style={[styles.methodCard, { borderColor: model.method === mode ? theme.primary : theme.line, backgroundColor: model.method === mode ? theme.primaryWash : theme.surface }]} onPress={() => updateModel((current) => ({ ...current, method: mode }))}><Text style={{ color: theme.text, fontWeight: '900' }}>{mode === 'balanced' ? 'Balanced · 50/30/20' : 'Saver · 40/30/30'}</Text><Text style={{ color: theme.muted, marginTop: 5 }}>{mode === 'balanced' ? 'Recommended daily calm' : 'Tighter spending, faster savings'}</Text></TouchableOpacity>)}
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Row label="Salary" value={formatMoney0(budget.salaryUsd)} theme={theme} />
                <Row label="− Fixed costs" value={`−${formatMoney0(budget.fixedUsd)}`} theme={theme} />
                <Row label="− Savings first" value={`−${formatMoney0(budget.savingsTargetUsd)}`} theme={theme} />
                <Row label="Free to spend" value={formatMoney0(budget.spendableMonthUsd)} theme={theme} strong />
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: theme.page, borderColor: theme.line }]}>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={() => updateModel((current) => current.onbStep < 3 ? { ...current, onbStep: current.onbStep + 1 } : { ...current, onboarded: true, screen: 'home' })}>
            <Text style={styles.buttonText}>{step < 3 ? 'Continue' : 'Start budgeting'} →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function renderHome() {
    const topGoal = model.goals[0];
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}><View style={[styles.logo, { backgroundColor: theme.primary }]}><Text style={styles.logoText}>៛</Text></View><View><Text style={[styles.greet, { color: theme.muted }]}>Good evening</Text><Text style={[styles.title, { color: theme.text }]}>Today's budget</Text></View></View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, dark: !current.dark }))}><Text style={{ color: theme.text }}>{model.dark ? '☀️' : '🌙'}</Text></TouchableOpacity>
        </View>
        <View style={styles.ringWrap}>
          <RingBudget pct={budget.ringPct} color={ringColor} bg={theme.surface2} />
          <View style={styles.ringCenter}>
            <Text style={[styles.ringLabel, { color: theme.muted }]}>{budget.leftTodayUsd.amountMinor < 0 ? 'Over budget today' : 'Left to spend today'}</Text>
            <Text style={[styles.ringAmount, { color: budget.leftTodayUsd.amountMinor < 0 ? theme.red : theme.text }]}>{formatMoney(money(Math.abs(budget.leftTodayUsd.amountMinor), 'USD'))}</Text>
            <Text style={{ color: theme.muted }}>≈ {khr(Math.abs(budget.leftTodayUsd.amountMinor / 100) * model.rate)}</Text>
          </View>
        </View>
        <Pill text={`${formatMoney(budget.baseDailyUsd)} base + $7.00 rolled over`} theme={theme} />
        <Pill text={`Tomorrow ≈ ${formatMoney(budget.tomorrowUsd)} at this pace`} theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <SectionHeader title="This month" action="27 days left" theme={theme} />
          <Progress label="Spent" value={formatMoney(budget.spentMonthUsd)} total={formatMoney0(budget.spendableMonthUsd)} pct={budget.monthPct} color={theme.primary} theme={theme} />
          <Progress label="Saved so far" value="$232" total={formatMoney0(budget.savingsTargetUsd)} pct={budget.savingsPct} color={theme.green} theme={theme} />
        </View>
        {topGoal ? <TouchableOpacity style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => go('goals')}><SectionHeader title="Goal" action="All goals" theme={theme} /><Text style={[styles.itemTitle, { color: theme.text }]}>{topGoal.icon} {topGoal.name}</Text><Progress label="Saved" value={amountLabel(topGoal.saved, topGoal.cur)} total={amountLabel(topGoal.target, topGoal.cur)} pct={topGoal.saved / topGoal.target} color={theme.primary} theme={theme} /></TouchableOpacity> : null}
        <SectionHeader title="Coming up" action="+ Borrowed money" theme={theme} onAction={() => setSheet('iou')} />
        {model.billReminders && !model.paidBills.rent ? <Upcoming icon="🧾" title="Rent & utilities" subtitle="Due soon" amount={usd(model.rent + model.utilities)} theme={theme} onDone={() => updateModel((current) => ({ ...current, paidBills: { ...current.paidBills, rent: true } }))} /> : null}
        {model.ious.map((iou) => <Upcoming key={iou.id} icon="👛" title={`Pay back ${iou.person}`} subtitle={`Borrowed · due ${iou.due}`} amount={amountLabel(iou.amount, iou.cur)} theme={theme} onDone={() => updateModel((current) => ({ ...current, ious: current.ious.filter((item) => item.id !== iou.id) }))} />)}
        <SectionHeader title="Today" action="Summary" theme={theme} onAction={() => go('insights')} />
        {model.expenses.map((expense) => {
          const cat = categoryFor(model.categories, expense.cat);
          return <TouchableOpacity key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]} onPress={() => { setDrafts((current) => ({ ...current, selectedExpenseId: expense.id, selectedCat: expense.cat, iouAmount: String(expense.amount) })); setSheet('entry'); }}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Text>{cat.icon}</Text></View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: theme.text }]}>{expense.name}</Text><Text style={{ color: theme.muted }}>{cat.label} · {expense.time}</Text>{expense.note ? <Text style={{ color: theme.faint }}>{expense.note}</Text> : null}</View><View style={{ alignItems: 'flex-end' }}><Text style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</Text><TouchableOpacity onPress={() => deleteExpense(expense.id)}><Text style={{ color: theme.faint }}>Remove</Text></TouchableOpacity></View></TouchableOpacity>;
        })}
      </ScrollView>
    );
  }

  function renderAdd() {
    const hasAmount = Boolean(parsedAmount);
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderTopBar('Add expense', undefined, 'home')}
        <TextInput style={[styles.addInput, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} placeholder="Try: netflix, 10$  or  food, 1000 riels" placeholderTextColor={theme.faint} value={drafts.addText} onChangeText={(value) => { const next = parseExpenseText(value); setDrafts((current) => ({ ...current, addText: value, selectedCat: next.categoryKey })); }} />
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={{ color: theme.primary, fontWeight: '900', textTransform: 'uppercase' }}>✨ Understood</Text>
          <View style={styles.headerRow}><View><Text style={[styles.parsedAmount, { color: theme.text }]}>{parsedAmount ? formatMoney(parsedAmount) : '—'}</Text><Text style={{ color: theme.muted }}>{parsedAmount ? parsedAmount.currency === 'KHR' ? `≈ ${usd((parsedAmount.amountMinor / model.rate))}` : `≈ ${khr((parsedAmount.amountMinor / 100) * model.rate)}` : 'Start typing above'}</Text></View><View style={[styles.bubbleLarge, { backgroundColor: `${parsedCat.color}22` }]}><Text style={{ fontSize: 24 }}>{parsedCat.icon}</Text></View></View>
          <Text style={{ color: theme.muted, marginTop: 12 }}>Category — tap to change</Text>
        </View>
        <View style={styles.chipRow}>{model.categories.map((cat) => <TouchableOpacity key={cat.key} style={[styles.chip, { borderColor: theme.line, backgroundColor: drafts.selectedCat === cat.key ? cat.color : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, selectedCat: cat.key }))}><Text style={{ color: drafts.selectedCat === cat.key ? '#fff' : theme.muted, fontWeight: '800' }}>{cat.icon} {cat.label}</Text></TouchableOpacity>)}</View>
        <Text style={[styles.label, { color: theme.muted }]}>Note (optional)</Text>
        <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} placeholder="e.g. team lunch" placeholderTextColor={theme.faint} value={drafts.addNote} onChangeText={(value) => setDrafts((current) => ({ ...current, addNote: value }))} />
        <TouchableOpacity disabled={!hasAmount} style={[styles.button, { backgroundColor: theme.primary, opacity: hasAmount ? 1 : 0.35, marginTop: 24 }]} onPress={addExpense}><Text style={styles.buttonText}>✓ Add {parsedAmount ? formatMoney(parsedAmount) : ''}</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderCategories() {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderTopBar('Categories', 'Where your Wants budget is going this month.')}
        <View style={styles.grid}>{model.categories.filter((cat) => cat.budgetUsd > 0).map((cat) => <TouchableOpacity key={cat.key} style={[styles.catCard, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => { setDrafts((current) => ({ ...current, selectedCat: cat.key })); go('detail'); }}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Text>{cat.icon}</Text></View><Text style={[styles.itemTitle, { color: theme.text, marginTop: 12 }]}>{cat.label}</Text><Text style={{ color: theme.muted }}>{usd(cat.spentUsd)} of {usd0(cat.budgetUsd)}</Text><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { backgroundColor: cat.color, width: `${Math.min(100, (cat.spentUsd / cat.budgetUsd) * 100)}%` }]} /></View><Text style={{ color: cat.spentUsd > cat.budgetUsd ? theme.red : theme.muted, fontWeight: '800' }}>{Math.round((cat.spentUsd / cat.budgetUsd) * 100)}% used</Text></TouchableOpacity>)}</View>
        <TouchableOpacity style={[styles.dashed, { borderColor: theme.faint }]} onPress={() => setSheet('category')}><Text style={{ color: theme.primary, fontWeight: '900' }}>＋ Add category</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDetail() {
    const txns = model.expenses.filter((expense) => expense.cat === selectedCategory.key);
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderTopBar(selectedCategory.label, undefined, 'categories')}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><Text style={{ color: theme.muted, textTransform: 'uppercase', fontWeight: '800' }}>Spent this month</Text><Text style={[styles.parsedAmount, { color: theme.text }]}>{usd(selectedCategory.spentUsd)}</Text><Text style={{ color: theme.muted }}>of {usd0(selectedCategory.budgetUsd)} budget</Text></View>
        <SectionHeader title="Transactions" theme={theme} />
        {txns.map((expense) => <View key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]}><View style={[styles.bubble, { backgroundColor: `${selectedCategory.color}22` }]}><Text>{selectedCategory.icon}</Text></View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: theme.text }]}>{expense.name}</Text><Text style={{ color: theme.muted }}>Today</Text></View><Text style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</Text></View>)}
      </ScrollView>
    );
  }

  function renderGoals() {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderTopBar('Savings goals', undefined, 'home')}
        {model.goals.map((goal) => <View key={goal.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={styles.headerRow}><Text style={[styles.itemTitle, { color: theme.text }]}>{goal.icon} {goal.name}</Text><TouchableOpacity onPress={() => updateModel((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== goal.id) }))}><Text style={{ color: theme.faint }}>Delete</Text></TouchableOpacity></View><Progress label="Saved" value={amountLabel(goal.saved, goal.cur)} total={amountLabel(goal.target, goal.cur)} pct={goal.saved / goal.target} color={theme.primary} theme={theme} />{goal.saved < goal.target && goal.perMonth > 0 ? <TouchableOpacity style={[styles.sweep, { backgroundColor: theme.primaryWash }]} onPress={() => addGoalContribution(goal.id)}><Text style={{ color: theme.primary, fontWeight: '900' }}>Add {amountLabel(goal.perMonth, goal.cur)} this month</Text></TouchableOpacity> : <Text style={{ color: theme.green, fontWeight: '900' }}>Goal reached 🎉</Text>}</View>)}
        <TouchableOpacity style={[styles.dashed, { borderColor: theme.faint }]} onPress={() => setSheet('goal')}><Text style={{ color: theme.primary, fontWeight: '900' }}>＋ New goal</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderInsights() {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderTopBar('Insights', 'Your end-of-day summary, all in one place.')}
        <View style={[styles.statusCard, { backgroundColor: budget.status === 'over' ? theme.red : theme.green }]}><Text style={styles.statusPill}>END OF DAY · TODAY</Text><Text style={styles.statusHeadline}>{budget.status === 'over' ? 'A little over today — tomorrow adjusts for you.' : "You're under budget today — nice work."}</Text><View style={styles.statRow}><Stat label="Spent today" value={formatMoney(budget.spentTodayUsd)} /><Stat label="Saved today" value={formatMoney(money(Math.max(budget.leftTodayUsd.amountMinor, 0), 'USD'))} /></View><Text style={styles.tip}>💡 Food is your top spend this week. Cooking one dinner at home could add ~$6 to savings.</Text></View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><SectionHeader title="This week" action={`Daily budget ${formatMoney(budget.dailyBudgetUsd)}`} theme={theme} /><View style={styles.chart}>{[14, 19, 11, 22, 16, 8, 8.5].map((value, index) => <View key={`${value}-${index}`} style={styles.barCol}><View style={[styles.bar, { height: Math.max(20, value * 5), backgroundColor: value > budget.dailyBudgetUsd.amountMinor / 100 ? theme.amber : theme.primary }]} /><Text style={{ color: theme.muted }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text></View>)}</View></View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><SectionHeader title="Spending activity" action="last 5 weeks" theme={theme} /><View style={styles.heat}>{heatmap.map((cell) => <TouchableOpacity key={cell.index} style={[styles.heatCell, { backgroundColor: heatColor(cell.status, theme) }]} onPress={() => { setDrafts((current) => ({ ...current, selectedDay: cell.index })); setSheet('day'); }} />)}</View></View>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={exportCsv}><Text style={styles.buttonText}>Download CSV</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: theme.surface2, marginTop: 12 }]} onPress={scheduleNotification}><Text style={{ color: theme.text, fontWeight: '900' }}>Preview notification</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderSettings() {
    const rows = [
      ['Monthly income', `${amountLabel(model.salary, model.salaryCur)} / month`, 'income'],
      ['Rent & utilities', `${usd(model.rent + model.utilities)} · due 1st`, 'fixed'],
      ['Budgeting method', model.method === 'balanced' ? 'Balanced (50/30/20)' : 'Saver (40/30/30)', 'method'],
      ['Currencies', `USD · KHR (1$ = ${khr(model.rate)})`, 'currency'],
      ['Daily reminder', model.notify, 'reminder'],
    ] as const;
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderTopBar('Settings', 'Adjust anything — your budget recalculates instantly.')}
        {rows.map((row) => <TouchableOpacity key={row[0]} style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => setSheet(row[2])}><View><Text style={[styles.itemTitle, { color: theme.text }]}>{row[0]}</Text><Text style={{ color: theme.muted }}>{row[1]}</Text></View><Text style={{ color: theme.faint }}>›</Text></TouchableOpacity>)}
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, billReminders: !current.billReminders }))}><View><Text style={[styles.itemTitle, { color: theme.text }]}>Bill reminders</Text><Text style={{ color: theme.muted }}>{model.billReminders ? 'On' : 'Off'}</Text></View><Text style={{ color: theme.primary }}>{model.billReminders ? 'On' : 'Off'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, dark: !current.dark }))}><View><Text style={[styles.itemTitle, { color: theme.text }]}>Appearance</Text><Text style={{ color: theme.muted }}>{model.dark ? 'Dark mode' : 'Light mode'}</Text></View><Text>{model.dark ? '☀️' : '🌙'}</Text></TouchableOpacity>
        <View style={{ alignItems: 'center', marginTop: 32 }}><View style={styles.brandRow}><View style={[styles.logo, { backgroundColor: theme.primary }]}><Text style={styles.logoText}>៛</Text></View><Text style={[styles.brandName, { color: theme.text }]}>Luy Khnom</Text></View><Text style={{ color: theme.muted }}>Spend calm · v1.0</Text></View>
      </ScrollView>
    );
  }

  function renderSheet() {
    return (
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.page }]}>
            <View style={[styles.grab, { backgroundColor: theme.faint }]} />
            <View style={styles.headerRow}><Text style={[styles.sheetTitle, { color: theme.text }]}>{sheetTitle(sheet)}</Text><TouchableOpacity onPress={() => setSheet(null)}><Text style={{ color: theme.text, fontSize: 22 }}>×</Text></TouchableOpacity></View>
            {sheet === 'income' ? <SheetInput label="Monthly salary" value={String(model.salary)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, salary: Number(value) || 0 }))} /> : null}
            {sheet === 'fixed' ? <View><SheetInput label="Rent" value={String(model.rent)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, rent: Number(value) || 0 }))} /><SheetInput label="Utilities" value={String(model.utilities)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, utilities: Number(value) || 0 }))} /><SheetInput label="Loan" value={String(model.loan)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, loan: Number(value) || 0 }))} /></View> : null}
            {sheet === 'method' ? <View>{(['balanced', 'saver'] as BudgetMode[]).map((mode) => <TouchableOpacity key={mode} style={[styles.methodCard, { backgroundColor: model.method === mode ? theme.primaryWash : theme.surface, borderColor: model.method === mode ? theme.primary : theme.line }]} onPress={() => updateModel((current) => ({ ...current, method: mode }))}><Text style={{ color: theme.text, fontWeight: '900' }}>{mode === 'balanced' ? 'Balanced · 50/30/20' : 'Saver · 40/30/30'}</Text></TouchableOpacity>)}</View> : null}
            {sheet === 'currency' ? <SheetInput label="KHR per $1" value={String(model.rate)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, rate: Number(value) || RATE }))} /> : null}
            {sheet === 'reminder' ? <SheetInput label="Reminder time" value={model.notify} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, notify: value }))} /> : null}
            {sheet === 'category' ? <View><SheetInput label="Category name" value={drafts.categoryName} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, categoryName: value }))} /><SheetInput label="Monthly budget" value={drafts.categoryBudget} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, categoryBudget: value }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 18 }]} onPress={saveCategory}><Text style={styles.buttonText}>Add category</Text></TouchableOpacity></View> : null}
            {sheet === 'entry' && selectedExpense ? <View><SheetInput label="Amount" value={drafts.iouAmount} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouAmount: value }))} /><View style={styles.chipRow}>{model.categories.map((cat) => <TouchableOpacity key={cat.key} style={[styles.chip, { borderColor: theme.line, backgroundColor: drafts.selectedCat === cat.key ? cat.color : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, selectedCat: cat.key }))}><Text style={{ color: drafts.selectedCat === cat.key ? '#fff' : theme.text }}>{cat.icon} {cat.label}</Text></TouchableOpacity>)}</View><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 18 }]} onPress={saveEntry}><Text style={styles.buttonText}>Save entry</Text></TouchableOpacity></View> : null}
            {sheet === 'iou' ? <View><SheetInput label="Who did you borrow from?" value={drafts.iouPerson} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouPerson: value }))} /><SheetInput label="Amount" value={drafts.iouAmount} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouAmount: value }))} /><SheetInput label="Pay back by" value={drafts.iouDue} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouDue: value }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 18 }]} onPress={saveIou}><Text style={styles.buttonText}>Save</Text></TouchableOpacity></View> : null}
            {sheet === 'goal' ? <View><SheetInput label="What are you saving for?" value={drafts.goalName} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalName: value }))} /><SheetInput label="Target amount" value={drafts.goalTarget} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalTarget: value }))} /><SheetInput label="Save per month" value={drafts.goalPer} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalPer: value }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 18 }]} onPress={saveGoal}><Text style={styles.buttonText}>Create goal</Text></TouchableOpacity></View> : null}
            {sheet === 'day' ? <View><View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><Text style={{ color: theme.muted }}>Spent</Text><Text style={[styles.parsedAmount, { color: theme.text }]}>{usd(model.history[drafts.selectedDay] ?? 0)}</Text></View></View> : null}
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  if (!hydrated) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: theme.page, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: theme.text, fontWeight: '900' }}>Loading Luy Khnom…</Text></SafeAreaView>;
  }

  if (!model.onboarded || model.screen === 'onboarding') return renderOnboarding();

  let content = renderHome();
  if (model.screen === 'add') content = renderAdd();
  if (model.screen === 'categories') content = renderCategories();
  if (model.screen === 'detail') content = renderDetail();
  if (model.screen === 'goals') content = renderGoals();
  if (model.screen === 'insights') content = renderInsights();
  if (model.screen === 'settings') content = renderSettings();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}> 
      <StatusBar style={model.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>{content}</View>
      {['home', 'categories', 'insights', 'settings'].includes(model.screen) ? <BottomNav screen={model.screen} theme={theme} onGo={go} /> : null}
      {toast ? <View style={[styles.toast, { backgroundColor: theme.text }]}><Text style={{ color: theme.page, fontWeight: '900' }}>✓ {toast}</Text></View> : null}
      {renderSheet()}
    </SafeAreaView>
  );
}

function Row({ label, value, theme, strong }: { label: string; value: string; theme: typeof LIGHT; strong?: boolean }) {
  return <View style={styles.row}><Text style={{ color: theme.muted }}>{label}</Text><Text style={{ color: strong ? theme.primary : theme.text, fontWeight: '900' }}>{value}</Text></View>;
}

function SectionHeader({ title, action, theme, onAction }: { title: string; action?: string; theme: typeof LIGHT; onAction?: () => void }) {
  return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>{action ? <TouchableOpacity onPress={onAction}><Text style={{ color: theme.primary, fontWeight: '900' }}>{action}</Text></TouchableOpacity> : null}</View>;
}

function Pill({ text, theme }: { text: string; theme: typeof LIGHT }) {
  return <View style={[styles.pill, { backgroundColor: theme.surface2 }]}><Text style={{ color: theme.muted, fontWeight: '800' }}>{text}</Text></View>;
}

function Progress({ label, value, total, pct, color, theme }: { label: string; value: string; total: string; pct: number; color: string; theme: typeof LIGHT }) {
  return <View style={{ marginBottom: 14 }}><View style={styles.row}><Text style={{ color: theme.muted }}>{label}</Text><Text style={{ color: theme.text, fontWeight: '900' }}>{value} <Text style={{ color: theme.faint }}>/ {total}</Text></Text></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(1, pct)) * 100}%`, backgroundColor: color }]} /></View></View>;
}

function Upcoming({ icon, title, subtitle, amount, theme, onDone }: { icon: string; title: string; subtitle: string; amount: string; theme: typeof LIGHT; onDone: () => void }) {
  return <View style={[styles.expenseRow, { borderColor: theme.line }]}><View style={[styles.bubble, { backgroundColor: theme.surface2 }]}><Text>{icon}</Text></View><View style={{ flex: 1 }}><Text style={[styles.itemTitle, { color: theme.text }]}>{title}</Text><Text style={{ color: theme.muted }}>{subtitle}</Text></View><Text style={[styles.amount, { color: theme.text }]}>{amount}</Text><TouchableOpacity onPress={onDone}><Text style={{ color: theme.green, fontWeight: '900' }}>✓</Text></TouchableOpacity></View>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.statBox}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SheetInput({ label, value, theme, onChange }: { label: string; value: string; theme: typeof LIGHT; onChange: (value: string) => void }) {
  return <View><Text style={[styles.label, { color: theme.muted }]}>{label}</Text><TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} value={value} onChangeText={onChange} keyboardType={label.toLowerCase().includes('amount') || label.toLowerCase().includes('salary') || label.toLowerCase().includes('budget') || label.includes('$') || label.includes('Rent') || label.includes('Utilities') || label.includes('Loan') ? 'decimal-pad' : 'default'} /></View>;
}

function BottomNav({ screen, theme, onGo }: { screen: Screen; theme: typeof LIGHT; onGo: (screen: Screen) => void }) {
  const nav = [
    ['home', '⌂', 'Home'],
    ['categories', '▦', 'Categories'],
    ['insights', '◌', 'Insights'],
    ['settings', '⚙', 'Settings'],
  ] as const;
  return <View style={[styles.nav, { backgroundColor: theme.surface, borderColor: theme.line }]}>{nav.slice(0, 2).map((item) => <NavItem key={item[0]} item={item} active={screen === item[0]} theme={theme} onGo={onGo} />)}<TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={() => onGo('add')}><Text style={{ color: '#fff', fontSize: 30 }}>＋</Text></TouchableOpacity>{nav.slice(2).map((item) => <NavItem key={item[0]} item={item} active={screen === item[0]} theme={theme} onGo={onGo} />)}</View>;
}

function NavItem({ item, active, theme, onGo }: { item: readonly [Screen, string, string]; active: boolean; theme: typeof LIGHT; onGo: (screen: Screen) => void }) {
  return <TouchableOpacity style={styles.navItem} onPress={() => onGo(item[0])}><View style={[styles.navIcon, { backgroundColor: active ? theme.primaryWash : 'transparent' }]}><Text style={{ color: active ? theme.primary : theme.muted }}>{item[1]}</Text></View><Text style={{ color: active ? theme.primary : theme.muted, fontWeight: '800', fontSize: 11 }}>{item[2]}</Text></TouchableOpacity>;
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
  if (sheet === 'fixed') return 'Fixed costs';
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  brandName: { fontWeight: '900', fontSize: 17 },
  greet: { fontWeight: '800', fontSize: 13 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  heroTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.7, marginTop: 18 },
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  iconButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  ringAmount: { fontSize: 48, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  pill: { alignSelf: 'center', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 24, padding: 20, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontWeight: '900', fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  track: { height: 9, borderRadius: 99, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', borderRadius: 99 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  bubble: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubbleLarge: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontWeight: '900', fontSize: 15 },
  amount: { fontWeight: '900', fontSize: 15 },
  addInput: { borderWidth: 2, borderRadius: 22, padding: 18, fontSize: 18, fontWeight: '800' },
  parsedAmount: { fontSize: 38, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  label: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 9 },
  input: { borderWidth: 2, borderRadius: 18, padding: 16, fontSize: 18, fontWeight: '800' },
  button: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: { width: '48%', borderWidth: 1, borderRadius: 22, padding: 15 },
  dashed: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 20, padding: 18, alignItems: 'center', marginTop: 16 },
  sweep: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 },
  statusCard: { borderRadius: 24, padding: 22, marginTop: 14 },
  statusPill: { color: '#fff', opacity: 0.9, fontWeight: '900', fontSize: 11 },
  statusHeadline: { color: '#fff', fontWeight: '900', fontSize: 25, lineHeight: 31, marginTop: 16 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,.16)', borderRadius: 16, padding: 13 },
  statValue: { color: '#fff', fontWeight: '900', fontSize: 22 },
  statLabel: { color: '#fff', opacity: 0.9, marginTop: 2 },
  tip: { color: '#fff', fontWeight: '700', lineHeight: 20, backgroundColor: 'rgba(255,255,255,.15)', borderRadius: 16, padding: 14, marginTop: 12 },
  chart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  bar: { width: '100%', borderRadius: 8 },
  heat: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heatCell: { width: '12.7%', aspectRatio: 1, borderRadius: 6 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 17, borderBottomWidth: 1 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 6, marginVertical: 14 },
  dot: { height: 8, borderRadius: 99 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segmentButton: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  help: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  methodCard: { borderWidth: 2, borderRadius: 18, padding: 16, marginTop: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, borderTopWidth: 1 },
  nav: { height: 82, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', paddingBottom: 10, paddingHorizontal: 6 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navIcon: { width: 56, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  fab: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginTop: -30, marginHorizontal: 8 },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 96, borderRadius: 16, padding: 14, alignItems: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(10,10,20,.42)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '88%' },
  grab: { width: 40, height: 4, borderRadius: 99, alignSelf: 'center', marginBottom: 14, opacity: 0.6 },
  sheetTitle: { fontSize: 20, fontWeight: '900' },
});
