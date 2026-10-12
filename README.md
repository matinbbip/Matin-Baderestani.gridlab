# Matin Baderestani Gridlab

A free, static F1 analysis site for the last five races. No server, no build step, no API key.

Pages
- index.html: results, fastest lap, top speed, fastest pit stop, most overtakes
- timing.html: best laps and sectors, ideal lap, lap time chart, position chart, lap by lap table
- sectors.html: mini-sector strips (purple, green, yellow), driver vs driver, coloured track map
- strategy.html: tyre stints, pace by tyre age, pit stops
- onboard.html: replay any lap from the race start, with all cars on a track map, live telemetry and a jump list of overtakes

Data comes straight from the browser to https://api.openf1.org (historical data is free). Requests are spaced out and cached in IndexedDB, so the first load of a race is slower than the next ones. OpenF1 can restrict access while a live session is running.


## Test before uploading

Opening index.html by double-click works in most browsers. If the browser blocks requests from file://, run `python3 -m http.server` in this folder and open http://localhost:8000.

## Troubleshooting

- 404 page on GitHub: the main page is not named index.html, or Pages is not enabled yet.
- "Could not load data": open the browser console (F12). Usually OpenF1 is busy, rate limiting, or restricted during a live session. Reload after a minute.
- Onboard says no location data: OpenF1 does not have telemetry for every lap of every race. Try another lap or driver.
- Video buttons open searches on the official Formula 1 YouTube channel. Full camera onboards are on F1 TV (subscription).
