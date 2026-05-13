export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '');
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

export function isValidDomain(input: string): boolean {
  if (!input || /\s/.test(input)) return false;
  if (/^https?:\/\//i.test(input)) return false;
  return DOMAIN_RE.test(input);
}
