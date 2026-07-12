import { StatusBar } from "expo-status-bar";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  BackHandler,
  AppState,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { MaterialIcons } from "@expo/vector-icons";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  KantumruyPro_400Regular,
  KantumruyPro_500Medium,
  KantumruyPro_600SemiBold,
  KantumruyPro_700Bold,
} from "@expo-google-fonts/kantumruy-pro";
import { saveAppState, loadAppState } from "./src/db/appStorage";
import {
  backupFileName,
  deriveRestorePreview,
  parsePersistedBackup,
  stringifyPersistedBackup,
  type RestorePreview,
} from "./src/db/appBackup";
import { BALANCED, SAVER, summarizeBudget } from "./src/domain/budget";
import { parseExpenseText } from "./src/domain/expenseParser";
import {
  applyLearningOnCategoryEdit,
  applyLearningOnExpenseSave,
  applyLearningOnExpenseSaveBatch,
} from "./src/domain/categoryLearning";
import {
  suggestCategoryForAba,
  suggestCategoryForAddText,
} from "./src/domain/categorySuggestion";
import {
  cleanAbaDescription,
  cleanFreeTextLabel,
} from "./src/domain/expenseLabel";
import { bestAndWorst, buildHeatmap } from "./src/domain/insights";
import { formatMoney, formatMoney0, money } from "./src/domain/money";
import {
  addIsoDays,
  budgetCycleForDay,
  budgetCycleKeyForDay,
  filterExpensesByBudgetCycle,
  filterExpensesByDay,
  isIsoDay,
  isIsoDayInBudgetCycle,
  isoDayFromDate,
  isoMonthFromDay,
  spentUsdForDay,
} from "./src/domain/dates";
import { categoryFor } from "./src/domain/categories";
import {
  isExpenseTransaction,
  isIncomeTransaction,
  transactionKind,
} from "./src/domain/transactions";
import { filterTransactions } from "./src/domain/transactionFilters";
import {
  normalizeDueDay,
  recurringPaidBillKey,
  upcomingRecurringPayments,
} from "./src/domain/recurring";
import {
  dedupeAbaTransactions,
  parseAbaStatementCsvText,
  parseAbaStatementText,
  parseAbaStatementWorkbookBase64,
  toExpenseFromAbaTransaction,
} from "./src/domain/abaStatement";
import type {
  AppModel,
  Currency,
  Drafts,
  Expense,
  RecurringPayment,
  Screen,
  Sheet,
  TransactionKind,
} from "./src/app/types";
import {
  INITIAL_DRAFTS,
  INITIAL_MODEL,
  PALETTE,
  RATE,
} from "./src/app/initialState";
import {
  FIRST_SETUP_ONBOARDING_STEP,
  LAST_SETUP_ONBOARDING_STEP,
  WELCOME_ONBOARDING_STEP,
  normalizeLoadedModel,
  type PersistedAppModel,
} from "./src/app/normalizeLoadedModel";
import { LANGUAGE_LABELS, categoryLabel, t } from "./src/app/i18n";
import {
  applyQuickAmountChip,
  buildFastEntryMemory,
  QUICK_AMOUNT_CHIPS,
} from "./src/app/fastEntryMemory";
import {
  fetchUsdToKhrRate,
  shouldRefreshExchangeRate,
  USD_TO_KHR_RATE_SOURCE,
} from "./src/services/exchangeRate";
import {
  dueText,
  greetingFor,
  monthLabel,
  shiftIsoMonth,
} from "./src/app/dateLabels";
import {
  amountLabel,
  amountUsd,
  csvEscape,
  formatClock,
  heatColor,
  khr,
  monthsToGo,
  nowTime,
  ordinal,
  round2,
  sheetTitle,
  usd,
  usd0,
} from "./src/app/formatters";
import { DARK, LIGHT } from "./src/theme/theme";
import { FONT, KHMER_FONT } from "./src/theme/typography";
import { AppText } from "./src/ui/AppText";
import { AnimatedPressable } from "./src/ui/AnimatedPressable";
import { KeyboardAwareScrollView } from "./src/ui/KeyboardAwareScrollView";
import { Glyph, ICON_SET, type IconName } from "./src/ui/icons";
import {
  AnimatedCue,
  AnimatedSplitBar,
  EmptyState,
  Pill,
  Progress,
  ReceiptToRingCue,
  RingBudget,
  Row,
  SectionHeader,
  SelectableChip,
  SetupDot,
  Stat,
  Upcoming,
} from "./src/ui/components";
import { AnimatedNumber } from "./src/ui/AnimatedNumber";
import {
  BudgetMethodPicker,
  DueDayPicker,
  MoneyField,
  ReminderTimePicker,
  SheetInput,
} from "./src/ui/forms";
import { WelcomeScreen } from "./src/ui/WelcomeScreen";
import { BottomNav } from "./src/ui/navigation";
import { CARD_SHADOW, styles } from "./src/ui/styles";
import {
  hapticError,
  hapticSelect,
  hapticSuccess,
  hapticWarning,
} from "./src/ui/haptics";

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
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(
    null,
  );
  const [celebrate, setCelebrate] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [heatWidth, setHeatWidth] = useState(0);
  const [draggingGoal, setDraggingGoal] = useState<string | null>(null);
  const goalHeights = useRef<Record<string, number>>({}).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const lastBackPressAt = useRef(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMonth, setExportMonth] = useState(() =>
    isoMonthFromDay(isoDayFromDate(new Date())),
  );
  const rateRefreshInFlightDay = useRef<string | null>(null);
  const [recentExpenseId, setRecentExpenseId] = useState<string | null>(null);
  const sweepInProgressRef = useRef(false);
  const addSuggestionCacheRef = useRef<{
    key: string;
    model: AppModel;
    value: ReturnType<typeof suggestCategoryForAddText>;
  } | null>(null);
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
      console.warn("Could not load Luy Khnom state", error);
      setModel(normalizeLoadedModel(undefined));
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        setModel((current) => normalizeLoadedModel(current));
    });
    return () => subscription.remove();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const todayForRate = isoDayFromDate(new Date());
    if (
      !shouldRefreshExchangeRate(model.exchangeRateLastFetchedDay, todayForRate)
    )
      return;
    if (rateRefreshInFlightDay.current === todayForRate) return;

    rateRefreshInFlightDay.current = todayForRate;
    setModel((current) => {
      if (
        !shouldRefreshExchangeRate(
          current.exchangeRateLastFetchedDay,
          todayForRate,
        )
      )
        return current;
      return { ...current, exchangeRateLastFetchedDay: todayForRate };
    });

    void fetchUsdToKhrRate()
      .then((result) => {
        if (result === null) return;
        setModel((current) => ({
          ...current,
          rate: round2(result.khrPerUsd),
          exchangeRateSource: result.source,
        }));
      })
      .catch((error) => {
        console.warn("Could not refresh USD/KHR exchange rate", error);
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
      console.warn("Could not save Luy Khnom state", error);
    }
  }, [model, hydrated]);

  const today = isoDayFromDate(new Date());
  const thisMonth = isoMonthFromDay(today);
  const budgetCycle = budgetCycleForDay(today, model.budgetCycleStartDay);
  const budgetCycleLabel = `${budgetCycle.start} → ${budgetCycle.end}`;
  const todayTransactions = filterExpensesByDay(model.expenses, today);
  const todayExpenses = todayTransactions.filter(isExpenseTransaction);
  const monthTransactions = filterExpensesByBudgetCycle(
    model.expenses,
    today,
    model.budgetCycleStartDay,
  );
  const monthExpenses = monthTransactions.filter(isExpenseTransaction);
  const monthIncomeUsd = monthTransactions
    .filter(isIncomeTransaction)
    .reduce(
      (sum, transaction) =>
        sum + amountUsd(transaction.amount, transaction.cur, model.rate),
      0,
    );
  const monthSpendByCategory = new Map<string, number>();
  monthExpenses.forEach((expense) => {
    monthSpendByCategory.set(
      expense.cat,
      (monthSpendByCategory.get(expense.cat) ?? 0) +
        amountUsd(expense.amount, expense.cur, model.rate),
    );
  });
  const categoryMonthSpentUsd = (key: string) =>
    monthSpendByCategory.get(key) ?? 0;
  const savedSoFarUsd = money(
    Math.round(
      model.goals.reduce(
        (sum, goal) => sum + amountUsd(goal.saved, goal.cur, model.rate),
        0,
      ) * 100,
    ),
    "USD",
  );
  const method =
    model.method === "custom"
      ? {
          key: "custom" as const,
          needsPct: model.custom.needs,
          wantsPct: model.custom.wants,
          savePct: model.custom.save,
        }
      : model.method === "balanced"
        ? BALANCED
        : SAVER;
  const categorySpend = model.categories.map((category) => ({
    key: category.key,
    spent: money(
      Math.round(categoryMonthSpentUsd(category.key) * 100),
      "USD" as const,
    ),
    budget: money(Math.round(category.budgetUsd * 100), "USD" as const),
  }));
  const todayMoney = todayExpenses.map((expense) =>
    money(
      expense.cur === "USD"
        ? Math.round(expense.amount * 100)
        : Math.round(expense.amount),
      expense.cur,
    ),
  );
  const budgetInput = {
    salary: money(
      Math.round(
        (amountUsd(model.salary, model.salaryCur, model.rate) +
          monthIncomeUsd) *
          100,
      ),
      "USD",
    ),
    fixedCosts: [
      money(Math.round(model.rent * 100), "USD"),
      money(Math.round(model.utilities * 100), "USD"),
      money(Math.round(model.loan * 100), "USD"),
    ],
    savedSoFar: savedSoFarUsd,
    categorySpend,
    todayExpenses: todayMoney,
    method,
    rate: { khrPerUsd: model.rate },
    daysLeftIncludingToday: budgetCycle.daysLeftIncludingToday,
  };
  const rolloverYesterday = money(Math.round(model.rolloverUsd * 100), "USD");
  const budget = summarizeBudget({ ...budgetInput, rolloverYesterday });
  const parsed = parseExpenseText(drafts.addText);
  const parsedAmount = parsed.amount;
  const addSuggestion = suggestionForAddText(
    drafts.addText,
    drafts.transactionKind,
    parsed,
  );
  const parsedCat = categoryFor(
    model.categories,
    drafts.selectedCat || addSuggestion.categoryKey,
  );
  const ringColor =
    budget.status === "over"
      ? theme.red
      : budget.ringPct < 0.35
        ? theme.amber
        : theme.green;
  const selectedCategory = categoryFor(model.categories, drafts.selectedCat);
  const selectedCategoryLabel = categoryLabel(selectedCategory, model.language);
  const selectedExpense =
    model.expenses.find((expense) => expense.id === drafts.selectedExpenseId) ??
    null;
  const chartHistoryValues = [
    ...model.history,
    budget.spentTodayUsd.amountMinor / 100,
  ].slice(-35);
  const chartHistoryItems = chartHistoryValues.map((value, index) => ({
    date: addIsoDays(today, index - (chartHistoryValues.length - 1)),
    value,
  }));
  const cycleHistoryItems = chartHistoryItems
    .filter((item) => item.date >= budgetCycle.start && item.date <= today)
    .map((item) => ({
      date: item.date,
      // Recompute each in-cycle day from the live expense list. model.history
      // is a frozen snapshot written once at day rollover, so it misses
      // transactions added to a past day afterwards (e.g. ABA statement
      // imports), which otherwise leaves the day-view total and heatmap at $0.
      value: spentUsdForDay(model.expenses, item.date, model.rate),
    }));
  const chartHistory = cycleHistoryItems.map((item) => item.value);
  const heatmap = buildHeatmap(
    chartHistory,
    budget.dailyBudgetUsd.amountMinor / 100,
  );
  const selectedDayIndex = Math.max(
    0,
    Math.min(drafts.selectedDay, chartHistory.length - 1),
  );
  const selectedDayItem = cycleHistoryItems[selectedDayIndex] ?? {
    date: today,
    value: budget.spentTodayUsd.amountMinor / 100,
  };
  const selectedDayDate = selectedDayItem.date;
  const selectedDayTransactions = filterExpensesByDay(
    model.expenses,
    selectedDayDate,
  );
  const transactionMonthFilter = drafts.transactionMonth || "current-cycle";
  const transactionHistoryBase =
    transactionMonthFilter === "current-cycle"
      ? monthTransactions
      : filterTransactions(model.expenses, { month: transactionMonthFilter });
  const filteredTransactions = filterTransactions(transactionHistoryBase, {
    text: drafts.transactionSearch,
    kind: drafts.transactionTypeFilter,
    categoryKey: drafts.transactionCategoryFilter,
    categories: model.categories,
  });
  const transactionHistoryMonths = [
    "current-cycle",
    thisMonth,
    shiftIsoMonth(thisMonth, -1),
    shiftIsoMonth(thisMonth, -2),
  ];
  const transactionHistoryFilterActive = Boolean(
    drafts.transactionSearch.trim() ||
    drafts.transactionTypeFilter !== "all" ||
    drafts.transactionCategoryFilter ||
    transactionMonthFilter !== "current-cycle",
  );
  const upcomingRecurring = upcomingRecurringPayments(
    model.recurringPayments,
    model.paidBills,
    model.billReminders,
  );

  function showToast(
    message: string,
    actionLabel?: string,
    action?: () => void,
  ) {
    setToast({ message, actionLabel, action });
    setTimeout(() => setToast(null), action ? 5200 : 2400);
  }

  function updateModel(recipe: (current: AppModel) => AppModel) {
    setModel((current) => recipe(current));
  }

  // Cache the last classifier result so the render body and the onChangeText /
  // quick-amount handlers don't each run predictCategory (cosine similarity over
  // every class prototype) on the same text — the expensive pass now runs at
  // most once per (text, kind, model).
  function suggestionForAddText(
    value: string,
    kind: TransactionKind,
    next: ReturnType<typeof parseExpenseText> = parseExpenseText(value),
  ) {
    const key = `${kind} ${value}`;
    const cached = addSuggestionCacheRef.current;
    if (cached && cached.key === key && cached.model === model)
      return cached.value;
    const result = suggestCategoryForAddText(model, value, next, kind);
    addSuggestionCacheRef.current = { key, model, value: result };
    return result;
  }

  function categoryKeyForAddText(
    value: string,
    kind: TransactionKind = drafts.transactionKind,
  ) {
    return suggestionForAddText(value, kind).categoryKey;
  }
  function go(screen: Screen) {
    if (screen === "add")
      setDrafts((current) => ({
        ...current,
        expenseDate: today,
        transactionKind: "expense",
      }));
    updateModel((current) => ({ ...current, screen }));
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
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
        if (!model.onboarded || model.screen === "onboarding") {
          if (model.onbStep > WELCOME_ONBOARDING_STEP) {
            updateModel((current) => ({
              ...current,
              onbStep: Math.max(WELCOME_ONBOARDING_STEP, current.onbStep - 1),
            }));
          } else {
            showToast("Finish setup to start budgeting");
          }
          return true;
        }
        if (model.screen === "detail") {
          updateModel((current) => ({ ...current, screen: "categories" }));
          return true;
        }
        if (model.screen !== "home") {
          updateModel((current) => ({ ...current, screen: "home" }));
          return true;
        }
        const now = Date.now();
        if (now - lastBackPressAt.current < 1800) return false;
        lastBackPressAt.current = now;
        showToast("Press back again to exit");
        return true;
      },
    );
    return () => subscription.remove();
  }, [
    celebrate,
    pendingRestore,
    sheet,
    model.onboarded,
    model.screen,
    model.onbStep,
  ]);

  function openEntrySheet(expense: Expense) {
    setDrafts((current) => ({
      ...current,
      selectedExpenseId: expense.id,
      selectedCat: expense.cat,
      iouAmount: String(expense.amount),
      entryCur: expense.cur,
      addNote: expense.note ?? "",
      expenseDate: expense.date,
      transactionKind: transactionKind(expense),
    }));
    setSheet("entry");
  }

  function addExpense() {
    if (!parsedAmount) return;
    const expenseDate = drafts.expenseDate.trim();
    if (!isIsoDay(expenseDate)) {
      hapticError();
      showToast(`Use a valid date like ${today}`);
      return;
    }
    const kind = drafts.transactionKind;
    const isIncome = kind === "income";
    const suggestion = suggestionForAddText(drafts.addText, kind, parsed);
    const chosenKey = drafts.selectedCat || suggestion.categoryKey;
    const category = categoryFor(model.categories, chosenKey);
    const expenseCat = isIncome
      ? "income"
      : model.categories.some((item) => item.key === chosenKey)
        ? chosenKey
        : category.key;
    const amount =
      parsedAmount.currency === "USD"
        ? parsedAmount.amountMinor / 100
        : parsedAmount.amountMinor;
    const expense: Expense = {
      id: `expense-${Date.now()}`,
      name: parsed.label || (isIncome ? "Income" : category.label),
      cat: expenseCat,
      amount,
      cur: parsedAmount.currency,
      time: nowTime(),
      date: expenseDate,
      kind,
      note: drafts.addNote.trim() || undefined,
      prediction: isIncome ? undefined : suggestion.prediction,
    };
    const usdValue = amountUsd(expense.amount, expense.cur, model.rate);
    const adjustCurrentMonth =
      !isIncome &&
      isIsoDayInBudgetCycle(expense.date, today, model.budgetCycleStartDay);
    setRecentExpenseId(expense.id);
    hapticSuccess();
    updateModel((current) => {
      const expenses = [expense, ...current.expenses];
      const categories = adjustCurrentMonth
        ? current.categories.map((item) =>
            item.key === expenseCat
              ? { ...item, spentUsd: item.spentUsd + usdValue }
              : item,
          )
        : current.categories;
      const withLearning = isIncome
        ? {
            ...current,
            screen: "home" as Screen,
            expenses,
            categories,
            fastEntryMemory: buildFastEntryMemory(expenses, categories),
          }
        : applyLearningOnExpenseSave(
            {
              ...current,
              screen: "home" as Screen,
              expenses,
              categories,
              fastEntryMemory: buildFastEntryMemory(expenses, categories),
            },
            {
              rawText: drafts.addText,
              cleanLabel: suggestion.cleanLabel,
              categoryKey: expenseCat,
              createdAtDay: expenseDate,
              prediction: suggestion.prediction,
              sourceType: "free_text",
            },
          );
      return withLearning;
    });
    setDrafts((current) => ({
      ...current,
      addText: "",
      addNote: "",
      selectedCat: "",
      expenseDate: today,
      transactionKind: "expense",
    }));
    showToast(`Added ${isIncome ? "income" : expense.name}`, "Undo", () => {
      hapticSelect();
      updateModel((current) => {
        const expenses = current.expenses.filter(
          (item) => item.id !== expense.id,
        );
        const categories = adjustCurrentMonth
          ? current.categories.map((item) =>
              item.key === expenseCat
                ? { ...item, spentUsd: Math.max(0, item.spentUsd - usdValue) }
                : item,
            )
          : current.categories;
        return {
          ...current,
          expenses,
          categories,
          fastEntryMemory: buildFastEntryMemory(expenses, categories),
        };
      });
    });
  }

  function deleteExpense(id: string) {
    const expense = model.expenses.find((item) => item.id === id);
    if (!expense) return;
    const usdValue = amountUsd(expense.amount, expense.cur, model.rate);
    const adjustCurrentMonth =
      isExpenseTransaction(expense) &&
      isIsoDayInBudgetCycle(expense.date, today, model.budgetCycleStartDay);
    hapticWarning();
    updateModel((current) => {
      const expenses = current.expenses.filter((item) => item.id !== id);
      const categories = adjustCurrentMonth
        ? current.categories.map((item) =>
            item.key === expense.cat
              ? { ...item, spentUsd: Math.max(0, item.spentUsd - usdValue) }
              : item,
          )
        : current.categories;
      return {
        ...current,
        expenses,
        categories,
        fastEntryMemory: buildFastEntryMemory(expenses, categories),
      };
    });
    showToast(`Deleted ${expense.name}`, "Undo", () => {
      hapticSelect();
      updateModel((current) => {
        const expenses = current.expenses.some((item) => item.id === expense.id)
          ? current.expenses
          : [expense, ...current.expenses];
        const categories = adjustCurrentMonth
          ? current.categories.map((item) =>
              item.key === expense.cat
                ? { ...item, spentUsd: item.spentUsd + usdValue }
                : item,
            )
          : current.categories;
        return {
          ...current,
          expenses,
          categories,
          fastEntryMemory: buildFastEntryMemory(expenses, categories),
        };
      });
    });
  }

  function saveEntry() {
    const amount = Number(drafts.iouAmount);
    const expenseDate = drafts.expenseDate.trim();
    if (!selectedExpense || !Number.isFinite(amount) || amount <= 0) return;
    if (!isIsoDay(expenseDate)) {
      hapticError();
      showToast(`Use a valid date like ${today}`);
      return;
    }
    const nextKind = drafts.transactionKind;
    const nextCat =
      nextKind === "income"
        ? "income"
        : drafts.selectedCat || selectedExpense.cat;
    const oldUsd = amountUsd(
      selectedExpense.amount,
      selectedExpense.cur,
      model.rate,
    );
    const newUsd = amountUsd(amount, drafts.entryCur, model.rate);
    const note = drafts.addNote.trim() || undefined;
    const oldCurrentMonth =
      isExpenseTransaction(selectedExpense) &&
      isIsoDayInBudgetCycle(
        selectedExpense.date,
        today,
        model.budgetCycleStartDay,
      );
    const newCurrentMonth =
      nextKind === "expense" &&
      isIsoDayInBudgetCycle(expenseDate, today, model.budgetCycleStartDay);
    // Must match the key the suggestion path derives, else the correction never
    // resolves. ABA imports clean via cleanAbaDescription, free text via
    // cleanFreeTextLabel — not a raw lowercased name.
    const cleanLabel =
      selectedExpense.prediction?.cleanLabel ??
      (selectedExpense.time === "imported"
        ? cleanAbaDescription(selectedExpense.name)
        : cleanFreeTextLabel(selectedExpense.name));
    updateModel((current) => {
      const expenses = current.expenses.map((expense) =>
        expense.id === selectedExpense.id
          ? {
              ...expense,
              amount,
              cur: drafts.entryCur,
              note,
              cat: nextCat,
              date: expenseDate,
              kind: nextKind,
            }
          : expense,
      );
      const categories =
        oldCurrentMonth || newCurrentMonth
          ? current.categories.map((category) => {
              let spentUsd = category.spentUsd;
              if (oldCurrentMonth && category.key === selectedExpense.cat)
                spentUsd -= oldUsd;
              if (newCurrentMonth && category.key === nextCat)
                spentUsd += newUsd;
              return { ...category, spentUsd: Math.max(0, spentUsd) };
            })
          : current.categories;
      const base = {
        ...current,
        expenses,
        categories,
        fastEntryMemory: buildFastEntryMemory(expenses, categories),
      };
      if (nextKind !== "expense" || nextCat === selectedExpense.cat)
        return base;
      return applyLearningOnCategoryEdit(base, {
        expense: selectedExpense,
        previousCategoryKey: selectedExpense.cat,
        nextCategoryKey: nextCat,
        cleanLabel,
        rawText: selectedExpense.name,
        createdAtDay: expenseDate,
      });
    });
    hapticSuccess();
    setDrafts((current) => ({ ...current, addNote: "" }));
    setSheet(null);
    showToast("Entry updated");
  }

  function openCatSheet(key: string | null) {
    if (key) {
      const category = categoryFor(model.categories, key);
      setDrafts((current) => ({
        ...current,
        categoryEditKey: key,
        categoryName: category.label,
        categoryBudget: String(category.budgetUsd),
        categoryIcon: category.icon,
        categoryColor: category.color,
      }));
    } else {
      const usedColors = model.categories.map((category) => category.color);
      const nextColor =
        PALETTE.find((color) => !usedColors.includes(color)) ??
        PALETTE[model.categories.length % PALETTE.length];
      setDrafts((current) => ({
        ...current,
        categoryEditKey: null,
        categoryName: "",
        categoryBudget: "50",
        categoryIcon: "category",
        categoryColor: nextColor,
      }));
    }
    setSheet("category");
  }

  function saveCategory() {
    const name = drafts.categoryName.trim();
    const budgetUsd = Number(drafts.categoryBudget);
    if (!name || !Number.isFinite(budgetUsd) || budgetUsd < 0) {
      hapticError();
      return;
    }
    const icon = drafts.categoryIcon || "category";
    const color = drafts.categoryColor || PALETTE[0];
    updateModel((current) => ({
      ...current,
      categories: drafts.categoryEditKey
        ? current.categories.map((category) =>
            category.key === drafts.categoryEditKey
              ? { ...category, label: name, icon, color, budgetUsd }
              : category,
          )
        : [
            ...current.categories,
            {
              key: `cat-${Date.now()}`,
              label: name,
              icon,
              color,
              spentUsd: 0,
              budgetUsd,
            },
          ],
    }));
    setDrafts((current) => ({
      ...current,
      categoryName: "",
      categoryBudget: "50",
      categoryIcon: "category",
      categoryColor: PALETTE[0],
      categoryEditKey: null,
    }));
    hapticSuccess();
    setSheet(null);
    showToast(drafts.categoryEditKey ? "Category updated" : "Category added");
  }

  function saveGoal() {
    const target = Number(drafts.goalTarget);
    const perMonth = Number(drafts.goalPer || 0);
    const name = drafts.goalName.trim();
    if (!name || !Number.isFinite(target) || target <= 0) return;
    updateModel((current) => ({
      ...current,
      goals: [
        ...current.goals,
        {
          id: `goal-${Date.now()}`,
          name,
          icon: "savings",
          target,
          saved: 0,
          perMonth,
          cur: "USD",
        },
      ],
    }));
    setDrafts((current) => ({
      ...current,
      goalName: "",
      goalTarget: "",
      goalPer: "",
    }));
    setSheet(null);
    hapticSuccess();
    showToast("Goal created");
  }

  function addGoalContribution(goalId: string) {
    updateModel((current) => ({
      ...current,
      goals: current.goals.map((goal) => {
        if (goal.id !== goalId) return goal;
        const saved = Math.min(goal.target, goal.saved + goal.perMonth);
        return {
          ...goal,
          saved,
          celebrated: saved >= goal.target ? true : goal.celebrated,
        };
      }),
    }));
    showToast("Added to goal");
    hapticSuccess();
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
        if (-remaining > h / 2) {
          target -= 1;
          remaining += h;
        } else break;
      }
    } else {
      while (target < items.length - 1) {
        const h = (goalHeights[items[target + 1].id] ?? 170) + 12;
        if (remaining > h / 2) {
          target += 1;
          remaining -= h;
        } else break;
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
      hapticSelect();
    }
  }

  function sweepLeftover() {
    const leftoverUsd = Math.max(0, budget.leftTodayUsd.amountMinor) / 100;
    if (leftoverUsd <= 0 || sweepInProgressRef.current || model.swept) return;
    if (model.goals.length === 0) {
      showToast("Create a goal to sweep into");
      hapticWarning();
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
          return {
            ...goal,
            saved,
            celebrated: saved >= goal.target ? true : goal.celebrated,
          };
        }),
      };
    });
    const topGoal = model.goals[0];
    hapticSuccess();
    const reached = topGoal.saved + leftoverUsd >= topGoal.target;
    if (reached) {
      setCelebrate({
        title: "Savings goal reached!",
        body: `You've set aside ${usd(leftoverUsd)} toward ${topGoal.name} — future you says thanks.`,
      });
    } else {
      showToast(`Swept ${usd(leftoverUsd)} into ${topGoal.name}`);
    }
  }

  function markBillPaid(key: string, label: string) {
    updateModel((current) => ({
      ...current,
      paidBills: { ...current.paidBills, [key]: true },
    }));
    showToast(`${label} marked paid`);
    hapticSuccess();
  }

  function settleIou(id: string, person: string) {
    updateModel((current) => ({
      ...current,
      ious: current.ious.filter((item) => item.id !== id),
    }));
    showToast(`Settled up with ${person}`);
    hapticSuccess();
  }

  function saveIou() {
    const amount = Number(drafts.iouAmount);
    const person = drafts.iouPerson.trim();
    if (!person || !Number.isFinite(amount) || amount <= 0) {
      hapticError();
      return;
    }
    const due = drafts.iouDue.trim() || "next month";
    updateModel((current) => ({
      ...current,
      ious: drafts.iouEditId
        ? current.ious.map((item) =>
            item.id === drafts.iouEditId
              ? { ...item, person, amount, due }
              : item,
          )
        : [
            ...current.ious,
            { id: `iou-${Date.now()}`, person, amount, cur: "USD", due },
          ],
    }));
    setDrafts((current) => ({
      ...current,
      iouPerson: "",
      iouAmount: "",
      iouDue: "",
      iouEditId: null,
    }));
    setSheet(null);
    showToast(
      drafts.iouEditId ? "Borrowed money updated" : "Borrowed money saved",
    );
    hapticSuccess();
  }

  function openRecurringSheet(payment: RecurringPayment | null) {
    setDrafts((current) => ({
      ...current,
      recurringName: payment?.name ?? "",
      recurringAmount: payment ? String(payment.amount) : "",
      recurringCur: payment?.cur ?? "USD",
      recurringDueDay: payment?.dueDay ?? 1,
      recurringEditId: payment?.id ?? null,
    }));
    setSheet("recurring");
  }

  function saveRecurringPayment() {
    const name = drafts.recurringName.trim();
    const amount = Number(drafts.recurringAmount);
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      hapticError();
      return;
    }
    const payment: RecurringPayment = {
      id: drafts.recurringEditId ?? `recurring-${Date.now()}`,
      name,
      amount: round2(amount),
      cur: drafts.recurringCur,
      dueDay: normalizeDueDay(drafts.recurringDueDay),
    };
    updateModel((current) => ({
      ...current,
      recurringPayments: drafts.recurringEditId
        ? current.recurringPayments.map((item) =>
            item.id === drafts.recurringEditId ? payment : item,
          )
        : [...current.recurringPayments, payment],
    }));
    setDrafts((current) => ({
      ...current,
      recurringName: "",
      recurringAmount: "",
      recurringCur: "USD",
      recurringDueDay: 1,
      recurringEditId: null,
    }));
    setSheet(null);
    showToast(
      drafts.recurringEditId
        ? "Recurring payment updated"
        : "Recurring payment saved",
    );
    hapticSuccess();
  }

  function deleteRecurringPayment(id: string, name: string) {
    updateModel((current) => {
      const paidBills = { ...current.paidBills };
      delete paidBills[recurringPaidBillKey(id)];
      return {
        ...current,
        paidBills,
        recurringPayments: current.recurringPayments.filter(
          (payment) => payment.id !== id,
        ),
      };
    });
    setDrafts((current) =>
      current.recurringEditId === id
        ? {
            ...current,
            recurringName: "",
            recurringAmount: "",
            recurringCur: "USD",
            recurringDueDay: 1,
            recurringEditId: null,
          }
        : current,
    );
    showToast(`Deleted ${name}`);
    hapticWarning();
  }

  const reminderBody =
    todayTransactions.length === 0
      ? "No transactions recorded today. Add anything you missed?"
      : `Today: spent ${formatMoney(budget.spentTodayUsd)} · saved ${formatMoney(money(Math.max(budget.leftTodayUsd.amountMinor, 0), "USD"))}.`;

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
        const granted =
          status.granted ||
          (status.canAskAgain &&
            (await Notifications.requestPermissionsAsync()).granted);
        if (!granted || cancelled) return;
        const [hourRaw, minuteRaw] = model.notify.split(":");
        const hour = Number(hourRaw);
        const minute = Number(minuteRaw);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
        await Notifications.scheduleNotificationAsync({
          content: { title: "Luy Khnom", body: reminderBody },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
          },
        });
      } catch (error) {
        console.warn("Could not schedule daily reminder", error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.notify, model.billReminders, hydrated]);

  async function previewNotification() {
    const status = await Notifications.getPermissionsAsync();
    const granted =
      status.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      hapticWarning();
      showToast("Notifications not enabled");
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: "Luy Khnom", body: reminderBody },
      trigger: null,
    });
    hapticSuccess();
    showToast("Preview sent");
  }

  async function exportCsv() {
    const rows = [
      ["Date", "Type", "Description", "Category", "Amount", "Currency", "Note"],
    ];
    model.expenses
      .filter((expense) => isoMonthFromDay(expense.date) === exportMonth)
      .forEach((expense) => {
        const kind = transactionKind(expense);
        rows.push([
          expense.date,
          kind === "income" ? "Income" : "Outcome",
          expense.name,
          kind === "income"
            ? "Income"
            : categoryFor(model.categories, expense.cat).label,
          String(expense.amount),
          expense.cur,
          expense.note ?? "",
        ]);
      });
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const exportLabel = monthLabel(exportMonth);
    const exportName = `luy-khnom-export-${exportLabel.replace(/\s+/g, "-").toLowerCase()}`;
    const uri = `${FileSystem.documentDirectory}${exportName}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: `Export Luy Khnom CSV — ${exportLabel}`,
      });
    }
    showToast("CSV exported");
    hapticSuccess();
  }

  async function exportJsonBackup() {
    try {
      const uri = `${FileSystem.documentDirectory}${backupFileName()}`;
      await FileSystem.writeAsStringAsync(
        uri,
        stringifyPersistedBackup(model),
        { encoding: FileSystem.EncodingType.UTF8 },
      );
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/json",
          dialogTitle: "Export Luy Khnom backup",
        });
      }
      showToast("Backup ready — JSON restores the whole app");
      hapticSuccess();
    } catch (error) {
      console.warn("Could not export Luy Khnom backup", error);
      showToast("Could not export backup");
      hapticError();
    }
  }

  async function importJsonBackup() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (!uri) throw new Error("No backup file selected");
      const raw = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const backup = parsePersistedBackup<PersistedAppModel>(raw);
      const preview = deriveRestorePreview(backup);
      if (!preview) throw new Error("Backup preview is unavailable");
      setPendingRestore({ model: normalizeLoadedModel(backup.state), preview });
      hapticSelect();
    } catch (error) {
      console.warn("Could not import Luy Khnom backup", error);
      showToast(
        error instanceof Error ? error.message : "Could not import backup",
      );
      hapticError();
    }
  }

  async function importAbaStatement() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
          "text/comma-separated-values",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const uri = asset?.uri;
      if (!uri) throw new Error("No ABA statement selected");
      const fileName = asset.name?.toLowerCase() ?? "";
      const mimeType = asset.mimeType?.toLowerCase() ?? "";
      const isWorkbook =
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls") ||
        mimeType.includes("spreadsheet") ||
        mimeType.includes("excel");
      const isCsv = fileName.endsWith(".csv") || mimeType.includes("csv");
      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: isWorkbook
          ? FileSystem.EncodingType.Base64
          : FileSystem.EncodingType.UTF8,
      });
      const parsed = isWorkbook
        ? parseAbaStatementWorkbookBase64(text)
        : isCsv
          ? parseAbaStatementCsvText(text)
          : parseAbaStatementText(text);
      // Dedupe against stored expenses AND within the batch (a single file can
      // contain repeated rows), so nothing is double-counted.
      const imported = dedupeAbaTransactions(
        model.expenses,
        parsed.transactions,
      );
      const skipped = parsed.transactions.length - imported.length;
      if (imported.length === 0) {
        showToast(
          parsed.transactions.length > 0
            ? "ABA statement already tracked"
            : "No ABA transactions found",
        );
        hapticWarning();
        return;
      }
      if (parsed.warnings.length > 0) {
        console.warn(
          `ABA import: ${parsed.warnings.length} balance continuity warning(s)`,
        );
      }
      updateModel((current) => {
        const learningInputs: Parameters<
          typeof applyLearningOnExpenseSaveBatch
        >[1][number][] = [];
        const newExpenses = imported.map((transaction) => {
          const suggestion = suggestCategoryForAba(current, transaction);
          const cat =
            transaction.kind === "income" ? "income" : suggestion.categoryKey;
          const expense = toExpenseFromAbaTransaction(
            transaction,
            cat,
            transaction.kind === "income" ? undefined : suggestion.prediction,
          );
          if (transaction.kind === "expense") {
            learningInputs.push({
              rawText: transaction.name,
              cleanLabel: suggestion.cleanLabel,
              categoryKey: cat,
              createdAtDay: transaction.date,
              prediction: suggestion.prediction,
              sourceType: "aba_statement",
              kindHint: "purchase",
            });
          }
          return expense;
        });
        const withLearning = applyLearningOnExpenseSaveBatch(
          current,
          learningInputs,
        );
        return {
          ...withLearning,
          expenses: [...withLearning.expenses, ...newExpenses],
        };
      });
      const warningSuffix =
        parsed.warnings.length > 0
          ? ` · ${parsed.warnings.length} balance warning(s)`
          : "";
      showToast(
        `Imported ${imported.length} · skipped ${skipped} already tracked${warningSuffix}`,
      );
      hapticSuccess();
    } catch (error) {
      console.warn("Could not import ABA statement", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Could not import ABA statement",
      );
      hapticError();
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
      showToast("Backup restored");
      hapticSuccess();
    } catch (error) {
      console.warn("Could not restore Luy Khnom backup", error);
      showToast("Could not restore backup");
      hapticError();
    }
  }

  function renderTopBar(
    title: string,
    _subtitle?: string,
    back?: Screen,
    right?: ReactNode,
  ) {
    return (
      <View style={styles.topRow}>
        {back ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[
              styles.iconButton,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
            onPress={() => go(back)}
          >
            <MaterialIcons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <AppText
            style={[
              back ? styles.title : styles.pageTitle,
              { color: theme.text },
            ]}
          >
            {title}
          </AppText>
        </View>
        {right ?? null}
      </View>
    );
  }

  function renderCurrencySegmentLabel(cur: Currency, selected: boolean) {
    const symbol = cur === "USD" ? "$" : "៛";
    return (
      <AppText
        style={[
          styles.segmentText,
          { color: selected ? theme.text : theme.muted },
        ]}
      >
        {cur}{" "}
        <AppText style={{ fontFamily: KHMER_FONT.bold }}>({symbol})</AppText>
      </AppText>
    );
  }

  function renderTransactionRow(
    transaction: Expense,
    options: { showDate?: boolean; showDelete?: boolean } = {},
  ) {
    const isIncome = isIncomeTransaction(transaction);
    const cat = categoryFor(model.categories, transaction.cat);
    const color = isIncome ? theme.green : cat.color;
    const icon = isIncome ? "account-balance-wallet" : cat.icon;
    const subtitle = [
      options.showDate ? transaction.date : null,
      isIncome
        ? t(model.language, "add.income")
        : categoryLabel(cat, model.language),
      transaction.time,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${transaction.name}, ${subtitle}, ${isIncome ? "Income " : ""}${amountLabel(transaction.amount, transaction.cur)}`}
        style={[styles.expenseRow, { borderColor: theme.line }]}
        onPress={() => openEntrySheet(transaction)}
      >
        <View style={[styles.bubble, { backgroundColor: `${color}22` }]}>
          <Glyph name={icon} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={[styles.itemName, { color: theme.text }]}>
            {transaction.name}
          </AppText>
          <AppText style={[styles.itemSub, { color: theme.muted }]}>
            {subtitle}
          </AppText>
          {transaction.note ? (
            <AppText style={[styles.itemNote, { color: theme.faint }]}>
              {transaction.note}
            </AppText>
          ) : null}
        </View>
        <AppText
          style={[
            styles.amount,
            { color: isIncome ? theme.green : theme.text },
          ]}
        >
          {isIncome ? "+" : ""}
          {amountLabel(transaction.amount, transaction.cur)}
        </AppText>
        {options.showDelete ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Delete ${transaction.name}`}
            onPress={() => deleteExpense(transaction.id)}
            style={{ padding: 5, marginLeft: 2 }}
          >
            <MaterialIcons
              name="delete-outline"
              size={20}
              color={theme.faint}
            />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  }

  function renderOnboarding() {
    const step = model.onbStep;
    if (step === WELCOME_ONBOARDING_STEP) {
      return (
        <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
          <WelcomeScreen
            theme={theme}
            onStart={() => {
              hapticSelect();
              updateModel((current) => ({
                ...current,
                onbStep: FIRST_SETUP_ONBOARDING_STEP,
              }));
            }}
          />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <KeyboardAwareScrollView
            key={`setup-${step}`}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: Math.max(260, footerBottomPadding + 200) },
            ]}
          >
            <View
              style={[styles.headerRow, { marginTop: 4, marginBottom: 20 }]}
            >
              <View style={{ width: 40 }}>
                {step > 1 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Previous setup step"
                    style={[
                      styles.iconButton,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.line,
                      },
                    ]}
                    onPress={() =>
                      updateModel((current) => ({
                        ...current,
                        onbStep: current.onbStep - 1,
                      }))
                    }
                  >
                    <MaterialIcons
                      name="arrow-back"
                      size={20}
                      color={theme.text}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.dots}>
                {[1, 2, 3].map((item) => (
                  <SetupDot
                    key={item}
                    active={item <= step}
                    activeColor={theme.primary}
                    inactiveColor={theme.surface2}
                  />
                ))}
              </View>
              <View style={{ width: 40 }} />
            </View>
            {step === 1 ? (
              <View style={[styles.brandRow, { marginBottom: 4 }]}>
                <Image
                  source={require("./assets/luy-khnom-favicon-flat.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <AppText style={[styles.brandName, { color: theme.text }]}>
                  Luy Khnom
                </AppText>
              </View>
            ) : null}
            {step === 1 ? (
              <AnimatedCue trigger={`setup-${step}`} distance={10}>
                <AppText style={[styles.heroTitle, { color: theme.text }]}>
                  What's your monthly income?
                </AppText>
                <AppText style={[styles.subtitle, { color: theme.muted }]}>
                  We'll plan around this — nothing leaves your phone.
                </AppText>
                <AppText style={[styles.label, { color: theme.muted }]}>
                  Monthly salary
                </AppText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.line,
                      color: theme.text,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  value={String(model.salary)}
                  onChangeText={(value) =>
                    updateModel((current) => ({
                      ...current,
                      salary: Number(value) || 0,
                    }))
                  }
                />
                <AppText style={[styles.label, { color: theme.muted }]}>
                  Currency
                </AppText>
                <View
                  style={[styles.segment, { backgroundColor: theme.surface2 }]}
                >
                  {(["USD", "KHR"] as Currency[]).map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${cur === "USD" ? "US dollars" : "Khmer riel"} for salary`}
                      accessibilityState={{ selected: model.salaryCur === cur }}
                      style={[
                        styles.segmentButton,
                        model.salaryCur === cur && {
                          backgroundColor: theme.surface,
                          ...CARD_SHADOW,
                        },
                      ]}
                      onPress={() => {
                        hapticSelect();
                        updateModel((current) => ({
                          ...current,
                          salaryCur: cur,
                        }));
                      }}
                    >
                      {renderCurrencySegmentLabel(cur, model.salaryCur === cur)}
                    </TouchableOpacity>
                  ))}
                </View>
                <AppText style={[styles.help, { color: theme.muted }]}>
                  You spend in both - set your rate anytime.
                </AppText>
                <AppText style={[styles.help, { color: theme.muted }]}>
                  Right now 1 USD ≈ {khr(model.rate)}.
                </AppText>
              </AnimatedCue>
            ) : null}
            {step === 2 ? (
              <AnimatedCue trigger={`setup-${step}`} distance={10}>
                <AppText style={[styles.heroTitle, { color: theme.text }]}>
                  Your fixed monthly costs
                </AppText>
                <AppText style={[styles.subtitle, { color: theme.muted }]}>
                  Rent and loan come out first — these are your Needs.
                </AppText>
                <MoneyField
                  label="Rent"
                  initialAmount={model.rent}
                  rate={model.rate}
                  theme={theme}
                  onChange={(value) =>
                    updateModel((current) => ({ ...current, rent: value }))
                  }
                />
                <DueDayPicker
                  label="Rent due date"
                  value={model.rentDue}
                  theme={theme}
                  onChange={(day) =>
                    updateModel((current) => ({ ...current, rentDue: day }))
                  }
                />
                <MoneyField
                  label="Utilities (monthly avg)"
                  initialAmount={model.utilities}
                  rate={model.rate}
                  theme={theme}
                  onChange={(value) =>
                    updateModel((current) => ({ ...current, utilities: value }))
                  }
                />
                <AppText style={[styles.label, { color: theme.muted }]}>
                  Loan
                </AppText>
                <View
                  style={[styles.segment, { backgroundColor: theme.surface2 }]}
                >
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="No loan"
                    accessibilityState={{ selected: model.loan <= 0 }}
                    style={[
                      styles.segmentButton,
                      model.loan <= 0 && {
                        backgroundColor: theme.surface,
                        ...CARD_SHADOW,
                      },
                    ]}
                    onPress={() =>
                      updateModel((current) => ({
                        ...current,
                        loan: 0,
                        paidBills: { ...current.paidBills, loan: true },
                      }))
                    }
                  >
                    <AppText
                      style={[
                        styles.segmentText,
                        { color: model.loan <= 0 ? theme.text : theme.muted },
                      ]}
                    >
                      No loan
                    </AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="I have a loan"
                    accessibilityState={{ selected: model.loan > 0 }}
                    style={[
                      styles.segmentButton,
                      model.loan > 0 && {
                        backgroundColor: theme.surface,
                        ...CARD_SHADOW,
                      },
                    ]}
                    onPress={() =>
                      updateModel((current) => ({
                        ...current,
                        loan: current.loan > 0 ? current.loan : 50,
                        paidBills: { ...current.paidBills, loan: false },
                      }))
                    }
                  >
                    <AppText
                      style={[
                        styles.segmentText,
                        { color: model.loan > 0 ? theme.text : theme.muted },
                      ]}
                    >
                      I have a loan
                    </AppText>
                  </TouchableOpacity>
                </View>
                {model.loan > 0 ? (
                  <>
                    <MoneyField
                      label="Loan repayment"
                      initialAmount={model.loan}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        updateModel((current) => ({ ...current, loan: value }))
                      }
                    />
                    <DueDayPicker
                      label="Loan due date"
                      value={model.loanDue}
                      theme={theme}
                      onChange={(day) =>
                        updateModel((current) => ({ ...current, loanDue: day }))
                      }
                    />
                  </>
                ) : (
                  <AppText style={[styles.help, { color: theme.muted }]}>
                    No loan payment will show in Coming up.
                  </AppText>
                )}
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.primaryWash,
                      borderColor: theme.primaryWash,
                    },
                    styles.row,
                    { marginBottom: 0 },
                  ]}
                >
                  <AppText style={[styles.rowValue, { color: theme.text }]}>
                    Fixed each month
                  </AppText>
                  <AppText
                    style={[
                      styles.parsedAmount,
                      { color: theme.text, fontSize: 18, marginTop: 0 },
                    ]}
                  >
                    {formatMoney0(budget.fixedUsd)}
                  </AppText>
                </View>
              </AnimatedCue>
            ) : null}
            {step === 3 ? (
              <AnimatedCue trigger={`setup-${step}`} distance={10}>
                <AppText style={[styles.heroTitle, { color: theme.text }]}>
                  Pick a budgeting method
                </AppText>
                <AppText style={[styles.subtitle, { color: theme.muted }]}>
                  Choose the split that fits your month — savings come first.
                </AppText>
                <BudgetMethodPicker
                  method={model.method}
                  custom={model.custom}
                  theme={theme}
                  onSelect={(mode) => {
                    hapticSelect();
                    updateModel((current) => ({ ...current, method: mode }));
                  }}
                  onCustomChange={(part, value) =>
                    updateModel((current) => ({
                      ...current,
                      custom: { ...current.custom, [part]: value },
                    }))
                  }
                />
                <AppText style={[styles.label, { color: theme.muted }]}>
                  Your plan
                </AppText>
                <AnimatedSplitBar
                  needsPct={method.needsPct}
                  wantsPct={method.wantsPct}
                  savePct={method.savePct}
                  needsColor={theme.primary}
                  wantsColor={theme.amber}
                  saveColor={theme.green}
                />
                <View style={[styles.row, { marginTop: 10 }]}>
                  <AppText
                    style={[
                      styles.duePillText,
                      { color: theme.primary, fontFamily: FONT.bold },
                    ]}
                  >
                    Needs{" "}
                    {formatMoney0(
                      money(
                        Math.round(
                          (budget.salaryUsd.amountMinor * method.needsPct) /
                            100,
                        ),
                        "USD",
                      ),
                    )}
                  </AppText>
                  <AppText
                    style={[
                      styles.duePillText,
                      { color: theme.amber, fontFamily: FONT.bold },
                    ]}
                  >
                    Wants{" "}
                    {formatMoney0(
                      money(
                        Math.round(
                          (budget.salaryUsd.amountMinor * method.wantsPct) /
                            100,
                        ),
                        "USD",
                      ),
                    )}
                  </AppText>
                  <AppText
                    style={[
                      styles.duePillText,
                      { color: theme.green, fontFamily: FONT.bold },
                    ]}
                  >
                    Save {formatMoney0(budget.savingsTargetUsd)}
                  </AppText>
                </View>
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.line },
                  ]}
                >
                  <Row
                    label="Salary"
                    value={formatMoney0(budget.salaryUsd)}
                    theme={theme}
                  />
                  <Row
                    label="− Rent + Loan"
                    value={`−${formatMoney0(budget.fixedUsd)}`}
                    theme={theme}
                  />
                  <Row
                    label="− Savings first"
                    value={`−${formatMoney0(budget.savingsTargetUsd)}`}
                    theme={theme}
                  />
                  <View
                    style={{
                      height: 1,
                      backgroundColor: theme.line,
                      marginVertical: 10,
                    }}
                  />
                  <Row
                    label="Free to spend"
                    value={formatMoney0(budget.spendableMonthUsd)}
                    theme={theme}
                    strong
                  />
                  <AppText
                    style={[
                      styles.itemSub,
                      { color: theme.muted, marginTop: 8 },
                    ]}
                  >
                    ≈{" "}
                    <AppText
                      style={{ fontFamily: FONT.bold, color: theme.text }}
                    >
                      {formatMoney0(budget.baseDailyUsd)}/day
                    </AppText>{" "}
                    across the month.
                  </AppText>
                </View>
                <AppText style={[styles.label, { color: theme.muted }]}>
                  Daily reminder
                </AppText>
                <ReminderTimePicker
                  value={model.notify}
                  theme={theme}
                  open={timePickerOpen}
                  onOpenChange={setTimePickerOpen}
                  onChange={(value) =>
                    updateModel((current) => ({ ...current, notify: value }))
                  }
                />
              </AnimatedCue>
            ) : null}
          </KeyboardAwareScrollView>
          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.page,
                borderColor: theme.line,
                paddingBottom: footerBottomPadding,
              },
            ]}
          >
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel={
                step < LAST_SETUP_ONBOARDING_STEP
                  ? "Continue setup"
                  : "Start budgeting"
              }
              style={[styles.button, { backgroundColor: theme.primary }]}
              contentStyle={styles.buttonContent}
              onPress={() => {
                hapticSelect();
                updateModel((current) =>
                  current.onbStep < LAST_SETUP_ONBOARDING_STEP
                    ? { ...current, onbStep: current.onbStep + 1 }
                    : { ...current, onboarded: true, screen: "home" },
                );
              }}
            >
              <AppText numberOfLines={1} style={styles.buttonText}>
                {step < LAST_SETUP_ONBOARDING_STEP
                  ? "Continue"
                  : "Start budgeting"}
              </AppText>
              <MaterialIcons
                name="arrow-forward"
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  function renderHome() {
    const topGoals = model.goals.slice(0, 3);
    const leftAbsUsd = Math.abs(budget.leftTodayUsd.amountMinor) / 100;
    const leftFmt =
      model.baseCur === "KHR"
        ? khr(leftAbsUsd * model.rate)
        : formatMoney(money(Math.abs(budget.leftTodayUsd.amountMinor), "USD"));
    const leftAmountValue =
      model.baseCur === "KHR" ? leftAbsUsd * model.rate : leftAbsUsd;
    const leftAlt =
      model.baseCur === "KHR" ? usd(leftAbsUsd) : khr(leftAbsUsd * model.rate);
    const ringLabel =
      budget.status === "over"
        ? t(model.language, "home.overBudgetToday")
        : budget.status === "close"
          ? t(model.language, "home.almostLimit")
          : t(model.language, "home.leftToday");
    const hasLoanPayment =
      model.billReminders && model.loan > 0 && !model.paidBills.loan;
    const hasRentPayment =
      model.billReminders &&
      model.rent + model.utilities > 0 &&
      !model.paidBills.rent;
    const hasUpcoming =
      hasLoanPayment ||
      hasRentPayment ||
      upcomingRecurring.length > 0 ||
      model.ious.length > 0;
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <AppText style={[styles.greet, { color: theme.muted }]}>
              {greetingFor()}
            </AppText>
            <AppText style={[styles.title, { color: theme.text }]}>
              {t(model.language, "home.title")}
            </AppText>
          </View>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityLabel="Dark mode"
            accessibilityState={{ checked: model.dark }}
            style={[
              styles.iconButton,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
            onPress={() =>
              updateModel((current) => ({ ...current, dark: !current.dark }))
            }
          >
            <MaterialIcons
              name={model.dark ? "light-mode" : "dark-mode"}
              size={20}
              color={theme.muted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.ringWrap}>
          <RingBudget
            pct={budget.ringPct}
            color={ringColor}
            bg={theme.ringTrack}
          />
          <View style={styles.ringCenter}>
            <AnimatedCue
              trigger={ringLabel}
              distance={3}
              scale={1}
              style={{ alignItems: "center" }}
            >
              <AppText
                style={[
                  styles.ringLabel,
                  {
                    color:
                      budget.status === "over"
                        ? theme.red
                        : budget.status === "close"
                          ? theme.amber
                          : theme.muted,
                  },
                ]}
              >
                {ringLabel}
              </AppText>
            </AnimatedCue>
            <AnimatedNumber
              numberOfLines={1}
              value={leftAmountValue}
              format={(value) =>
                model.baseCur === "KHR"
                  ? khr(value)
                  : formatMoney(money(Math.round(value * 100), "USD"))
              }
              style={[
                styles.ringAmount,
                {
                  color: budget.status === "over" ? theme.red : theme.text,
                  fontSize:
                    leftFmt.length > 10
                      ? 26
                      : leftFmt.length > 8
                        ? 32
                        : leftFmt.length > 6
                          ? 40
                          : 50,
                },
              ]}
            />
            <AppText style={[styles.ringKhr, { color: theme.muted }]}>
              {budget.status === "over"
                ? t(model.language, "home.tomorrowAdjusts")
                : `≈ ${leftAlt}`}
            </AppText>
          </View>
        </View>
        <ReceiptToRingCue trigger={recentExpenseId} theme={theme} />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Show daily budget calculation"
          activeOpacity={0.8}
          onPress={() => setSheet("formula")}
        >
          <Pill
            icon="bolt"
            text={`${formatMoney(budget.baseDailyUsd)} base + ${formatMoney(rolloverYesterday)} rolled over`}
            theme={theme}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Show tomorrow budget calculation"
          activeOpacity={0.8}
          onPress={() => setSheet("formula")}
        >
          <Pill
            icon="trending-up"
            text={`Tomorrow ≈ ${formatMoney(budget.tomorrowUsd)} at this pace`}
            theme={theme}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open current budget cycle summary"
          activeOpacity={0.7}
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}
          onPress={() => setSheet("month")}
        >
          <View style={[styles.row, { marginBottom: 16 }]}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              Current cycle
            </AppText>
            <View style={[styles.duePill, { backgroundColor: theme.surface2 }]}>
              <AppText style={[styles.duePillText, { color: theme.muted }]}>
                {budgetCycle.daysLeftIncludingToday} days left
              </AppText>
            </View>
          </View>
          <Progress
            label="Spent"
            value={formatMoney(budget.spentMonthUsd)}
            total={formatMoney0(budget.spendableMonthUsd)}
            pct={budget.monthPct}
            color={theme.primary}
            theme={theme}
          />
          <Progress
            label="Saved so far"
            value={formatMoney(savedSoFarUsd)}
            total={formatMoney0(budget.savingsTargetUsd)}
            pct={budget.savingsPct}
            color={theme.green}
            theme={theme}
          />
          {model.swept ? (
            <AnimatedCue trigger="swept">
              <View
                style={[styles.sweep, { backgroundColor: `${theme.green}1f` }]}
              >
                <MaterialIcons name="savings" size={18} color={theme.green} />
                <AppText
                  style={[
                    styles.chipText,
                    { color: theme.green, fontFamily: FONT.bold },
                  ]}
                >
                  Leftover protected in savings
                </AppText>
              </View>
            </AnimatedCue>
          ) : budget.leftTodayUsd.amountMinor > 0 ? (
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Sweep leftover into savings"
              style={[styles.sweep, { backgroundColor: theme.primaryWash }]}
              contentStyle={styles.buttonContent}
              onPress={sweepLeftover}
            >
              <MaterialIcons name="savings" size={18} color={theme.primary} />
              <AppText
                style={[
                  styles.chipText,
                  { color: theme.primary, fontFamily: FONT.bold },
                ]}
              >
                Sweep {usd(budget.leftTodayUsd.amountMinor / 100)} leftover into
                savings
              </AppText>
            </AnimatedPressable>
          ) : null}
        </TouchableOpacity>
        {topGoals.length > 0 ? (
          <>
            <SectionHeader
              title={topGoals.length > 1 ? "Top goals" : "Goal"}
              action="All goals"
              theme={theme}
              onAction={() => go("goals")}
            />
            {topGoals.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                accessibilityRole="button"
                accessibilityLabel={`Open goal ${goal.name}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.line,
                    marginTop: 0,
                    marginBottom: 10,
                  },
                ]}
                onPress={() => go("goals")}
              >
                <View
                  style={[
                    styles.expenseRow,
                    {
                      borderBottomWidth: 0,
                      paddingVertical: 0,
                      marginBottom: 12,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      { backgroundColor: `${theme.primary}1f` },
                    ]}
                  >
                    <Glyph name={goal.icon} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={[styles.itemTitle, { color: theme.text }]}>
                      {goal.name}
                    </AppText>
                    <AppText style={[styles.itemSub, { color: theme.muted }]}>
                      {amountLabel(goal.perMonth, goal.cur)}/month
                    </AppText>
                    {monthsToGo(goal) ? (
                      <AppText style={[styles.itemSub, { color: theme.muted }]}>
                        {monthsToGo(goal)}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText style={[styles.amount, { color: theme.text }]}>
                    {amountLabel(goal.saved, goal.cur)}
                  </AppText>
                </View>
                <View
                  style={[styles.track, { backgroundColor: theme.surface2 }]}
                >
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`,
                        backgroundColor: theme.primary,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}
        {topGoals.length === 0 ? (
          <>
            <SectionHeader
              title={t(model.language, "home.goals")}
              action={t(model.language, "home.newGoal")}
              theme={theme}
              onAction={() => setSheet("goal")}
            />
            <EmptyState
              icon="flag"
              title={t(model.language, "home.startGoalTitle")}
              body={t(model.language, "home.startGoalBody")}
              theme={theme}
            />
          </>
        ) : null}
        <SectionHeader
          title="Coming up"
          action="+ Payment"
          theme={theme}
          onAction={() => openRecurringSheet(null)}
        />
        {hasLoanPayment ? (
          <Upcoming
            icon="savings"
            color="#7c5cff"
            title="Loan repayment"
            subtitle={dueText(model.loanDue)}
            amount={usd(model.loan)}
            theme={theme}
            onPress={() => setSheet("loan")}
            onDone={() => markBillPaid("loan", "Loan repayment")}
          />
        ) : null}
        {hasRentPayment ? (
          <Upcoming
            icon="receipt-long"
            color="#d98a00"
            title="Rent & utilities"
            subtitle={dueText(model.rentDue)}
            amount={usd(model.rent + model.utilities)}
            theme={theme}
            onPress={() => setSheet("fixed")}
            onDone={() => markBillPaid("rent", "Rent & utilities")}
          />
        ) : null}
        {upcomingRecurring.map((payment) => (
          <Upcoming
            key={payment.id}
            icon="subscriptions"
            color="#0ea5b7"
            title={payment.name}
            subtitle={`Recurring · ${dueText(payment.dueDay)}`}
            amount={amountLabel(payment.amount, payment.cur)}
            theme={theme}
            onPress={() => openRecurringSheet(payment)}
            onDone={() =>
              markBillPaid(recurringPaidBillKey(payment.id), payment.name)
            }
          />
        ))}
        {model.ious.map((iou) => (
          <Upcoming
            key={iou.id}
            icon="account-balance-wallet"
            color="#3ba6d4"
            title={`Pay back ${iou.person}`}
            subtitle={`Borrowed · due ${iou.due}`}
            amount={amountLabel(iou.amount, iou.cur)}
            theme={theme}
            onPress={() => {
              setDrafts((current) => ({
                ...current,
                iouPerson: iou.person,
                iouAmount: String(iou.amount),
                iouDue: iou.due,
                iouEditId: iou.id,
              }));
              setSheet("iou");
            }}
            onDone={() => settleIou(iou.id, iou.person)}
          />
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add borrowed money"
          style={[styles.dashed, { borderColor: theme.faint, marginTop: 8 }]}
          onPress={() => {
            setDrafts((current) => ({
              ...current,
              iouPerson: "",
              iouAmount: "",
              iouDue: "",
              iouEditId: null,
            }));
            setSheet("iou");
          }}
        >
          <MaterialIcons name="add" size={20} color={theme.primary} />
          <AppText
            style={[
              styles.chipText,
              { color: theme.primary, fontFamily: FONT.bold },
            ]}
          >
            Borrowed money
          </AppText>
        </TouchableOpacity>
        {!hasUpcoming ? (
          <View style={{ marginTop: 14 }}>
            <EmptyState
              icon="check-circle"
              title={t(model.language, "home.noPaymentsTitle")}
              body={t(model.language, "home.noPaymentsBody")}
              theme={theme}
            />
          </View>
        ) : null}
        <SectionHeader
          title={t(model.language, "home.today")}
          action={t(model.language, "home.summary")}
          theme={theme}
          onAction={() => go("insights")}
        />
        {todayTransactions.map((transaction) => {
          const row = renderTransactionRow(transaction, { showDelete: true });
          return transaction.id === recentExpenseId ? (
            <AnimatedCue key={transaction.id} trigger={transaction.id}>
              {row}
            </AnimatedCue>
          ) : (
            <View key={transaction.id}>{row}</View>
          );
        })}
        {todayTransactions.length === 0 ? (
          <EmptyState
            icon="edit-note"
            title={t(model.language, "home.startRecordingTitle")}
            body={t(model.language, "home.startRecordingBody")}
            theme={theme}
          />
        ) : null}
      </ScrollView>
    );
  }

  function renderAdd() {
    const hasAmount = Boolean(parsedAmount);
    const hasValidDate = isIsoDay(drafts.expenseDate.trim());
    const canSave = hasAmount && hasValidDate;
    const parsedAmountValue = parsedAmount
      ? parsedAmount.currency === "KHR"
        ? parsedAmount.amountMinor
        : parsedAmount.amountMinor / 100
      : 0;
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <KeyboardAwareScrollView
          key="add"
          extraSpace={120}
          contentContainerStyle={[styles.scroll, { paddingBottom: 132 }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
        >
          {renderTopBar(t(model.language, "add.title"), undefined, "home")}
          <AppText style={[styles.label, { color: theme.muted, marginTop: 0 }]}>
            {t(model.language, "add.recordAs")}
          </AppText>
          <View
            style={[
              styles.segment,
              { backgroundColor: theme.surface2, marginBottom: 12 },
            ]}
          >
            {(["expense", "income"] as const).map((kind) => (
              <TouchableOpacity
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={
                  kind === "expense" ? "Record as outcome" : "Record as income"
                }
                accessibilityState={{
                  selected: drafts.transactionKind === kind,
                }}
                style={[
                  styles.segmentButton,
                  drafts.transactionKind === kind && {
                    backgroundColor: theme.surface,
                    ...CARD_SHADOW,
                  },
                ]}
                onPress={() => {
                  hapticSelect();
                  setDrafts((current) => ({
                    ...current,
                    transactionKind: kind,
                    selectedCat:
                      kind === "income"
                        ? ""
                        : categoryKeyForAddText(current.addText),
                  }));
                }}
              >
                <AppText
                  style={[
                    styles.segmentText,
                    {
                      color:
                        drafts.transactionKind === kind
                          ? theme.text
                          : theme.muted,
                    },
                  ]}
                >
                  {kind === "expense"
                    ? t(model.language, "add.outcome")
                    : t(model.language, "add.income")}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[
              styles.addInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                color: theme.text,
              },
            ]}
            placeholder={
              drafts.transactionKind === "income"
                ? t(model.language, "add.tryIncome")
                : t(model.language, "add.tryExpense")
            }
            placeholderTextColor={theme.faint}
            value={drafts.addText}
            onChangeText={(value) =>
              setDrafts((current) => ({
                ...current,
                addText: value,
                selectedCat:
                  current.transactionKind === "income"
                    ? ""
                    : categoryKeyForAddText(value),
              }))
            }
          />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={styles.aiHeader}>
              <MaterialIcons
                name="auto-awesome"
                size={17}
                color={
                  drafts.transactionKind === "income"
                    ? theme.green
                    : theme.primary
                }
              />
              <AppText
                style={[
                  styles.aiHeaderText,
                  {
                    color:
                      drafts.transactionKind === "income"
                        ? theme.green
                        : theme.primary,
                  },
                ]}
              >
                {t(model.language, "add.understood")}
              </AppText>
            </View>
            <View
              style={[
                styles.headerRow,
                { alignItems: "flex-end", marginTop: 6 },
              ]}
            >
              <View style={{ flex: 1 }}>
                {parsedAmount ? (
                  <AnimatedNumber
                    value={parsedAmountValue}
                    format={(value) =>
                      parsedAmount.currency === "KHR"
                        ? formatMoney(money(Math.round(value), "KHR"))
                        : formatMoney(money(Math.round(value * 100), "USD"))
                    }
                    style={[styles.parsedAmount, { color: theme.text }]}
                  />
                ) : (
                  <AppText style={[styles.parsedAmount, { color: theme.text }]}>
                    —
                  </AppText>
                )}
                <AnimatedCue
                  trigger={
                    hasAmount
                      ? `${parsedAmount?.currency}-${parsedAmount?.amountMinor}`
                      : "empty"
                  }
                  distance={4}
                  scale={1}
                >
                  <AppText style={[styles.itemSub, { color: theme.muted }]}>
                    {parsedAmount
                      ? parsedAmount.currency === "KHR"
                        ? `≈ ${usd(parsedAmount.amountMinor / model.rate)}`
                        : `≈ ${khr((parsedAmount.amountMinor / 100) * model.rate)}`
                      : t(model.language, "add.startTyping")}
                  </AppText>
                </AnimatedCue>
              </View>
              <AnimatedCue
                trigger={
                  drafts.transactionKind === "income" ? "income" : parsedCat.key
                }
                distance={4}
              >
                <View
                  style={[
                    styles.bubbleLarge,
                    {
                      backgroundColor:
                        drafts.transactionKind === "income"
                          ? `${theme.green}22`
                          : `${parsedCat.color}22`,
                    },
                  ]}
                >
                  <Glyph
                    name={
                      drafts.transactionKind === "income"
                        ? "account-balance-wallet"
                        : parsedCat.icon
                    }
                    size={27}
                    color={
                      drafts.transactionKind === "income"
                        ? theme.green
                        : parsedCat.color
                    }
                  />
                </View>
              </AnimatedCue>
            </View>
            {drafts.transactionKind === "income" ? (
              <AppText
                style={[styles.itemSub, { color: theme.muted, marginTop: 16 }]}
              >
                {t(model.language, "add.incomeExplainer")}
              </AppText>
            ) : (
              <AppText
                style={[styles.itemSub, { color: theme.muted, marginTop: 16 }]}
              >
                {t(model.language, "add.categoryTap")}
              </AppText>
            )}
          </View>
          <AppText style={[styles.label, { color: theme.muted }]}>
            Quick amount
          </AppText>
          <View style={styles.chipRow}>
            {QUICK_AMOUNT_CHIPS.map((chip) => (
              <TouchableOpacity
                key={chip.label}
                accessibilityRole="button"
                accessibilityLabel={`Use quick amount ${chip.label}`}
                style={[
                  styles.chip,
                  {
                    borderColor: theme.line,
                    backgroundColor:
                      chip.cur === "KHR" ? theme.primaryWash : theme.surface,
                  },
                ]}
                onPress={() => {
                  hapticSelect();
                  setDrafts((current) => {
                    const addText = applyQuickAmountChip(
                      current.addText,
                      chip.text,
                    );
                    return {
                      ...current,
                      addText,
                      selectedCat:
                        current.transactionKind === "income"
                          ? ""
                          : categoryKeyForAddText(addText),
                    };
                  });
                }}
              >
                <AppText
                  style={[
                    styles.chipText,
                    { color: chip.cur === "KHR" ? theme.primary : theme.text },
                  ]}
                >
                  {chip.label}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
          {drafts.transactionKind === "expense" ? (
            <View style={styles.chipRow}>
              {model.categories.map((cat) => {
                const on = drafts.selectedCat === cat.key;
                return (
                  <SelectableChip
                    key={cat.key}
                    icon={cat.icon}
                    label={categoryLabel(cat, model.language)}
                    selected={on}
                    selectedColor={cat.color}
                    textColor="#fff"
                    mutedColor={theme.muted}
                    borderColor={theme.line}
                    surfaceColor={theme.surface}
                    onPress={() => {
                      hapticSelect();
                      setDrafts((current) => ({
                        ...current,
                        selectedCat: cat.key,
                      }));
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          {drafts.transactionKind === "expense" &&
          model.categories.length === 0 ? (
            <EmptyState
              icon="category"
              title={t(model.language, "add.noCategoriesTitle")}
              body={t(model.language, "add.noCategoriesBody")}
              theme={theme}
            />
          ) : null}
          <AppText style={[styles.label, { color: theme.muted }]}>
            {t(model.language, "add.transactionDate")}
          </AppText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: hasValidDate ? theme.line : theme.red,
                color: theme.text,
                fontFamily: FONT.semibold,
                fontSize: 16,
              },
            ]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.faint}
            value={drafts.expenseDate}
            onChangeText={(value) =>
              setDrafts((current) => ({ ...current, expenseDate: value }))
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          {!hasValidDate ? (
            <AppText
              style={[styles.itemSub, { color: theme.red, marginTop: 7 }]}
            >
              {t(model.language, "add.dateFormatHelp", { date: today })}
            </AppText>
          ) : null}
          <AppText style={[styles.label, { color: theme.muted }]}>
            {t(model.language, "add.noteOptional")}
          </AppText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                color: theme.text,
                fontFamily: FONT.semibold,
                fontSize: 16,
              },
            ]}
            placeholder={t(model.language, "add.notePlaceholder")}
            placeholderTextColor={theme.faint}
            value={drafts.addNote}
            onChangeText={(value) =>
              setDrafts((current) => ({ ...current, addNote: value }))
            }
            returnKeyType="done"
          />
        </KeyboardAwareScrollView>
        <View
          style={[
            styles.footer,
            { backgroundColor: theme.page, borderColor: theme.line },
          ]}
        >
          <AnimatedPressable
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel={
              parsedAmount
                ? `${t(model.language, "add.button")} ${drafts.transactionKind === "income" ? t(model.language, "add.income") : formatMoney(parsedAmount)}`
                : t(model.language, "add.title")
            }
            style={[
              styles.button,
              { backgroundColor: theme.primary, opacity: canSave ? 1 : 0.35 },
            ]}
            contentStyle={styles.buttonContent}
            onPress={addExpense}
          >
            <MaterialIcons name="check-circle" size={20} color="#fff" />
            <AppText numberOfLines={1} style={styles.buttonText}>
              {t(model.language, "add.button")}{" "}
              {parsedAmount
                ? drafts.transactionKind === "income"
                  ? `${t(model.language, "add.income")} ${formatMoney(parsedAmount)}`
                  : formatMoney(parsedAmount)
                : ""}
            </AppText>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  function renderCategories() {
    const visibleCategories = model.categories.filter(
      (cat) => cat.budgetUsd > 0,
    );
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {renderTopBar(
          t(model.language, "categories.title"),
          t(model.language, "categories.subtitle"),
        )}
        <View style={styles.grid}>
          {visibleCategories.map((cat) => {
            const spentUsd = categoryMonthSpentUsd(cat.key);
            const pct = Math.round((spentUsd / cat.budgetUsd) * 100);
            const over = spentUsd > cat.budgetUsd;
            const label = categoryLabel(cat, model.language);
            return (
              <TouchableOpacity
                key={cat.key}
                accessibilityRole="button"
                accessibilityLabel={`Open ${label} category`}
                style={[
                  styles.catCard,
                  { backgroundColor: theme.surface, borderColor: theme.line },
                ]}
                onPress={() => {
                  setDrafts((current) => ({
                    ...current,
                    selectedCat: cat.key,
                  }));
                  go("detail");
                }}
              >
                <View style={styles.row}>
                  <View
                    style={[
                      styles.bubble,
                      { backgroundColor: `${cat.color}22` },
                    ]}
                  >
                    <Glyph name={cat.icon} color={cat.color} />
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.faint}
                  />
                </View>
                <AppText
                  style={[
                    styles.itemTitle,
                    { color: theme.text, fontSize: 14, marginTop: 16 },
                  ]}
                >
                  {label}
                </AppText>
                <AppText style={[styles.itemSub, { color: theme.muted }]}>
                  {usd(spentUsd)} / {usd0(cat.budgetUsd)}
                </AppText>
                <Progress
                  label={`${pct}%`}
                  value={usd(spentUsd)}
                  total={usd0(cat.budgetUsd)}
                  pct={cat.budgetUsd > 0 ? spentUsd / cat.budgetUsd : 0}
                  color={over ? theme.red : cat.color}
                  theme={theme}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        {visibleCategories.length === 0 ? (
          <EmptyState
            icon="category"
            title={t(model.language, "categories.emptyTitle")}
            body={t(model.language, "categories.emptyBody")}
            theme={theme}
          />
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t(model.language, "categories.addCategory")}
          style={[styles.dashed, { borderColor: theme.faint }]}
          onPress={() => openCatSheet(null)}
        >
          <MaterialIcons name="add" size={20} color={theme.primary} />
          <AppText
            style={[
              styles.chipText,
              { color: theme.primary, fontFamily: FONT.bold },
            ]}
          >
            {t(model.language, "categories.addCategory")}
          </AppText>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDetail() {
    const txns = monthExpenses.filter(
      (expense) => expense.cat === selectedCategory.key,
    );
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {renderTopBar(
          selectedCategoryLabel,
          undefined,
          "categories",
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Edit ${selectedCategoryLabel} category`}
            style={[
              styles.iconButton,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
            onPress={() => openCatSheet(selectedCategory.key)}
          >
            <MaterialIcons name="edit" size={19} color={theme.muted} />
          </TouchableOpacity>,
        )}
        <View
          style={[
            styles.card,
            styles.row,
            {
              backgroundColor: theme.surface,
              borderColor: theme.line,
              marginBottom: 0,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <AppText
              style={[
                styles.label,
                { color: theme.muted, marginTop: 0, marginBottom: 6 },
              ]}
            >
              {t(model.language, "categories.spentThisMonth")}
            </AppText>
            <AppText
              style={[
                styles.parsedAmount,
                { color: theme.text, fontSize: 32, marginTop: 0 },
              ]}
            >
              {usd(categoryMonthSpentUsd(selectedCategory.key))}
            </AppText>
            <AppText
              style={[styles.itemSub, { color: theme.muted, marginTop: 2 }]}
            >
              of {usd0(selectedCategory.budgetUsd)}{" "}
              {t(model.language, "categories.budgetSuffix")}
            </AppText>
          </View>
          <View
            style={[
              styles.bubbleLarge,
              {
                backgroundColor: `${selectedCategory.color}22`,
                width: 56,
                height: 56,
                borderRadius: 18,
              },
            ]}
          >
            <Glyph
              name={selectedCategory.icon}
              size={30}
              color={selectedCategory.color}
            />
          </View>
        </View>
        <SectionHeader
          title={t(model.language, "categories.transactions")}
          theme={theme}
        />
        {txns.map((expense) => (
          <TouchableOpacity
            key={expense.id}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${expense.name}, ${expense.date}, ${amountLabel(expense.amount, expense.cur)}`}
            style={[styles.expenseRow, { borderColor: theme.line }]}
            onPress={() => openEntrySheet(expense)}
          >
            <View
              style={[
                styles.bubble,
                { backgroundColor: `${selectedCategory.color}22` },
              ]}
            >
              <Glyph
                name={selectedCategory.icon}
                color={selectedCategory.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={[styles.itemName, { color: theme.text }]}>
                {expense.name}
              </AppText>
              <AppText style={[styles.itemSub, { color: theme.muted }]}>
                {expense.date} · {expense.time}
              </AppText>
              {expense.note ? (
                <AppText style={[styles.itemNote, { color: theme.faint }]}>
                  {expense.note}
                </AppText>
              ) : null}
            </View>
            <AppText style={[styles.amount, { color: theme.text }]}>
              {amountLabel(expense.amount, expense.cur)}
            </AppText>
          </TouchableOpacity>
        ))}
        {txns.length === 0 ? (
          <EmptyState
            icon="receipt-long"
            title={t(model.language, "categories.noTransactionsTitle")}
            body={t(model.language, "categories.noTransactionsBody")}
            theme={theme}
          />
        ) : null}
      </ScrollView>
    );
  }

  function renderGoals() {
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEnabled={draggingGoal === null}
      >
        {renderTopBar(
          "Savings goals",
          model.goals.length > 1
            ? "Drag the handle to set priority — top goal shows first."
            : undefined,
          "home",
        )}
        {model.goals.map((goal, index) => {
          const isDragging = draggingGoal === goal.id;
          const pan = PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: () => {
              dragY.setValue(0);
              setDraggingGoal(goal.id);
            },
            onPanResponderMove: (_event, gesture) => dragY.setValue(gesture.dy),
            onPanResponderRelease: (_event, gesture) =>
              finishGoalDrag(index, gesture.dy),
            onPanResponderTerminate: () => setDraggingGoal(null),
          });
          return (
            <Animated.View
              key={goal.id}
              onLayout={(event) => {
                goalHeights[goal.id] = event.nativeEvent.layout.height;
              }}
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: isDragging ? theme.primary : theme.line,
                },
                isDragging && {
                  transform: [{ translateY: dragY }],
                  zIndex: 20,
                  elevation: 10,
                  shadowColor: "#191c3a",
                  shadowOpacity: 0.25,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 12 },
                },
              ]}
            >
              <View
                style={[
                  styles.expenseRow,
                  { borderBottomWidth: 0, paddingVertical: 0 },
                ]}
              >
                {model.goals.length > 1 ? (
                  <View
                    {...pan.panHandlers}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={`Reorder ${goal.name}`}
                    style={{
                      paddingVertical: 8,
                      paddingRight: 6,
                      marginLeft: -4,
                    }}
                  >
                    <MaterialIcons
                      name="drag-indicator"
                      size={22}
                      color={theme.faint}
                    />
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    { backgroundColor: `${theme.primary}1f` },
                  ]}
                >
                  <Glyph name={goal.icon} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[styles.itemTitle, { color: theme.text }]}>
                    {goal.name}
                  </AppText>
                  <AppText style={[styles.itemSub, { color: theme.muted }]}>
                    {amountLabel(goal.perMonth, goal.cur)}/month
                  </AppText>
                  {monthsToGo(goal) ? (
                    <AppText style={[styles.itemSub, { color: theme.muted }]}>
                      {monthsToGo(goal)}
                    </AppText>
                  ) : null}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${goal.name} goal`}
                  onPress={() =>
                    updateModel((current) => ({
                      ...current,
                      goals: current.goals.filter(
                        (item) => item.id !== goal.id,
                      ),
                    }))
                  }
                  style={{ padding: 5, marginLeft: 4 }}
                >
                  <MaterialIcons name="delete" size={20} color={theme.faint} />
                </TouchableOpacity>
              </View>
              <View style={[styles.row, { marginTop: 14, marginBottom: 7 }]}>
                <AppText
                  style={[
                    styles.parsedAmount,
                    { color: theme.text, fontSize: 18, marginTop: 0 },
                  ]}
                >
                  {amountLabel(goal.saved, goal.cur)}
                </AppText>
                <AppText style={[styles.itemSub, { color: theme.muted }]}>
                  of {amountLabel(goal.target, goal.cur)} ·{" "}
                  {Math.round((goal.saved / goal.target) * 100)}%
                </AppText>
              </View>
              <View style={[styles.track, { backgroundColor: theme.surface2 }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`,
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              </View>
              {goal.saved < goal.target && goal.perMonth > 0 ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${amountLabel(goal.perMonth, goal.cur)} to ${goal.name}`}
                  style={[styles.sweep, { backgroundColor: theme.primaryWash }]}
                  onPress={() => addGoalContribution(goal.id)}
                >
                  <MaterialIcons
                    name="savings"
                    size={18}
                    color={theme.primary}
                  />
                  <AppText
                    style={[
                      styles.chipText,
                      { color: theme.primary, fontFamily: FONT.bold },
                    ]}
                  >
                    Add {amountLabel(goal.perMonth, goal.cur)} this month
                  </AppText>
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.goalBadge,
                    { backgroundColor: `${theme.green}1f` },
                  ]}
                >
                  <MaterialIcons
                    name="celebration"
                    size={18}
                    color={theme.green}
                  />
                  <AppText
                    style={[
                      styles.chipText,
                      { color: theme.green, fontFamily: FONT.bold },
                    ]}
                  >
                    Goal reached
                  </AppText>
                </View>
              )}
            </Animated.View>
          );
        })}
        {model.goals.length === 0 ? (
          <EmptyState
            icon="flag"
            title="Start a savings goal"
            body="Create the first thing you want your money to move toward."
            theme={theme}
          />
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="New goal"
          style={[styles.dashed, { borderColor: theme.faint }]}
          onPress={() => setSheet("goal")}
        >
          <MaterialIcons name="add" size={20} color={theme.primary} />
          <AppText
            style={[
              styles.chipText,
              { color: theme.primary, fontFamily: FONT.bold },
            ]}
          >
            New goal
          </AppText>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderInsights() {
    const dailyBudget = budget.dailyBudgetUsd.amountMinor / 100;
    const weekItems = cycleHistoryItems.slice(-7);
    const week = weekItems.map((item) => item.value);
    const weekLabels = weekItems.map((item) =>
      new Date(`${item.date}T00:00:00`)
        .toLocaleDateString("en-US", { weekday: "short" })
        .slice(0, 1),
    );
    const chartH = 120;
    const labelOffset = 20;
    const maxVal = Math.max(dailyBudget, ...week, 1) * 1.15;
    const budgetBottom = labelOffset + (dailyBudget / maxVal) * chartH;
    const heatGap = 5;
    // Floor so 7 cells + 6 gaps never exceed the measured row width (subpixel
    // overflow made the grid wrap at 6 columns); space-between absorbs the slack.
    const heatSize =
      heatWidth > 0 ? Math.floor((heatWidth - heatGap * 6) / 7) : 0;
    const heatRows = Array.from(
      { length: Math.ceil(heatmap.length / 7) },
      (_item, row) => heatmap.slice(row * 7, row * 7 + 7),
    );
    const { spentMost, savedMost } = bestAndWorst(chartHistory, dailyBudget);
    const dayLabel = (index: number) => {
      const date = cycleHistoryItems[index]?.date;
      return date
        ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
            weekday: "short",
          })
        : "Day";
    };
    const topCategory = model.categories
      .map((category) => ({
        category,
        spentUsd: categoryMonthSpentUsd(category.key),
      }))
      .sort((a, b) => b.spentUsd - a.spentUsd)[0];
    const insightTip =
      topCategory && topCategory.spentUsd > 0
        ? `${topCategory.category.label} is your top spend this budget cycle. Small cuts there will move your savings fastest.`
        : "Add expenses today to see category-specific savings tips.";
    const exportMonths = [0, -1, -2].map((delta) =>
      shiftIsoMonth(thisMonth, delta),
    );
    const insightDays = new Set(
      monthTransactions.map((expense) => expense.date),
    ).size;
    const hasInsightData = insightDays > 0;
    const hasEnoughInsightData = insightDays >= 3;
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {renderTopBar("Insights", "Your end-of-day summary, all in one place.")}
        {!hasInsightData ? (
          <AnimatedCue trigger="insights-empty">
            <EmptyState
              icon="receipt-long"
              title="No spending recorded yet"
              body="Record your first expense to see daily budget and savings insights."
              theme={theme}
            />
          </AnimatedCue>
        ) : null}
        {hasInsightData ? (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor:
                  budget.status === "over" ? theme.red : theme.green,
              },
            ]}
          >
            <View style={styles.statusPill}>
              <MaterialIcons name="schedule" size={15} color="#fff" />
              <AppText style={styles.statusPillText}>
                End of day · today
              </AppText>
            </View>
            <AppText style={styles.statusHeadline}>
              {budget.status === "over"
                ? "A little over today — tomorrow adjusts for you."
                : "You're under budget today — nice work."}
            </AppText>
            <View style={styles.statRow}>
              <Stat
                label="Spent today"
                value={formatMoney(budget.spentTodayUsd)}
              />
              <Stat
                label="Saved today"
                value={formatMoney(
                  money(Math.max(budget.leftTodayUsd.amountMinor, 0), "USD"),
                )}
              />
            </View>
            <View style={styles.tip}>
              <MaterialIcons name="lightbulb" size={20} color="#fff" />
              <AppText style={styles.tipText}>{insightTip}</AppText>
            </View>
          </View>
        ) : null}
        {hasInsightData ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.line },
            ]}
          >
            <View style={[styles.row, { marginBottom: 14 }]}>
              <AppText
                style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
              >
                Rolling 7 days
              </AppText>
              <View
                style={[styles.duePill, { backgroundColor: theme.surface2 }]}
              >
                <AppText style={[styles.duePillText, { color: theme.muted }]}>
                  Inside current cycle
                </AppText>
              </View>
            </View>
            <View style={{ position: "relative" }}>
              <View style={[styles.chart, { height: chartH + labelOffset }]}>
                {week.map((value, index) => (
                  <TouchableOpacity
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`${weekLabels[index]}, ${usd(value)} spent`}
                    activeOpacity={0.7}
                    style={styles.barCol}
                    onPress={() =>
                      showToast(`${weekLabels[index]} · ${usd(value)}`)
                    }
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(6, (value / maxVal) * chartH),
                          backgroundColor:
                            value > dailyBudget ? theme.amber : theme.primary,
                        },
                      ]}
                    />
                    <AppText style={[styles.barDay, { color: theme.muted }]}>
                      {weekLabels[index]}
                    </AppText>
                  </TouchableOpacity>
                ))}
              </View>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: budgetBottom,
                  borderTopWidth: 2,
                  borderStyle: "dashed",
                  borderColor: theme.faint,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: budgetBottom - 8,
                }}
              >
                <AppText
                  style={{
                    fontFamily: FONT.bold,
                    fontSize: 10,
                    color: theme.faint,
                    backgroundColor: theme.surface,
                    paddingHorizontal: 4,
                  }}
                >
                  budget
                </AppText>
              </View>
            </View>
          </View>
        ) : null}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}
        >
          <View style={[styles.row, { marginBottom: 12 }]}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              Spending activity
            </AppText>
            <View style={[styles.duePill, { backgroundColor: theme.surface2 }]}>
              <AppText style={[styles.duePillText, { color: theme.muted }]}>
                {hasEnoughInsightData
                  ? "current cycle"
                  : `${insightDays} of 3 cycle days`}
              </AppText>
            </View>
          </View>
          {!hasInsightData ? (
            <EmptyState
              icon="edit-note"
              title="Start recording"
              body="No heatmap yet. Your real spending days will appear here."
              theme={theme}
            />
          ) : !hasEnoughInsightData ? (
            <AnimatedCue trigger={`low-${insightDays}`}>
              <EmptyState
                icon="insights"
                title="Keep tracking"
                body={`${insightDays} of 3 days recorded. A few more days makes these patterns useful.`}
                theme={theme}
              />
            </AnimatedCue>
          ) : (
            <>
              <View
                onLayout={(event) =>
                  setHeatWidth(event.nativeEvent.layout.width)
                }
              >
                {heatSize > 0
                  ? heatRows.map((row, rowIndex) => (
                      <View
                        key={rowIndex}
                        style={{
                          flexDirection: "row",
                          justifyContent:
                            row.length === 7 ? "space-between" : "flex-start",
                          gap: row.length === 7 ? 0 : heatGap,
                          marginTop: rowIndex === 0 ? 0 : heatGap,
                        }}
                      >
                        {row.map((cell) => (
                          <TouchableOpacity
                            key={cell.index}
                            accessibilityRole="button"
                            accessibilityLabel={`Open spending for ${dayLabel(cell.index)}, ${cell.status}`}
                            style={{
                              width: heatSize,
                              height: heatSize,
                              borderRadius: 5,
                              backgroundColor: heatColor(cell.status, theme),
                            }}
                            onPress={() => {
                              setDrafts((current) => ({
                                ...current,
                                selectedDay: cell.index,
                              }));
                              setSheet("day");
                            }}
                          />
                        ))}
                      </View>
                    ))
                  : null}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 6,
                  marginTop: 12,
                }}
              >
                <AppText style={[styles.itemSub, { color: theme.muted }]}>
                  saved
                </AppText>
                {[
                  theme.heat.savedHigh,
                  theme.heat.near,
                  theme.heat.over,
                  theme.heat.overHigh,
                ].map((c) => (
                  <View
                    key={c}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 4,
                      backgroundColor: c,
                    }}
                  />
                ))}
                <AppText style={[styles.itemSub, { color: theme.muted }]}>
                  over
                </AppText>
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                <View
                  style={[styles.statMini, { backgroundColor: theme.surface2 }]}
                >
                  <AppText
                    style={[
                      styles.label,
                      {
                        color: theme.muted,
                        marginTop: 0,
                        marginBottom: 4,
                        fontSize: 11,
                      },
                    ]}
                  >
                    Spent most
                  </AppText>
                  <AppText
                    style={[
                      styles.amount,
                      { color: theme.text, textAlign: "left" },
                    ]}
                  >
                    {spentMost >= 0
                      ? `${dayLabel(spentMost)} · ${usd(chartHistory[spentMost])}`
                      : "—"}
                  </AppText>
                </View>
                <View
                  style={[styles.statMini, { backgroundColor: theme.surface2 }]}
                >
                  <AppText
                    style={[
                      styles.label,
                      {
                        color: theme.muted,
                        marginTop: 0,
                        marginBottom: 4,
                        fontSize: 11,
                      },
                    ]}
                  >
                    Best saving day
                  </AppText>
                  <AppText
                    style={[
                      styles.amount,
                      { color: theme.text, textAlign: "left" },
                    ]}
                  >
                    {savedMost >= 0
                      ? `${dayLabel(savedMost)} · ${usd(chartHistory[savedMost])}`
                      : "—"}
                  </AppText>
                </View>
              </View>
            </>
          )}
        </View>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}
        >
          <AppText
            style={[
              styles.itemTitle,
              { color: theme.text, fontSize: 14, marginBottom: 12 },
            ]}
          >
            Export data
          </AppText>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Choose export month, currently ${monthLabel(exportMonth)}`}
              accessibilityState={{ expanded: exportOpen }}
              style={[
                styles.input,
                {
                  flex: 1,
                  paddingVertical: 13,
                  backgroundColor: theme.surface,
                  borderColor: theme.line,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                },
              ]}
              onPress={() => setExportOpen((open) => !open)}
            >
              <AppText
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 14,
                  color: theme.text,
                }}
              >
                {monthLabel(exportMonth)}
              </AppText>
              <MaterialIcons name="expand-more" size={20} color={theme.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Export CSV"
              style={[
                styles.button,
                {
                  backgroundColor: theme.primary,
                  minHeight: 48,
                  paddingHorizontal: 20,
                },
              ]}
              onPress={exportCsv}
            >
              <MaterialIcons name="download" size={18} color="#fff" />
              <AppText style={styles.buttonText}>CSV</AppText>
            </TouchableOpacity>
          </View>
          {exportOpen ? (
            <View
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: theme.line,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {exportMonths.map((month) => (
                <TouchableOpacity
                  key={month}
                  accessibilityRole="button"
                  accessibilityLabel={`Export ${monthLabel(month)}`}
                  accessibilityState={{ selected: month === exportMonth }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    backgroundColor:
                      month === exportMonth ? theme.primaryWash : theme.surface,
                  }}
                  onPress={() => {
                    setExportMonth(month);
                    setExportOpen(false);
                  }}
                >
                  <AppText
                    style={{
                      fontFamily: FONT.semibold,
                      fontSize: 14,
                      color: month === exportMonth ? theme.primary : theme.text,
                    }}
                  >
                    {monthLabel(month)}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  function renderSettings() {
    const rateCheckLabel = model.exchangeRateLastFetchedDay
      ? `Last checked ${model.exchangeRateLastFetchedDay}`
      : "Checks when the app opens";
    const nextLanguage = model.language === "en" ? "km" : "en";
    const rows: readonly [string, string, Sheet | "categories", IconName][] = [
      [
        t(model.language, "settings.monthlyIncome"),
        `${amountLabel(model.salary, model.salaryCur)} / month`,
        "income",
        "account-balance-wallet",
      ],
      [
        t(model.language, "settings.rentUtilities"),
        model.rent + model.utilities > 0
          ? `${usd(model.rent + model.utilities)} · due ${ordinal(model.rentDue)}`
          : t(model.language, "settings.notSet"),
        "fixed",
        "receipt-long",
      ],
      [
        t(model.language, "settings.loanRepayment"),
        model.loan > 0
          ? `${usd(model.loan)} · due ${ordinal(model.loanDue)}`
          : t(model.language, "settings.noLoan"),
        "loan",
        "savings",
      ],
      [
        t(model.language, "settings.budgetingMethod"),
        model.method === "balanced"
          ? "Balanced (50/30/20)"
          : model.method === "saver"
            ? "Saver (40/30/30)"
            : `Custom (${model.custom.needs}/${model.custom.wants}/${model.custom.save})`,
        "method",
        "pie-chart",
      ],
      [
        "Budget cycle",
        `Starts ${ordinal(model.budgetCycleStartDay)} · ${budgetCycleLabel}`,
        "cycle",
        "calendar-month",
      ],
      [
        t(model.language, "settings.currencies"),
        `Auto daily USD/KHR · $1 = ${khr(model.rate)}\n${rateCheckLabel}`,
        "currency",
        "currency-exchange",
      ],
      [
        t(model.language, "settings.categories"),
        t(model.language, "settings.categoriesCount", {
          count: model.categories.length,
        }),
        "categories",
        "grid-view",
      ],
      [
        "Recurring payments",
        model.recurringPayments.length > 0
          ? `${model.recurringPayments.length} saved`
          : "Subscriptions and other monthly payments",
        "recurring",
        "subscriptions",
      ],
      [
        t(model.language, "settings.dailyReminder"),
        formatClock(model.notify),
        "reminder",
        "schedule",
      ],
    ];
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {renderTopBar(
          t(model.language, "settings.title"),
          t(model.language, "settings.subtitle"),
        )}
        {rows.map((row) => (
          <TouchableOpacity
            key={row[0]}
            accessibilityRole="button"
            accessibilityLabel={`${row[0]}, ${row[1]}`}
            style={[styles.settingsRow, { borderColor: theme.line }]}
            onPress={() =>
              row[2] === "categories" ? go("categories") : setSheet(row[2])
            }
          >
            <View
              style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
            >
              <MaterialIcons name={row[3]} size={21} color={theme.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText
                style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
              >
                {row[0]}
              </AppText>
              <AppText
                style={[styles.itemSub, { color: theme.muted, lineHeight: 18 }]}
              >
                {row[1]}
              </AppText>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.faint} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${t(model.language, "settings.language")}, ${LANGUAGE_LABELS[model.language]}`}
          style={[styles.settingsRow, { borderColor: theme.line }]}
          onPress={() =>
            updateModel((current) => ({
              ...current,
              language: current.language === "en" ? "km" : "en",
            }))
          }
        >
          <View
            style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
          >
            <MaterialIcons name="language" size={21} color={theme.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              {t(model.language, "settings.language")}
            </AppText>
            <AppText style={[styles.itemSub, { color: theme.muted }]}>
              {LANGUAGE_LABELS[model.language]} ·{" "}
              {t(model.language, "settings.languageDetail")}
            </AppText>
          </View>
          <AppText
            style={[
              styles.itemSub,
              { color: theme.primary, fontFamily: FONT.bold },
            ]}
          >
            {LANGUAGE_LABELS[nextLanguage]}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityLabel={t(model.language, "settings.billReminders")}
          accessibilityState={{ checked: model.billReminders }}
          style={[styles.settingsRow, { borderColor: theme.line }]}
          onPress={() =>
            updateModel((current) => ({
              ...current,
              billReminders: !current.billReminders,
            }))
          }
        >
          <View
            style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
          >
            <MaterialIcons name="notifications" size={21} color={theme.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              {t(model.language, "settings.billReminders")}
            </AppText>
            <AppText style={[styles.itemSub, { color: theme.muted }]}>
              {model.billReminders
                ? t(model.language, "settings.on")
                : t(model.language, "settings.off")}
            </AppText>
          </View>
          <MaterialIcons
            name={model.billReminders ? "toggle-on" : "toggle-off"}
            size={30}
            color={model.billReminders ? theme.primary : theme.faint}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityLabel="Dark mode"
          accessibilityState={{ checked: model.dark }}
          style={[styles.settingsRow, { borderColor: theme.line }]}
          onPress={() =>
            updateModel((current) => ({ ...current, dark: !current.dark }))
          }
        >
          <View
            style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
          >
            <MaterialIcons
              name={model.dark ? "dark-mode" : "light-mode"}
              size={21}
              color={theme.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              {t(model.language, "settings.appearance")}
            </AppText>
            <AppText style={[styles.itemSub, { color: theme.muted }]}>
              {model.dark
                ? t(model.language, "settings.darkMode")
                : t(model.language, "settings.lightMode")}
            </AppText>
          </View>
          <MaterialIcons
            name={model.dark ? "toggle-on" : "toggle-off"}
            size={30}
            color={model.dark ? theme.primary : theme.faint}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t(model.language, "settings.exportJsonBackup")}
          style={[styles.settingsRow, { borderColor: theme.line }]}
          onPress={exportJsonBackup}
        >
          <View
            style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
          >
            <MaterialIcons name="file-download" size={21} color={theme.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              {t(model.language, "settings.exportJsonBackup")}
            </AppText>
            <AppText style={[styles.itemSub, { color: theme.muted }]}>
              {t(model.language, "settings.exportDescription")}
            </AppText>
          </View>
          <MaterialIcons name="ios-share" size={22} color={theme.faint} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t(model.language, "settings.importJsonBackup")}
          style={[styles.settingsRow, { borderColor: theme.line }]}
          onPress={importJsonBackup}
        >
          <View
            style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
          >
            <MaterialIcons name="file-upload" size={21} color={theme.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              {t(model.language, "settings.importJsonBackup")}
            </AppText>
            <AppText style={[styles.itemSub, { color: theme.muted }]}>
              {t(model.language, "settings.importDescription")}
            </AppText>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.faint} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Import ABA statement"
          style={[styles.settingsRow, { borderColor: theme.line }]}
          onPress={importAbaStatement}
        >
          <View
            style={[styles.settingsIcon, { backgroundColor: theme.surface2 }]}
          >
            <MaterialIcons
              name="account-balance"
              size={21}
              color={theme.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText
              style={[styles.itemTitle, { color: theme.text, fontSize: 14 }]}
            >
              Import ABA statement
            </AppText>
            <AppText style={[styles.itemSub, { color: theme.muted }]}>
              Add transactions from ABA CSV or Excel export
            </AppText>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={theme.faint} />
        </TouchableOpacity>
        <View
          style={{ alignItems: "center", marginTop: 32, gap: 6, opacity: 0.7 }}
        >
          <View style={styles.brandRow}>
            <Image
              source={require("./assets/luy-khnom-favicon-flat.png")}
              style={styles.footerLogoImage}
              resizeMode="contain"
            />
            <AppText
              style={[styles.brandName, { color: theme.text, fontSize: 14 }]}
            >
              Luy Khnom
            </AppText>
          </View>
          <AppText style={[styles.itemSub, { color: theme.muted }]}>
            {t(model.language, "app.version")}
          </AppText>
        </View>
      </ScrollView>
    );
  }

  function renderSheet() {
    return (
      <Modal
        visible={sheet !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setSheet(null)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <Pressable style={styles.scrim} onPress={() => setSheet(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.page }]}>
              <View style={[styles.grab, { backgroundColor: theme.faint }]} />
              <View style={[styles.headerRow, { marginBottom: 4 }]}>
                <AppText style={[styles.sheetTitle, { color: theme.text }]}>
                  {sheet === "category" && drafts.categoryEditKey
                    ? "Edit category"
                    : sheetTitle(sheet)}
                </AppText>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close sheet"
                  style={[
                    styles.iconButton,
                    { backgroundColor: theme.surface, borderColor: theme.line },
                  ]}
                  onPress={() => setSheet(null)}
                >
                  <MaterialIcons name="close" size={20} color={theme.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={
                  Platform.OS === "ios" ? "interactive" : "none"
                }
                contentContainerStyle={{
                  paddingBottom:
                    sheet === "category"
                      ? 36
                      : sheet === "month" || sheet === "day"
                        ? 44
                        : 8,
                }}
              >
                {sheet === "income" ? (
                  <View>
                    <SheetInput
                      label="Monthly salary"
                      value={String(model.salary)}
                      theme={theme}
                      onChange={(value) =>
                        updateModel((current) => ({
                          ...current,
                          salary: Number(value) || 0,
                        }))
                      }
                    />
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 7 },
                      ]}
                    >
                      {model.salaryCur === "KHR"
                        ? `≈ ${usd(model.salary / model.rate)}`
                        : `≈ ${khr(model.salary * model.rate)}`}
                    </AppText>
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Currency
                    </AppText>
                    <View
                      style={[
                        styles.segment,
                        { backgroundColor: theme.surface2 },
                      ]}
                    >
                      {(["USD", "KHR"] as Currency[]).map((cur) => (
                        <TouchableOpacity
                          key={cur}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${cur === "USD" ? "US dollars" : "Khmer riel"} for salary`}
                          accessibilityState={{
                            selected: model.salaryCur === cur,
                          }}
                          style={[
                            styles.segmentButton,
                            model.salaryCur === cur && {
                              backgroundColor: theme.surface,
                              ...CARD_SHADOW,
                            },
                          ]}
                          onPress={() =>
                            updateModel((current) => ({
                              ...current,
                              salaryCur: cur,
                            }))
                          }
                        >
                          {renderCurrencySegmentLabel(
                            cur,
                            model.salaryCur === cur,
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
                {sheet === "fixed" ? (
                  <View>
                    <MoneyField
                      label="Rent"
                      initialAmount={model.rent}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        updateModel((current) => ({ ...current, rent: value }))
                      }
                    />
                    <MoneyField
                      label="Utilities (monthly avg)"
                      initialAmount={model.utilities}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        updateModel((current) => ({
                          ...current,
                          utilities: value,
                        }))
                      }
                    />
                    <DueDayPicker
                      label="Both due each month"
                      value={model.rentDue}
                      theme={theme}
                      onChange={(day) =>
                        updateModel((current) => ({ ...current, rentDue: day }))
                      }
                    />
                  </View>
                ) : null}
                {sheet === "loan" ? (
                  <View>
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Loan
                    </AppText>
                    <View
                      style={[
                        styles.segment,
                        { backgroundColor: theme.surface2 },
                      ]}
                    >
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="No loan"
                        accessibilityState={{ selected: model.loan <= 0 }}
                        style={[
                          styles.segmentButton,
                          model.loan <= 0 && {
                            backgroundColor: theme.surface,
                            ...CARD_SHADOW,
                          },
                        ]}
                        onPress={() =>
                          updateModel((current) => ({
                            ...current,
                            loan: 0,
                            paidBills: { ...current.paidBills, loan: true },
                          }))
                        }
                      >
                        <AppText
                          style={[
                            styles.segmentText,
                            {
                              color: model.loan <= 0 ? theme.text : theme.muted,
                            },
                          ]}
                        >
                          No loan
                        </AppText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="I have a loan"
                        accessibilityState={{ selected: model.loan > 0 }}
                        style={[
                          styles.segmentButton,
                          model.loan > 0 && {
                            backgroundColor: theme.surface,
                            ...CARD_SHADOW,
                          },
                        ]}
                        onPress={() =>
                          updateModel((current) => ({
                            ...current,
                            loan: current.loan > 0 ? current.loan : 50,
                            paidBills: { ...current.paidBills, loan: false },
                          }))
                        }
                      >
                        <AppText
                          style={[
                            styles.segmentText,
                            {
                              color: model.loan > 0 ? theme.text : theme.muted,
                            },
                          ]}
                        >
                          I have a loan
                        </AppText>
                      </TouchableOpacity>
                    </View>
                    {model.loan > 0 ? (
                      <>
                        <MoneyField
                          label="Monthly repayment"
                          initialAmount={model.loan}
                          rate={model.rate}
                          theme={theme}
                          onChange={(value) =>
                            updateModel((current) => ({
                              ...current,
                              loan: value,
                            }))
                          }
                        />
                        <DueDayPicker
                          label="Due each month"
                          value={model.loanDue}
                          theme={theme}
                          onChange={(day) =>
                            updateModel((current) => ({
                              ...current,
                              loanDue: day,
                            }))
                          }
                        />
                      </>
                    ) : (
                      <AppText style={[styles.help, { color: theme.muted }]}>
                        No loan payment will show in Coming up.
                      </AppText>
                    )}
                  </View>
                ) : null}
                {sheet === "method" ? (
                  <BudgetMethodPicker
                    method={model.method}
                    custom={model.custom}
                    theme={theme}
                    onSelect={(mode) =>
                      updateModel((current) => ({ ...current, method: mode }))
                    }
                    onCustomChange={(part, value) =>
                      updateModel((current) => ({
                        ...current,
                        custom: { ...current.custom, [part]: value },
                      }))
                    }
                  />
                ) : null}
                {sheet === "cycle" ? (
                  <View>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 8, lineHeight: 21 },
                      ]}
                    >
                      Start the monthly budget on payday instead of the 1st.
                    </AppText>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      For a salary paid on the 5th, choose day 5.
                    </AppText>
                    <DueDayPicker
                      label="Cycle starts each month"
                      value={model.budgetCycleStartDay}
                      theme={theme}
                      onChange={(day) =>
                        updateModel((current) => ({
                          ...current,
                          budgetCycleStartDay: day,
                          lastActiveMonth: budgetCycleKeyForDay(today, day),
                        }))
                      }
                    />
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      Current cycle: {budgetCycleLabel}.
                    </AppText>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      Income, spending, days left, and category totals use this
                      range.
                    </AppText>
                  </View>
                ) : null}
                {sheet === "currency" ? (
                  <View>
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Base currency — used for the home budget display
                    </AppText>
                    <View
                      style={[
                        styles.segment,
                        { backgroundColor: theme.surface2 },
                      ]}
                    >
                      {(["USD", "KHR"] as Currency[]).map((cur) => (
                        <TouchableOpacity
                          key={cur}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${cur === "USD" ? "US dollars" : "Khmer riel"} as base currency`}
                          accessibilityState={{
                            selected: model.baseCur === cur,
                          }}
                          style={[
                            styles.segmentButton,
                            model.baseCur === cur && {
                              backgroundColor: theme.surface,
                              ...CARD_SHADOW,
                            },
                          ]}
                          onPress={() =>
                            updateModel((current) => ({
                              ...current,
                              baseCur: cur,
                            }))
                          }
                        >
                          {renderCurrencySegmentLabel(
                            cur,
                            model.baseCur === cur,
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <SheetInput
                      label="Conversion rate — KHR per $1"
                      value={String(model.rate)}
                      theme={theme}
                      onChange={(value) =>
                        updateModel((current) => {
                          const nextRate = Number(value);
                          return {
                            ...current,
                            rate:
                              Number.isFinite(nextRate) && nextRate > 0
                                ? round2(nextRate)
                                : RATE,
                            exchangeRateSource: "Manual override",
                          };
                        })
                      }
                    />
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      Auto-checks once per day from{" "}
                      {USD_TO_KHR_RATE_SOURCE.name}.
                    </AppText>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      If you’re offline or the data is missing, Luy Khnom keeps
                      this value.
                    </AppText>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 8, lineHeight: 21 },
                      ]}
                    >
                      {model.exchangeRateLastFetchedDay
                        ? `Last checked ${model.exchangeRateLastFetchedDay}`
                        : "Not checked yet"}
                      {"\n"}Current source:{" "}
                      {model.exchangeRateSource === USD_TO_KHR_RATE_SOURCE.name
                        ? "Rates from Exchange Rate."
                        : `${model.exchangeRateSource}.`}
                    </AppText>
                  </View>
                ) : null}
                {sheet === "reminder" ? (
                  <ReminderTimePicker
                    value={model.notify}
                    theme={theme}
                    open={timePickerOpen}
                    onOpenChange={setTimePickerOpen}
                    onChange={(value) =>
                      updateModel((current) => ({ ...current, notify: value }))
                    }
                    onPreview={previewNotification}
                  />
                ) : null}
                {sheet === "category" ? (
                  <View>
                    <View
                      style={[styles.headerRow, { marginTop: 14, gap: 12 }]}
                    >
                      <View
                        style={[
                          styles.bubbleLarge,
                          { backgroundColor: `${drafts.categoryColor}22` },
                        ]}
                      >
                        <Glyph
                          name={drafts.categoryIcon}
                          size={27}
                          color={drafts.categoryColor}
                        />
                      </View>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            flex: 1,
                            fontSize: 18,
                            backgroundColor: theme.surface,
                            borderColor: theme.line,
                            color: theme.text,
                          },
                        ]}
                        placeholder="Category name"
                        placeholderTextColor={theme.faint}
                        value={drafts.categoryName}
                        onChangeText={(value) =>
                          setDrafts((current) => ({
                            ...current,
                            categoryName: value,
                          }))
                        }
                      />
                    </View>
                    <MoneyField
                      label="Monthly budget"
                      initialAmount={Number(drafts.categoryBudget) || 0}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          categoryBudget: value ? String(value) : "",
                        }))
                      }
                    />
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Icon
                    </AppText>
                    <View style={styles.iconGrid}>
                      {ICON_SET.map((ic) => {
                        const on = drafts.categoryIcon === ic;
                        return (
                          <TouchableOpacity
                            key={ic}
                            accessibilityRole="button"
                            accessibilityLabel={`Choose ${ic} icon`}
                            accessibilityState={{ selected: on }}
                            style={[
                              styles.iconPick,
                              {
                                borderColor: on
                                  ? drafts.categoryColor
                                  : theme.line,
                                backgroundColor: on
                                  ? `${drafts.categoryColor}22`
                                  : theme.surface,
                              },
                            ]}
                            onPress={() =>
                              setDrafts((current) => ({
                                ...current,
                                categoryIcon: ic,
                              }))
                            }
                          >
                            <Glyph
                              name={ic}
                              size={22}
                              color={on ? drafts.categoryColor : theme.muted}
                            />
                          </TouchableOpacity>
                        );
                      })}
                      {Array.from({
                        length: (6 - (ICON_SET.length % 6)) % 6,
                      }).map((_, index) => (
                        <View
                          key={`icon-spacer-${index}`}
                          style={styles.iconPickSpacer}
                        />
                      ))}
                    </View>
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Color
                    </AppText>
                    <View style={styles.colorGrid}>
                      {PALETTE.map((color) => (
                        <TouchableOpacity
                          key={color}
                          accessibilityRole="button"
                          accessibilityLabel={`Choose color ${color}`}
                          accessibilityState={{
                            selected: drafts.categoryColor === color,
                          }}
                          style={[
                            styles.swatch,
                            {
                              backgroundColor: color,
                              borderColor:
                                drafts.categoryColor === color
                                  ? theme.text
                                  : "transparent",
                            },
                          ]}
                          onPress={() =>
                            setDrafts((current) => ({
                              ...current,
                              categoryColor: color,
                            }))
                          }
                        />
                      ))}
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        drafts.categoryEditKey
                          ? "Save category changes"
                          : "Add category"
                      }
                      style={[
                        styles.button,
                        { backgroundColor: theme.primary, marginTop: 22 },
                      ]}
                      onPress={saveCategory}
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#fff"
                      />
                      <AppText style={styles.buttonText}>
                        {drafts.categoryEditKey
                          ? "Save changes"
                          : "Add category"}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {sheet === "entry" && selectedExpense ? (
                  <View>
                    <AppText
                      style={[
                        styles.label,
                        { color: theme.muted, marginTop: 10 },
                      ]}
                    >
                      Record as
                    </AppText>
                    <View
                      style={[
                        styles.segment,
                        { backgroundColor: theme.surface2 },
                      ]}
                    >
                      {(["expense", "income"] as const).map((kind) => (
                        <TouchableOpacity
                          key={kind}
                          accessibilityRole="button"
                          accessibilityLabel={
                            kind === "expense"
                              ? "Record as outcome"
                              : "Record as income"
                          }
                          accessibilityState={{
                            selected: drafts.transactionKind === kind,
                          }}
                          style={[
                            styles.segmentButton,
                            drafts.transactionKind === kind && {
                              backgroundColor: theme.surface,
                              ...CARD_SHADOW,
                            },
                          ]}
                          onPress={() => {
                            hapticSelect();
                            setDrafts((current) => ({
                              ...current,
                              transactionKind: kind,
                              selectedCat:
                                kind === "income" ? "" : current.selectedCat,
                            }));
                          }}
                        >
                          <AppText
                            style={[
                              styles.segmentText,
                              {
                                color:
                                  drafts.transactionKind === kind
                                    ? theme.text
                                    : theme.muted,
                              },
                            ]}
                          >
                            {kind === "expense" ? "Outcome" : "Income"}
                          </AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <MoneyField
                      label="Amount"
                      initialAmount={Number(drafts.iouAmount) || 0}
                      initialCur={drafts.entryCur}
                      rate={model.rate}
                      theme={theme}
                      onChange={(_usd, amount, cur) =>
                        setDrafts((current) => ({
                          ...current,
                          iouAmount: amount ? String(amount) : "",
                          entryCur: cur,
                        }))
                      }
                    />
                    <SheetInput
                      label="Transaction date (YYYY-MM-DD)"
                      value={drafts.expenseDate}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          expenseDate: value,
                        }))
                      }
                    />
                    {!isIsoDay(drafts.expenseDate.trim()) ? (
                      <AppText
                        style={[
                          styles.itemSub,
                          { color: theme.red, marginTop: 7 },
                        ]}
                      >
                        Use YYYY-MM-DD, for example {today}.
                      </AppText>
                    ) : null}
                    <SheetInput
                      label="Remark (optional)"
                      value={drafts.addNote}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({ ...current, addNote: value }))
                      }
                    />
                    {drafts.transactionKind === "expense" ? (
                      <>
                        <AppText style={[styles.label, { color: theme.muted }]}>
                          Category
                        </AppText>
                        <View style={styles.chipRow}>
                          {model.categories.map((cat) => {
                            const on = drafts.selectedCat === cat.key;
                            return (
                              <TouchableOpacity
                                key={cat.key}
                                accessibilityRole="button"
                                accessibilityLabel={`Select ${cat.label} category`}
                                accessibilityState={{ selected: on }}
                                style={[
                                  styles.chip,
                                  {
                                    borderColor: on ? cat.color : theme.line,
                                    backgroundColor: on
                                      ? cat.color
                                      : theme.surface,
                                  },
                                ]}
                                onPress={() =>
                                  setDrafts((current) => ({
                                    ...current,
                                    selectedCat: cat.key,
                                  }))
                                }
                              >
                                <Glyph
                                  name={cat.icon}
                                  size={18}
                                  color={on ? "#fff" : cat.color}
                                />
                                <AppText
                                  style={[
                                    styles.chipText,
                                    { color: on ? "#fff" : theme.muted },
                                  ]}
                                >
                                  {cat.label}
                                </AppText>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    ) : (
                      <AppText
                        style={[
                          styles.itemSub,
                          { color: theme.muted, marginTop: 12 },
                        ]}
                      >
                        Income is kept in transactions and added to this month’s
                        available budget.
                      </AppText>
                    )}
                    <TouchableOpacity
                      disabled={!isIsoDay(drafts.expenseDate.trim())}
                      accessibilityRole="button"
                      accessibilityLabel="Save entry"
                      accessibilityState={{
                        disabled: !isIsoDay(drafts.expenseDate.trim()),
                      }}
                      style={[
                        styles.button,
                        {
                          backgroundColor: theme.primary,
                          opacity: isIsoDay(drafts.expenseDate.trim())
                            ? 1
                            : 0.35,
                          marginTop: 22,
                        },
                      ]}
                      onPress={saveEntry}
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#fff"
                      />
                      <AppText style={styles.buttonText}>Save entry</AppText>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {sheet === "iou" ? (
                  <View>
                    <SheetInput
                      label="Who did you borrow from?"
                      value={drafts.iouPerson}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          iouPerson: value,
                        }))
                      }
                    />
                    <MoneyField
                      label="Amount"
                      initialAmount={Number(drafts.iouAmount) || 0}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          iouAmount: value ? String(value) : "",
                        }))
                      }
                    />
                    <SheetInput
                      label="Pay back by"
                      value={drafts.iouDue}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({ ...current, iouDue: value }))
                      }
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Save borrowed money"
                      style={[
                        styles.button,
                        { backgroundColor: theme.primary, marginTop: 22 },
                      ]}
                      onPress={saveIou}
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#fff"
                      />
                      <AppText style={styles.buttonText}>Save</AppText>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {sheet === "goal" ? (
                  <View>
                    <SheetInput
                      label="What are you saving for?"
                      value={drafts.goalName}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          goalName: value,
                        }))
                      }
                    />
                    <MoneyField
                      label="Target amount"
                      initialAmount={Number(drafts.goalTarget) || 0}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          goalTarget: value ? String(value) : "",
                        }))
                      }
                    />
                    <MoneyField
                      label="Save per month"
                      initialAmount={Number(drafts.goalPer) || 0}
                      rate={model.rate}
                      theme={theme}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          goalPer: value ? String(value) : "",
                        }))
                      }
                    />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Save goal"
                      style={[
                        styles.button,
                        { backgroundColor: theme.primary, marginTop: 22 },
                      ]}
                      onPress={saveGoal}
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={20}
                        color="#fff"
                      />
                      <AppText style={styles.buttonText}>Create goal</AppText>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {sheet === "recurring" ? (
                  <View>
                    {model.recurringPayments.length > 0 ? (
                      <View>
                        <AppText
                          style={[
                            styles.label,
                            { color: theme.muted, marginTop: 10 },
                          ]}
                        >
                          Saved payments
                        </AppText>
                        {model.recurringPayments.map((payment) => (
                          <View
                            key={payment.id}
                            style={[
                              styles.expenseRow,
                              { borderColor: theme.line },
                            ]}
                          >
                            <View
                              style={[
                                styles.bubble,
                                { backgroundColor: `${theme.primary}22` },
                              ]}
                            >
                              <Glyph
                                name="subscriptions"
                                color={theme.primary}
                              />
                            </View>
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={`Edit ${payment.name}`}
                              style={{ flex: 1 }}
                              onPress={() => openRecurringSheet(payment)}
                            >
                              <AppText
                                style={[styles.itemName, { color: theme.text }]}
                              >
                                {payment.name}
                              </AppText>
                              <AppText
                                style={[styles.itemSub, { color: theme.muted }]}
                              >
                                {dueText(payment.dueDay)} ·{" "}
                                {amountLabel(payment.amount, payment.cur)}
                              </AppText>
                            </TouchableOpacity>
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={`Delete ${payment.name}`}
                              onPress={() =>
                                deleteRecurringPayment(payment.id, payment.name)
                              }
                              style={{ padding: 5, marginLeft: 4 }}
                            >
                              <MaterialIcons
                                name="delete-outline"
                                size={20}
                                color={theme.faint}
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <EmptyState
                        icon="subscriptions"
                        title="No recurring payments yet"
                        body="Add subscriptions or other monthly payments you want to see in Coming up."
                        theme={theme}
                      />
                    )}
                    <View key={drafts.recurringEditId ?? "new-recurring"}>
                      <SheetInput
                        label="Payment name"
                        value={drafts.recurringName}
                        theme={theme}
                        onChange={(value) =>
                          setDrafts((current) => ({
                            ...current,
                            recurringName: value,
                          }))
                        }
                      />
                      <MoneyField
                        label="Amount"
                        initialAmount={Number(drafts.recurringAmount) || 0}
                        initialCur={drafts.recurringCur}
                        rate={model.rate}
                        theme={theme}
                        onChange={(_usd, amount, cur) =>
                          setDrafts((current) => ({
                            ...current,
                            recurringAmount: amount ? String(amount) : "",
                            recurringCur: cur,
                          }))
                        }
                      />
                      <DueDayPicker
                        label="Due each month"
                        value={drafts.recurringDueDay}
                        theme={theme}
                        onChange={(day) =>
                          setDrafts((current) => ({
                            ...current,
                            recurringDueDay: day,
                          }))
                        }
                      />
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={
                          drafts.recurringEditId
                            ? "Save recurring payment changes"
                            : "Add recurring payment"
                        }
                        style={[
                          styles.button,
                          { backgroundColor: theme.primary, marginTop: 22 },
                        ]}
                        onPress={saveRecurringPayment}
                      >
                        <MaterialIcons
                          name="check-circle"
                          size={20}
                          color="#fff"
                        />
                        <AppText style={styles.buttonText}>
                          {drafts.recurringEditId
                            ? "Save changes"
                            : "Add payment"}
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                {sheet === "month" ? (
                  <View>
                    <View style={[styles.row, { marginTop: 10 }]}>
                      <AppText style={[styles.itemSub, { color: theme.muted }]}>
                        Spent {formatMoney(budget.spentMonthUsd)} of{" "}
                        {formatMoney0(budget.spendableMonthUsd)}
                      </AppText>
                      <AppText style={[styles.itemSub, { color: theme.muted }]}>
                        {filteredTransactions.length} of{" "}
                        {transactionHistoryBase.length}
                      </AppText>
                    </View>
                    {monthIncomeUsd > 0 &&
                    transactionMonthFilter === "current-cycle" ? (
                      <AppText
                        style={[
                          styles.itemSub,
                          { color: theme.green, marginBottom: 8 },
                        ]}
                      >
                        Income recorded this cycle: +{usd(monthIncomeUsd)}
                      </AppText>
                    ) : null}
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.line,
                          color: theme.text,
                          fontFamily: FONT.semibold,
                          fontSize: 15,
                        },
                      ]}
                      placeholder="Search name, note, category, or type"
                      placeholderTextColor={theme.faint}
                      value={drafts.transactionSearch}
                      onChangeText={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          transactionSearch: value,
                        }))
                      }
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Type
                    </AppText>
                    <View
                      style={[
                        styles.segment,
                        { backgroundColor: theme.surface2 },
                      ]}
                    >
                      {(["all", "expense", "income"] as const).map((kind) => (
                        <TouchableOpacity
                          key={kind}
                          accessibilityRole="button"
                          accessibilityLabel={`Show ${kind === "all" ? "all transactions" : kind === "expense" ? "outcomes" : "income"}`}
                          accessibilityState={{
                            selected: drafts.transactionTypeFilter === kind,
                          }}
                          style={[
                            styles.segmentButton,
                            drafts.transactionTypeFilter === kind && {
                              backgroundColor: theme.surface,
                              ...CARD_SHADOW,
                            },
                          ]}
                          onPress={() =>
                            setDrafts((current) => ({
                              ...current,
                              transactionTypeFilter: kind,
                              transactionCategoryFilter:
                                kind === "income"
                                  ? "income"
                                  : current.transactionCategoryFilter ===
                                      "income"
                                    ? ""
                                    : current.transactionCategoryFilter,
                            }))
                          }
                        >
                          <AppText
                            style={[
                              styles.segmentText,
                              {
                                color:
                                  drafts.transactionTypeFilter === kind
                                    ? theme.text
                                    : theme.muted,
                              },
                            ]}
                          >
                            {kind === "all"
                              ? "All"
                              : kind === "expense"
                                ? "Outcome"
                                : "Income"}
                          </AppText>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Period
                    </AppText>
                    <View style={styles.chipRow}>
                      {transactionHistoryMonths.map((month) => {
                        const on = transactionMonthFilter === month;
                        const label =
                          month === "current-cycle"
                            ? "Current cycle"
                            : monthLabel(month);
                        return (
                          <TouchableOpacity
                            key={month}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter by ${label}`}
                            accessibilityState={{ selected: on }}
                            style={[
                              styles.chip,
                              {
                                borderColor: on ? theme.primary : theme.line,
                                backgroundColor: on
                                  ? theme.primary
                                  : theme.surface,
                              },
                            ]}
                            onPress={() =>
                              setDrafts((current) => ({
                                ...current,
                                transactionMonth: month,
                              }))
                            }
                          >
                            <AppText
                              style={[
                                styles.chipText,
                                { color: on ? "#fff" : theme.muted },
                              ]}
                            >
                              {label}
                            </AppText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <AppText style={[styles.label, { color: theme.muted }]}>
                      Category
                    </AppText>
                    <View style={styles.chipRow}>
                      {[
                        {
                          key: "",
                          label: "All",
                          color: theme.primary,
                          icon: "all-inclusive" as IconName,
                        },
                        {
                          key: "income",
                          label: "Income",
                          color: theme.green,
                          icon: "account-balance-wallet" as IconName,
                        },
                        ...model.categories,
                      ].map((cat) => {
                        const on = drafts.transactionCategoryFilter === cat.key;
                        return (
                          <TouchableOpacity
                            key={cat.key || "all"}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter by ${cat.label}`}
                            accessibilityState={{ selected: on }}
                            style={[
                              styles.chip,
                              {
                                borderColor: on ? cat.color : theme.line,
                                backgroundColor: on ? cat.color : theme.surface,
                              },
                            ]}
                            onPress={() =>
                              setDrafts((current) => ({
                                ...current,
                                transactionCategoryFilter: cat.key,
                                transactionTypeFilter:
                                  cat.key === "income"
                                    ? "income"
                                    : current.transactionTypeFilter ===
                                          "income" && cat.key
                                      ? "expense"
                                      : current.transactionTypeFilter,
                              }))
                            }
                          >
                            <Glyph
                              name={cat.icon}
                              size={18}
                              color={on ? "#fff" : cat.color}
                            />
                            <AppText
                              style={[
                                styles.chipText,
                                { color: on ? "#fff" : theme.muted },
                              ]}
                            >
                              {cat.label}
                            </AppText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {transactionHistoryFilterActive ? (
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Clear transaction filters"
                        style={[
                          styles.dashed,
                          { borderColor: theme.faint, marginTop: 14 },
                        ]}
                        onPress={() =>
                          setDrafts((current) => ({
                            ...current,
                            transactionSearch: "",
                            transactionTypeFilter: "all",
                            transactionCategoryFilter: "",
                            transactionMonth: "current-cycle",
                          }))
                        }
                      >
                        <MaterialIcons
                          name="filter-alt-off"
                          size={20}
                          color={theme.primary}
                        />
                        <AppText
                          style={[
                            styles.chipText,
                            { color: theme.primary, fontFamily: FONT.bold },
                          ]}
                        >
                          Clear filters
                        </AppText>
                      </TouchableOpacity>
                    ) : null}
                    {filteredTransactions.map((transaction) => (
                      <View key={transaction.id}>
                        {renderTransactionRow(transaction, { showDate: true })}
                      </View>
                    ))}
                    {filteredTransactions.length === 0 ? (
                      <View style={{ marginTop: 20 }}>
                        <EmptyState
                          icon="calendar-month"
                          title="No matching transactions"
                          body="Try a different search, type, category, or period filter."
                          theme={theme}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {sheet === "day" ? (
                  <View>
                    <View
                      style={[
                        styles.card,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.line,
                        },
                      ]}
                    >
                      <AppText
                        style={[
                          styles.label,
                          { color: theme.muted, marginTop: 0 },
                        ]}
                      >
                        Spent on {selectedDayDate}
                      </AppText>
                      <AppText
                        style={[
                          styles.parsedAmount,
                          { color: theme.text, fontSize: 26 },
                        ]}
                      >
                        {usd(selectedDayItem.value)}
                      </AppText>
                    </View>
                    {selectedDayTransactions.map((transaction) => (
                      <View key={transaction.id}>
                        {renderTransactionRow(transaction)}
                      </View>
                    ))}
                    {selectedDayTransactions.length === 0 ? (
                      <View style={{ marginTop: 12 }}>
                        <EmptyState
                          icon="receipt-long"
                          title="No transactions this day"
                          body="Income and outcomes saved for this date will show up here."
                          theme={theme}
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {sheet === "formula" ? (
                  <View>
                    <AppText style={[styles.itemSub, { color: theme.muted }]}>
                      How today’s safe-to-spend amount is calculated.
                    </AppText>
                    <View
                      style={[
                        styles.card,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.line,
                          marginTop: 14,
                        },
                      ]}
                    >
                      <Row
                        label="Cycle income"
                        value={formatMoney0(budget.salaryUsd)}
                        theme={theme}
                      />
                      <Row
                        label="Needs split"
                        value={`${method.needsPct}%`}
                        theme={theme}
                      />
                      <Row
                        label="Wants split"
                        value={`${method.wantsPct}%`}
                        theme={theme}
                      />
                      <Row
                        label="Savings first"
                        value={`−${formatMoney0(budget.savingsTargetUsd)}`}
                        theme={theme}
                      />
                      <Row
                        label="Fixed costs"
                        value={`−${formatMoney0(budget.fixedUsd)}`}
                        theme={theme}
                      />
                      <View
                        style={{
                          height: 1,
                          backgroundColor: theme.line,
                          marginVertical: 10,
                        }}
                      />
                      <Row
                        label="Free this cycle"
                        value={formatMoney0(budget.spendableMonthUsd)}
                        theme={theme}
                        strong
                      />
                      <Row
                        label="Base per day"
                        value={formatMoney(budget.baseDailyUsd)}
                        theme={theme}
                      />
                      <Row
                        label="Rolled from yesterday"
                        value={formatMoney(rolloverYesterday)}
                        theme={theme}
                      />
                      <Row
                        label="Spent today"
                        value={`−${formatMoney(budget.spentTodayUsd)}`}
                        theme={theme}
                      />
                      <View
                        style={{
                          height: 1,
                          backgroundColor: theme.line,
                          marginVertical: 10,
                        }}
                      />
                      <Row
                        label={
                          budget.leftTodayUsd.amountMinor < 0
                            ? "Over today"
                            : "Left today"
                        }
                        value={formatMoney(budget.leftTodayUsd)}
                        theme={theme}
                        strong
                      />
                      <Row
                        label="Tomorrow at this pace"
                        value={formatMoney(budget.tomorrowUsd)}
                        theme={theme}
                      />
                    </View>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      Rollover uses unused safe-to-spend from yesterday.
                    </AppText>
                    <AppText
                      style={[
                        styles.itemSub,
                        { color: theme.muted, marginTop: 10, lineHeight: 21 },
                      ]}
                    >
                      Overspending reduces tomorrow instead of hiding the debt.
                    </AppText>
                  </View>
                ) : null}
                {sheet &&
                [
                  "income",
                  "fixed",
                  "loan",
                  "method",
                  "cycle",
                  "currency",
                  "reminder",
                  "formula",
                ].includes(sheet) ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Done"
                    style={[
                      styles.button,
                      { backgroundColor: theme.primary, marginTop: 22 },
                    ]}
                    onPress={() => setSheet(null)}
                  >
                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                    <AppText style={styles.buttonText}>Done</AppText>
                  </TouchableOpacity>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  let screen: ReactNode;
  if (!hydrated || !fontsLoaded) {
    screen = (
      <SafeAreaView
        style={[
          styles.safe,
          {
            backgroundColor: theme.page,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <AppText style={[styles.itemTitle, { color: theme.text }]}>
          {t(model.language, "app.loading")}
        </AppText>
      </SafeAreaView>
    );
  } else if (!model.onboarded || model.screen === "onboarding") {
    screen = renderOnboarding();
  } else {
    let content = renderHome();
    if (model.screen === "add") content = renderAdd();
    if (model.screen === "categories") content = renderCategories();
    if (model.screen === "detail") content = renderDetail();
    if (model.screen === "goals") content = renderGoals();
    if (model.screen === "insights") content = renderInsights();
    if (model.screen === "settings") content = renderSettings();
    const screenKey =
      model.screen === "detail"
        ? `${model.screen}:${selectedCategory.key}`
        : model.screen;
    screen = (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.page }]}>
        <StatusBar style={model.dark ? "light" : "dark"} />
        <View key={screenKey} style={{ flex: 1 }}>
          {content}
        </View>
        {["home", "categories", "insights", "settings"].includes(
          model.screen,
        ) ? (
          <BottomNav
            screen={model.screen}
            theme={theme}
            language={model.language}
            onGo={go}
          />
        ) : null}
        {toast ? (
          <View style={[styles.toast, { backgroundColor: theme.text }]}>
            <MaterialIcons name="check-circle" size={18} color={theme.green} />
            <AppText style={[styles.toastText, { color: theme.page }]}>
              {toast.message}
            </AppText>
            {toast.action ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel ?? "Undo"}
                onPress={() => {
                  const action = toast.action;
                  setToast(null);
                  action?.();
                }}
                style={{ paddingVertical: 2, paddingLeft: 6 }}
              >
                <AppText style={[styles.toastText, { color: theme.green }]}>
                  {toast.actionLabel ?? "Undo"}
                </AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <Modal
          visible={pendingRestore !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPendingRestore(null)}
        >
          <View style={styles.celebrateScrim}>
            <View
              style={[
                styles.celebrateCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.line,
                  borderWidth: 1,
                  alignItems: "stretch",
                },
              ]}
            >
              <View
                style={[
                  styles.celebrateIcon,
                  { backgroundColor: theme.primaryWash, alignSelf: "center" },
                ]}
              >
                <MaterialIcons name="restore" size={34} color={theme.primary} />
              </View>
              <AppText style={[styles.celebrateTitle, { color: theme.text }]}>
                Restore backup?
              </AppText>
              <AppText style={[styles.celebrateBody, { color: theme.muted }]}>
                {pendingRestore?.preview.backupDate
                  ? `Backup from ${pendingRestore.preview.backupDate}`
                  : "Backup date unavailable"}
              </AppText>
              <AnimatedCue
                trigger={
                  pendingRestore?.preview.backupDate ?? "restore-preview"
                }
                distance={6}
              >
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.surface2,
                      borderColor: theme.line,
                      marginTop: 18,
                      shadowOpacity: 0,
                      elevation: 0,
                    },
                  ]}
                >
                  {[
                    [
                      "Categories",
                      pendingRestore?.preview.counts.categories ?? 0,
                    ],
                    [
                      "Transactions",
                      pendingRestore?.preview.counts.expenses ?? 0,
                    ],
                    ["Goals", pendingRestore?.preview.counts.goals ?? 0],
                    [
                      "Borrowed-money items",
                      pendingRestore?.preview.counts.ious ?? 0,
                    ],
                    [
                      "Recurring payments",
                      pendingRestore?.preview.counts.recurringPayments ?? 0,
                    ],
                  ].map(([label, count]) => (
                    <Row
                      key={label}
                      label={String(label)}
                      value={String(count)}
                      theme={theme}
                    />
                  ))}
                </View>
              </AnimatedCue>
              <AppText
                style={[
                  styles.itemSub,
                  { color: theme.muted, textAlign: "center", marginTop: 12 },
                ]}
              >
                This replaces current data on this device.
              </AppText>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 22 }}>
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel restore"
                  style={[
                    styles.button,
                    { flex: 1, backgroundColor: theme.surface2 },
                  ]}
                  contentStyle={styles.buttonContent}
                  onPress={() => setPendingRestore(null)}
                >
                  <AppText style={[styles.buttonText, { color: theme.text }]}>
                    Cancel
                  </AppText>
                </AnimatedPressable>
                <AnimatedPressable
                  accessibilityRole="button"
                  accessibilityLabel="Restore backup"
                  style={[
                    styles.button,
                    { flex: 1, backgroundColor: theme.primary },
                  ]}
                  contentStyle={styles.buttonContent}
                  onPress={restorePendingBackup}
                >
                  <AppText style={styles.buttonText}>Restore</AppText>
                </AnimatedPressable>
              </View>
            </View>
          </View>
        </Modal>
        <Modal
          visible={celebrate !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setCelebrate(null)}
        >
          <View style={styles.celebrateScrim}>
            <View
              style={[
                styles.celebrateCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.line,
                  borderWidth: 1,
                },
              ]}
            >
              <View
                style={[
                  styles.celebrateIcon,
                  { backgroundColor: theme.primaryWash },
                ]}
              >
                <MaterialIcons
                  name="celebration"
                  size={38}
                  color={theme.primary}
                />
              </View>
              <AppText style={[styles.celebrateTitle, { color: theme.text }]}>
                {celebrate?.title}
              </AppText>
              <AppText style={[styles.celebrateBody, { color: theme.muted }]}>
                {celebrate?.body}
              </AppText>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Dismiss celebration"
                style={[
                  styles.button,
                  {
                    backgroundColor: theme.primary,
                    alignSelf: "stretch",
                    marginTop: 22,
                  },
                ]}
                onPress={() => setCelebrate(null)}
              >
                <AppText style={styles.buttonText}>Nice!</AppText>
              </TouchableOpacity>
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
    <KeyboardProvider>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}
