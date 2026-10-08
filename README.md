# CartShare

A collaborative shared-cart web app. Friends, roommates or teammates join one "Room",
add items to a shared cart, watch the free-delivery goal fill up, and print a receipt
that shows who owes what.

**Live demo:** _paste your Vercel / Netlify / GitHub Pages URL here_

## Features
- Create a room (random 6-character code) or join one with a code
- Add and remove items (name, price, quantity); every item records who added it
- Cart updates live in every open tab of the same room (cross-tab sync)
- Activity log of every join, add, remove and leave
- Free-delivery progress bar (minimum is `THRESHOLD = 75` in `js/app.js`)
- "Who owes what" table with an equal split
- Printable receipt (CSS `@media print`) with items, totals, split and activity log
- Responsive layout with Bootstrap 5 and CSS Flexbox/Grid, works on phones and PCs

## Run locally
No build step and no install needed.
1. Download or clone this repo.
2. Open `index.html` in a browser (or run `npx serve` / VS Code Live Server in the folder).

## Try the multi-user simulation
1. Enter a name and click **Create new room**. Note the room code.
2. Click **Open as another user** (or open the site in a new tab).
3. In the new tab, enter a different name and the room code, then click **Join room**.
4. Add or remove items in either tab. Both tabs update instantly.
5. Click **Print receipt** and choose "Save as PDF" or print.

## How it works
- `localStorage` stores each room under `cartshare:room:<CODE>`.
- The browser's `storage` event fires in the *other* tabs whenever a room changes, and they re-render.
- `sessionStorage` stores who you are in this tab, so each tab can be a different person.
- Note: sync works across tabs of the same browser on the same site. That is how this project simulates multiple users.

## Folder structure
```
CartShare/
  index.html
  README.md
  css/style.css
  js/app.js
  assets/logo.svg
```