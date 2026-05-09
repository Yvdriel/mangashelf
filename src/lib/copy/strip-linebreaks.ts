export function stripLinebreaks(s: string): string {
  return s.replace(/\r\n?|\n/g, "");
}
