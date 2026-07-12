import { isoDayFromDate } from "../domain/dates";

export const USD_TO_KHR_RATE_SOURCE = {
  name: "Rates by Exchange Rate API",
  url: "https://open.er-api.com/v6/latest/USD",
} as const;

export type UsdToKhrRateResult = {
  khrPerUsd: number;
  source: string;
};

type ExchangeRateHttpResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type ExchangeRateFetcher = (url: string) => Promise<ExchangeRateHttpResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function shouldRefreshExchangeRate(
  lastFetchedDay: string | null | undefined,
  today = isoDayFromDate(new Date()),
) {
  return lastFetchedDay !== today;
}

export function parseUsdToKhrRate(payload: unknown) {
  if (!isRecord(payload) || payload.result !== "success") return null;
  const rates = payload.rates;
  if (!isRecord(rates)) return null;

  const khrPerUsd = rates.KHR;
  return typeof khrPerUsd === "number" &&
    Number.isFinite(khrPerUsd) &&
    khrPerUsd > 0
    ? khrPerUsd
    : null;
}

export async function fetchUsdToKhrRate(
  fetcher: ExchangeRateFetcher = fetch,
): Promise<UsdToKhrRateResult | null> {
  const response = await fetcher(USD_TO_KHR_RATE_SOURCE.url);
  if (!response.ok) return null;

  const khrPerUsd = parseUsdToKhrRate(await response.json());
  if (khrPerUsd === null) return null;

  return {
    khrPerUsd,
    source: USD_TO_KHR_RATE_SOURCE.name,
  };
}
