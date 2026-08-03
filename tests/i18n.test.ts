import assert from "node:assert/strict";
import test from "node:test";
import { enMessages, translateMessage, zhCNMessages } from "../app/i18n/catalogs.ts";
import {
  formatTemplate,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
  resolveLocale,
} from "../app/i18n/core.ts";
import { formatUserMessage, issue, message } from "../app/i18n/user-message.ts";

test("locale resolution prefers a saved language and normalizes browser variants", () => {
  assert.equal(normalizeLocale("zh_Hans_CN"), "zh-CN");
  assert.equal(normalizeLocale("en-GB"), "en");
  assert.equal(normalizeLocale("fr-FR"), null);
  assert.equal(resolveLocale("en", ["zh-CN"]), "en");
  assert.equal(resolveLocale("invalid", ["fr-FR", "zh-HK"]), "zh-CN");
  assert.equal(resolveLocale(null, ["fr-FR"]), "en");
  assert.equal(LOCALE_STORAGE_KEY, "peach-patch.locale.v1");
});

test("stable message descriptors retranslate nested counts when the locale changes", () => {
  const status = message("status.registry.ready", {
    modules: message("count.modules", { count: 2 }),
  });
  assert.equal(
    formatUserMessage((key, values) => translateMessage("en", key, values), status),
    "GitHub registry ready · 2 modules",
  );
  assert.equal(
    formatUserMessage((key, values) => translateMessage("zh-CN", key, values), status),
    "GitHub 注册表已就绪 · 2 个模块",
  );
  assert.equal(
    formatUserMessage(
      (key, values) => translateMessage("zh-CN", key, values),
      issue(new Error("native browser detail"), "errors.patchInvalid"),
    ),
    "这不是受支持的有效 .vcv 补丁。",
  );
});

test("English and Simplified Chinese catalogs have exact key parity", () => {
  assert.deepEqual(Object.keys(zhCNMessages).sort(), Object.keys(enMessages).sort());
  for (const [key, template] of Object.entries(zhCNMessages)) {
    assert.ok(typeof template === "string" ? template.length > 0 : template.other.length > 0, key);
  }
});

test("translations preserve every interpolation placeholder", () => {
  const placeholders = (template: string | Readonly<Record<string, string>>) =>
    new Set(
      (typeof template === "string" ? [template] : Object.values(template)).flatMap((value) =>
        [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]),
      ),
    );
  for (const key of Object.keys(enMessages) as Array<keyof typeof enMessages>) {
    assert.deepEqual(
      [...placeholders(zhCNMessages[key])].sort(),
      [...placeholders(enMessages[key])].sort(),
      key,
    );
  }
});

test("message formatting interpolates localized values and plural forms", () => {
  assert.equal(
    formatTemplate("en", { one: "{count} module", other: "{count} modules" }, { count: 1 }),
    "1 module",
  );
  assert.equal(
    formatTemplate("en", { one: "{count} module", other: "{count} modules" }, { count: 1200 }),
    "1,200 modules",
  );
  assert.equal(
    formatTemplate("zh-CN", { other: "{count} 个模块" }, { count: 1200 }),
    "1,200 个模块",
  );
  assert.equal(formatTemplate("en", "Load {module}", { module: "Core/Audio" }), "Load Core/Audio");
  assert.equal(formatTemplate("en", "Keep {missing}"), "Keep {missing}");
});
