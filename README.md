# Auburn Grub Guide

Every local spot we've tried around Auburn, rated and remembered.

**Open it:** https://bhg0012.github.io/auburn-grub-guide/

On iPhone, open the link in Safari, tap Share, then **Add to Home Screen**. It launches full screen like a real app.

## Adding a spot

Tell Claude the place, your rating out of 10, and a comment or two. Claude finds the photos, address, hours and map location, adds it to `data/places.json`, and publishes. The site updates a minute or two later.

Or do it from the app: tap + to add a place to the To Try list (or rate it on the spot), Rate it on a To Try spot, or Update our rating on a rated one. With direct send set up, the request goes to GitHub as an issue and `.github/workflows/app-requests.yml` updates the guide on its own: Claude Haiku for ratings, Claude Sonnet for researching new places. Without it, the app copies a message to paste into the Claude chat.

## How it's built

Plain HTML, CSS and JavaScript with no build step, hosted on GitHub Pages from the `main` branch. Pushes to `claude/*` branches are validated and merged into `main` automatically by `.github/workflows/publish.yml`. Maps are MapLibre GL with OpenFreeMap tiles.
