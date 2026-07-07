import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { backupFileName, deriveRestorePreview, parsePersistedBackup, stringifyPersistedBackup, type RestorePreview } from './src/db/appBackup';
import { BALANCED, SAVER, summarizeBudget } from './src/domain/budget';
import { parseExpenseText } from './src/domain/expenseParser';
import { bestAndWorst, buildHeatmap } from './src/domain/insights';
import { formatMoney, formatMoney0, money } from './src/domain/money';
import { daysRemainingInMonth, filterExpensesByDay, filterExpensesByMonth, isIsoDay, isoDayFromDate, isoMonthFromDay } from './src/domain/dates';
import { categoryFor } from './src/domain/categories';
import type { AppModel, Currency, Drafts, Expense, Screen, Sheet } from './src/app/types';
import { INITIAL_DRAFTS, INITIAL_MODEL, PALETTE, RATE } from './src/app/initialState';
import { FIRST_SETUP_ONBOARDING_STEP, LAST_SETUP_ONBOARDING_STEP, WELCOME_ONBOARDING_STEP, normalizeLoadedModel, type PersistedAppModel } from './src/app/normalizeLoadedModel';
import { fetchUsdToKhrRate, shouldRefreshExchangeRate, USD_TO_KHR_RATE_SOURCE } from './src/services/exchangeRate';
import { dueText, greetingFor, monthLabel, shiftIsoMonth } from './src/app/dateLabels';
import { amountLabel, amountUsd, csvEscape, formatClock, heatColor, khr, monthsToGo, nowTime, ordinal, sheetTitle, usd, usd0 } from './src/app/formatters';
import { DARK, LIGHT } from './src/theme/theme';
import { FONT } from './src/theme/typography';
import { AppText } from './src/ui/AppText';
import { AnimatedPressable } from './src/ui/AnimatedPressable';
import { Glyph, ICON_SET, type IconName } from './src/ui/icons';
import { AnimatedCue, EmptyState, Pill, Progress, RingBudget, Row, SectionHeader, SelectableChip, SetupDot, Stat, Upcoming } from './src/ui/components';
import { AnimatedNumber } from './src/ui/AnimatedNumber';
import { BudgetMethodPicker, DueDayPicker, MoneyField, ReminderTimePicker, SheetInput } from './src/ui/forms';
import { WelcomeScreen } from './src/ui/WelcomeScreen';
import { BottomNav } from './src/ui/navigation';
import { CARD_SHADOW, styles } from './src/ui/styles';

type ToastState = {
  message: string;
  actionLabel?: string;
  action?: () => void;
};

type PendingRestore = {
  model: AppModel;
  preview: RestorePreview;
};


