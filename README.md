# Matin Baderestani Gridlab

A free, static F1 analysis site for the last five races. No server, no build step, no API key.

Pages
- index.html: results, fastest lap, top speed, fastest pit stop, most overtakes
- timing.html: best laps and sectors, ideal lap, lap time chart, position chart, lap by lap table
- sectors.html: mini-sector strips (purple, green, yellow), driver vs driver, coloured track map
- strategy.html: tyre stints, pace by tyre age, pit stops
- onboard.html: replay any lap from the race start, with all cars on a track map, live telemetry and a jump list of overtakes

Data comes straight from the browser to https://api.openf1.org (historical data is free). Requests are spaced out and cached in IndexedDB, so the first load of a race is slower than the next ones. OpenF1 can restrict access while a live session is running.

## Put it online with the GitHub free plan (GitHub Pages)

1. Create a free account at https://github.com.
2. Click New repository. Name it, for example, gridlab. Choose Public (GitHub Pages is free for public repositories). Click Create repository.
3. Click "uploading an existing file". Select ALL files from this folder: index.html, timing.html, sectors.html, strategy.html, onboard.html, style.css, app.js, pages.js and README.md. The file names must stay exactly the same, and index.html must stay named index.html.
4. Click Commit changes.
5. Open Settings, then Pages. Under Build and deployment choose Deploy from a branch, pick the main branch and the / (root) folder, then Save.
6. Wait one or two minutes. Your site is at https://YOUR-USERNAME.github.io/gridlab/

Updating: open the repository, click Add file, then Upload files, and upload the changed files again. The site refreshes in a minute.

Tips for a phone: GitHub's mobile website is easier to use with "Desktop site" turned on in the browser menu.

## Test before uploading

Opening index.html by double-click works in most browsers. If the browser blocks requests from file://, run `python3 -m http.server` in this folder and open http://localhost:8000.

## Troubleshooting

- 404 page on GitHub: the main page is not named index.html, or Pages is not enabled yet.
- "Could not load data": open the browser console (F12). Usually OpenF1 is busy, rate limiting, or restricted during a live session. Reload after a minute.
- Onboard says no location data: OpenF1 does not have telemetry for every lap of every race. Try another lap or driver.
- Video buttons open searches on the official Formula 1 YouTube channel. Full camera onboards are on F1 TV (subscription).
