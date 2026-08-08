export function substituteMergeFields(text: string, values: Record<string, string>): string {
  return text.replace(/%%(\w+)%%/g, (_, key: string) => values[key] ?? "");
}
