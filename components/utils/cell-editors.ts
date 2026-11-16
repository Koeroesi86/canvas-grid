import type { BuiltInCellEditor, CellEditor, CellEditorContext, CellEditorInstance, SelectOption } from '../types';

const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const createInput = (type: string) => {
  const input = document.createElement('input');
  input.type = type;
  return input;
};

/** A text or number box: starts with the key that opened it, or with the value selected. */
const createTextEditor = (type: 'text' | 'number', { value, initialText }: CellEditorContext): CellEditorInstance => {
  const input = createInput(type);
  input.value = initialText ?? asText(value);
  return {
    element: input,
    getValue: () => input.value,
    focus() {
      input.focus({ preventScroll: true });
      if (initialText === undefined) input.select();
      else input.setSelectionRange(input.value.length, input.value.length);
    },
  };
};

const createCheckboxEditor = ({ value }: CellEditorContext): CellEditorInstance => {
  const input = createInput('checkbox');
  input.checked = value === true;
  return { element: input, getValue: () => input.checked, focus: () => input.focus({ preventScroll: true }) };
};

const toOption = (option: string | number | SelectOption): SelectOption => (typeof option === 'object' ? option : { value: option });

const createSelectEditor = (options: readonly (string | number | SelectOption)[], { value }: CellEditorContext): CellEditorInstance => {
  const entries = options.map(toOption);
  const select = document.createElement('select');
  select.replaceChildren(...entries.map(({ value: optionValue, label }) => new Option(label ?? asText(optionValue))));
  select.selectedIndex = Math.max(0, entries.findIndex(entry => entry.value === value));
  return { element: select, getValue: () => entries[select.selectedIndex]?.value, focus: () => select.focus({ preventScroll: true }) };
};

const createBuiltIn = (editor: BuiltInCellEditor, context: CellEditorContext) => {
  if (editor === 'checkbox') return createCheckboxEditor(context);
  if (typeof editor === 'object') return createSelectEditor(editor.options, context);
  return createTextEditor(editor, context);
};

/** Builds the editor a column asks for; a column without one edits text. */
export const createEditor = (editor: CellEditor | undefined, context: CellEditorContext): CellEditorInstance =>
  typeof editor === 'function' ? editor(context) : createBuiltIn(editor ?? 'text', context);

/** Whether typing a character on the cell can start this editor. */
export const startsByTyping = (editor: CellEditor | undefined) => editor === undefined || typeof editor === 'function' || editor === 'text' || editor === 'number';
