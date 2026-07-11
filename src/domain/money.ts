export type Currency = 'USD' | 'KHR';

export type Money = Readonly<{
  amountMinor: number;
  currency: Currency;
}>;

export type ExchangeRate = Readonly<{
  khrPerUsd: number;
}>;

export const DEFAULT_RATE: ExchangeRate = { khrPerUsd: 4100 };

function assertFiniteInteger(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`${label} must be a finite integer`);
  }
}

export function money(amountMinor: number, currency: Currency): Money {
  assertFiniteInteger(amountMinor, 'amountMinor');
  return { amountMinor, currency };
}

export function parseMoney(value: string | number, currency: Currency): Money {
  const raw = typeof value === 'number' ? String(value) : value.trim().replace(/,/g, '');
  if (!raw || !/^[-+]?\d+(\.\d+)?$/.test(raw)) {
    throw new Error('Invalid money amount');
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('Money amount must be a positive finite number');
  }

  if (currency === 'KHR') {
    if (!Number.isInteger(numeric)) {
      throw new Error('KHR amounts must be whole riel');
    }
    return money(numeric, currency);
  }

  const cents = Math.round(numeric * 100);
  if (Math.abs(cents / 100 - numeric) > 1e-9) {
    throw new Error('USD amounts cannot have more than two decimal places');
  }
  return money(cents, currency);
}

export function assertRate(rate: ExchangeRate) {
  if (!Number.isFinite(rate.khrPerUsd) || rate.khrPerUsd <= 0) {
    throw new Error('Exchange rate must be positive');
  }
}

export function convertMoney(value: Money, to: Currency, rate: ExchangeRate = DEFAULT_RATE): Money {
  assertRate(rate);
  if (value.currency === to) return money(value.amountMinor, to);

  if (value.currency === 'USD' && to === 'KHR') {
    return money(Math.round((value.amountMinor * rate.khrPerUsd) / 100), 'KHR');
  }

  return money(Math.round((value.amountMinor * 100) / rate.khrPerUsd), 'USD');
}

export function toUsdCents(value: Money, rate: ExchangeRate = DEFAULT_RATE): number {
  return convertMoney(value, 'USD', rate).amountMinor;
}

export function addMoney(values: readonly Money[], currency: Currency, rate: ExchangeRate = DEFAULT_RATE): Money {
  return money(values.reduce((sum, item) => sum + convertMoney(item, currency, rate).amountMinor, 0), currency);
}

export function formatMoney(value: Money): string {
  if (value.currency === 'KHR') {
    return `${value.amountMinor.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}៛`;
  }
  return `$${(value.amountMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoney0(value: Money): string {
  if (value.currency === 'KHR') return formatMoney(value);
  return `$${Math.round(value.amountMinor / 100).toLocaleString('en-US')}`;
}

export function percent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}
