import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY, loadDishes, saveDishes } from './storage';
import type { Dish } from './domain';

const dish: Dish = {
	id: 'a', name: 'Khao soi', restaurant: 'Mae Sai', area: 'Chiang Mai',
	note: 'friend tip', cuisine: 'Thai', tried: false, dateAdded: 100,
};

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => store.get(k) ?? null,
	setItem: (k: string, v: string) => void store.set(k, v),
});

beforeEach(() => store.clear());

describe('loadDishes', () => {
	it('reads an empty list when nothing was ever saved', () => {
		expect(loadDishes()).toEqual({ ok: true, dishes: [] });
	});
	it('round-trips what saveDishes wrote', () => {
		saveDishes([dish]);
		expect(loadDishes()).toEqual({ ok: true, dishes: [dish] });
	});
	it.each([
		['unparsable JSON', '{not json['],
		['a value that is not a list', '{"a":1}'],
		['a record missing required fields', '[{"id":"a"}]'],
	])('reports a read failure on %s instead of silently emptying the list', (_label, raw) => {
		store.set(STORAGE_KEY, raw);
		expect(loadDishes()).toEqual({ ok: false, reason: 'read' });
	});
});

describe('saveDishes', () => {
	it('reports a write failure when the quota is exceeded', () => {
		const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
			throw new DOMException('QuotaExceededError');
		});
		expect(saveDishes([dish])).toEqual({ ok: false, reason: 'write' });
		setItem.mockRestore();
	});
});
