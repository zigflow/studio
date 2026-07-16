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
import type { ZigflowDocumentMeta } from '../types/zigflow';

/**
 * The one divergence between Zigflow and OWS is a pair of renamed `document`
 * fields (DESIGN.md §2.2):
 *
 * | OWS         | Zigflow        |
 * | ----------- | -------------- |
 * | `namespace` | `taskQueue`    |
 * | `name`      | `workflowType` |
 *
 * Nothing else in the document — or anywhere else in the workflow — diverges.
 * These mappers are a pure bidirectional rename, used *only* at boundaries where
 * OWS-shaped tooling is needed. The app's internal model, storage format, and
 * API always use Zigflow's field names; the mapper is not on the hot path.
 */

/** The OWS-shaped equivalent of {@link ZigflowDocumentMeta}. */
export interface OwsDocumentMeta {
  dsl: string;
  namespace: string;
  name: string;
  version: string;
  title?: string;
  summary?: string;
  tags?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/** Rename a Zigflow document into its OWS form (`taskQueue`→`namespace`, `workflowType`→`name`). */
export function toOwsDocument(doc: ZigflowDocumentMeta): OwsDocumentMeta {
  const { taskQueue, workflowType, ...rest } = doc;
  return { ...rest, namespace: taskQueue, name: workflowType };
}

/** Rename an OWS document into its Zigflow form (`namespace`→`taskQueue`, `name`→`workflowType`). */
export function fromOwsDocument(doc: OwsDocumentMeta): ZigflowDocumentMeta {
  const { namespace, name, ...rest } = doc;
  return { ...rest, taskQueue: namespace, workflowType: name };
}
