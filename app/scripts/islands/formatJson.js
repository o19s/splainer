/**
 * formatJson — pretty-print a JSON string with 2-space indent.
 * Returns the original string unchanged if parsing fails.
 */
export function formatJson(str) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch (_e) {
    return str;
  }
}
