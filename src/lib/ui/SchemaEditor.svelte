<!--
  ~ Copyright 2025 - 2026 Zigflow authors <https://github.com/zigflow/studio/graphs/contributors>
  ~
  ~ Licensed under the Apache License, Version 2.0 (the "License");
  ~ you may not use this file except in compliance with the License.
  ~ You may obtain a copy of the License at
  ~
  ~     http://www.apache.org/licenses/LICENSE-2.0
  ~
  ~ Unless required by applicable law or agreed to in writing, software
  ~ distributed under the License is distributed on an "AS IS" BASIS,
  ~ WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  ~ See the License for the specific language governing permissions and
  ~ limitations under the License.
  -->

<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import { untrack } from 'svelte';

  import type { SchemaField, SchemaFieldType } from './input-schema';
  import {
    appendChildField,
    buildSchemaDocument,
    deleteFieldDeep,
    mapFieldDeep,
    parseSchemaDocument,
    validateFields,
  } from './input-schema';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  interface Props {
    /** Initial value of input.schema.document. Parsed once on mount. */
    document: Record<string, unknown>;
    /** Called whenever fields change with the updated schema document. */
    onchange: (doc: Record<string, unknown>) => void;
  }

  let { document, onchange }: Props = $props();

  // ---------------------------------------------------------------------------
  // Field state — owns the tree after initial parse
  // ---------------------------------------------------------------------------

  // untrack: intentionally captures the initial prop value only.
  // The component owns field state after mount; the parent is notified via onchange.
  let fields = $state<SchemaField[]>(
    untrack(() => parseSchemaDocument(document)),
  );

  const errors = $derived(validateFields(fields));

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  function commit(): void {
    onchange(buildSchemaDocument(fields));
  }

  function addField(): void {
    fields = [
      ...fields,
      { id: crypto.randomUUID(), name: '', type: 'string', required: false },
    ];
    // Empty name is skipped by buildSchemaDocument — no commit needed yet.
  }

  function handleNameInput(id: string, value: string): void {
    fields = mapFieldDeep(fields, id, (f) => ({ ...f, name: value }));
    commit();
  }

  function handleTypeChange(id: string, value: SchemaFieldType): void {
    fields = mapFieldDeep(fields, id, (f) => {
      const base: SchemaField = {
        id: f.id,
        name: f.name,
        type: value,
        required: f.required,
      };
      if (value === 'object') {
        base.children = [];
      } else if (value === 'array') {
        base.items = {
          id: crypto.randomUUID(),
          name: '',
          type: 'string',
          required: false,
        };
      }
      return base;
    });
    commit();
  }

  function handleRequiredChange(id: string, checked: boolean): void {
    fields = mapFieldDeep(fields, id, (f) => ({ ...f, required: checked }));
    commit();
  }

  function handleDeleteField(id: string): void {
    fields = deleteFieldDeep(fields, id);
    commit();
  }

  function handleAddChildField(parentId: string): void {
    const child: SchemaField = {
      id: crypto.randomUUID(),
      name: '',
      type: 'string',
      required: false,
    };
    fields = appendChildField(fields, parentId, child);
    // Empty name: no commit yet.
  }

  function handleItemsTypeChange(
    arrayFieldId: string,
    value: SchemaFieldType,
  ): void {
    fields = mapFieldDeep(fields, arrayFieldId, (f) => {
      const newItems: SchemaField = {
        id: f.items?.id ?? crypto.randomUUID(),
        name: '',
        type: value,
        required: false,
      };
      if (value === 'object') {
        // Preserve existing children when re-selecting object.
        newItems.children =
          f.items?.type === 'object' ? (f.items.children ?? []) : [];
      }
      return { ...f, items: newItems };
    });
    commit();
  }
</script>

