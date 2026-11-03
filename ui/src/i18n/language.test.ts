import { afterEach, describe, expect, it, vi } from "vitest";

import { detectLocale, isSupportedLocale, LANGUAGE_STORAGE_KEY } from "./language";

describe("language detection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubEnv(storage: Record<string, string> = {}, languages: string[] = []) {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage[key] ?? null,
      },
    });
    vi.stubGlobal("navigator", { languages });
  }

  it("knows which locales are supported", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("zh-CN")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
  });

  it("prefers an explicit stored choice", () => {
    stubEnv({ [LANGUAGE_STORAGE_KEY]: "zh-CN" }, ["en-US"]);
    expect(detectLocale()).toBe("zh-CN");
  });

  it("ignores an unsupported stored value", () => {
    stubEnv({ [LANGUAGE_STORAGE_KEY]: "xx-YY" }, ["en-US"]);
    expect(detectLocale()).toBe("en");
  });

  it("matches an exact browser locale before any base-language match", () => {
    stubEnv({}, ["en-US", "zh-CN"]);
    // Exact matches win across the whole preference list, even when an
    // earlier candidate only matches at the base-language level.
    expect(detectLocale()).toBe("zh-CN");
  });

  it("falls back to the base language for regional variants (zh-TW → zh-CN)", () => {
    stubEnv({}, ["zh-TW", "en-US"]);
    expect(detectLocale()).toBe("zh-CN");
  });

  it("defaults to English when nothing matches", () => {
    stubEnv({}, ["fr-FR", "de-DE"]);
    expect(detectLocale()).toBe("en");
  });

  it("defaults to English without any signals", () => {
    stubEnv();
    expect(detectLocale()).toBe("en");
  });
});
