// Pure hash-route parsing. No DOM access, so it can be unit tested.

export const MODULE_ROUTES = ['circuits', 'rc', 'capacitors', 'fields'];
export const HIDDEN_ROUTES = ['kitchen-sink'];

/**
 * Parse a location hash like "#/circuits/parallel" into { top, sub }.
 * Unknown or empty hashes resolve to the home route (top === '').
 */
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const path = raw.replace(/^\/+/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  const top = parts[0] || '';
  const sub = parts.slice(1).join('/');
  const known = top === '' || MODULE_ROUTES.includes(top) || HIDDEN_ROUTES.includes(top);
  return known ? { top, sub } : { top: '', sub: '' };
}

export function buildHash(top, sub) {
  if (!top) return '#/';
  return sub ? `#/${top}/${sub}` : `#/${top}`;
}