<div class="schema-editor">
  {#if fields.length > 0}
    <table class="schema-table">
      <thead>
        <tr>
          <th class="col-name">{t('input.schema.colName')}</th>
          <th class="col-type">{t('input.schema.colType')}</th>
          <th class="col-required">{t('input.schema.colRequired')}</th>
          <th class="col-delete"></th>
        </tr>
      </thead>
      <tbody>
        {@render fieldRows(fields, 0)}
      </tbody>
    </table>
  {/if}

  <button class="add-field-btn" type="button" onclick={addField}>
    {t('input.schema.addField')}
  </button>
</div>

{#snippet fieldRows(rowFields: SchemaField[], depth: number)}
  {#each rowFields as field (field.id)}
    {@const error = errors.get(field.id)}
    <tr>
      <td class="col-name">
        <div class="name-cell" style:padding-left="{depth * 1.5}rem">
          <input
            class="field-name"
            class:field-name--error={!!error}
            type="text"
            value={field.name}
            oninput={(e) =>
              handleNameInput(field.id, (e.target as HTMLInputElement).value)}
            aria-label={t('input.schema.colName')}
          />
          {#if error}
            <p class="field-error">{t(`input.schema.${error}`)}</p>
          {/if}
        </div>
      </td>
      <td class="col-type">
        <select
          class="field-type"
          value={field.type}
          onchange={(e) =>
            handleTypeChange(
              field.id,
              (e.target as HTMLSelectElement).value as SchemaFieldType,
            )}
          aria-label={t('input.schema.colType')}
        >
          <option value="string">{t('input.schema.typeString')}</option>
          <option value="number">{t('input.schema.typeNumber')}</option>
          <option value="boolean">{t('input.schema.typeBoolean')}</option>
          <option value="object">{t('input.schema.typeObject')}</option>
          <option value="array">{t('input.schema.typeArray')}</option>
        </select>
      </td>
      <td class="col-required">
        <input
          type="checkbox"
          checked={field.required}
          onchange={(e) =>
            handleRequiredChange(
              field.id,
              (e.target as HTMLInputElement).checked,
            )}
          aria-label={t('input.schema.colRequired')}
        />
      </td>
      <td class="col-delete">
        <button
          class="delete-btn"
          type="button"
          onclick={() => handleDeleteField(field.id)}
          title={t('input.schema.deleteField')}
          aria-label={t('input.schema.deleteField')}
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="12"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
            viewBox="0 0 16 16"
            width="12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline points="2 4 14 4" />
            <path d="M5 4V2h6v2" />
            <path d="M3 4l1 10h8l1-10" />
            <line x1="6.5" x2="6.5" y1="7" y2="11" />
            <line x1="9.5" x2="9.5" y1="7" y2="11" />
          </svg>
        </button>
      </td>
    </tr>

    {#if field.type === 'object'}
      {@render fieldRows(field.children ?? [], depth + 1)}
      <tr class="add-child-row">
        <td colspan="4">
          <div
            class="add-child-cell"
            style:padding-left="{(depth + 1) * 1.5}rem"
          >
            <button
              class="add-child-btn"
              type="button"
              onclick={() => handleAddChildField(field.id)}
            >
              {t('input.schema.addChildField')}
            </button>
          </div>
        </td>
      </tr>
    {/if}

    {#if field.type === 'array'}
      {@const itemsField = field.items}
      <tr class="items-row">
        <td class="col-name">
          <div class="items-label" style:padding-left="{(depth + 1) * 1.5}rem">
            {t('input.schema.itemsLabel')}:
          </div>
        </td>
        <td class="col-type">
          <select
            class="field-type"
            value={itemsField?.type ?? 'string'}
            onchange={(e) =>
              handleItemsTypeChange(
                field.id,
                (e.target as HTMLSelectElement).value as SchemaFieldType,
              )}
            aria-label={t('input.schema.colType')}
          >
            <option value="string">{t('input.schema.typeString')}</option>
            <option value="number">{t('input.schema.typeNumber')}</option>
            <option value="boolean">{t('input.schema.typeBoolean')}</option>
            <option value="object">{t('input.schema.typeObject')}</option>
          </select>
        </td>
        <td class="col-required"></td>
        <td class="col-delete"></td>
      </tr>
      {#if itemsField?.type === 'object'}
        {@render fieldRows(itemsField.children ?? [], depth + 2)}
        <tr class="add-child-row">
          <td colspan="4">
            <div
              class="add-child-cell"
              style:padding-left="{(depth + 2) * 1.5}rem"
            >
              <button
                class="add-child-btn"
                type="button"
                onclick={() => handleAddChildField(itemsField.id)}
              >
                {t('input.schema.addChildField')}
              </button>
            </div>
          </td>
        </tr>
      {/if}
    {/if}
  {/each}
{/snippet}

<style>
  .schema-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .schema-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .schema-table th {
    text-align: left;
    padding: 0.375rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #999;
    border-bottom: 1px solid #eee;
  }

  .schema-table td {
    padding: 0.375rem 0.5rem;
    vertical-align: top;
  }

  .schema-table tbody tr + tr td {
    border-top: 1px solid #f5f5f5;
  }

  .col-name {
    width: 40%;
  }

  .col-type {
    width: 22%;
  }

  .col-required {
    width: 14%;
    text-align: center;
  }

  .col-delete {
    width: 10%;
    text-align: right;
  }

  .name-cell {
    display: flex;
    flex-direction: column;
  }

  .field-name {
    width: 100%;
    padding: 0.3rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #333;
    background: #fff;
    outline: none;
    transition: border-color 0.1s;
    box-sizing: border-box;
  }

  .field-name:focus {
    border-color: #7eaaff;
    box-shadow: 0 0 0 2px #c5d8ff55;
  }

  .field-name--error {
    border-color: #e57373;
  }

  .field-error {
    margin: 0.2rem 0 0;
    font-size: 0.72rem;
    color: #c0392b;
  }

  .field-type {
    width: 100%;
    padding: 0.3rem 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.875rem;
    color: #333;
    background: #fff;
    outline: none;
    cursor: pointer;
    transition: border-color 0.1s;
    box-sizing: border-box;
  }

  .field-type:focus {
    border-color: #7eaaff;
    box-shadow: 0 0 0 2px #c5d8ff55;
  }

  .col-required input[type='checkbox'] {
    margin-top: 0.4rem;
    cursor: pointer;
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    margin-top: 0.2rem;
    margin-left: auto;
    transition:
      color 0.1s,
      background 0.1s,
      border-color 0.1s;
  }

  .delete-btn:hover {
    color: #c0392b;
    background: #fdecea;
    border-color: #f5c6c2;
  }

  .items-label {
    padding-top: 0.35rem;
    font-size: 0.8rem;
    color: #888;
    font-style: italic;
  }

  .add-child-cell {
    padding: 0.125rem 0;
  }

  .add-child-btn {
    padding: 0.2rem 0.5rem;
    border: 1px dashed #ccc;
    border-radius: 4px;
    background: transparent;
    font-size: 0.75rem;
    color: #888;
    cursor: pointer;
    transition:
      border-color 0.1s,
      color 0.1s;
  }

  .add-child-btn:hover {
    border-color: #999;
    color: #333;
  }

  .add-field-btn {
    align-self: flex-start;
    padding: 0.375rem 0.75rem;
    border: 1px dashed #ccc;
    border-radius: 6px;
    background: transparent;
    font-size: 0.8rem;
    color: #666;
    cursor: pointer;
    transition:
      border-color 0.1s,
      color 0.1s;
  }

  .add-field-btn:hover {
    border-color: #999;
    color: #333;
  }
</style>
