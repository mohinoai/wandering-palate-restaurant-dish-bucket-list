import {
	FIELDS,
	countTried,
	createDish,
	cuisineTags,
	filterDishes,
	readDraft,
	sortDishes,
	toggleTried,
	validate,
	type Dish,
	type Order,
	type Status,
} from './domain';
import { loadDishes, saveDishes } from './storage';

const pick = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T => {
	const el = root.querySelector<T>(selector);
	if (el === null) throw new Error(`missing element: ${selector}`);
	return el;
};

const setText = (root: ParentNode, selector: string, value: string): void => {
	pick(selector, root).textContent = value;
};

const list = pick('#dish-list');
const listHeading = pick('#list-heading');
const form = pick<HTMLFormElement>('#dish-form');
const formError = pick('#form-error');
const loadError = pick('#load-error');
const live = pick('#live-region');
const emptyState = pick('#empty-state');
const filterBlank = pick('#filter-blank');
const filterBlankDetail = pick('#filter-blank-detail');
const cuisineFilter = pick<HTMLSelectElement>('#filter-cuisine');
const sortOrder = pick<HTMLSelectElement>('#sort-order');
const tallyTotal = pick('#tally-total');
const tallyTried = pick('#tally-tried');
const dishTemplate = pick<HTMLTemplateElement>('#dish-template');
const ghostTemplate = pick<HTMLTemplateElement>('#skeleton-template');

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

let dishes: Dish[] = [];
/** The card the user just stamped — only that one replays the stamp animation. */
let justStamped: string | null = null;
const view: { cuisine: string | null; status: Status; order: Order } = {
	cuisine: null,
	status: 'all',
	order: 'newest',
};

/** Re-announce reliably: a live region ignores a repeated identical string. */
function announce(message: string): void {
	live.textContent = '';
	requestAnimationFrame(() => {
		live.textContent = message;
	});
}

/** Same id always leans the same way, so re-renders never reshuffle the pile. */
function tilt(id: string): string {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
	return `${(hash % 21) / 10 - 1}deg`;
}

function buildCard(dish: Dish): DocumentFragment {
	const fragment = dishTemplate.content.cloneNode(true) as DocumentFragment;
	const item = pick<HTMLLIElement>('li', fragment);
	item.dataset.id = dish.id;
	item.style.setProperty('--tilt', tilt(dish.id));
	item.classList.toggle('is-tried', dish.tried);
	item.classList.toggle('is-fresh', dish.tried && dish.id === justStamped);

	setText(fragment, '[data-cuisine]', dish.cuisine);
	setText(fragment, '[data-name]', dish.name);
	setText(fragment, '[data-restaurant]', dish.restaurant);
	setText(fragment, '[data-area]', dish.area);
	setText(fragment, '[data-note]', dish.note);

	const stamp = pick('[data-stamp]', fragment);
	stamp.hidden = !dish.tried;

	const date = pick<HTMLTimeElement>('[data-date]', fragment);
	date.dateTime = new Date(dish.dateAdded).toISOString().slice(0, 10);
	date.textContent = `Added ${dateFormat.format(dish.dateAdded)}`;

	const slot = pick('[data-error]', fragment);
	slot.id = `error-${dish.id}`;

	const toggle = pick<HTMLInputElement>('[data-toggle]', fragment);
	toggle.id = `tried-${dish.id}`;
	toggle.checked = dish.tried;
	toggle.setAttribute('aria-label', `Tried it? ${dish.name} at ${dish.restaurant}`);
	toggle.setAttribute('aria-describedby', slot.id);
	return fragment;
}

function syncCuisineOptions(): void {
	const tags = cuisineTags(dishes);
	if (view.cuisine !== null && !tags.includes(view.cuisine)) view.cuisine = null;

	cuisineFilter.replaceChildren(new Option('All cuisines', ''));
	for (const tag of tags) cuisineFilter.append(new Option(tag, tag, false, tag === view.cuisine));
}

function render(): void {
	syncCuisineOptions();
	const visible = sortDishes(filterDishes(dishes, view.cuisine, view.status), view.order);

	tallyTotal.textContent = String(dishes.length);
	tallyTried.textContent = String(countTried(dishes));

	const cards = document.createDocumentFragment();
	for (const dish of visible) cards.append(buildCard(dish));
	list.replaceChildren(cards);

	emptyState.hidden = dishes.length > 0;
	filterBlank.hidden = dishes.length === 0 || visible.length > 0;
	filterBlankDetail.textContent = blankMessage();
}

