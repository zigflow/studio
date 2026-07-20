/*
 * Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Guards Paraglide locale files against duplication (DESIGN.md §6, i18n).
// Run with `npm run check:locales`.
//
// A non-base locale's message file must not:
//   1. repeat the base locale's value for a key byte-for-byte — such a key adds
//      nothing (the base is the fallback) and only drifts out of sync; and
//   2. contain a key the base locale lacks (an "orphan") — the base is the
//      fallback, so every non-base key must have a base to fall back to; an
//      orphan signals a real bug, not just redundancy.
//
// The base locale, the locale list, and the message-file path are all read from
// `project.inlang/settings.json`, so adding a future locale (fr, fr-CA, …) is
// covered automatically with no change to this guard.
import { readFileSync } from 'node:fs';

// Repo root, regardless of the caller's cwd (this file lives in scripts/).
const ROOT = new URL('../', import.meta.url);

const settings = JSON.parse(
  readFileSync(new URL('project.inlang/settings.json', ROOT), 'utf8'),
);

const baseLocale = settings.baseLocale;
const locales = settings.locales ?? [];
const pathPattern =
  settings['plugin.inlang.messageFormat']?.pathPattern ??
  './messages/{locale}.json';

/** Resolve a locale's message file from the inlang `pathPattern` (repo-relative). */
function fileFor(locale) {
  const relative = pathPattern.replace('{locale}', locale).replace(/^\.\//, '');
  return new URL(relative, ROOT);
}

/** Parse a locale's messages, or null if the file doesn't exist yet. */
function loadMessages(locale) {
  try {
    return JSON.parse(readFileSync(fileFor(locale), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

// `$`-prefixed keys (e.g. `$schema`) are message-format metadata, not
// translations — they are legitimately identical across every locale file.
const isMessageKey = (key) => !key.startsWith('$');

const base = loadMessages(baseLocale);
if (base === null) {
  console.error(
    `Base locale "${baseLocale}" has no message file (expected ${pathPattern.replace('{locale}', baseLocale)}).`,
  );
  process.exit(1);
}

/** @type {{ locale: string, duplicates: string[], orphans: string[] }[]} */
const problems = [];

for (const locale of locales) {
  if (locale === baseLocale) {
    continue;
  }
  const messages = loadMessages(locale);
  if (messages === null) {
    continue; // No file for this locale yet — nothing to compare.
  }

  const duplicates = [];
  const orphans = [];
  for (const key of Object.keys(messages)) {
    if (!isMessageKey(key)) {
      continue;
    }
    if (!(key in base)) {
      orphans.push(key);
    } else if (JSON.stringify(base[key]) === JSON.stringify(messages[key])) {
      duplicates.push(key);
    }
  }

  if (duplicates.length > 0 || orphans.length > 0) {
    problems.push({ locale, duplicates, orphans });
  }
}

if (problems.length > 0) {
  console.error('Locale duplication check FAILED.\n');
  for (const { locale, duplicates, orphans } of problems) {
    if (duplicates.length > 0) {
      console.error(
        `  ${locale}: ${duplicates.length} key(s) byte-identical to base "${baseLocale}" — remove them so they fall back to ${baseLocale}:`,
      );
      for (const key of duplicates) {
        console.error(`      - ${key}`);
      }
    }
    if (orphans.length > 0) {
      console.error(
        `  ${locale}: ${orphans.length} key(s) missing from base "${baseLocale}" (orphans — likely a real bug, not duplication):`,
      );
      for (const key of orphans) {
        console.error(`      - ${key}`);
      }
    }
    console.error('');
  }
  process.exit(1);
}

const others = locales.filter((locale) => locale !== baseLocale);
console.log(
  `Locale duplication check passed: ${others.length} non-base locale(s) [${others.join(', ')}] carry only values that differ from base "${baseLocale}".`,
);