function AppContent() {
  const [model, setModel] = useState<AppModel>(INITIAL_MODEL);
  const [drafts, setDrafts] = useState<Drafts>(INITIAL_DRAFTS);
  const [hydrated, setHydrated] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [celebrate, setCelebrate] = useState<{ title: string; body: string } | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [heatWidth, setHeatWidth] = useState(0);
  const [draggingGoal, setDraggingGoal] = useState<string | null>(null);
  const goalHeights = useRef<Record<string, number>>({}).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const lastBackPressAt = useRef(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(() => isoMonthFromDay(isoDayFromDate(new Date())));
  const rateRefreshInFlightDay = useRef<string | null>(null);
  const [recentExpenseId, setRecentExpenseId] = useState<string | null>(null);
  const sweepInProgressRef = useRef(false);
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
  const safeInsets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(16, safeInsets.bottom + 10);

  useEffect(() => {
    try {
      const saved = loadAppState<PersistedAppModel>();
      setModel(normalizeLoadedModel(saved?.state));
    } catch (error) {
      console.warn('Could not load Luy Khnom state', error);
      setModel(normalizeLoadedModel(undefined));
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setModel((current) => normalizeLoadedModel(current));
    });
    return () => subscription.remove();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const todayForRate = isoDayFromDate(new Date());
    if (!shouldRefreshExchangeRate(model.exchangeRateLastFetchedDay, todayForRate)) return;
    if (rateRefreshInFlightDay.current === todayForRate) return;

    rateRefreshInFlightDay.current = todayForRate;
    setModel((current) => {
      if (!shouldRefreshExchangeRate(current.exchangeRateLastFetchedDay, todayForRate)) return current;
      return { ...current, exchangeRateLastFetchedDay: todayForRate };
    });

    void fetchUsdToKhrRate()
      .then((result) => {
        if (result === null) return;
        setModel((current) => ({
          ...current,
          rate: result.khrPerUsd,
          exchangeRateSource: result.source,
        }));
      })
      .catch((error) => {
        console.warn('Could not refresh USD/KHR exchange rate', error);
      })
      .finally(() => {
        if (rateRefreshInFlightDay.current === todayForRate) {
          rateRefreshInFlightDay.current = null;
        }
      });
  }, [hydrated, model.exchangeRateLastFetchedDay, model.lastActiveDay]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveAppState(model);
    } catch (error) {
      console.warn('Could not save Luy Khnom state', error);
    }
  }, [model, hydrated]);

  const today = isoDayFromDate(new Date());
  const thisMonth = isoMonthFromDay(today);
  const todayExpenses = filterExpensesByDay(model.expenses, today);
  const monthExpenses = filterExpensesByMonth(model.expenses, thisMonth);
  const monthSpendByCategory = new Map<string, number>();
  monthExpenses.forEach((expense) => {
    monthSpendByCategory.set(expense.cat, (monthSpendByCategory.get(expense.cat) ?? 0) + amountUsd(expense.amount, expense.cur, model.rate));
  });
  const categoryMonthSpentUsd = (key: string) => monthSpendByCategory.get(key) ?? 0;
  const savedSoFarUsd = money(Math.round(model.goals.reduce((sum, goal) => sum + amountUsd(goal.saved, goal.cur, model.rate), 0) * 100), 'USD');
  const method = model.method === 'custom'
    ? { key: 'custom' as const, needsPct: model.custom.needs, wantsPct: model.custom.wants, savePct: model.custom.save }
    : model.method === 'balanced' ? BALANCED : SAVER;
  const categorySpend = model.categories.map((category) => ({
    key: category.key,
    spent: money(Math.round(categoryMonthSpentUsd(category.key) * 100), 'USD' as const),
    budget: money(Math.round(category.budgetUsd * 100), 'USD' as const),
  }));
  const todayMoney = todayExpenses.map((expense) => money(expense.cur === 'USD' ? Math.round(expense.amount * 100) : Math.round(expense.amount), expense.cur));
  const budgetInput = {
    salary: money(model.salaryCur === 'USD' ? Math.round(model.salary * 100) : Math.round(model.salary), model.salaryCur),
    fixedCosts: [money(Math.round(model.rent * 100), 'USD'), money(Math.round(model.utilities * 100), 'USD'), money(Math.round(model.loan * 100), 'USD')],
    savedSoFar: savedSoFarUsd,
    categorySpend,
    todayExpenses: todayMoney,
    method,
    rate: { khrPerUsd: model.rate },
    daysLeftIncludingToday: daysRemainingInMonth(today),
  };
  const rolloverYesterday = money(Math.round(model.rolloverUsd * 100), 'USD');
  const budget = summarizeBudget({ ...budgetInput, rolloverYesterday });
  const parsed = parseExpenseText(drafts.addText);
  const parsedCat = categoryFor(model.categories, drafts.selectedCat || parsed.categoryKey);
  const parsedAmount = parsed.amount;
  const ringColor = budget.status === 'over' ? theme.red : budget.ringPct < 0.35 ? theme.amber : theme.green;
  const selectedCategory = categoryFor(model.categories, drafts.selectedCat);
  const selectedExpense = model.expenses.find((expense) => expense.id === drafts.selectedExpenseId) ?? null;
  const chartHistory = [...model.history, budget.spentTodayUsd.amountMinor / 100].slice(-35);
  const heatmap = buildHeatmap(chartHistory, budget.dailyBudgetUsd.amountMinor / 100);
  const selectedDayIndex = Math.max(0, Math.min(drafts.selectedDay, chartHistory.length - 1));
  const selectedDayDate = isoDayFromDate(new Date(new Date().setDate(new Date().getDate() - (chartHistory.length - 1 - selectedDayIndex))));
  const selectedDayExpenses = filterExpensesByDay(model.expenses, selectedDayDate);

  function showToast(message: string, actionLabel?: string, action?: () => void) {
    setToast({ message, actionLabel, action });
    setTimeout(() => setToast(null), action ? 5200 : 2400);
  }

  function updateModel(recipe: (current: AppModel) => AppModel) {
    setModel((current) => recipe(current));
  }

  function go(screen: Screen) {
    if (screen === 'add') setDrafts((current) => ({ ...current, expenseDate: today }));
    updateModel((current) => ({ ...current, screen }));
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pendingRestore) {
        setPendingRestore(null);
        return true;
      }
      if (celebrate) {
        setCelebrate(null);
        return true;
      }
      if (sheet) {
        setSheet(null);
        return true;
      }
      if (!model.onboarded || model.screen === 'onboarding') {
        if (model.onbStep > WELCOME_ONBOARDING_STEP) {
          updateModel((current) => ({ ...current, onbStep: Math.max(WELCOME_ONBOARDING_STEP, current.onbStep - 1) }));
        } else {
          showToast('Finish setup to start budgeting');
        }
        return true;
      }
      if (model.screen === 'detail') {
        updateModel((current) => ({ ...current, screen: 'categories' }));
        return true;
      }
      if (model.screen !== 'home') {
        updateModel((current) => ({ ...current, screen: 'home' }));
        return true;
      }
      const now = Date.now();
      if (now - lastBackPressAt.current < 1800) return false;
      lastBackPressAt.current = now;
      showToast('Press back again to exit');
      return true;
    });
    return () => subscription.remove();
  }, [celebrate, pendingRestore, sheet, model.onboarded, model.screen, model.onbStep]);

  function openEntrySheet(expense: Expense) {
    setDrafts((current) => ({
      ...current,
      selectedExpenseId: expense.id,
      selectedCat: expense.cat,
      iouAmount: String(expense.amount),
      entryCur: expense.cur,
      addNote: expense.note ?? '',
      expenseDate: expense.date,
    }));
    setSheet('entry');
  }

  function addExpense() {
    if (!parsedAmount) return;
    const expenseDate = drafts.expenseDate.trim();
    if (!isIsoDay(expenseDate)) {
      showToast(`Use a valid date like ${today}`);
      return;
    }
    const chosenKey = drafts.selectedCat || parsed.categoryKey;
    const category = categoryFor(model.categories, chosenKey);
    const expenseCat = model.categories.some((item) => item.key === chosenKey) ? chosenKey : category.key;
    const amount = parsedAmount.currency === 'USD' ? parsedAmount.amountMinor / 100 : parsedAmount.amountMinor;
    const expense: Expense = {
      id: `expense-${Date.now()}`,
      name: parsed.label || category.label,
      cat: expenseCat,
      amount,
      cur: parsedAmount.currency,
      time: nowTime(),
      date: expenseDate,
      note: drafts.addNote.trim() || undefined,
    };
    const usdValue = amountUsd(expense.amount, expense.cur, model.rate);
    const adjustCurrentMonth = isoMonthFromDay(expense.date) === thisMonth;
    setRecentExpenseId(expense.id);
    updateModel((current) => ({
      ...current,
      screen: 'home',
      expenses: [expense, ...current.expenses],
      categories: adjustCurrentMonth ? current.categories.map((item) => (item.key === expenseCat ? { ...item, spentUsd: item.spentUsd + usdValue } : item)) : current.categories,
    }));
    setDrafts((current) => ({ ...current, addText: '', addNote: '', selectedCat: '', expenseDate: today }));
    showToast(`Added ${expense.name}`, 'Undo', () => {
      updateModel((current) => ({
        ...current,
        expenses: current.expenses.filter((item) => item.id !== expense.id),
        categories: adjustCurrentMonth ? current.categories.map((item) => (item.key === expenseCat ? { ...item, spentUsd: Math.max(0, item.spentUsd - usdValue) } : item)) : current.categories,
      }));
    });
  }

  function deleteExpense(id: string) {
    const expense = model.expenses.find((item) => item.id === id);
    if (!expense) return;
    const usdValue = amountUsd(expense.amount, expense.cur, model.rate);
    const adjustCurrentMonth = isoMonthFromDay(expense.date) === thisMonth;
    updateModel((current) => ({
      ...current,
      expenses: current.expenses.filter((item) => item.id !== id),
      categories: adjustCurrentMonth ? current.categories.map((item) => (item.key === expense.cat ? { ...item, spentUsd: Math.max(0, item.spentUsd - usdValue) } : item)) : current.categories,
    }));
    showToast(`Deleted ${expense.name}`, 'Undo', () => {
      updateModel((current) => ({
        ...current,
        expenses: current.expenses.some((item) => item.id === expense.id) ? current.expenses : [expense, ...current.expenses],
        categories: adjustCurrentMonth ? current.categories.map((item) => (item.key === expense.cat ? { ...item, spentUsd: item.spentUsd + usdValue } : item)) : current.categories,
      }));
    });
  }

  function saveEntry() {
    const amount = Number(drafts.iouAmount);
    const expenseDate = drafts.expenseDate.trim();
    if (!selectedExpense || !Number.isFinite(amount) || amount <= 0) return;
    if (!isIsoDay(expenseDate)) {
      showToast(`Use a valid date like ${today}`);
      return;
    }
    const nextCat = drafts.selectedCat || selectedExpense.cat;
    const oldUsd = amountUsd(selectedExpense.amount, selectedExpense.cur, model.rate);
    const newUsd = amountUsd(amount, drafts.entryCur, model.rate);
    const note = drafts.addNote.trim() || undefined;
    const oldCurrentMonth = isoMonthFromDay(selectedExpense.date) === thisMonth;
    const newCurrentMonth = isoMonthFromDay(expenseDate) === thisMonth;
    updateModel((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => (expense.id === selectedExpense.id ? { ...expense, amount, cur: drafts.entryCur, note, cat: nextCat, date: expenseDate } : expense)),
      categories: oldCurrentMonth || newCurrentMonth ? current.categories.map((category) => {
        let spentUsd = category.spentUsd;
        if (oldCurrentMonth && category.key === selectedExpense.cat) spentUsd -= oldUsd;
        if (newCurrentMonth && category.key === nextCat) spentUsd += newUsd;
        return { ...category, spentUsd: Math.max(0, spentUsd) };
      }) : current.categories,
    }));
    setDrafts((current) => ({ ...current, addNote: '' }));
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

  function sweepLeftover() {
    const leftoverUsd = Math.max(0, budget.leftTodayUsd.amountMinor) / 100;
    if (leftoverUsd <= 0 || sweepInProgressRef.current || model.swept) return;
    if (model.goals.length === 0) {
      showToast('Create a goal to sweep into');
      return;
    }
    sweepInProgressRef.current = true;
    setTimeout(() => {
      sweepInProgressRef.current = false;
    }, 900);
    updateModel((current) => {
      if (current.swept) return current;
      return {
        ...current,
        swept: true,
        goals: current.goals.map((goal, index) => {
          if (index !== 0) return goal;
          const saved = Math.min(goal.target, goal.saved + leftoverUsd);
          return { ...goal, saved, celebrated: saved >= goal.target ? true : goal.celebrated };
        }),
      };
    });
    const topGoal = model.goals[0];
    const reached = topGoal.saved + leftoverUsd >= topGoal.target;
    if (reached) {
      setCelebrate({
        title: 'Savings goal reached!',
        body: `You've set aside ${usd(leftoverUsd)} toward ${topGoal.name} — future you says thanks.`,
      });
    } else {
      showToast(`Swept ${usd(leftoverUsd)} into ${topGoal.name}`);
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
    model.expenses
      .filter((expense) => isoMonthFromDay(expense.date) === exportMonth)
      .forEach((expense) => {
        rows.push([expense.date, expense.name, categoryFor(model.categories, expense.cat).label, String(expense.amount), expense.cur, expense.note ?? '']);
      });
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const exportLabel = monthLabel(exportMonth);
    const exportName = `luy-khnom-export-${exportLabel.replace(/\s+/g, '-').toLowerCase()}`;
    const uri = `${FileSystem.documentDirectory}${exportName}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Export Luy Khnom CSV — ${exportLabel}` });
    }
    showToast('CSV exported');
  }

  async function exportJsonBackup() {
    try {
      const uri = `${FileSystem.documentDirectory}${backupFileName()}`;
      await FileSystem.writeAsStringAsync(uri, stringifyPersistedBackup(model), { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export Luy Khnom backup' });
      }
      showToast('Backup ready — JSON restores the whole app');
    } catch (error) {
      console.warn('Could not export Luy Khnom backup', error);
      showToast('Could not export backup');
    }
  }

  async function importJsonBackup() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) throw new Error('No backup file selected');
      const raw = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const backup = parsePersistedBackup<PersistedAppModel>(raw);
      const preview = deriveRestorePreview(backup);
      if (!preview) throw new Error('Backup preview is unavailable');
      setPendingRestore({ model: normalizeLoadedModel(backup.state), preview });
    } catch (error) {
      console.warn('Could not import Luy Khnom backup', error);
      showToast(error instanceof Error ? error.message : 'Could not import backup');
    }
  }

  async function restorePendingBackup() {
    if (!pendingRestore) return;
    try {
      await saveAppState(pendingRestore.model);
      setModel(pendingRestore.model);
      setDrafts(INITIAL_DRAFTS);
      setSheet(null);
      setPendingRestore(null);
      showToast('Backup restored');
    } catch (error) {
      console.warn('Could not restore Luy Khnom backup', error);
      showToast('Could not restore backup');
    }
  }

  function renderTopBar(title: string, _subtitle?: string, back?: Screen, right?: ReactNode) {
    return (
      <View style={styles.topRow}>
        {back ? (
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => go(back)}>
            <MaterialIcons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText style={[back ? styles.title : styles.pageTitle, { color: theme.text }]}>{title}</AppText>
        </View>
        {right ?? null}
      </View>
    );
  }

  function renderOnboarding() {
    const step = model.onbStep;
    if (step === WELCOME_ONBOARDING_STEP) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
          <WelcomeScreen theme={theme} onStart={() => updateModel((current) => ({ ...current, onbStep: FIRST_SETUP_ONBOARDING_STEP }))} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
          <ScrollView key={`setup-${step}`} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'} contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(220, footerBottomPadding + 156) }]}>
            <View style={[styles.headerRow, { marginTop: 4, marginBottom: 20 }]}>
            <View style={{ width: 40 }}>{step > 1 ? <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, onbStep: current.onbStep - 1 }))}><MaterialIcons name="arrow-back" size={20} color={theme.text} /></TouchableOpacity> : null}</View>
            <View style={styles.dots}>
              {[1, 2, 3].map((item) => <SetupDot key={item} active={item <= step} activeColor={theme.primary} inactiveColor={theme.surface2} />)}
            </View>
            <View style={{ width: 40 }} />
          </View>
          {step === 1 ? <View style={[styles.brandRow, { marginBottom: 4 }]}>
            <Image source={require('./assets/luy-khnom-favicon-flat.png')} style={styles.logo} resizeMode="contain" />
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
              <MoneyField label="Rent" initialAmount={model.rent} rate={model.rate} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, rent: value }))} />
              <DueDayPicker label="Rent due date" value={model.rentDue} theme={theme} onChange={(day) => updateModel((current) => ({ ...current, rentDue: day }))} />
              <MoneyField label="Utilities (monthly avg)" initialAmount={model.utilities} rate={model.rate} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, utilities: value }))} />
              <AppText style={[styles.label, { color: theme.muted }]}>Loan</AppText>
              <View style={[styles.segment, { backgroundColor: theme.surface2 }]}><TouchableOpacity style={[styles.segmentButton, model.loan <= 0 && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, loan: 0, paidBills: { ...current.paidBills, loan: true } }))}><AppText style={[styles.segmentText, { color: model.loan <= 0 ? theme.text : theme.muted }]}>No loan</AppText></TouchableOpacity><TouchableOpacity style={[styles.segmentButton, model.loan > 0 && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, loan: current.loan > 0 ? current.loan : 50, paidBills: { ...current.paidBills, loan: false } }))}><AppText style={[styles.segmentText, { color: model.loan > 0 ? theme.text : theme.muted }]}>I have a loan</AppText></TouchableOpacity></View>
              {model.loan > 0 ? <><MoneyField label="Loan repayment" initialAmount={model.loan} rate={model.rate} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, loan: value }))} /><DueDayPicker label="Loan due date" value={model.loanDue} theme={theme} onChange={(day) => updateModel((current) => ({ ...current, loanDue: day }))} /></> : <AppText style={[styles.help, { color: theme.muted }]}>No loan payment will show in Coming up.</AppText>}
              <View style={[styles.card, { backgroundColor: theme.primaryWash, borderColor: theme.primaryWash }, styles.row, { marginBottom: 0 }]}><AppText style={[styles.rowValue, { color: theme.text }]}>Fixed each month</AppText><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 18, marginTop: 0 }]}>{formatMoney0(budget.fixedUsd)}</AppText></View>
            </View>
          ) : null}
          {step === 3 ? (
            <View>
              <AppText style={[styles.heroTitle, { color: theme.text }]}>Pick a budgeting method</AppText>
              <AppText style={[styles.subtitle, { color: theme.muted }]}>Choose the split that fits your month — savings come first.</AppText>
              <BudgetMethodPicker
                method={model.method}
                custom={model.custom}
                theme={theme}
                onSelect={(mode) => updateModel((current) => ({ ...current, method: mode }))}
                onCustomChange={(part, value) => updateModel((current) => ({ ...current, custom: { ...current.custom, [part]: value } }))}
              />
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
              <ReminderTimePicker
                value={model.notify}
                theme={theme}
                open={timePickerOpen}
                onOpenChange={setTimePickerOpen}
                onChange={(value) => updateModel((current) => ({ ...current, notify: value }))}
              />
            </View>
          ) : null}
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: theme.page, borderColor: theme.line, paddingBottom: footerBottomPadding }]}>
            <AnimatedPressable accessibilityRole="button" accessibilityLabel={step < LAST_SETUP_ONBOARDING_STEP ? 'Continue setup' : 'Start budgeting'} style={[styles.button, { backgroundColor: theme.primary }]} contentStyle={styles.buttonContent} onPress={() => updateModel((current) => current.onbStep < LAST_SETUP_ONBOARDING_STEP ? { ...current, onbStep: current.onbStep + 1 } : { ...current, onboarded: true, screen: 'home' })}>
              <AppText numberOfLines={1} style={styles.buttonText}>{step < LAST_SETUP_ONBOARDING_STEP ? 'Continue' : 'Start budgeting'}</AppText>
              <MaterialIcons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  function renderHome() {
    const topGoals = model.goals.slice(0, 3);
    const leftAbsUsd = Math.abs(budget.leftTodayUsd.amountMinor) / 100;
    const leftFmt = model.baseCur === 'KHR' ? khr(leftAbsUsd * model.rate) : formatMoney(money(Math.abs(budget.leftTodayUsd.amountMinor), 'USD'));
    const leftAmountValue = model.baseCur === 'KHR' ? leftAbsUsd * model.rate : leftAbsUsd;
    const leftAlt = model.baseCur === 'KHR' ? usd(leftAbsUsd) : khr(leftAbsUsd * model.rate);
    const ringLabel = budget.status === 'over' ? 'Over budget today' : budget.status === 'close' ? "Almost at today's limit" : 'Left to spend today';
    const hasLoanPayment = model.billReminders && model.loan > 0 && !model.paidBills.loan;
    const hasRentPayment = model.billReminders && model.rent + model.utilities > 0 && !model.paidBills.rent;
    const hasUpcoming = hasLoanPayment || hasRentPayment || model.ious.length > 0;
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}><AppText style={[styles.greet, { color: theme.muted }]}>{greetingFor()}</AppText><AppText style={[styles.title, { color: theme.text }]}>Today's budget</AppText></View>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, dark: !current.dark }))}><MaterialIcons name={model.dark ? 'light-mode' : 'dark-mode'} size={20} color={theme.muted} /></TouchableOpacity>
        </View>
        <View style={styles.ringWrap}>
          <RingBudget pct={budget.ringPct} color={ringColor} bg={theme.ringTrack} />
          <View style={styles.ringCenter}>
            <AnimatedCue trigger={ringLabel} distance={3} scale={1} style={{ alignItems: 'center' }}>
              <AppText style={[styles.ringLabel, { color: budget.status === 'over' ? theme.red : budget.status === 'close' ? theme.amber : theme.muted }]}>{ringLabel}</AppText>
            </AnimatedCue>
            <AnimatedNumber
              numberOfLines={1}
              value={leftAmountValue}
              format={(value) => model.baseCur === 'KHR' ? khr(value) : formatMoney(money(Math.round(value * 100), 'USD'))}
              style={[styles.ringAmount, { color: budget.status === 'over' ? theme.red : theme.text, fontSize: leftFmt.length > 10 ? 26 : leftFmt.length > 8 ? 32 : leftFmt.length > 6 ? 40 : 50 }]}
            />
            <AppText style={[styles.ringKhr, { color: theme.muted }]}>{budget.status === 'over' ? 'Tomorrow adjusts for this overspend' : `≈ ${leftAlt}`}</AppText>
          </View>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show daily budget calculation" activeOpacity={0.8} onPress={() => setSheet('formula')}><Pill icon="bolt" text={`${formatMoney(budget.baseDailyUsd)} base + ${formatMoney(rolloverYesterday)} rolled over`} theme={theme} /></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show tomorrow budget calculation" activeOpacity={0.8} onPress={() => setSheet('formula')}><Pill icon="trending-up" text={`Tomorrow ≈ ${formatMoney(budget.tomorrowUsd)} at this pace`} theme={theme} /></TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => setSheet('month')}>
          <View style={[styles.row, { marginBottom: 16 }]}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>This month</AppText><View style={[styles.duePill, { backgroundColor: theme.surface2 }]}><AppText style={[styles.duePillText, { color: theme.muted }]}>{daysRemainingInMonth(today)} days left</AppText></View></View>
          <Progress label="Spent" value={formatMoney(budget.spentMonthUsd)} total={formatMoney0(budget.spendableMonthUsd)} pct={budget.monthPct} color={theme.primary} theme={theme} />
          <Progress label="Saved so far" value={formatMoney(savedSoFarUsd)} total={formatMoney0(budget.savingsTargetUsd)} pct={budget.savingsPct} color={theme.green} theme={theme} />
          {model.swept ? <AnimatedCue trigger="swept"><View style={[styles.sweep, { backgroundColor: `${theme.green}1f` }]}><MaterialIcons name="savings" size={18} color={theme.green} /><AppText style={[styles.chipText, { color: theme.green, fontFamily: FONT.bold }]}>Leftover protected in savings</AppText></View></AnimatedCue> : budget.leftTodayUsd.amountMinor > 0 ? <AnimatedPressable accessibilityRole="button" accessibilityLabel="Sweep leftover into savings" style={[styles.sweep, { backgroundColor: theme.primaryWash }]} contentStyle={styles.buttonContent} onPress={sweepLeftover}><MaterialIcons name="savings" size={18} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>Sweep {usd(budget.leftTodayUsd.amountMinor / 100)} leftover into savings</AppText></AnimatedPressable> : null}
        </TouchableOpacity>
        {topGoals.length > 0 ? <><SectionHeader title={topGoals.length > 1 ? 'Top goals' : 'Goal'} action="All goals" theme={theme} onAction={() => go('goals')} />{topGoals.map((goal) => <TouchableOpacity key={goal.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line, marginTop: 0, marginBottom: 10 }]} onPress={() => go('goals')}><View style={[styles.expenseRow, { borderBottomWidth: 0, paddingVertical: 0, marginBottom: 12 }]}><View style={[styles.bubble, { backgroundColor: `${theme.primary}1f` }]}><Glyph name={goal.icon} color={theme.primary} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text }]}>{goal.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{amountLabel(goal.perMonth, goal.cur)}/month</AppText>{monthsToGo(goal) ? <AppText style={[styles.itemSub, { color: theme.muted }]}>{monthsToGo(goal)}</AppText> : null}</View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(goal.saved, goal.cur)}</AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`, backgroundColor: theme.primary }]} /></View></TouchableOpacity>)}</> : null}
        {topGoals.length === 0 ? <><SectionHeader title="Goals" action="New goal" theme={theme} onAction={() => setSheet('goal')} /><EmptyState icon="flag" title="Start a savings goal" body="Add a trip, emergency fund, or anything you want future money to protect." theme={theme} /></> : null}
        <SectionHeader title="Coming up" action="+ Borrowed money" theme={theme} onAction={() => { setDrafts((current) => ({ ...current, iouPerson: '', iouAmount: '', iouDue: '', iouEditId: null })); setSheet('iou'); }} />
        {hasLoanPayment ? <Upcoming icon="savings" color="#7c5cff" title="Loan repayment" subtitle={dueText(model.loanDue)} amount={usd(model.loan)} theme={theme} onPress={() => setSheet('loan')} onDone={() => markBillPaid('loan', 'Loan repayment')} /> : null}
        {hasRentPayment ? <Upcoming icon="receipt-long" color="#d98a00" title="Rent & utilities" subtitle={dueText(model.rentDue)} amount={usd(model.rent + model.utilities)} theme={theme} onPress={() => setSheet('fixed')} onDone={() => markBillPaid('rent', 'Rent & utilities')} /> : null}
        {model.ious.map((iou) => <Upcoming key={iou.id} icon="account-balance-wallet" color="#3ba6d4" title={`Pay back ${iou.person}`} subtitle={`Borrowed · due ${iou.due}`} amount={amountLabel(iou.amount, iou.cur)} theme={theme} onPress={() => { setDrafts((current) => ({ ...current, iouPerson: iou.person, iouAmount: String(iou.amount), iouDue: iou.due, iouEditId: iou.id })); setSheet('iou'); }} onDone={() => settleIou(iou.id, iou.person)} />)}
        {!hasUpcoming ? <EmptyState icon="check-circle" title="Hooray, no payments coming up" body="Rent, loan, and borrowed-money reminders will appear here when they apply." theme={theme} /> : null}
        <SectionHeader title="Today" action="Summary" theme={theme} onAction={() => go('insights')} />
        {todayExpenses.map((expense) => {
          const cat = categoryFor(model.categories, expense.cat);
          const row = <TouchableOpacity style={[styles.expenseRow, { borderColor: theme.line }]} onPress={() => openEntrySheet(expense)}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Glyph name={cat.icon} color={cat.color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{expense.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{cat.label} · {expense.time}</AppText>{expense.note ? <AppText style={[styles.itemNote, { color: theme.faint }]}>{expense.note}</AppText> : null}</View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</AppText><TouchableOpacity onPress={() => deleteExpense(expense.id)} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="close" size={19} color={theme.faint} /></TouchableOpacity></TouchableOpacity>;
          return expense.id === recentExpenseId ? <AnimatedCue key={expense.id} trigger={expense.id}>{row}</AnimatedCue> : <View key={expense.id}>{row}</View>;
        })}
        {todayExpenses.length === 0 ? <EmptyState icon="edit-note" title="Start recording today" body="Tap + when you spend. Today's list stays quiet until there is something to track." theme={theme} /> : null}
      </ScrollView>
    );
  }

  function renderAdd() {
    const hasAmount = Boolean(parsedAmount);
    const hasValidDate = isIsoDay(drafts.expenseDate.trim());
    const canSave = hasAmount && hasValidDate;
    const parsedAmountValue = parsedAmount ? (parsedAmount.currency === 'KHR' ? parsedAmount.amountMinor : parsedAmount.amountMinor / 100) : 0;
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key="add" contentContainerStyle={[styles.scroll, { paddingBottom: 240 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}>
          {renderTopBar('Add expense', undefined, 'home')}
          <TextInput style={[styles.addInput, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} placeholder="Try: netflix, 10$  or  food, 1000 riels" placeholderTextColor={theme.faint} value={drafts.addText} onChangeText={(value) => { const next = parseExpenseText(value); setDrafts((current) => ({ ...current, addText: value, selectedCat: next.categoryKey })); }} />
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.aiHeader}><MaterialIcons name="auto-awesome" size={17} color={theme.primary} /><AppText style={[styles.aiHeaderText, { color: theme.primary }]}>Understood</AppText></View>
            <View style={[styles.headerRow, { alignItems: 'flex-end', marginTop: 6 }]}>
              <View style={{ flex: 1 }}>
                {parsedAmount ? <AnimatedNumber value={parsedAmountValue} format={(value) => parsedAmount.currency === 'KHR' ? formatMoney(money(Math.round(value), 'KHR')) : formatMoney(money(Math.round(value * 100), 'USD'))} style={[styles.parsedAmount, { color: theme.text }]} /> : <AppText style={[styles.parsedAmount, { color: theme.text }]}>—</AppText>}
                <AnimatedCue trigger={hasAmount ? `${parsedAmount?.currency}-${parsedAmount?.amountMinor}` : 'empty'} distance={4} scale={1}>
                  <AppText style={[styles.itemSub, { color: theme.muted }]}>{parsedAmount ? parsedAmount.currency === 'KHR' ? `≈ ${usd((parsedAmount.amountMinor / model.rate))}` : `≈ ${khr((parsedAmount.amountMinor / 100) * model.rate)}` : 'Start typing above'}</AppText>
                </AnimatedCue>
              </View>
              <AnimatedCue trigger={parsedCat.key} distance={4}>
                <View style={[styles.bubbleLarge, { backgroundColor: `${parsedCat.color}22` }]}><Glyph name={parsedCat.icon} size={27} color={parsedCat.color} /></View>
              </AnimatedCue>
            </View>
            <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 16 }]}>Category — tap to change</AppText>
          </View>
          <View style={styles.chipRow}>{model.categories.map((cat) => { const on = drafts.selectedCat === cat.key; return <SelectableChip key={cat.key} icon={cat.icon} label={cat.label} selected={on} selectedColor={cat.color} textColor="#fff" mutedColor={theme.muted} borderColor={theme.line} surfaceColor={theme.surface} onPress={() => setDrafts((current) => ({ ...current, selectedCat: cat.key }))} />; })}</View>
          {model.categories.length === 0 ? <EmptyState icon="category" title="No categories yet" body="You can still save this as Uncategorized, or add custom categories from Categories." theme={theme} /> : null}
          <AppText style={[styles.label, { color: theme.muted }]}>Transaction date</AppText>
          <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: hasValidDate ? theme.line : theme.red, color: theme.text, fontFamily: FONT.semibold, fontSize: 16 }]} placeholder="YYYY-MM-DD" placeholderTextColor={theme.faint} value={drafts.expenseDate} onChangeText={(value) => setDrafts((current) => ({ ...current, expenseDate: value }))} autoCapitalize="none" autoCorrect={false} />
          {!hasValidDate ? <AppText style={[styles.itemSub, { color: theme.red, marginTop: 7 }]}>Use YYYY-MM-DD, for example {today}.</AppText> : null}
          <AppText style={[styles.label, { color: theme.muted }]}>Note (optional)</AppText>
          <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.line, color: theme.text, fontFamily: FONT.semibold, fontSize: 16 }]} placeholder="e.g. team lunch" placeholderTextColor={theme.faint} value={drafts.addNote} onChangeText={(value) => setDrafts((current) => ({ ...current, addNote: value }))} />
          <AnimatedPressable disabled={!canSave} accessibilityRole="button" accessibilityLabel={parsedAmount ? `Add ${formatMoney(parsedAmount)}` : 'Add expense'} style={[styles.button, { backgroundColor: theme.primary, opacity: canSave ? 1 : 0.35, marginTop: 24 }]} contentStyle={styles.buttonContent} onPress={addExpense}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText numberOfLines={1} style={styles.buttonText}>Add {parsedAmount ? formatMoney(parsedAmount) : ''}</AppText></AnimatedPressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  function renderCategories() {
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar('Categories', 'Where your Wants budget is going this month.')}
        <View style={styles.grid}>{model.categories.filter((cat) => cat.budgetUsd > 0).map((cat) => { const spentUsd = categoryMonthSpentUsd(cat.key); const pct = Math.round((spentUsd / cat.budgetUsd) * 100); const over = spentUsd > cat.budgetUsd; return <TouchableOpacity key={cat.key} style={[styles.catCard, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => { setDrafts((current) => ({ ...current, selectedCat: cat.key })); go('detail'); }}><View style={styles.row}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Glyph name={cat.icon} color={cat.color} /></View><MaterialIcons name="chevron-right" size={20} color={theme.faint} /></View><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14, marginTop: 10 }]}>{cat.label}</AppText><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 2 }]}>{usd(spentUsd)} of {usd0(cat.budgetUsd)}</AppText><View style={[styles.track, { backgroundColor: theme.surface2, height: 7, marginTop: 11 }]}><View style={[styles.fill, { backgroundColor: over ? theme.red : cat.color, width: `${Math.min(100, pct)}%` }]} /></View><AppText style={[styles.itemSub, { color: over ? theme.red : theme.muted, fontFamily: FONT.bold, marginTop: 8 }]}>{pct}% used</AppText></TouchableOpacity>; })}</View>
        {model.categories.filter((cat) => cat.budgetUsd > 0).length === 0 ? <EmptyState icon="category" title="Start with a category" body="Add a spending bucket before recording expenses." theme={theme} /> : null}
        <TouchableOpacity style={[styles.dashed, { borderColor: theme.faint }]} onPress={() => openCatSheet(null)}><MaterialIcons name="add" size={20} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>Add category</AppText></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDetail() {
    const txns = monthExpenses.filter((expense) => expense.cat === selectedCategory.key);
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar(selectedCategory.label, undefined, 'categories', <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => openCatSheet(selectedCategory.key)}><MaterialIcons name="edit" size={19} color={theme.muted} /></TouchableOpacity>)}
        <View style={[styles.card, styles.row, { backgroundColor: theme.surface, borderColor: theme.line, marginBottom: 0 }]}><View style={{ flex: 1 }}><AppText style={[styles.label, { color: theme.muted, marginTop: 0, marginBottom: 6 }]}>Spent this month</AppText><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 32, marginTop: 0 }]}>{usd(categoryMonthSpentUsd(selectedCategory.key))}</AppText><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 2 }]}>of {usd0(selectedCategory.budgetUsd)} budget</AppText></View><View style={[styles.bubbleLarge, { backgroundColor: `${selectedCategory.color}22`, width: 56, height: 56, borderRadius: 18 }]}><Glyph name={selectedCategory.icon} size={30} color={selectedCategory.color} /></View></View>
        <SectionHeader title="Transactions" theme={theme} />
        {txns.map((expense) => <TouchableOpacity key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]} onPress={() => openEntrySheet(expense)}><View style={[styles.bubble, { backgroundColor: `${selectedCategory.color}22` }]}><Glyph name={selectedCategory.icon} color={selectedCategory.color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{expense.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{expense.date} · {expense.time}</AppText>{expense.note ? <AppText style={[styles.itemNote, { color: theme.faint }]}>{expense.note}</AppText> : null}</View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</AppText></TouchableOpacity>)}
        {txns.length === 0 ? <EmptyState icon="receipt-long" title="No transactions yet" body="Expenses in this category will show up here after you record them." theme={theme} /> : null}
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
          return <Animated.View key={goal.id} onLayout={(event) => { goalHeights[goal.id] = event.nativeEvent.layout.height; }} style={[styles.card, { backgroundColor: theme.surface, borderColor: isDragging ? theme.primary : theme.line }, isDragging && { transform: [{ translateY: dragY }], zIndex: 20, elevation: 10, shadowColor: '#191c3a', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } }]}><View style={[styles.expenseRow, { borderBottomWidth: 0, paddingVertical: 0 }]}>{model.goals.length > 1 ? <View {...pan.panHandlers} style={{ paddingVertical: 8, paddingRight: 6, marginLeft: -4 }}><MaterialIcons name="drag-indicator" size={22} color={theme.faint} /></View> : null}<View style={[styles.bubble, { backgroundColor: `${theme.primary}1f` }]}><Glyph name={goal.icon} color={theme.primary} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text }]}>{goal.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{amountLabel(goal.perMonth, goal.cur)}/month</AppText>{monthsToGo(goal) ? <AppText style={[styles.itemSub, { color: theme.muted }]}>{monthsToGo(goal)}</AppText> : null}</View><TouchableOpacity onPress={() => updateModel((current) => ({ ...current, goals: current.goals.filter((item) => item.id !== goal.id) }))} style={{ padding: 5, marginLeft: 4 }}><MaterialIcons name="delete" size={20} color={theme.faint} /></TouchableOpacity></View><View style={[styles.row, { marginTop: 14, marginBottom: 7 }]}><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 18, marginTop: 0 }]}>{amountLabel(goal.saved, goal.cur)}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>of {amountLabel(goal.target, goal.cur)} · {Math.round((goal.saved / goal.target) * 100)}%</AppText></View><View style={[styles.track, { backgroundColor: theme.surface2 }]}><View style={[styles.fill, { width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`, backgroundColor: theme.primary }]} /></View>{goal.saved < goal.target && goal.perMonth > 0 ? <TouchableOpacity style={[styles.sweep, { backgroundColor: theme.primaryWash }]} onPress={() => addGoalContribution(goal.id)}><MaterialIcons name="savings" size={18} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>Add {amountLabel(goal.perMonth, goal.cur)} this month</AppText></TouchableOpacity> : <View style={[styles.goalBadge, { backgroundColor: `${theme.green}1f` }]}><MaterialIcons name="celebration" size={18} color={theme.green} /><AppText style={[styles.chipText, { color: theme.green, fontFamily: FONT.bold }]}>Goal reached</AppText></View>}</Animated.View>;
        })}
        {model.goals.length === 0 ? <EmptyState icon="flag" title="Start a savings goal" body="Create the first thing you want your money to move toward." theme={theme} /> : null}
        <TouchableOpacity style={[styles.dashed, { borderColor: theme.faint }]} onPress={() => setSheet('goal')}><MaterialIcons name="add" size={20} color={theme.primary} /><AppText style={[styles.chipText, { color: theme.primary, fontFamily: FONT.bold }]}>New goal</AppText></TouchableOpacity>
      </ScrollView>
    );
  }

  function renderInsights() {
    const dailyBudget = budget.dailyBudgetUsd.amountMinor / 100;
    const week = chartHistory.slice(-7);
    const weekLabels = week.map((_value, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (week.length - 1 - index));
      return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1);
    });
    const chartH = 120;
    const labelOffset = 20;
    const maxVal = Math.max(dailyBudget, ...week, 1) * 1.15;
    const budgetBottom = labelOffset + (dailyBudget / maxVal) * chartH;
    const heatGap = 5;
    // Floor so 7 cells + 6 gaps never exceed the measured row width (subpixel
    // overflow made the grid wrap at 6 columns); space-between absorbs the slack.
    const heatSize = heatWidth > 0 ? Math.floor((heatWidth - heatGap * 6) / 7) : 0;
    const heatRows = Array.from({ length: Math.ceil(heatmap.length / 7) }, (_item, row) => heatmap.slice(row * 7, row * 7 + 7));
    const { spentMost, savedMost } = bestAndWorst(chartHistory, dailyBudget);
    const dayLabel = (index: number) => {
      const date = new Date();
      date.setDate(date.getDate() - (chartHistory.length - 1 - index));
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    };
    const topCategory = model.categories.map((category) => ({ category, spentUsd: categoryMonthSpentUsd(category.key) })).sort((a, b) => b.spentUsd - a.spentUsd)[0];
    const insightTip = topCategory && topCategory.spentUsd > 0 ? `${topCategory.category.label} is your top spend this month. Small cuts there will move your savings fastest.` : 'Add expenses today to see category-specific savings tips.';
    const exportMonths = [0, -1, -2].map((delta) => shiftIsoMonth(thisMonth, delta));
    const insightDays = new Set(model.expenses.map((expense) => expense.date)).size;
    const hasInsightData = insightDays > 0;
    const hasEnoughInsightData = insightDays >= 3;
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar('Insights', 'Your end-of-day summary, all in one place.')}
        {!hasInsightData ? <AnimatedCue trigger="insights-empty"><EmptyState icon="receipt-long" title="No spending recorded yet" body="Record your first expense to see daily budget and savings insights." theme={theme} /></AnimatedCue> : null}
        {hasInsightData ? <View style={[styles.statusCard, { backgroundColor: budget.status === 'over' ? theme.red : theme.green }]}><View style={styles.statusPill}><MaterialIcons name="schedule" size={15} color="#fff" /><AppText style={styles.statusPillText}>End of day · today</AppText></View><AppText style={styles.statusHeadline}>{budget.status === 'over' ? 'A little over today — tomorrow adjusts for you.' : "You're under budget today — nice work."}</AppText><View style={styles.statRow}><Stat label="Spent today" value={formatMoney(budget.spentTodayUsd)} /><Stat label="Saved today" value={formatMoney(money(Math.max(budget.leftTodayUsd.amountMinor, 0), 'USD'))} /></View><View style={styles.tip}><MaterialIcons name="lightbulb" size={20} color="#fff" /><AppText style={styles.tipText}>{insightTip}</AppText></View></View> : null}
        {hasInsightData ? <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={[styles.row, { marginBottom: 14 }]}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>This week</AppText><View style={[styles.duePill, { backgroundColor: theme.surface2 }]}><AppText style={[styles.duePillText, { color: theme.muted }]}>Daily budget {formatMoney(budget.dailyBudgetUsd)}</AppText></View></View>
          <View style={{ position: 'relative' }}>
            <View style={[styles.chart, { height: chartH + labelOffset }]}>{week.map((value, index) => <TouchableOpacity key={index} activeOpacity={0.7} style={styles.barCol} onPress={() => showToast(`${weekLabels[index]} · ${usd(value)}`)}><View style={[styles.bar, { height: Math.max(6, (value / maxVal) * chartH), backgroundColor: value > dailyBudget ? theme.amber : theme.primary }]} /><AppText style={[styles.barDay, { color: theme.muted }]}>{weekLabels[index]}</AppText></TouchableOpacity>)}</View>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: budgetBottom, borderTopWidth: 2, borderStyle: 'dashed', borderColor: theme.faint }} />
            <View pointerEvents="none" style={{ position: 'absolute', right: 0, bottom: budgetBottom - 8 }}><AppText style={{ fontFamily: FONT.bold, fontSize: 10, color: theme.faint, backgroundColor: theme.surface, paddingHorizontal: 4 }}>budget</AppText></View>
          </View>
        </View> : null}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><View style={[styles.row, { marginBottom: 12 }]}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Spending activity</AppText><View style={[styles.duePill, { backgroundColor: theme.surface2 }]}><AppText style={[styles.duePillText, { color: theme.muted }]}>{hasEnoughInsightData ? 'last 5 weeks' : `${insightDays} of 3 days`}</AppText></View></View>
          {!hasInsightData ? <EmptyState icon="edit-note" title="Start recording" body="No heatmap yet. Your real spending days will appear here." theme={theme} /> : !hasEnoughInsightData ? <AnimatedCue trigger={`low-${insightDays}`}><EmptyState icon="insights" title="Keep tracking" body={`${insightDays} of 3 days recorded. A few more days makes these patterns useful.`} theme={theme} /></AnimatedCue> : <><View onLayout={(event) => setHeatWidth(event.nativeEvent.layout.width)}>{heatSize > 0 ? heatRows.map((row, rowIndex) => <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: row.length === 7 ? 'space-between' : 'flex-start', gap: row.length === 7 ? 0 : heatGap, marginTop: rowIndex === 0 ? 0 : heatGap }}>{row.map((cell) => <TouchableOpacity key={cell.index} style={{ width: heatSize, height: heatSize, borderRadius: 5, backgroundColor: heatColor(cell.status, theme) }} onPress={() => { setDrafts((current) => ({ ...current, selectedDay: cell.index })); setSheet('day'); }} />)}</View>) : null}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}><AppText style={[styles.itemSub, { color: theme.muted }]}>saved</AppText>{[theme.heat.savedHigh, theme.heat.near, theme.heat.over, theme.heat.overHigh].map((c) => <View key={c} style={{ width: 13, height: 13, borderRadius: 4, backgroundColor: c }} />)}<AppText style={[styles.itemSub, { color: theme.muted }]}>over</AppText></View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
            <View style={[styles.statMini, { backgroundColor: theme.surface2 }]}><AppText style={[styles.label, { color: theme.muted, marginTop: 0, marginBottom: 4, fontSize: 11 }]}>Spent most</AppText><AppText style={[styles.amount, { color: theme.text, textAlign: 'left' }]}>{spentMost >= 0 ? `${dayLabel(spentMost)} · ${usd(chartHistory[spentMost])}` : '—'}</AppText></View>
            <View style={[styles.statMini, { backgroundColor: theme.surface2 }]}><AppText style={[styles.label, { color: theme.muted, marginTop: 0, marginBottom: 4, fontSize: 11 }]}>Best saving day</AppText><AppText style={[styles.amount, { color: theme.text, textAlign: 'left' }]}>{savedMost >= 0 ? `${dayLabel(savedMost)} · ${usd(chartHistory[savedMost])}` : '—'}</AppText></View>
          </View></>}
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14, marginBottom: 12 }]}>Export data</AppText>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TouchableOpacity style={[styles.input, { flex: 1, paddingVertical: 13, backgroundColor: theme.surface, borderColor: theme.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setExportOpen((open) => !open)}><AppText style={{ fontFamily: FONT.semibold, fontSize: 14, color: theme.text }}>{monthLabel(exportMonth)}</AppText><MaterialIcons name="expand-more" size={20} color={theme.muted} /></TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, minHeight: 48, paddingHorizontal: 20 }]} onPress={exportCsv}><MaterialIcons name="download" size={18} color="#fff" /><AppText style={styles.buttonText}>CSV</AppText></TouchableOpacity>
          </View>
          {exportOpen ? <View style={{ marginTop: 8, borderWidth: 1, borderColor: theme.line, borderRadius: 14, overflow: 'hidden' }}>{exportMonths.map((month) => <TouchableOpacity key={month} style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: month === exportMonth ? theme.primaryWash : theme.surface }} onPress={() => { setExportMonth(month); setExportOpen(false); }}><AppText style={{ fontFamily: FONT.semibold, fontSize: 14, color: month === exportMonth ? theme.primary : theme.text }}>{monthLabel(month)}</AppText></TouchableOpacity>)}</View> : null}
        </View>
      </ScrollView>
    );
  }

  function renderSettings() {
    const rateCheckLabel = model.exchangeRateLastFetchedDay
      ? `Last checked ${model.exchangeRateLastFetchedDay}`
      : 'Checks when the app opens';
    const rows: readonly [string, string, Sheet | 'categories', IconName][] = [
      ['Monthly income', `${amountLabel(model.salary, model.salaryCur)} / month`, 'income', 'account-balance-wallet'],
      ['Rent & utilities', model.rent + model.utilities > 0 ? `${usd(model.rent + model.utilities)} · due ${ordinal(model.rentDue)}` : 'Not set', 'fixed', 'receipt-long'],
      ['Loan repayment', model.loan > 0 ? `${usd(model.loan)} · due ${ordinal(model.loanDue)}` : 'No loan', 'loan', 'savings'],
      ['Budgeting method', model.method === 'balanced' ? 'Balanced (50/30/20)' : model.method === 'saver' ? 'Saver (40/30/30)' : `Custom (${model.custom.needs}/${model.custom.wants}/${model.custom.save})`, 'method', 'pie-chart'],
      ['Currencies', `Auto daily USD/KHR · $1 = ${khr(model.rate)} · ${rateCheckLabel}`, 'currency', 'currency-exchange'],
      ['Categories', `${model.categories.length} categories`, 'categories', 'grid-view'],
      ['Daily reminder', formatClock(model.notify), 'reminder', 'schedule'],
    ];
    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderTopBar('Settings', 'Adjust anything — your budget recalculates instantly.')}
        {rows.map((row) => <TouchableOpacity key={row[0]} style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => (row[2] === 'categories' ? go('categories') : setSheet(row[2]))}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name={row[3]} size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>{row[0]}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{row[1]}</AppText></View><MaterialIcons name="chevron-right" size={22} color={theme.faint} /></TouchableOpacity>)}
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, billReminders: !current.billReminders }))}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name="notifications" size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Bill reminders</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{model.billReminders ? 'On' : 'Off'}</AppText></View><MaterialIcons name={model.billReminders ? 'toggle-on' : 'toggle-off'} size={30} color={model.billReminders ? theme.primary : theme.faint} /></TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={() => updateModel((current) => ({ ...current, dark: !current.dark }))}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name={model.dark ? 'dark-mode' : 'light-mode'} size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Appearance</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{model.dark ? 'Dark mode' : 'Light mode'}</AppText></View><MaterialIcons name={model.dark ? 'toggle-on' : 'toggle-off'} size={30} color={model.dark ? theme.primary : theme.faint} /></TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={exportJsonBackup}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name="file-download" size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Export JSON backup</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>Save a full restorable copy of this device</AppText></View><MaterialIcons name="ios-share" size={22} color={theme.faint} /></TouchableOpacity>
        <TouchableOpacity style={[styles.settingsRow, { borderColor: theme.line }]} onPress={importJsonBackup}><View style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}><MaterialIcons name="file-upload" size={21} color={theme.muted} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}>Import JSON backup</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>Restore from a Luy Khnom backup file</AppText></View><MaterialIcons name="chevron-right" size={22} color={theme.faint} /></TouchableOpacity>
        <View style={{ alignItems: 'center', marginTop: 32, gap: 6, opacity: 0.7 }}><View style={styles.brandRow}><Image source={require('./assets/luy-khnom-favicon-flat.png')} style={styles.footerLogoImage} resizeMode="contain" /><AppText style={[styles.brandName, { color: theme.text, fontSize: 14 }]}>Luy Khnom</AppText></View><AppText style={[styles.itemSub, { color: theme.muted }]}>Spend calm · v1.0</AppText></View>
      </ScrollView>
    );
  }

  function renderSheet() {
    return (
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.scrim} onPress={() => setSheet(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.page }]}>
            <View style={[styles.grab, { backgroundColor: theme.faint }]} />
            <View style={[styles.headerRow, { marginBottom: 4 }]}><AppText style={[styles.sheetTitle, { color: theme.text }]}>{sheet === 'category' && drafts.categoryEditKey ? 'Edit category' : sheetTitle(sheet)}</AppText><TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.surface, borderColor: theme.line }]} onPress={() => setSheet(null)}><MaterialIcons name="close" size={20} color={theme.muted} /></TouchableOpacity></View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'} contentContainerStyle={{ paddingBottom: 120 }}>
            {sheet === 'income' ? <View><SheetInput label="Monthly salary" value={String(model.salary)} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, salary: Number(value) || 0 }))} /><AppText style={[styles.itemSub, { color: theme.muted, marginTop: 7 }]}>{model.salaryCur === 'KHR' ? `≈ ${usd(model.salary / model.rate)}` : `≈ ${khr(model.salary * model.rate)}`}</AppText><AppText style={[styles.label, { color: theme.muted }]}>Currency</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{(['USD', 'KHR'] as Currency[]).map((cur) => <TouchableOpacity key={cur} style={[styles.segmentButton, model.salaryCur === cur && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, salaryCur: cur }))}><AppText style={[styles.segmentText, { color: model.salaryCur === cur ? theme.text : theme.muted }]}>{cur === 'USD' ? 'USD ($)' : 'KHR (៛)'}</AppText></TouchableOpacity>)}</View></View> : null}
            {sheet === 'fixed' ? <View><MoneyField label="Rent" initialAmount={model.rent} rate={model.rate} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, rent: value }))} /><MoneyField label="Utilities (monthly avg)" initialAmount={model.utilities} rate={model.rate} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, utilities: value }))} /><DueDayPicker label="Both due each month" value={model.rentDue} theme={theme} onChange={(day) => updateModel((current) => ({ ...current, rentDue: day }))} /></View> : null}
            {sheet === 'loan' ? <View><AppText style={[styles.label, { color: theme.muted }]}>Loan</AppText><View style={[styles.segment, { backgroundColor: theme.surface2 }]}><TouchableOpacity style={[styles.segmentButton, model.loan <= 0 && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, loan: 0, paidBills: { ...current.paidBills, loan: true } }))}><AppText style={[styles.segmentText, { color: model.loan <= 0 ? theme.text : theme.muted }]}>No loan</AppText></TouchableOpacity><TouchableOpacity style={[styles.segmentButton, model.loan > 0 && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, loan: current.loan > 0 ? current.loan : 50, paidBills: { ...current.paidBills, loan: false } }))}><AppText style={[styles.segmentText, { color: model.loan > 0 ? theme.text : theme.muted }]}>I have a loan</AppText></TouchableOpacity></View>{model.loan > 0 ? <><MoneyField label="Monthly repayment" initialAmount={model.loan} rate={model.rate} theme={theme} onChange={(value) => updateModel((current) => ({ ...current, loan: value }))} /><DueDayPicker label="Due each month" value={model.loanDue} theme={theme} onChange={(day) => updateModel((current) => ({ ...current, loanDue: day }))} /></> : <AppText style={[styles.help, { color: theme.muted }]}>No loan payment will show in Coming up.</AppText>}</View> : null}
            {sheet === 'method' ? <BudgetMethodPicker method={model.method} custom={model.custom} theme={theme} onSelect={(mode) => updateModel((current) => ({ ...current, method: mode }))} onCustomChange={(part, value) => updateModel((current) => ({ ...current, custom: { ...current.custom, [part]: value } }))} /> : null}
            {sheet === 'currency' ? <View>
              <AppText style={[styles.label, { color: theme.muted }]}>Base currency — used for the home budget display</AppText>
              <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>{(['USD', 'KHR'] as Currency[]).map((cur) => <TouchableOpacity key={cur} style={[styles.segmentButton, model.baseCur === cur && { backgroundColor: theme.surface, ...CARD_SHADOW }]} onPress={() => updateModel((current) => ({ ...current, baseCur: cur }))}><AppText style={[styles.segmentText, { color: model.baseCur === cur ? theme.text : theme.muted }]}>{cur === 'USD' ? 'USD ($)' : 'KHR (៛)'}</AppText></TouchableOpacity>)}</View>
              <SheetInput label="Conversion rate — KHR per $1" value={String(model.rate)} theme={theme} onChange={(value) => updateModel((current) => { const nextRate = Number(value); return { ...current, rate: Number.isFinite(nextRate) && nextRate > 0 ? nextRate : RATE, exchangeRateSource: 'Manual override' }; })} />
              <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 8 }]}>Auto-checks once per day from {USD_TO_KHR_RATE_SOURCE.name}. If you’re offline or the data is missing, Luy Khnom keeps this value.</AppText>
              <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 4 }]}>{model.exchangeRateLastFetchedDay ? `Last checked ${model.exchangeRateLastFetchedDay}` : 'Not checked yet'} · Current source: {model.exchangeRateSource}</AppText>
            </View> : null}
            {sheet === 'reminder' ? <ReminderTimePicker value={model.notify} theme={theme} open={timePickerOpen} onOpenChange={setTimePickerOpen} onChange={(value) => updateModel((current) => ({ ...current, notify: value }))} onPreview={previewNotification} /> : null}
            {sheet === 'category' ? <View>
              <View style={[styles.headerRow, { marginTop: 14, gap: 12 }]}><View style={[styles.bubbleLarge, { backgroundColor: `${drafts.categoryColor}22` }]}><Glyph name={drafts.categoryIcon} size={27} color={drafts.categoryColor} /></View><TextInput style={[styles.input, { flex: 1, fontSize: 18, backgroundColor: theme.surface, borderColor: theme.line, color: theme.text }]} placeholder="Category name" placeholderTextColor={theme.faint} value={drafts.categoryName} onChangeText={(value) => setDrafts((current) => ({ ...current, categoryName: value }))} /></View>
              <MoneyField label="Monthly budget" initialAmount={Number(drafts.categoryBudget) || 0} rate={model.rate} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, categoryBudget: value ? String(value) : '' }))} />
              <AppText style={[styles.label, { color: theme.muted }]}>Icon</AppText>
              <View style={styles.pickWrap}>{ICON_SET.map((ic) => { const on = drafts.categoryIcon === ic; return <TouchableOpacity key={ic} style={[styles.iconPick, { borderColor: on ? drafts.categoryColor : theme.line, backgroundColor: on ? `${drafts.categoryColor}22` : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, categoryIcon: ic }))}><Glyph name={ic} size={22} color={on ? drafts.categoryColor : theme.muted} /></TouchableOpacity>; })}</View>
              <AppText style={[styles.label, { color: theme.muted }]}>Color</AppText>
              <View style={styles.pickWrap}>{PALETTE.map((color) => <TouchableOpacity key={color} style={[styles.swatch, { backgroundColor: color, borderColor: drafts.categoryColor === color ? theme.text : 'transparent' }]} onPress={() => setDrafts((current) => ({ ...current, categoryColor: color }))} />)}</View>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveCategory}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>{drafts.categoryEditKey ? 'Save changes' : 'Add category'}</AppText></TouchableOpacity>
            </View> : null}
            {sheet === 'entry' && selectedExpense ? <View><MoneyField label="Amount" initialAmount={Number(drafts.iouAmount) || 0} initialCur={drafts.entryCur} rate={model.rate} theme={theme} onChange={(_usd, amount, cur) => setDrafts((current) => ({ ...current, iouAmount: amount ? String(amount) : '', entryCur: cur }))} /><SheetInput label="Transaction date (YYYY-MM-DD)" value={drafts.expenseDate} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, expenseDate: value }))} />{!isIsoDay(drafts.expenseDate.trim()) ? <AppText style={[styles.itemSub, { color: theme.red, marginTop: 7 }]}>Use YYYY-MM-DD, for example {today}.</AppText> : null}<SheetInput label="Remark (optional)" value={drafts.addNote} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, addNote: value }))} /><AppText style={[styles.label, { color: theme.muted }]}>Category</AppText><View style={styles.chipRow}>{model.categories.map((cat) => { const on = drafts.selectedCat === cat.key; return <TouchableOpacity key={cat.key} style={[styles.chip, { borderColor: on ? cat.color : theme.line, backgroundColor: on ? cat.color : theme.surface }]} onPress={() => setDrafts((current) => ({ ...current, selectedCat: cat.key }))}><Glyph name={cat.icon} size={18} color={on ? '#fff' : cat.color} /><AppText style={[styles.chipText, { color: on ? '#fff' : theme.muted }]}>{cat.label}</AppText></TouchableOpacity>; })}</View><TouchableOpacity disabled={!isIsoDay(drafts.expenseDate.trim())} style={[styles.button, { backgroundColor: theme.primary, opacity: isIsoDay(drafts.expenseDate.trim()) ? 1 : 0.35, marginTop: 22 }]} onPress={saveEntry}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Save entry</AppText></TouchableOpacity></View> : null}
            {sheet === 'iou' ? <View><SheetInput label="Who did you borrow from?" value={drafts.iouPerson} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouPerson: value }))} /><MoneyField label="Amount" initialAmount={Number(drafts.iouAmount) || 0} rate={model.rate} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouAmount: value ? String(value) : '' }))} /><SheetInput label="Pay back by" value={drafts.iouDue} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, iouDue: value }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveIou}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Save</AppText></TouchableOpacity></View> : null}
            {sheet === 'goal' ? <View><SheetInput label="What are you saving for?" value={drafts.goalName} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalName: value }))} /><MoneyField label="Target amount" initialAmount={Number(drafts.goalTarget) || 0} rate={model.rate} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalTarget: value ? String(value) : '' }))} /><MoneyField label="Save per month" initialAmount={Number(drafts.goalPer) || 0} rate={model.rate} theme={theme} onChange={(value) => setDrafts((current) => ({ ...current, goalPer: value ? String(value) : '' }))} /><TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={saveGoal}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Create goal</AppText></TouchableOpacity></View> : null}
            {sheet === 'month' ? <View>
              <View style={[styles.row, { marginTop: 10 }]}><AppText style={[styles.itemSub, { color: theme.muted }]}>Spent {formatMoney(budget.spentMonthUsd)} of {formatMoney0(budget.spendableMonthUsd)}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{monthExpenses.length} transaction{monthExpenses.length === 1 ? '' : 's'}</AppText></View>
              {monthExpenses.map((expense) => { const cat = categoryFor(model.categories, expense.cat); return <TouchableOpacity key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]} onPress={() => openEntrySheet(expense)}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Glyph name={cat.icon} color={cat.color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{expense.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{expense.date} · {cat.label} · {expense.time}</AppText>{expense.note ? <AppText style={[styles.itemNote, { color: theme.faint }]}>{expense.note}</AppText> : null}</View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</AppText></TouchableOpacity>; })}
              {monthExpenses.length === 0 ? <EmptyState icon="calendar-month" title="No transactions this month" body="Start recording expenses and this month will fill itself in." theme={theme} /> : null}
            </View> : null}
            {sheet === 'day' ? <View><View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}><AppText style={[styles.label, { color: theme.muted, marginTop: 0 }]}>Spent on {selectedDayDate}</AppText><AppText style={[styles.parsedAmount, { color: theme.text, fontSize: 26 }]}>{usd(chartHistory[selectedDayIndex] ?? 0)}</AppText></View>{selectedDayExpenses.map((expense) => { const cat = categoryFor(model.categories, expense.cat); return <TouchableOpacity key={expense.id} style={[styles.expenseRow, { borderColor: theme.line }]} onPress={() => openEntrySheet(expense)}><View style={[styles.bubble, { backgroundColor: `${cat.color}22` }]}><Glyph name={cat.icon} color={cat.color} /></View><View style={{ flex: 1 }}><AppText style={[styles.itemName, { color: theme.text }]}>{expense.name}</AppText><AppText style={[styles.itemSub, { color: theme.muted }]}>{cat.label} · {expense.time}</AppText>{expense.note ? <AppText style={[styles.itemNote, { color: theme.faint }]}>{expense.note}</AppText> : null}</View><AppText style={[styles.amount, { color: theme.text }]}>{amountLabel(expense.amount, expense.cur)}</AppText></TouchableOpacity>; })}{selectedDayExpenses.length === 0 ? <EmptyState icon="receipt-long" title="No transactions this day" body="Expenses saved for this date will show up here." theme={theme} /> : null}</View> : null}
            {sheet === 'formula' ? <View>
              <AppText style={[styles.itemSub, { color: theme.muted }]}>How today’s safe-to-spend amount is calculated.</AppText>
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line, marginTop: 14 }]}>
                <Row label="Monthly income" value={formatMoney0(budget.salaryUsd)} theme={theme} />
                <Row label="Needs split" value={`${method.needsPct}%`} theme={theme} />
                <Row label="Wants split" value={`${method.wantsPct}%`} theme={theme} />
                <Row label="Savings first" value={`−${formatMoney0(budget.savingsTargetUsd)}`} theme={theme} />
                <Row label="Fixed costs" value={`−${formatMoney0(budget.fixedUsd)}`} theme={theme} />
                <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 10 }} />
                <Row label="Free this month" value={formatMoney0(budget.spendableMonthUsd)} theme={theme} strong />
                <Row label="Base per day" value={formatMoney(budget.baseDailyUsd)} theme={theme} />
                <Row label="Rolled from yesterday" value={formatMoney(rolloverYesterday)} theme={theme} />
                <Row label="Spent today" value={`−${formatMoney(budget.spentTodayUsd)}`} theme={theme} />
                <View style={{ height: 1, backgroundColor: theme.line, marginVertical: 10 }} />
                <Row label={budget.leftTodayUsd.amountMinor < 0 ? 'Over today' : 'Left today'} value={formatMoney(budget.leftTodayUsd)} theme={theme} strong />
                <Row label="Tomorrow at this pace" value={formatMoney(budget.tomorrowUsd)} theme={theme} />
              </View>
              <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 10 }]}>Rollover uses unused safe-to-spend from yesterday. Overspending reduces tomorrow instead of hiding the debt.</AppText>
            </View> : null}
            {sheet && ['income', 'fixed', 'loan', 'method', 'currency', 'reminder', 'formula'].includes(sheet) ? <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 22 }]} onPress={() => setSheet(null)}><MaterialIcons name="check-circle" size={20} color="#fff" /><AppText style={styles.buttonText}>Done</AppText></TouchableOpacity> : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
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
    const screenKey = model.screen === 'detail' ? `${model.screen}:${selectedCategory.key}` : model.screen;
    screen = (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <StatusBar style={model.dark ? 'light' : 'dark'} />
        <View key={screenKey} style={{ flex: 1 }}>{content}</View>
        {['home', 'categories', 'insights', 'settings'].includes(model.screen) ? <BottomNav screen={model.screen} theme={theme} onGo={go} /> : null}
        {toast ? <View style={[styles.toast, { backgroundColor: theme.text }]}><MaterialIcons name="check-circle" size={18} color={theme.green} /><AppText style={[styles.toastText, { color: theme.page }]}>{toast.message}</AppText>{toast.action ? <TouchableOpacity accessibilityRole="button" accessibilityLabel={toast.actionLabel ?? 'Undo'} onPress={() => { const action = toast.action; setToast(null); action?.(); }} style={{ paddingVertical: 2, paddingLeft: 6 }}><AppText style={[styles.toastText, { color: theme.green }]}>{toast.actionLabel ?? 'Undo'}</AppText></TouchableOpacity> : null}</View> : null}
        <Modal visible={pendingRestore !== null} transparent animationType="fade" onRequestClose={() => setPendingRestore(null)}>
          <View style={styles.celebrateScrim}>
            <View style={[styles.celebrateCard, { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1, alignItems: 'stretch' }]}>
              <View style={[styles.celebrateIcon, { backgroundColor: theme.primaryWash, alignSelf: 'center' }]}><MaterialIcons name="restore" size={34} color={theme.primary} /></View>
              <AppText style={[styles.celebrateTitle, { color: theme.text }]}>Restore backup?</AppText>
              <AppText style={[styles.celebrateBody, { color: theme.muted }]}>{pendingRestore?.preview.backupDate ? `Backup from ${pendingRestore.preview.backupDate}` : 'Backup date unavailable'}</AppText>
              <AnimatedCue trigger={pendingRestore?.preview.backupDate ?? 'restore-preview'} distance={6}>
                <View style={[styles.card, { backgroundColor: theme.surface2, borderColor: theme.line, marginTop: 18, shadowOpacity: 0, elevation: 0 }]}>
                  {[
                    ['Categories', pendingRestore?.preview.counts.categories ?? 0],
                    ['Expenses', pendingRestore?.preview.counts.expenses ?? 0],
                    ['Goals', pendingRestore?.preview.counts.goals ?? 0],
                    ['Borrowed-money items', pendingRestore?.preview.counts.ious ?? 0],
                  ].map(([label, count]) => <Row key={label} label={String(label)} value={String(count)} theme={theme} />)}
                </View>
              </AnimatedCue>
              <AppText style={[styles.itemSub, { color: theme.muted, textAlign: 'center', marginTop: 12 }]}>This replaces current data on this device.</AppText>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 22 }}>
                <AnimatedPressable accessibilityRole="button" style={[styles.button, { flex: 1, backgroundColor: theme.surface2 }]} contentStyle={styles.buttonContent} onPress={() => setPendingRestore(null)}><AppText style={[styles.buttonText, { color: theme.text }]}>Cancel</AppText></AnimatedPressable>
                <AnimatedPressable accessibilityRole="button" style={[styles.button, { flex: 1, backgroundColor: theme.primary }]} contentStyle={styles.buttonContent} onPress={restorePendingBackup}><AppText style={styles.buttonText}>Restore</AppText></AnimatedPressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal visible={celebrate !== null} transparent animationType="fade" onRequestClose={() => setCelebrate(null)}>
          <View style={styles.celebrateScrim}>
            <View style={[styles.celebrateCard, { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: 1 }]}>
              <View style={[styles.celebrateIcon, { backgroundColor: theme.primaryWash }]}><MaterialIcons name="celebration" size={38} color={theme.primary} /></View>
              <AppText style={[styles.celebrateTitle, { color: theme.text }]}>{celebrate?.title}</AppText>
              <AppText style={[styles.celebrateBody, { color: theme.muted }]}>{celebrate?.body}</AppText>
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, alignSelf: 'stretch', marginTop: 22 }]} onPress={() => setCelebrate(null)}><AppText style={styles.buttonText}>Nice!</AppText></TouchableOpacity>
            </View>
          </View>
        </Modal>
        {renderSheet()}
      </SafeAreaView>
    );
  }

  return screen;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

