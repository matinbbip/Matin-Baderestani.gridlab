# Matin Baderestani Gridlab

A free, static F1 analysis site for the last five races. No server, no build step, no API key.

Pages
- index.html: welcome page with the story of the site and a button into the data
- overview.html: results, fastest lap, top speed, fastest pit stop, most overtakes for the selected race
- championship.html: driver and constructor standings for any season since 2020, podium with photos, fireworks when the title is decided
- archive.html: every Grand Prix since 2020, choose a season then a race
- classic.html: results, qualifying, lap charts and pit stops for any race from 2020 (Jolpica data)
- calendar.html: season calendar with live countdowns to the next practice, qualifying and race, plus a circuit outline
- sessions.html: practice, qualifying, sprint and race tables with tyres, best lap, gap and top speed
- timing.html: best laps and sectors, ideal lap, lap time chart, position chart, lap by lap table
- sectors.html: mini-sector strips (purple, green, yellow), driver vs driver, coloured track map
- strategy.html: tyre stints, pace by tyre age, pit stops
- onboard.html: replay any lap from the race start, with all cars on a track map, smooth live telemetry, active aero mode, a live running order and an overtake feed

Data comes straight from the browser. From 2023 it uses https://api.openf1.org (free historical data with telemetry). For 2020 to 2022 it uses the Jolpica archive at https://api.jolpi.ca, which has results, qualifying, lap times and pit stops but no telemetry or mini-sectors. Jolpica limits free requests per hour, so loading many old races quickly can pause for a while. Requests are spaced out and cached in IndexedDB, so the first load of a race is slower than the next ones. OpenF1 can restrict access while a live session is running.

## Put it online with the GitHub free plan (GitHub Pages)

1. Create a free account at https://github.com.
2. Click New repository. Name it, for example, gridlab. Choose Public (GitHub Pages is free for public repositories). Click Create repository.
3. Click "uploading an existing file". Select ALL files from this folder: index.html, overview.html, championship.html, archive.html, classic.html, calendar.html, sessions.html, timing.html, sectors.html, strategy.html, onboard.html, style.css, app.js, pages.js and README.md. The file names must stay exactly the same, and index.html must stay named index.html.
4. Click Commit changes.
5. Open Settings, then Pages. Under Build and deployment choose Deploy from a branch, pick the main branch and the / (root) folder, then Save.
6. Wait one or two minutes. Your site is at https://YOUR-USERNAME.github.io/gridlab/

Updating: open the repository, click Add file, then Upload files, and upload the changed files again. The site refreshes in a minute.

Tips for a phone: GitHub's mobile website is easier to use with "Desktop site" turned on in the browser menu.

## Test before uploading (on your own computer)

Put ALL the files in one folder, then double-click index.html. Chrome opens it straight from the folder and the site works the same as online. Do not open a single file on its own.

## Header race bar and view counter

The bar under the menu lists every race of the selected season. Raced weekends are clickable, upcoming ones are greyed out and become clickable on their own once they happen. The bar scrolls sideways (finger, trackpad or mouse wheel), and the Season and Grand Prix menus next to it do the same job.

The footer counter uses the free counterapi.dev service. Every page load counts as one view, and it shows views today, this month and all time. Search engine bots can add to the count.

## When OpenF1 shows no data

OpenF1's free service switches off completely, past races included, from 30 minutes before every practice, qualifying, sprint and race until 30 minutes after it ends. During that window the analysis pages show an explanation and the time they should come back. Calendar, Archive and the Results and laps pages (Jolpica data) keep working, and races you opened before are kept in your browser.

## Old notes: test before uploading

Opening index.html by double-click works in most browsers. If the browser blocks requests from file://, run `python3 -m http.server` in this folder and open http://localhost:8000.

## Troubleshooting

- 404 page on GitHub: the main page is not named index.html, or Pages is not enabled yet.
- "Could not load data": open the browser console (F12). Usually OpenF1 is busy, rate limiting, or restricted during a live session. Reload after a minute.
- Onboard says no location data: OpenF1 does not have telemetry for every lap of every race. Try another lap or driver.
- Video buttons open searches on the official Formula 1 YouTube channel. Full camera onboards are on F1 TV (subscription).
