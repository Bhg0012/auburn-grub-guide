# Auburn Grub Guide

A mobile-first web app that tracks the local food spots Bruce and friends have tried around Auburn/Opelika, AL. Plain HTML/CSS/JS, no build step, served by GitHub Pages from `main`.

- `index.html`, `assets/styles.css`, `assets/app.js`: the app (iOS-style UI, Guide / Map / Stats tabs)
- `data/places.json`: every spot. This is the only file that changes when a spot is added.
- `images/places/<id>/1.jpg, 2.jpg, ...`: photos for each spot (first one is the cover)
- `scripts/process_photo.py`: resizes/compresses downloaded photos into `images/places/<id>/`
- `scripts/validate.mjs`: sanity-checks `data/places.json` (also runs in CI)
- `.github/workflows/publish.yml`: merges any pushed `claude/*` branch into `main` automatically

## Standing instructions from the user

- When the user names a place, a rating out of 5 and some comments, add it to the guide. Do the research yourself (photos, address, hours, phone, website, coordinates). Don't ask follow-up questions unless the place can't be identified.
- **Always publish without being asked**: commit, push the working branch, and also push to `main` (`git push origin HEAD:main`, or merge if `main` moved). The user has given standing permission for this; they should never have to merge anything by hand.
- Never use em dashes in anything user-facing (comments, blurbs, UI copy). Use a plain dash or rephrase.
- Keep the design clean and Apple-like. No emoji in the UI.

## Adding a spot

1. **Identify the place.** Search the web. Many "Auburn" spots are actually in Opelika (Tiger Town, Pepperell Pkwy). Confirm the street address.
2. **Coordinates.** Geocode with OpenStreetMap Nominatim:
   `curl -sS -A "AuburnGrubGuide/1.0" "https://nominatim.openstreetmap.org/search?q=<name or address>&format=json&limit=3"`
   If it isn't in OSM, try the address alone, or pull lat/lng from a listing page (MapQuest pages embed them).
3. **Details.** Hours, phone, website from the restaurant's own site first; MapQuest/Yelp listings as backup. Leave a field out rather than guess (e.g. conflicting phone numbers -> omit `phone`).
4. **Photos (3-5).** Prefer the restaurant's own site (food shots), then Yelp photos (MapQuest place pages list Yelp photo IDs; full size is `https://s3-media0.fl.yelpcdn.com/bphoto/<id>/o.jpg`). Download into the scratchpad, look at a contact sheet, drop anything that isn't clearly this restaurant (listing pages mix in neighbors), then:
   `python3 scripts/process_photo.py <id> best.jpg second.jpg ...`
   Put the most appetizing, landscape-friendly shot first: it's the card cover (cropped to 16:10).
5. **Write the entry** in `data/places.json` (append to `places`):

```json
{
  "id": "kebab-slug",                 // lowercase-hyphen, also the photo folder name
  "name": "Official Name",
  "category": "Breakfast",            // one word or two: Breakfast, Sushi, Burgers, Pizza, Mexican, BBQ, Coffee...
  "price": "$$",                      // $ to $$$$
  "rating": 4.1,                      // exactly what the user said
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

   Keep the user's comments in their voice. Don't invent opinions, dishes they "loved", or visit dates.
6. **Check it:** `node scripts/validate.mjs`. To eyeball it, serve the folder (`http-server -p 8080 -c-1 .`) and screenshot with Playwright at 393x852 (Chromium is preinstalled).
7. **Publish:** commit (`Add <Place> (<rating>/5)`), `git push -u origin <branch>`, then `git push origin HEAD:main`. GitHub Pages updates within a minute or two.

Editing or removing a spot works the same way: change `data/places.json` (and photos), validate, commit, push both.

## Notes

- Live site: https://bhg0012.github.io/auburn-grub-guide/ (GitHub Pages, source: `main` branch, root folder)
- Maps use MapLibre GL + OpenFreeMap vector tiles (free, no key). CARTO raster tiles now require an API key, so don't switch back to them.
- Ratings: verdict labels are 5 Perfect, 4.5+ Must-go, 4+ Great, 3+ Solid, 2+ Meh, below that Skip it.
