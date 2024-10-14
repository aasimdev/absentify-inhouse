export function replacePlaceholder(
  text: string,
  placeholders: { name: string; value: string | null }[]
) {
  for (let index = 0; index < placeholders.length; index++) {
    const element = placeholders[index];
    if (!element) continue;
    text = replaceAll(text, `{{${element.name}}}`, `${element.value}`);
    text = replaceAll(text, `@{${element.name}}`, `${element.value}`);
  }

  return text;
}
function replaceAll(target: string, search: string, replacement: string) {
  return target.split(search).join(replacement);
}
