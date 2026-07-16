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
// Refreshes the bundled Zigflow schema used by src/lib/schema/validate.ts.
// Run with `npm run update-schema`. See DESIGN.md §4.
//
// The schema is sourced *only* from the Zigflow CLI (`zigflow schema -o yaml`).
// There is deliberately no fallback to fetching the public website: the CLI is
// the final authority on what a workflow must satisfy, so bundling from anywhere
// else would risk the editor validating against a different definition than the
// CLI/runtime actually enforces. If the CLI is unavailable we fail loudly rather
// than succeed quietly from a second source.
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DEST = fileURLToPath(
  new URL('../src/lib/schema/zigflow.schema.yaml', import.meta.url),
);

const result = spawnSync('zigflow', ['schema', '-o', 'yaml'], {
  encoding: 'utf8',
});

if (result.error?.code === 'ENOENT') {
  console.error(
    'The `zigflow` CLI was not found on PATH, and it is required to update the ' +
      'bundled schema.\n' +
      "This project's devcontainer and GitHub Action install it for you; run " +
      'this command there, or install the CLI from https://zigflow.dev.\n' +
      'The existing src/lib/schema/zigflow.schema.yaml was left unchanged.',
  );
  process.exit(1);
}

if (result.error || result.status !== 0) {
  const detail = result.error
    ? result.error.message
    : `exited with code ${result.status}${
        result.stderr ? `:\n${result.stderr.trim()}` : ''
      }`;
  console.error(
    `\`zigflow schema -o yaml\` failed (${detail}).\n` +
      'The existing src/lib/schema/zigflow.schema.yaml was left unchanged.',
  );
  process.exit(1);
}

const schema = result.stdout;
await writeFile(DEST, schema, 'utf8');

// Surface what was bundled so it is obvious after the fact.
const id = schema.match(/^\$id:\s*(\S+)/m)?.[1] ?? '(no $id found)';
const version = id.match(/schemas\/([^/]+)\//)?.[1] ?? 'unknown';
console.log(
  `Updated ${DEST} (${schema.length} bytes) from the Zigflow CLI.\n` +
    `  $id: ${id}\n` +
    `  version: ${version}`,
);
