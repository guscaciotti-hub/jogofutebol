/** Seed lives in the hash (works inside embedded viewers that own the query string); ?seed= is still read for old links. */
export function readSeed(): string | null {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  return hash.get('seed') ?? new URLSearchParams(location.search).get('seed');
}

export function seedUrl(seed: string): string {
  return `${location.pathname}${location.search}#seed=${encodeURIComponent(seed)}`;
}

export function goToSeed(seed: string): void {
  location.hash = `seed=${encodeURIComponent(seed)}`;
  location.reload();
}
