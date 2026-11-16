import type { BuiltInCellEditor, CellEditor, CellEditorContext, CellEditorInstance, SelectOption } from '../types';

const asText = (value: unknown) => (value === undefined || value === null ? '' : String(value));

const createInput = (type: string) => {
  const input = document.createElement('input');
  input.type = type;
  return input;
};

/** Selects the whole text, or puts the caret after the key that opened the editor. */
const focusText = (input: HTMLInputElement, typed: boolean) => {
  input.focus({ preventScroll: true });
  if (typed) input.setSelectionRange(input.value.length, input.value.length);
  else input.select();
};

const createTextEditor = ({ value, initialText }: CellEditorContext): CellEditorInstance => {
  const input = createInput('text');
  input.value = initialText ?? asText(value);
  return { element: input, getValue: () => input.value, focus: () => focusText(input, initialText !== undefined) };
};

/**
 * A text box with the numeric keypad on touch screens, aligned like the cell it covers. It is not `type="number"`, which hides what was typed when it
 * is not a number (so a typo would clear the cell), steps on arrow keys and wheel, and shows spin buttons; the parser reports a bad number instead.
 */
const createNumberEditor = ({ value, initialText }: CellEditorContext): CellEditorInstance => {
  const input = createInput('text');
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.classList.add('number');
  input.value = initialText ?? asText(value);
  return { element: input, getValue: () => input.value, focus: () => focusText(input, initialText !== undefined) };
};

const createCheckboxEditor = ({ value }: CellEditorContext): CellEditorInstance => {
  const input = createInput('checkbox');
  input.checked = value === true;
  return { element: input, getValue: () => input.checked, focus: () => input.focus({ preventScroll: true }) };
};

const toOption = (option: string | number | SelectOption): SelectOption => (typeof option === 'object' ? option : { value: option });

/** A dropdown that opens at once and commits when an option is picked. A value outside the options is listed first, so leaving it alone keeps it. */
const createSelectEditor = (options: readonly (string | number | SelectOption)[], { value, commit }: CellEditorContext): CellEditorInstance => {
  const listed = options.map(toOption);
  const entries = listed.some(entry => entry.value === value) ? listed : [{ value, label: asText(value) }, ...listed];
  const select = document.createElement('select');
  select.replaceChildren(...entries.map(({ value: optionValue, label }) => new Option(label ?? asText(optionValue))));
  select.selectedIndex = Math.max(0, entries.findIndex(entry => entry.value === value));
  select.addEventListener('change', commit);
  return {
    element: select,
    getValue: () => entries[select.selectedIndex]?.value,
    focus() {
      select.focus({ preventScroll: true });
      try {
        select.showPicker();
      } catch {
        // needs a user action and browser support; the focused select still works from the keyboard
      }
    },
  };
};

const createBuiltIn = (editor: BuiltInCellEditor, context: CellEditorContext) => {
  if (editor === 'checkbox') return createCheckboxEditor(context);
  if (typeof editor === 'object') return createSelectEditor(editor.options, context);
  return editor === 'number' ? createNumberEditor(context) : createTextEditor(context);
};

/** Builds the editor a column asks for; a column without one edits text. */
export const createEditor = (editor: CellEditor | undefined, context: CellEditorContext): CellEditorInstance =>
  typeof editor === 'function' ? editor(context) : createBuiltIn(editor ?? 'text', context);

/** Whether typing a character on the cell can start this editor. */
export const startsByTyping = (editor: CellEditor | undefined) => editor === undefined || typeof editor === 'function' || editor === 'text' || editor === 'number';
