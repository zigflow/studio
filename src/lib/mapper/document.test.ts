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
import { describe, expect, it } from 'vitest';

import type { ZigflowDocumentMeta } from '../types/zigflow';
import { fromOwsDocument, toOwsDocument } from './document';
import type { OwsDocumentMeta } from './document';

const zigflow: ZigflowDocumentMeta = {
  dsl: '1.0.0',
  taskQueue: 'order-processing',
  workflowType: 'orderProcessing',
  version: '0.1.0',
  title: 'Order Processing',
  metadata: { owner: 'payments' },
};

describe('document mapper', () => {
  it('renames Zigflow fields to OWS fields', () => {
    const ows = toOwsDocument(zigflow);
    expect(ows.namespace).toBe('order-processing');
    expect(ows.name).toBe('orderProcessing');
    expect('taskQueue' in ows).toBe(false);
    expect('workflowType' in ows).toBe(false);
    // Non-diverging fields are carried through untouched.
    expect(ows.title).toBe('Order Processing');
    expect(ows.metadata).toEqual({ owner: 'payments' });
  });

  it('round-trips Zigflow -> OWS -> Zigflow', () => {
    expect(fromOwsDocument(toOwsDocument(zigflow))).toEqual(zigflow);
  });

  it('round-trips OWS -> Zigflow -> OWS', () => {
    const ows: OwsDocumentMeta = {
      dsl: '1.0.0',
      namespace: 'billing',
      name: 'invoiceRun',
      version: '2.3.4',
    };
    expect(toOwsDocument(fromOwsDocument(ows))).toEqual(ows);
  });
});
