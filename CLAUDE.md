# Auburn Grub Guide

A mobile-first web app that tracks the local food spots Bruce and friends have tried around Auburn/Opelika, AL. Plain HTML/CSS/JS, no build step, served by GitHub Pages from `main`.

- `index.html`, `assets/styles.css`, `assets/app.js`: the app (iOS-style UI, Guide / Map / Stats tabs)
- `data/places.json`: every spot. This is the only file that changes when a spot is added.
- `images/places/<id>/1.jpg, 2.jpg, ...`: photos for each spot (first one is the cover)
- `data/wishlist.json`: the To Try list (places they want to go but haven't rated yet)
- `scripts/process_photo.py`: resizes/compresses downloaded photos into `images/places/<id>/`
- `scripts/validate.mjs`: sanity-checks `data/places.json` (also runs in CI)
- `.github/workflows/publish.yml`: merges any pushed `claude/*` branch into `main` automatically
- `.github/workflows/app-requests.yml` + `scripts/agent/run.mjs`: turn requests sent from the app into commits (Haiku for ratings, Sonnet for new places)

## Standing instructions from the user

- When the user names a place, a rating out of 10 and some comments, add it to the guide. Do the research yourself (photos, address, hours, phone, website, coordinates). Don't ask follow-up questions unless the place can't be identified.
- **Always publish without being asked**: commit, push the working branch, and also push to `main` (`git push origin HEAD:main`, or merge if `main` moved). The user has given standing permission for this; they should never have to merge anything by hand.
- Never use em dashes in anything user-facing (comments, blurbs, UI copy). Use a plain dash or rephrase.
- Keep the design clean and Apple-like. No emoji in the UI.

## Adding a spot

1. **Identify the place.** Search the web. Many "Auburn" spots are actually in Opelika (Tiger Town, Pepperell Pkwy). Confirm the street address.
2. **Coordinates.** Geocode with OpenStreetMap Nominatim:
   `curl -sS -A "AuburnGrubGuide/1.0" "https://nominatim.openstreetmap.org/search?q=<name or address>&format=json&limit=3"`
   If it isn't in OSM, try the address alone, or pull lat/lng from a listing page (MapQuest pages embed them).
3. **Details.** Hours, phone, website from the restaurant's own site first; MapQuest/Yelp listings as backup. Leave a field out rather than guess (e.g. conflicting phone numbers -> omit `phone`).
4. **Photos (3-5).** Prefer the restaurant's own site (food shots), then Yelp photos (MapQuest place pages list Yelp photo IDs; full size is `https://s3-media0.fl.yelpcdn.com/bphoto/<id>/o.jpg`). Every MapQuest page also embeds the same 8 unrelated "nearby" Yelp photo IDs (8iyvGl..., MQNk_..., TmjSdtR2c..., aaefftRd5..., ds4sQg4..., eOT9kGSs..., rwH8C5..., tVJkm83a...); skip those. Find MapQuest pages with `curl https://html.duckduckgo.com/html/?q=mapquest+<name>+auburn+al`. Download into the scratchpad, look at a contact sheet, drop anything that isn't clearly this restaurant (listing pages mix in neighbors), then:
   `python3 scripts/process_photo.py <id> best.jpg second.jpg ...`
   Put the most appetizing, landscape-friendly shot first: it's the card cover (cropped to 16:10).
5. **Write the entry** in `data/places.json` (append to `places`):

```json
{
  "id": "kebab-slug",                 // lowercase-hyphen, also the photo folder name
  "name": "Official Name",
  "category": "Breakfast",            // one word or two: Breakfast, Sushi, Burgers, Pizza, Mexican, BBQ, Coffee...
  "price": "$$",                      // $ to $$$$
  "tier": "sitdown",                  // "quick" (cheap, counter/fast) or "sitdown" (pricier, table service); drives the spinner filter
  "rating": 8.2,                      // out of 10, exactly what the user said (stars show half of it)
  "verdict": "Must-go",               // optional: only when the user calls it that; overrides the rating-based label
  "comments": ["...", "..."],         // the user's own words, lightly cleaned up, one thought per bubble
  "mustTry": [],                      // only dishes the user recommended
  "tags": ["All You Can Eat"],        // 2-3 short facts worth scanning for
  "added": "2026-10-23T20:45:00",     // when it was added (orders "Newest")
  "visited": "2026-10-20",            // optional, only if the user says when they went
  "blurb": "1-3 factual sentences about the place: what it is, what it's known for, anything handy (price tiers, opened date).",
  "address": "123 Street, Opelika, AL 36801",
  "area": "Tiger Town",               // Downtown, Tiger Town, Opelika, etc.
  "lat": 32.61, "lng": -85.41,
  "phone": "(334) 555-0100",          // optional
  "website": "https://...",           // optional
  "hours": "Mon-Fri 7am-2pm, Sat-Sun 7am-3pm",  // comma-separated, each part renders on its own line
  "photos": ["images/places/kebab-slug/1.jpg"],
  "photoCredit": "Restaurant name or Yelp reviewers"
}
```

   Chains or places with several locations ("so many locations", "multiple on campus"): pin the one the user named, or the most central one, and list the others in the blurb.
   Keep the user's comments in their voice. Don't invent opinions, dishes they "loved", or visit dates.
6. **Check it:** `node scripts/validate.mjs`. To eyeball it, serve the folder (`http-server -p 8080 -c-1 .`) and screenshot with Playwright at 393x852 (Chromium is preinstalled).
7. **Publish:** commit (`Add <Place> (<rating>/10)`), `git push -u origin <branch>`, then `git push origin HEAD:main`. GitHub Pages updates within a minute or two.

**Always check the To Try list when adding a spot:** if the place is in `data/wishlist.json` (match by name, loosely: "Momma Goldberg's" = "momma goldbergs"), delete it from there in the same commit. `validate.mjs` errors if a rated place is still on the list.

## To Try list

`data/wishlist.json` holds `{ "spots": [...] }`. Each spot has the same details as a rated place except the rating and comments: `{ id, name, category, tier, area, added, blurb, address, lat, lng, phone?, website?, hours?, photos, photoCredit }`. Tapping one in the app opens the full detail page (photos, About, address, hours, phone, website) with a "Not tried yet" card where the rating would be. They are **not** shown on the Map tab.

Adding to the list: research each place exactly like a rated spot (MapQuest page via DuckDuckGo gives address, phone, hours, coordinates, website and Yelp photo IDs), run `process_photo.py <id> ...` so photos land in `images/places/<id>/`, and write a short factual blurb. Tier: "quick" for fast food and counter service, "sitdown" for table service or pricier spots. The user's own example: Botanic and Olivine are sit-down; Beyond the Wok and Cook Out are quick.

**When the user rates a place that's on the list:** move it. Copy its wishlist entry into `data/places.json` (keep id, photos, address, phone, hours, website, blurb, lat/lng, tier), add `rating`, `comments`, `price`, `tags`, a fresh `added` timestamp, then delete it from `wishlist.json`. Photos are already in `images/places/<id>/`, so no new photo work is needed unless the user sends their own.

Editing or removing a spot works the same way: change `data/places.json` (and photos), validate, commit, push both.

## Sending from the app

The + sheet has **Add a place** (name, optional where/type/note, and an "Already been?" switch that is off by default, so it saves to To Try; switched on it shows the rating form) and **Rate a place we tried**. Every To Try spot has **Rate it**, and every rated spot has **Update our rating** (prefilled form).

**Direct send (when the phone is connected):** the app stores a fine-grained GitHub token (Issues read/write, this repo only) in localStorage (`#/connect`) and opens an issue whose body has `<!-- grub-guide-request -->` and a JSON block `{type, id, name, rating, mustGo, order, comments, tier, where, note}`. `.github/workflows/app-requests.yml` runs `scripts/agent/run.mjs` on issues the repo owner opens. It handles every open request oldest first:
- `rate` (To Try spot) and `rerate` (rated spot): done in code, plus one **Claude Haiku** (`claude-haiku-5-5`) call to tidy comments and pick tags/price. Under a cent.
- `add` (to To Try) and `ratenew` (new place, rated): **Claude Sonnet** (`claude-sonnet-5-5`) through the Claude Agent SDK, following this file, capped at $2 and 80 turns. Usually 20-60 cents.
Then it validates, commits to `main` with the GitHub token, asks Pages to rebuild, comments the result (with a `<!-- grub-guide-result {...} -->` tag the app reads) and closes the issue (`not_planned` when it failed). Needs the repo secret `ANTHROPIC_API_KEY` (from the Console org linked to the user's Max plan API credits). The app polls the issue every 20 seconds and shows progress cards on the Guide and To Try tabs.

**Copy and paste (not connected, or GitHub refused):** the form copies a message like this for the user to paste into the Claude chat:

```
Add to the Grub Guide: Bow & Arrow
Rating: 8.4/10 (Must-go)
Order this: Brisket tacos
- Brisket was amazing
- A little pricey
(It's on our To Try list as "bow-and-arrow".)
```

Variants: `Add to our To Try list: <name>` (with Where/Type/Note lines) means research it onto the To Try list; `Update our rating in the Grub Guide: <name>` means change that rated spot's rating/comments/mustTry/verdict. Treat them like any other request: move the spot from the To Try list (or research it if it says "New place"), set `verdict: "Must-go"` only when "(Must-go)" is there, and `mustTry` only from "Order this".

## Notes

- Live site: https://bhg0012.github.io/auburn-grub-guide/ (GitHub Pages, source: `main` branch, root folder)
- Maps use MapLibre GL + OpenFreeMap vector tiles (free, no key). CARTO raster tiles now require an API key, so don't switch back to them.
- Ratings are out of 10 (the user switched from 5; the first two spots were doubled: 4.1 -> 8.2, 4.3 -> 8.6). Stars display rating / 2. Verdict labels: 10 Perfect, 9+ Must-go, 8+ Great, 7+ Good, 6+ Solid, 4+ Meh, below that Skip it. A place's `verdict` field overrides this (Sushi Kingdom is 8.6 but the user called it a must-go). Must-go/Perfect get a highlighted badge and count toward the Must-gos stat.
