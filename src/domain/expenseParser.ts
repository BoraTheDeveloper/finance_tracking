import { Currency, Money, parseMoney } from './money';

export type ParsedExpense = Readonly<{
  amount: Money | null;
  categoryKey: string;
  label: string;
  currency: Currency;
}>;

export const CATEGORY_KEYWORDS: Record<string, readonly string[]> = {
  food: ['food', 'lunch', 'dinner', 'breakfast', 'coffee', 'restaurant', 'snack', 'grocery', 'groceries', 'meal', 'eat', 'cafe', 'tea', 'noodle', 'rice', 'drink'],
  ent: ['netflix', 'movie', 'cinema', 'game', 'spotify', 'youtube', 'concert', 'bar', 'beer', 'party', 'ticket'],
  transport: ['bus', 'taxi', 'grab', 'fuel', 'gas', 'petrol', 'tuktuk', 'tuk', 'moto', 'ride', 'uber', 'parking', 'transport'],
  bills: ['phone', 'internet', 'wifi', 'electric', 'electricity', 'water', 'bill', 'subscription', 'topup', 'top-up', 'recharge', 'rent'],
  shopping: ['clothes', 'shoes', 'shirt', 'amazon', 'shopping', 'mall', 'store', 'gadget', 'bag'],
  health: ['pharmacy', 'doctor', 'medicine', 'gym', 'hospital', 'clinic', 'health', 'dentist', 'vitamin'],
};

export function inferCurrency(text: string, amount: number | null): Currency {
  const t = text.toLowerCase();
  if (/riel|khr|៛/.test(t)) return 'KHR';
  if (/\$|usd|dollar|buck/.test(t)) return 'USD';
  if (amount != null && amount >= 500) return 'KHR';
  return 'USD';
}

export function inferCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [categoryKey, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((word) => t.includes(word))) return categoryKey;
  }
  return 'other';
}

export function parseExpenseText(input: string): ParsedExpense {
  const text = input.trim();
  const lower = text.toLowerCase();
  const amountText = text.includes(',') ? text.split(',').slice(1).join(',').toLowerCase() : lower;
  const match = amountText.match(/(\d[\d,]*\.?\d*|\d*\.\d+)/) ?? lower.match(/(\d[\d,]*\.?\d*|\d*\.\d+)/);
  const amountNumber = match ? Number(match[1].replace(/,/g, '')) : null;
  const currency = inferCurrency(lower, amountNumber);
  const labelPart = text.split(',')[0]?.trim() ?? '';
  const label = labelPart.replace(/\s+/g, ' ');

  return {
    amount: amountNumber == null ? null : parseMoney(String(amountNumber), currency),
    categoryKey: inferCategory(lower),
    label,
    currency,
  };
}
