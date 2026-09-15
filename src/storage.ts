/** localStorage boundary. `loadDishes` and `saveDishes` never call each other. */
import { reviveDish, type Dish } from './domain';

export const STORAGE_KEY = 'wandering-palate-dishes';

export type LoadResult = { ok: true; dishes: Dish[] } | { ok: false; reason: 'read' };
export type SaveResult = { ok: true } | { ok: false; reason: 'write' };

export function loadDishes(): LoadResult {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === null) return { ok: true, dishes: [] };
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) throw new TypeError('stored value is not a list');
		const dishes: Dish[] = [];
		for (const entry of parsed) {
			const dish = reviveDish(entry);
			if (dish === null) throw new TypeError('stored entry is not a dish');
			dishes.push(dish);
		}
		return { ok: true, dishes };
	} catch {
		return { ok: false, reason: 'read' };
	}
}

export function saveDishes(dishes: readonly Dish[]): SaveResult {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(dishes));
		return { ok: true };
	} catch {
		return { ok: false, reason: 'write' };
	}
}
