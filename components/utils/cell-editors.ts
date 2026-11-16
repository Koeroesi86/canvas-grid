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

/** Most rows the list shows before it scrolls, and the room it keeps from the window's edge, in px. */
const LIST_MAX_HEIGHT = 240;
const LIST_MARGIN = 8;

/**
 * A dropdown drawn by the grid, since the browser's own list cannot follow the theme and clips its text in short rows. It opens at once,
 * arrows and typing move through the options, a click picks one and commits. The list sits in the top layer, so no cell or scroll area clips it.
 * A value outside the options is listed first, so leaving it alone keeps it.
 */
const createSelectEditor = (options: readonly (string | number | SelectOption)[], { value, commit }: CellEditorContext): CellEditorInstance => {
  const listed = options.map(toOption);
  const entries = listed.some(entry => entry.value === value) ? listed : [{ value, label: asText(value) }, ...listed];
  const labelOf = (entry: SelectOption) => entry.label ?? asText(entry.value);
  let index = Math.max(0, entries.findIndex(entry => entry.value === value));
  let open = false;

  const box = document.createElement('div');
  box.className = 'cellSelect';
  box.tabIndex = 0;
  box.role = 'combobox';
  box.ariaHasPopup = 'listbox';
  const label = document.createElement('span');
  label.className = 'cellSelectLabel';
  const list = document.createElement('div');
  list.className = 'cellSelectList';
  list.role = 'listbox';
  list.popover = 'manual';
  box.append(label, list);

  const items = entries.map((entry, position) => {
    const item = document.createElement('div');
    item.role = 'option';
    item.textContent = labelOf(entry);
    // the editor keeps the focus, or leaving it would commit
    item.addEventListener('pointerdown', event => event.preventDefault());
    item.addEventListener('click', () => {
      choose(position);
      commit();
    });
    return item;
  });
  list.append(...items);

  function choose(position: number) {
    index = position;
    label.textContent = labelOf(entries[position]);
    items.forEach((item, at) => {
      item.classList.toggle('active', at === position);
      item.ariaSelected = String(at === position);
    });
    items[position]?.scrollIntoView({ block: 'nearest' });
  }

  const place = (visible: boolean) => {
    const show = open && visible;
    box.ariaExpanded = String(open);
    if (show !== list.matches(':popover-open')) {
      if (show) list.showPopover();
      else list.hidePopover();
    }
    if (!show) return;

    const rect = box.getBoundingClientRect();
    const height = Math.min(list.scrollHeight, LIST_MAX_HEIGHT);
    const below = window.innerHeight - rect.bottom - LIST_MARGIN;
    const above = rect.top - LIST_MARGIN;
    const upwards = height > below && above > below;
    list.style.maxHeight = `${Math.min(LIST_MAX_HEIGHT, upwards ? above : below)}px`;
    list.style.minWidth = `${rect.width}px`;
    list.style.left = `${rect.left}px`;
    list.style.top = `${upwards ? rect.top - Math.min(height, above) : rect.bottom}px`;
    items[index]?.scrollIntoView({ block: 'nearest' });
  };

  const typeAhead = (key: string) => {
    const wanted = key.toLowerCase();
    const order = [...entries.keys()].map((_, step) => (index + 1 + step) % entries.length);
    const found = order.find(position => labelOf(entries[position]).toLowerCase().startsWith(wanted));
    if (found !== undefined) choose(found);
  };

  box.addEventListener('pointerdown', event => {
    // a press on an option is the option's, and closing the list now would swallow its click
    if (event.target instanceof Node && list.contains(event.target)) return;

    event.preventDefault();
    box.focus({ preventScroll: true });
    open = !open;
    place(true);
  });
  box.addEventListener('keydown', event => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    const typed = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (step === undefined && !typed) return;

    event.preventDefault();
    open = true;
    if (step === undefined) typeAhead(event.key);
    else choose(Math.max(0, Math.min(entries.length - 1, index + step)));
    place(true);
  });

  choose(index);
  return {
    element: box,
    getValue: () => entries[index]?.value,
    focus() {
      box.focus({ preventScroll: true });
      open = true;
      place(true);
    },
    place,
    destroy() {
      open = false;
      place(false);
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