function blankMessage(): string {
	const status = view.status === 'all' ? 'any status' : view.status;
	return `Nothing here for ${view.cuisine ?? 'all cuisines'} · ${status}.`;
}

function renderGhosts(): void {
	const ghosts = document.createDocumentFragment();
	for (let i = 0; i < 3; i += 1) ghosts.append(ghostTemplate.content.cloneNode(true));
	list.replaceChildren(ghosts);
}

form.addEventListener('submit', (event) => {
	event.preventDefault();
	formError.textContent = '';

	const data = new FormData(form);
	const draft = readDraft({
		name: data.get('name'),
		restaurant: data.get('restaurant'),
		area: data.get('area'),
		note: data.get('note'),
		cuisine: data.get('cuisine'),
	});

	const errors = validate(draft);
	for (const field of FIELDS) {
		const message = errors[field] ?? '';
		pick(`#e-${field}`).textContent = message;
		pick(`#f-${field}`).setAttribute('aria-invalid', message === '' ? 'false' : 'true');
	}

	const firstBad = FIELDS.find((field) => errors[field] !== undefined);
	if (firstBad !== undefined) {
		const count = Object.keys(errors).length;
		pick(`#f-${firstBad}`).focus();
		announce(`${count} field${count === 1 ? '' : 's'} still need filling in.`);
		return;
	}

	const dish = createDish(draft, Date.now(), crypto.randomUUID());
	const updated = [...dishes, dish];
	const saved = saveDishes(updated);
	if (!saved.ok) {
		formError.textContent = 'Could not save this dish — try again.';
		return;
	}

	dishes = updated;
	form.reset();
	render();
	announce(`${dish.name} added to the bucket list.`);
	pick('#f-name').focus();
});

list.addEventListener('change', (event) => {
	const toggle = (event.target as HTMLElement).closest<HTMLInputElement>('[data-toggle]');
	if (toggle === null) return;

	const item = toggle.closest<HTMLLIElement>('li');
	const id = item?.dataset.id;
	if (item === null || item === undefined || id === undefined) return;

	const slot = pick('[data-error]', item);
	slot.textContent = '';

	const updated = toggleTried(dishes, id);
	const saved = saveDishes(updated);
	if (!saved.ok) {
		toggle.checked = !toggle.checked;
		slot.textContent = 'Could not save that change — try again.';
		return;
	}

	dishes = updated;
	const dish = dishes.find((entry) => entry.id === id);
	justStamped = id;
	render();
	justStamped = null;
	(document.getElementById(`tried-${id}`) ?? listHeading).focus();
	if (dish !== undefined) {
		announce(`${dish.name} marked as ${dish.tried ? 'tried' : 'still to try'}.`);
	}
});

function applyFilters(): void {
	render();
	const shown = list.childElementCount;
	announce(shown === 0 ? blankMessage() : `${shown} dish${shown === 1 ? '' : 'es'} shown.`);
}

cuisineFilter.addEventListener('change', () => {
	view.cuisine = cuisineFilter.value === '' ? null : cuisineFilter.value;
	applyFilters();
});

sortOrder.addEventListener('change', () => {
	view.order = sortOrder.value as Order;
	applyFilters();
});

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="status"]')) {
	radio.addEventListener('change', () => {
		view.status = radio.value as Status;
		applyFilters();
	});
}

pick('#reset-filters').addEventListener('click', () => {
	view.cuisine = null;
	view.status = 'all';
	view.order = 'newest';
	sortOrder.value = 'newest';
	pick<HTMLInputElement>('#status-all').checked = true;
	applyFilters();
	cuisineFilter.focus();
});

pick('#cta-add').addEventListener('click', () => {
	pick('#f-name').focus();
});

/**
 * Hands the read to the frame *after* the skeleton is painted: the first callback
 * still runs before that paint, so a single frame would swap the cards in unseen.
 */
function loadAsync(): Promise<ReturnType<typeof loadDishes>> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve(loadDishes())));
	});
}

async function boot(): Promise<void> {
	listHeading.tabIndex = -1;
	renderGhosts();
	const result = await loadAsync();
	list.setAttribute('aria-busy', 'false');

	if (result.ok) {
		dishes = result.dishes;
	} else {
		dishes = [];
		loadError.textContent =
			'Your saved bucket list could not be read — the stored data looks damaged. Adding a dish starts a clean list.';
	}
	render();
}

void boot();
