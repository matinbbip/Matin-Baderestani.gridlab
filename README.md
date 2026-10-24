# Matin Baderestani Gridlab
Hi i am Matin Baderestani, a f1 lover 
i made a website for all f1 lovers 
A free, static F1 analysis site for the last five races. No server, no build step, no API key.

Pages
- calendar.html: season calendar with live countdowns to the next practice, qualifying and race, plus a circuit outline
- sessions.html: practice, qualifying, sprint and race tables with tyres, best lap, gap and top speed
- index.html: results, fastest lap, top speed, fastest pit stop, most overtakes
- timing.html: best laps and sectors, ideal lap, lap time chart, position chart, lap by lap table
- sectors.html: mini-sector strips (purple, green, yellow), driver vs driver, coloured track map
- strategy.html: tyre stints, pace by tyre age, pit stops
- onboard.html: replay any lap from the race start, with all cars on a track map, smooth live telemetry, active aero mode, a live running order and an overtake feed

Data comes straight from the browser to https://api.openf1.org (historical data is free). Requests are spaced out and cached in IndexedDB, so the first load of a race is slower than the next ones. OpenF1 can restrict access while a live session is running.

made with LOVE 
