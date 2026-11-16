import type { BuiltInCellEditor, CellEditor, CellValueChange } from '../types';

export type EditResult = { ok: true; value: unknown } | { ok: false; message: string };

export interface ValueRules {
  parse?: (text: string, change: CellValueChange) => unknown;
  validate?: (value: unknown, change: CellValueChange) => boolean | string;
}

const INVALID = 'Invalid value';

/** The text of a number editor as a number; empty text is no value. */
export const parseNumber = (text: string) => {
  if (text.trim() === '') return undefined;

  const value = Number(text);
  if (Number.isNaN(value)) throw new Error('Not a number');
  return value;
};

/** The editor type a column uses when it names none. */
export const editorKind = (editor: CellEditor | undefined): BuiltInCellEditor | 'custom' => {
  if (editor === undefined) return 'text';
  return typeof editor === 'function' ? 'custom' : editor;
};

/** Turns what an editor holds into the value to store: strings of text editors are parsed, then everything is validated. */
export const resolveEdit = (raw: unknown, editor: CellEditor | undefined, rules: ValueRules, change: Omit<CellValueChange, 'newValue'>): EditResult => {
  const kind = editorKind(editor);
  const isText = kind === 'text' || kind === 'number';
  const parse = rules.parse ?? (kind === 'number' ? parseNumber : undefined);
  const full = { ...change, newValue: raw };
  try {
    const value = isText && typeof raw === 'string' && parse ? parse(raw, full) : raw;
    const verdict = rules.validate?.(value, { ...full, newValue: value }) ?? true;
    if (verdict === true) return { ok: true, value };
    return { ok: false, message: typeof verdict === 'string' ? verdict : INVALID };
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message ? error.message : INVALID };
  }
};
