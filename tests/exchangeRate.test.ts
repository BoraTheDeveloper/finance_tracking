import { describe, expect, it } from "vitest";
import { INITIAL_MODEL, RATE } from "../src/app/initialState";
import { normalizeLoadedModel } from "../src/app/normalizeLoadedModel";
import {
  USD_TO_KHR_RATE_SOURCE,
  fetchUsdToKhrRate,
  parseUsdToKhrRate,
  shouldRefreshExchangeRate,
} from "../src/services/exchangeRate";

describe("USD to KHR exchange-rate source", () => {
  it("uses a public no-key endpoint and parses finite positive KHR per USD", async () => {
    let requestedUrl = "";
    const result = await fetchUsdToKhrRate(async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ result: "success", rates: { KHR: 3996.327392 } }),
      };
    });

    expect(requestedUrl).toBe(USD_TO_KHR_RATE_SOURCE.url);
    expect(requestedUrl).not.toContain("key=");
    expect(result).toEqual({
      khrPerUsd: 3996.327392,
      source: USD_TO_KHR_RATE_SOURCE.name,
    });
  });

  it("ignores failed, missing, non-positive, and non-finite API values", async () => {
    expect(
      parseUsdToKhrRate({ result: "error", rates: { KHR: 4000 } }),
    ).toBeNull();
    expect(parseUsdToKhrRate({ result: "success", rates: {} })).toBeNull();
    expect(
      parseUsdToKhrRate({ result: "success", rates: { KHR: 0 } }),
    ).toBeNull();
    expect(
      parseUsdToKhrRate({
        result: "success",
        rates: { KHR: Number.POSITIVE_INFINITY },
      }),
    ).toBeNull();
    await expect(
      fetchUsdToKhrRate(async () => ({ ok: false, json: async () => ({}) })),
    ).resolves.toBeNull();
  });

  it("gates refresh to one local day", () => {
    expect(shouldRefreshExchangeRate(null, "2026-07-07")).toBe(true);
    expect(shouldRefreshExchangeRate("2026-07-06", "2026-07-07")).toBe(true);
    expect(shouldRefreshExchangeRate("2026-07-07", "2026-07-07")).toBe(false);
  });
});

describe("exchange-rate model migration", () => {
  it("keeps legacy models compatible and rejects invalid persisted rates", () => {
    const normalized = normalizeLoadedModel(
      {
        rate: Number.NaN,
        exchangeRateLastFetchedDay: "not-a-day",
        exchangeRateSource: "",
      },
      "2026-07-07",
    );

    expect(normalized.rate).toBe(RATE);
    expect(normalized.exchangeRateLastFetchedDay).toBe(
      INITIAL_MODEL.exchangeRateLastFetchedDay,
    );
    expect(normalized.exchangeRateSource).toBe(
      INITIAL_MODEL.exchangeRateSource,
    );
  });

  it("preserves valid persisted exchange-rate metadata", () => {
    const normalized = normalizeLoadedModel(
      {
        rate: 3996,
        exchangeRateLastFetchedDay: "2026-07-07",
        exchangeRateSource: "Rates by Exchange Rate API",
      },
      "2026-07-07",
    );

    expect(normalized.rate).toBe(3996);
    expect(normalized.exchangeRateLastFetchedDay).toBe("2026-07-07");
    expect(normalized.exchangeRateSource).toBe("Rates by Exchange Rate API");
  });
});
