# Tally Counter

A flexible, open-source browser-based tally counter for tracking multiple values at once. It supports simple click counting as well as configurable steps, limits, directional milestones, themes, and embeddable counters.

## How it works

Each counter stores its own name, current value, starting value, color, and counting rules. Use the plus and minus buttons to change a counter independently of every other counter.

The positive and negative buttons can have different step amounts. For example, a counter may add `5` when pressing plus and subtract `2` when pressing minus. Values can move above or below zero unless a minimum or maximum prevents them from doing so.

Counters are saved automatically in the browser's local storage. Refreshing or reopening the app on the same browser retains the counters, but the data is not synchronized between browsers or devices.

## Features

- Create and manage multiple named counters
- Count with positive and negative values
- Configure separate positive and negative step amounts
- Set optional hard minimum and maximum values
- Reset a counter to its configured starting value
- Choose a preset color or any custom color
- Switch between light and dark themes
- Automatically save counters in the browser

## Goals and progress

A counter can have multiple goals. Goals use one of two directions:

- **More than:** goals are completed from the lowest value to the highest value.
- **Less than:** goals are completed from the highest value to the lowest value.

For example, goals of `-20`, `-15`, and `20` are ordered differently depending on the selected direction. With **More than**, `-20` is the first goal. With **Less than**, `-20` is the final goal.

The segmented progress bar shows every milestone and fills smoothly toward the next one. Its percentage displays progress toward the next goal. Hovering over the percentage also shows progress toward the final goal and, when configured, the maximum value.

Reaching the final goal marks the counter as complete, but it does not stop counting. Only the optional minimum and maximum values act as hard limits.

## Embedding a counter

Open the embed builder from the code icon on a counter card. It provides a live preview and generates an iframe snippet for use on another website.

Embed options include:

- Compact or standard sizing
- Light, dark, or device-matched theme
- Show or hide the reset control
- Show or hide counter settings information
- Show or remove the “Powered by Tally” watermark

The counter configuration is encoded into the embed URL, so an embedded counter does not depend on the main page's local storage. Before deploying, replace the placeholder `EMBED_ORIGIN` value in `src/main.jsx` with the final site domain.

## Development

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The production files are generated in `dist`. The build also creates a `404.html` fallback so direct embed routes can work on GitHub Pages.

## Disclaimer

The code in this project was generated with artificial intelligence. See [DISCLAIMER.md](DISCLAIMER.md) for details.
