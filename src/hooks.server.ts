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
import { paraglideMiddleware } from '$lib/paraglide/server';
import type { Handle } from '@sveltejs/kit';

/**
 * Resolve the request locale per DESIGN.md §6: server-side, from the browser's
 * `Accept-Language` header only (the `preferredLanguage` strategy configured on
 * the Paraglide plugin), falling back to `en` (`baseLocale`). There is no cookie,
 * URL, or in-app switcher. Paraglide's middleware makes the resolved locale
 * request-scoped via `AsyncLocalStorage`, so concurrent requests don't leak.
 */
export const handle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;
    return resolve(event, {
      transformPageChunk: ({ html }) =>
        html.replace('%paraglide.lang%', locale),
    });
  });
