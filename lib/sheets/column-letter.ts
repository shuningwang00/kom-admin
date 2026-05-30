/** 0-based column index → A1 letter (0 = A, 10 = K). */
export function columnIndexToLetter(index: number): string {
  let result = "";
  let i = index;
  while (i >= 0) {
    result = String.fromCharCode((i % 26) + 65) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}
