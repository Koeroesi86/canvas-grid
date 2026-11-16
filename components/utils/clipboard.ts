import type { Bounds } from './selection';

/** Most cells one copy puts on the clipboard, so selecting everything in a huge grid cannot freeze the page. */
export const MAX_COPY_CELLS = 1_000_000;

/** Text as one field of tab-separated values: wrapped in quotes, with quotes doubled, when it holds a tab, a line break or a quote, as spreadsheets do. */
export const escapeField = (text: string) => (/[\t\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);

export interface CopiedText {
  text: string;
  /** Rows were left off to stay within `MAX_COPY_CELLS`. */
  truncated: boolean;
}

/**
 * The cells of `bounds` as tab-separated values, a row per line, from the text `textAt` gives for each cell.
 * Stops after as many whole rows as fit in `maxCells`, but always includes one.
 */
export const toTsv = (bounds: Bounds, textAt: (row: number, column: number) => string, maxCells = MAX_COPY_CELLS): CopiedText => {
  const width = bounds.right - bounds.left + 1;
  const height = bounds.bottom - bounds.top + 1;
  const rows = Math.min(height, Math.max(1, Math.floor(maxCells / width)));
  const lines = Array.from({ length: rows }, (_, offset) =>
    Array.from({ length: width }, (__, column) => escapeField(textAt(bounds.top + offset, bounds.left + column))).join('\t'));
  return { text: lines.join('\r\n'), truncated: rows < height };
};
