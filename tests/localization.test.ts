import { describe, expect, it } from "vitest";

import { categoryLabel, t } from "../src/app/i18n";

describe("localization helpers", () => {
  it("translates key app chrome to Khmer", () => {
    expect(t("km", "nav.home")).toBe("ទំព័រដើម");
    expect(t("km", "settings.language")).toBe("ភាសា");
    expect(t("km", "add.title")).toBe("បន្ថែមប្រតិបត្តិការ");
  });

  it("falls back to English for untranslated Khmer strings", () => {
    expect(t("km", "settings.exportJsonBackup")).toBe("Export JSON backup");
    expect(t("km", "app.version")).toBe("Spend calm · v1.0");
  });

  it("localizes starter category labels without changing custom labels", () => {
    expect(categoryLabel({ key: "food", label: "Food & drinks" }, "km")).toBe(
      "អាហារ និងភេសជ្ជៈ",
    );
    expect(categoryLabel({ key: "market", label: "Local market" }, "km")).toBe(
      "Local market",
    );
  });
});
