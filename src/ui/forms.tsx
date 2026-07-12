import { useState, type ReactNode } from "react";
import { Platform, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialIcons } from "@expo/vector-icons";

import type { AppModel, BudgetMode, Currency } from "../app/types";
import {
  formatClock,
  khr,
  notifyToDate,
  ordinal,
  usd,
} from "../app/formatters";
import type { Theme } from "../theme/theme";
import { FONT, KHMER_FONT } from "../theme/typography";
import { AppText } from "./AppText";
import { CARD_SHADOW, styles } from "./styles";

const QUICK_DUE_DAYS = [1, 5, 15, 25] as const;
const REMINDER_PRESETS = [
  ["8:00 PM", "20:00"],
  ["9:00 PM", "21:00"],
  ["10:00 PM", "22:00"],
] as const;
const BUDGET_MODES: readonly BudgetMode[] = ["balanced", "saver", "custom"];
const CUSTOM_BUDGET_PARTS = ["needs", "wants", "save"] as const;

function dayFromInput(value: string) {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(31, Math.trunc(parsed));
}

export function DueDayPicker({
  label,
  value,
  theme,
  onChange,
}: {
  label: string;
  value: number;
  theme: Theme;
  onChange: (day: number) => void;
}) {
  return (
    <View>
      <AppText style={[styles.label, { color: theme.muted }]}>{label}</AppText>
      <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>
        {QUICK_DUE_DAYS.map((day) => (
          <TouchableOpacity
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${ordinal(day)}`}
            accessibilityState={{ selected: value === day }}
            style={[
              styles.segmentButton,
              value === day && {
                backgroundColor: theme.surface,
                ...CARD_SHADOW,
              },
            ]}
            onPress={() => onChange(day)}
          >
            <AppText
              style={[
                styles.segmentText,
                { color: value === day ? theme.text : theme.muted },
              ]}
            >
              {ordinal(day)}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>
      <AppText style={[styles.label, { color: theme.muted }]}>
        Or enter any day
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
        keyboardType="number-pad"
        value={String(value)}
        onChangeText={(next) => onChange(dayFromInput(next))}
        placeholder="1–31"
        placeholderTextColor={theme.faint}
        maxLength={2}
      />
      <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 6 }]}>
        Use any calendar day from 1 to 31.
      </AppText>
    </View>
  );
}

export function BudgetMethodPicker({
  method,
  custom,
  theme,
  onSelect,
  onCustomChange,
}: {
  method: BudgetMode;
  custom: AppModel["custom"];
  theme: Theme;
  onSelect: (mode: BudgetMode) => void;
  onCustomChange: (part: keyof AppModel["custom"], value: number) => void;
}) {
  return (
    <View>
      {BUDGET_MODES.map((mode) => (
        <TouchableOpacity
          key={mode}
          accessibilityRole="radio"
          accessibilityLabel={
            mode === "balanced"
              ? "Balanced budget method, 50 30 20"
              : mode === "saver"
                ? "Saver budget method, 40 30 30"
                : `Custom budget method, ${custom.needs} ${custom.wants} ${custom.save}`
          }
          accessibilityState={{
            checked: method === mode,
            selected: method === mode,
          }}
          style={[
            styles.methodCard,
            {
              backgroundColor:
                method === mode ? theme.primaryWash : theme.surface,
              borderColor: method === mode ? theme.primary : theme.line,
            },
          ]}
          onPress={() => onSelect(mode)}
        >
          <View style={styles.row}>
            <AppText style={[styles.itemTitle, { color: theme.text }]}>
              {mode === "balanced"
                ? "Balanced · 50/30/20"
                : mode === "saver"
                  ? "Saver · 40/30/30"
                  : `Custom · ${custom.needs}/${custom.wants}/${custom.save}`}
            </AppText>
            {mode === "balanced" ? (
              <View
                style={[styles.duePill, { backgroundColor: theme.primary }]}
              >
                <AppText style={[styles.duePillText, { color: "#fff" }]}>
                  Recommended
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText
            style={[styles.itemSub, { color: theme.muted, marginTop: 5 }]}
          >
            {mode === "balanced"
              ? "50% Needs · 30% Wants · 20% Savings"
              : mode === "saver"
                ? "Tighter spending, faster savings"
                : "Design your own Needs/Wants/Savings split"}
          </AppText>
        </TouchableOpacity>
      ))}
      {method === "custom" ? (
        <View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            {CUSTOM_BUDGET_PARTS.map((part) => (
              <View key={part} style={{ flex: 1 }}>
                <AppText
                  style={[
                    styles.label,
                    {
                      color: theme.muted,
                      marginTop: 0,
                      marginBottom: 6,
                      fontSize: 11,
                    },
                  ]}
                >
                  {part === "save" ? "Savings" : part} %
                </AppText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      padding: 13,
                      fontSize: 16,
                      backgroundColor: theme.surface,
                      borderColor: theme.line,
                      color: theme.text,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={String(custom[part])}
                  onChangeText={(next) =>
                    onCustomChange(
                      part,
                      Math.max(0, Math.min(100, Number(next) || 0)),
                    )
                  }
                />
              </View>
            ))}
          </View>
          {custom.needs + custom.wants + custom.save !== 100 ? (
            <AppText
              style={[styles.itemSub, { color: theme.red, marginTop: 8 }]}
            >
              Adds up to {custom.needs + custom.wants + custom.save}% — adjust
              so it totals 100%.
            </AppText>
          ) : (
            <AppText
              style={[styles.itemSub, { color: theme.muted, marginTop: 8 }]}
            >
              Savings come out first, Needs cover fixed costs, Wants set your
              daily budget.
            </AppText>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function ReminderTimePicker({
  value,
  theme,
  open,
  onOpenChange,
  onChange,
  onPreview,
}: {
  value: string;
  theme: Theme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
  onPreview?: () => void;
}) {
  return (
    <View>
      <AppText style={[styles.label, { color: theme.muted }]}>
        Quick pick
      </AppText>
      <View style={[styles.segment, { backgroundColor: theme.surface2 }]}>
        {REMINDER_PRESETS.map(([label, preset]) => (
          <TouchableOpacity
            key={preset}
            accessibilityRole="button"
            accessibilityLabel={`Reminder time ${label}`}
            accessibilityState={{ selected: value === preset }}
            style={[
              styles.segmentButton,
              value === preset && {
                backgroundColor: theme.surface,
                ...CARD_SHADOW,
              },
            ]}
            onPress={() => onChange(preset)}
          >
            <AppText
              style={[
                styles.segmentText,
                { color: value === preset ? theme.text : theme.muted },
              ]}
            >
              {label}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>
      <AppText style={[styles.label, { color: theme.muted }]}>
        Or choose your own time
      </AppText>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Choose reminder time, currently ${formatClock(value)}`}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: theme.line,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          },
        ]}
        onPress={() => onOpenChange(true)}
      >
        <AppText
          style={{ fontFamily: FONT.bold, fontSize: 18, color: theme.text }}
        >
          {formatClock(value)}
        </AppText>
        <MaterialIcons name="schedule" size={22} color={theme.muted} />
      </TouchableOpacity>
      {open ? (
        <DateTimePicker
          value={notifyToDate(value)}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event, date) => {
            onOpenChange(Platform.OS === "ios");
            if (date)
              onChange(
                `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
              );
          }}
        />
      ) : null}
      {onPreview ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Send a preview notification now"
          style={[
            styles.button,
            { backgroundColor: theme.surface2, marginTop: 16, minHeight: 48 },
          ]}
          onPress={onPreview}
        >
          <MaterialIcons name="notifications" size={18} color={theme.text} />
          <AppText
            style={[styles.buttonText, { color: theme.text, fontSize: 14 }]}
          >
            Send a preview now
          </AppText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function SheetInput({
  label,
  value,
  theme,
  onChange,
}: {
  label: string;
  value: string;
  theme: Theme;
  onChange: (value: string) => void;
}) {
  return (
    <View>
      <AppText style={[styles.label, { color: theme.muted }]}>{label}</AppText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: theme.line,
            color: theme.text,
          },
        ]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={theme.faint}
        keyboardType={
          label.toLowerCase().includes("amount") ||
          label.toLowerCase().includes("salary") ||
          label.toLowerCase().includes("budget") ||
          label.includes("$") ||
          label.includes("Rent") ||
          label.includes("Utilities") ||
          label.includes("Loan")
            ? "decimal-pad"
            : "default"
        }
      />
    </View>
  );
}

// Amount input with a per-field USD/KHR toggle and a live conversion line, so
// bills paid in riel (rent, loan, utilities…) can be typed in riel directly.
// Reports the USD equivalent plus the raw amount/currency the user entered.
export function MoneyField({
  label,
  initialAmount,
  initialCur = "USD",
  rate,
  theme,
  onChange,
  right,
}: {
  label: string;
  initialAmount: number;
  initialCur?: Currency;
  rate: number;
  theme: Theme;
  onChange: (usd: number, amount: number, cur: Currency) => void;
  right?: ReactNode;
}) {
  const [cur, setCur] = useState<Currency>(initialCur);
  const [text, setText] = useState(() =>
    initialAmount ? String(initialAmount) : "",
  );
  const amount = Number(text) || 0;

  function report(nextAmount: number, nextCur: Currency) {
    onChange(
      nextCur === "KHR" ? nextAmount / rate : nextAmount,
      nextAmount,
      nextCur,
    );
  }

  function switchCur(next: Currency) {
    if (next === cur) return;
    const converted =
      amount > 0
        ? next === "KHR"
          ? Math.round(amount * rate)
          : Math.round((amount / rate) * 100) / 100
        : 0;
    setCur(next);
    setText(converted ? String(converted) : "");
    report(converted, next);
  }

  return (
    <View>
      <AppText style={[styles.label, { color: theme.muted }]}>{label}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          style={[
            styles.input,
            {
              flex: 1,
              backgroundColor: theme.surface,
              borderColor: theme.line,
              color: theme.text,
            },
          ]}
          keyboardType="decimal-pad"
          value={text}
          placeholder="0"
          placeholderTextColor={theme.faint}
          onChangeText={(value) => {
            setText(value);
            report(Number(value) || 0, cur);
          }}
        />
        <View style={[styles.curToggle, { backgroundColor: theme.surface2 }]}>
          {(["USD", "KHR"] as Currency[]).map((c) => (
            <TouchableOpacity
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Use ${c === "USD" ? "US dollars" : "Khmer riel"}`}
              accessibilityState={{ selected: cur === c }}
              style={[
                styles.curToggleButton,
                cur === c && { backgroundColor: theme.surface, ...CARD_SHADOW },
              ]}
              onPress={() => switchCur(c)}
            >
              <AppText
                style={[
                  styles.segmentText,
                  {
                    fontFamily: KHMER_FONT.bold,
                    fontSize: 15,
                    color: cur === c ? theme.text : theme.muted,
                  },
                ]}
              >
                {c === "USD" ? "$" : "៛"}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>
        {right ?? null}
      </View>
      {amount > 0 ? (
        <AppText style={[styles.itemSub, { color: theme.muted, marginTop: 6 }]}>
          ≈ {cur === "KHR" ? usd(amount / rate) : khr(amount * rate)}
        </AppText>
      ) : null}
    </View>
  );
}
