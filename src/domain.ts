/** Pure domain logic. No DOM, no localStorage, no clock. */

export type Dish = {
	id: string;
	name: string;
	restaurant: string;
	area: string;
	note: string;
	cuisine: string;
	tried: boolean;
	dateAdded: number;
};

export type Draft = Pick<Dish, 'name' | 'restaurant' | 'area' | 'note' | 'cuisine'>;
export type Field = keyof Draft;
export type Status = 'all' | 'untried' | 'tried';
export type Order = 'newest' | 'oldest';
export type Errors = Partial<Record<Field, string>>;

export const FIELDS = ['name', 'restaurant', 'area', 'note', 'cuisine'] as const;

const LABEL: Record<Field, string> = {
	name: 'Dish name',
	restaurant: 'Restaurant name',
	area: 'Neighborhood or city',
	note: 'Why you want it',
	cuisine: 'Cuisine tag',
};

/** Collapse runs of whitespace and trim. Non-strings become ''. */
export function clean(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Comparison key for a cuisine tag: "Japanese " and "japanese" collapse to one. */
export function normalizeCuisine(value: unknown): string {
	return clean(value).toLowerCase();
}

export function readDraft(raw: Partial<Record<Field, unknown>>): Draft {
	return {
		name: clean(raw.name),
		restaurant: clean(raw.restaurant),
		area: clean(raw.area),
		note: clean(raw.note),
		cuisine: clean(raw.cuisine),
	};
}

/** Cleans as it checks, so it is safe on raw form values too. */
export function validate(draft: Draft): Errors {
	const errors: Errors = {};
	for (const field of FIELDS) {
		if (clean(draft[field]) === '') errors[field] = `${LABEL[field]} is required.`;
	}
	return errors;
}

/** `dateAdded` is passed in so the domain never reads the clock. */
export function createDish(draft: Draft, dateAdded: number, id: string): Dish {
	return { ...readDraft(draft), id, tried: false, dateAdded };
}

/** Same gate for stored records as for form input: clean, validate, coerce. */
export function reviveDish(raw: unknown): Dish | null {
	if (raw === null || typeof raw !== 'object') return null;
	const record = raw as Partial<Record<Field, unknown>> & { id?: unknown; tried?: unknown; dateAdded?: unknown };
	const draft = readDraft(record);
	if (Object.keys(validate(draft)).length > 0) return null;
	if (typeof record.id !== 'string' || record.id === '') return null;
	if (typeof record.dateAdded !== 'number' || !Number.isFinite(record.dateAdded)) return null;
	return { ...draft, id: record.id, tried: record.tried === true, dateAdded: record.dateAdded };
}

/** Display-cased tag list, deduped case-insensitively, alphabetical. */
export function cuisineTags(dishes: readonly Dish[]): string[] {
	const seen = new Map<string, string>();
	for (const dish of dishes) {
		const key = normalizeCuisine(dish.cuisine);
		if (key !== '' && !seen.has(key)) seen.set(key, dish.cuisine);
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** `cuisine: null` means every cuisine. Both filters combine. */
export function filterDishes(dishes: readonly Dish[], cuisine: string | null, status: Status): Dish[] {
	const key = cuisine === null ? null : normalizeCuisine(cuisine);
	return dishes.filter(
		(dish) =>
			(key === null || normalizeCuisine(dish.cuisine) === key) &&
			(status === 'all' || dish.tried === (status === 'tried')),
	);
}

/** Stable: equal timestamps fall back to id, so the order never flickers. */
export function sortDishes(dishes: readonly Dish[], order: Order): Dish[] {
	return [...dishes].sort((a, b) => {
		const byDate = order === 'newest' ? b.dateAdded - a.dateAdded : a.dateAdded - b.dateAdded;
		return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
	});
}

export function toggleTried(dishes: readonly Dish[], id: string): Dish[] {
	return dishes.map((dish) => (dish.id === id ? { ...dish, tried: !dish.tried } : dish));
}

export function countTried(dishes: readonly Dish[]): number {
	return dishes.reduce((total, dish) => total + (dish.tried ? 1 : 0), 0);
}
