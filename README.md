# Wandering Palate

A paper-journal bucket list for specific **dishes**, not restaurants. Vanilla TypeScript + Vite, `localStorage` only.

```bash
npm install && npm run dev   # http://localhost:5173
npm test                     # 30 unit tests
npm run size                 # committed bytes
```

`domain.ts` is pure — no DOM, no storage, no clock (`dateAdded` is a parameter). `storage.ts` exposes `loadDishes()` and `saveDishes()`; each catches its own failure and neither calls the other. Every static region, error slots included, lives in `index.html`; JS only fills the card list.

## Reaching each state

| State | How |
| --- | --- |
| Loading | On load: `loadDishes()` is awaited behind `requestAnimationFrame`, `aria-busy` set until it resolves. Throttle CPU 20× in DevTools to watch it. |
| Empty | `localStorage.clear()`, reload. |
| Filter-empty | Pick a cuisine and a status with no overlap — its own message, names both filters, offers Reset filters. |
| Validation | Submit with a field blank: inline message, `aria-invalid`, focus jumps to the first one. |
| Read failure | `localStorage.setItem('wandering-palate-dishes','{not json[')`, reload. Separate message above the form — never a silent empty list. |
| Write failure, add | `Storage.prototype.setItem = () => { throw new DOMException('x') }`, then submit. Message under the button, nothing added. |
| Write failure, toggle | Same stub, then flip a Tried it? switch. Message inside that card, switch springs back. |

Storage failures are covered in `storage.test.ts`, everything else in `domain.test.ts`.

Error slots sit in the DOM from load and hide with `.error:empty`, never `hidden`. Text renders through `textContent` and is trimmed before storage. Colour pairs were measured on the surface each one renders against: text ≥ 4.5:1, borders and focus ring ≥ 3:1. The stamp carries the words "Tried it" and a strikethrough, never colour alone.
