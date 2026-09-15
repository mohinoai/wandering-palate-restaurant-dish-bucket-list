import { describe, expect, it } from 'vitest';
import {
	clean, countTried, createDish, cuisineTags, filterDishes, normalizeCuisine,
	readDraft, reviveDish, sortDishes, toggleTried, validate, type Dish, type Draft,
} from './domain';

const draft = (over: Partial<Draft> = {}): Draft => ({
	name: 'Khao soi', restaurant: 'Mae Sai', area: 'Chiang Mai', note: 'friend tip', cuisine: 'Thai', ...over,
});
const dish = (over: Partial<Dish> = {}): Dish => ({ ...draft(), id: 'a', tried: false, dateAdded: 100, ...over });

describe('validate', () => {
	it('accepts a complete draft', () => expect(validate(draft())).toEqual({}));
	it.each(['name', 'restaurant', 'area', 'note', 'cuisine'] as const)('flags %s when only whitespace', (field) => {
		const errors = validate(draft({ [field]: '   ' }));
		expect(Object.keys(errors)).toEqual([field]);
		expect(errors[field]).toMatch(/required/);
	});
	it('reports every empty field at once', () => {
		expect(Object.keys(validate(draft({ name: '', cuisine: '' })))).toEqual(['name', 'cuisine']);
	});
});

describe('cleaning and normalising', () => {
	it('trims, collapses inner runs of whitespace, and ignores non-strings', () => {
		expect(clean('  Tonkotsu   ramen ')).toBe('Tonkotsu ramen');
		expect(clean(42)).toBe('');
		expect(readDraft({ name: ' Pho  Bo ' }).name).toBe('Pho Bo');
	});
	it('treats casing and padding as the same cuisine', () => {
		expect(normalizeCuisine(' Japanese ')).toBe(normalizeCuisine('japanese'));
	});
	it('lists each cuisine once, in the casing it was first written in', () => {
		expect(cuisineTags([
			dish({ id: 'a', cuisine: 'Japanese' }),
			dish({ id: 'b', cuisine: 'japanese ' }),
			dish({ id: 'c', cuisine: 'Ethiopian' }),
		])).toEqual(['Ethiopian', 'Japanese']);
	});
});

describe('filterDishes', () => {
	const dishes = [
		dish({ id: 'a', cuisine: 'Japanese', tried: false }),
		dish({ id: 'b', cuisine: 'japanese ', tried: true }),
		dish({ id: 'c', cuisine: 'Tex-Mex', tried: true }),
	];
	const ids = (list: Dish[]) => list.map((d) => d.id);
	it('returns everything when nothing is chosen', () => expect(filterDishes(dishes, null, 'all')).toHaveLength(3));
	it('matches a cuisine whatever its casing or padding', () => {
		expect(ids(filterDishes(dishes, 'JAPANESE', 'all'))).toEqual(['a', 'b']);
	});
	it('filters by status alone', () => {
		expect(ids(filterDishes(dishes, null, 'untried'))).toEqual(['a']);
		expect(ids(filterDishes(dishes, null, 'tried'))).toEqual(['b', 'c']);
	});
	it('combines cuisine and status', () => {
		expect(ids(filterDishes(dishes, 'japanese', 'tried'))).toEqual(['b']);
		expect(filterDishes(dishes, 'Tex-Mex', 'untried')).toEqual([]);
	});
});

describe('sortDishes', () => {
	const dishes = [dish({ id: 'a', dateAdded: 2 }), dish({ id: 'c', dateAdded: 1 }), dish({ id: 'b', dateAdded: 2 })];
	it('sorts newest first, breaking ties by id so the order never flickers', () => {
		expect(sortDishes(dishes, 'newest').map((d) => d.id)).toEqual(['a', 'b', 'c']);
	});
	it('sorts oldest first with the same tie-breaker, leaving the input alone', () => {
		expect(sortDishes(dishes, 'oldest').map((d) => d.id)).toEqual(['c', 'a', 'b']);
		expect(dishes.map((d) => d.id)).toEqual(['a', 'c', 'b']);
	});
});

describe('createDish, toggleTried, countTried', () => {
	it('takes dateAdded from its caller and starts untried', () => {
		expect(createDish(draft({ name: '  Khao  soi ' }), 1717, 'id-1'))
			.toMatchObject({ id: 'id-1', name: 'Khao soi', dateAdded: 1717, tried: false });
	});
	it('toggles one dish both ways without dropping any entry', () => {
		const once = toggleTried([dish({ id: 'a' }), dish({ id: 'b' })], 'a');
		expect(once.map((d) => d.tried)).toEqual([true, false]);
		expect(toggleTried(once, 'a')[0]?.tried).toBe(false);
		expect(once).toHaveLength(2);
	});
	it('counts the tried ones', () => {
		expect(countTried([dish({ tried: true }), dish({ tried: false })])).toBe(1);
	});
});

describe('reviveDish', () => {
	it('cleans a stored record the same way the form does', () => {
		expect(reviveDish({ ...dish(), name: ' Khao  soi ' })?.name).toBe('Khao soi');
		expect(reviveDish({ ...dish(), tried: 'yes' })?.tried).toBe(false);
	});
	it.each([
		['not an object', 'nope'],
		['a blank required field', { ...dish(), cuisine: '  ' }],
		['no id', { ...dish(), id: '' }],
		['a non-numeric dateAdded', { ...dish(), dateAdded: 'yesterday' }],
	])('rejects %s', (_label, input) => expect(reviveDish(input)).toBeNull());
});
