import type { CategoryPort } from '../../ports';

/**
 * TEMPORARY static categories (no category API yet; products carry a `categoryId` with nothing behind it).
 * Clicking a category runs a text search with its name — a display aid, not a real filter.
 */
export function createStaticCategories(): CategoryPort {
  const list = [
    { id: 'milk-tea', name: 'Milk tea', icon: '🧋' },
    { id: 'coffee', name: 'Coffee', icon: '☕' },
    { id: 'rice', name: 'Rice', icon: '🍚' },
    { id: 'noodles', name: 'Noodles', icon: '🍜' },
    { id: 'bakery', name: 'Bakery', icon: '🥐' },
    { id: 'snacks', name: 'Snacks', icon: '🍿' },
    { id: 'fruit', name: 'Fruit', icon: '🍉' },
    { id: 'grocery', name: 'Grocery', icon: '🛒' },
  ];
  return { list: () => list };
}
