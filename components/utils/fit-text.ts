/**
 * Cuts `text` to fit `available` pixels, ending in `ellipsis` when something was cut.
 * `widthOf` gives the width of one character; the width of the text is the sum of its characters.
 */
const fitText = (text: string, available: number, ellipsis: string, widthOf: (character: string) => number) => {
  let used = 0;
  let end = 0;
  while (end < text.length) {
    const width = widthOf(text.charAt(end));
    if (used + width > available) break;
    used += width;
    end++;
  }
  if (end === text.length) return text;

  // the ellipsis needs room too: give up characters until it fits
  const ellipsisWidth = widthOf(ellipsis);
  while (end > 0 && used + ellipsisWidth > available) {
    end--;
    used -= widthOf(text.charAt(end));
  }
  return used + ellipsisWidth > available ? '' : text.slice(0, end) + ellipsis;
};

export default fitText;
