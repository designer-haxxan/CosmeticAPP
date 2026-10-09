// One-time setup of a new device: a starter set of cosmetics and retail categories.
// It runs once (flag in meta). Existing data is never changed: categories are only added when there are none.
import * as idb from '../db/idb.js';
import { uuid, nowISO } from '../core/utils.js';

const FLAG = 'seededCosmeticsCategories';
const STARTER_CATEGORIES = ['Skincare', 'Makeup', 'Haircare', 'Fragrance', 'Nails', 'Bath & Body', "Men's grooming", 'Tools & Accessories', 'Wellness'];

export async function seedStarterCategories() {
  await idb.write(['meta', 'categories'], async (t) => {
    if (await t.get('meta', FLAG)) return;
    if (!(await t.getAll('categories')).length) {
      const now = nowISO();
      for (const name of STARTER_CATEGORIES) {
        await t.add('categories', { id: uuid(), name, nameLc: name.toLowerCase(), createdAt: now, updatedAt: now });
      }
    }
    await t.put('meta', { key: FLAG, value: true });
  });
}
