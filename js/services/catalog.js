// In-memory product/category/party cache for instant search. IndexedDB remains the source of truth.
import * as idb from '../db/idb.js';
import { lc, localDate } from '../core/utils.js';

const products = new Map();
const categories = new Map();
const byBarcode = new Map();
const parties = { customers: new Map(), suppliers: new Map() };

function indexProduct(p) {
  const old = products.get(p.id);
  if (old?.barcode) byBarcode.delete(lc(old.barcode));
  products.set(p.id, p);
  if (p.barcode) byBarcode.set(lc(p.barcode), p);
  p._s = lc([p.name, p.brand, p.shade, p.batchNo, p.sku, p.barcode, categories.get(p.categoryId)?.name].filter(Boolean).join(' '));
}

export async function load() {
  const [ps, cs, cus, sups] = await idb.read(['products', 'categories', 'customers', 'suppliers'], (t) =>
    Promise.all([t.getAll('products'), t.getAll('categories'), t.getAll('customers'), t.getAll('suppliers')]));
  products.clear(); categories.clear(); byBarcode.clear(); parties.customers.clear(); parties.suppliers.clear();
  cs.forEach((c) => categories.set(c.id, c));
  ps.forEach(indexProduct);
  cus.forEach((c) => parties.customers.set(c.id, c));
  sups.forEach((s) => parties.suppliers.set(s.id, s));
}

export async function refreshProducts(ids) {
  const fresh = await idb.read(['products'], (t) => Promise.all(ids.map((id) => t.get('products', id))));
  ids.forEach((id, i) => {
    if (fresh[i]) indexProduct(fresh[i]);
    else { const old = products.get(id); if (old?.barcode) byBarcode.delete(lc(old.barcode)); products.delete(id); }
  });
}
export async function refreshCategories() {
  const cs = await idb.getAll('categories');
  categories.clear(); cs.forEach((c) => categories.set(c.id, c));
  products.forEach(indexProduct);
}
export async function refreshParty(kind, id) {
  const p = await idb.get(kind, id);
  if (p) parties[kind].set(id, p); else parties[kind].delete(id);
}

export const product = (id) => products.get(id);
export const allProducts = () => [...products.values()];
export const category = (id) => categories.get(id);
export const allCategories = () => [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
export const party = (kind, id) => parties[kind].get(id);
export const allParties = (kind) => [...parties[kind].values()];

export function findByCode(code) {
  const c = lc(code);
  if (!c) return null;
  const p = byBarcode.get(c);
  if (p && p.active) return p;
  for (const x of products.values()) if (x.active && x.sku && lc(x.sku) === c) return x;
  return null;
}

// Products nearing expiry are flagged this many days ahead.
export const EXPIRY_WARN_DAYS = 60;

// Expiry state of a product: null when it has no expiry date, otherwise { days, state } where days is the
// whole number of days until expiry (negative once expired) and state is 'expired', 'soon' or 'ok'.
export function expiryInfo(p) {
  if (!p?.expiryDate) return null;
  const end = new Date(p.expiryDate + 'T00:00:00');
  const start = new Date(localDate() + 'T00:00:00');
  const days = Math.round((end - start) / 86400000);
  return { days, state: days < 0 ? 'expired' : days <= EXPIRY_WARN_DAYS ? 'soon' : 'ok' };
}

export function searchProducts(q, { limit = 40, categoryId = null, includeInactive = false } = {}) {
  const terms = lc(q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const p of products.values()) {
    if (!includeInactive && !p.active) continue;
    if (categoryId && p.categoryId !== categoryId) continue;
    if (terms.every((t) => p._s.includes(t))) {
      out.push(p);
      if (!terms.length && out.length >= limit * 4) break;
    }
  }
  const q0 = lc(q);
  out.sort((a, b) => {
    const ea = (lc(a.barcode) === q0 || lc(a.sku) === q0) ? 0 : 1;
    const eb = (lc(b.barcode) === q0 || lc(b.sku) === q0) ? 0 : 1;
    return ea - eb || a.name.localeCompare(b.name);
  });
  return out.slice(0, limit);
}

export function searchParties(kind, q, limit = 50) {
  const terms = lc(q).split(/\s+/).filter(Boolean);
  return allParties(kind)
    .filter((p) => p.active && terms.every((t) => lc(`${p.name} ${p.phone || ''} ${p.email || ''}`).includes(t)))
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
}
