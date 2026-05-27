# Time Tracker

A small personal progress tracker.

## Features

- Tracks percent complete, days left, weeks left, and days done
- Custom event name, dates, and accent color
- Simple todo list for goals to finish before the event ends

## Run Locally

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Open:

```txt
http://localhost:5173/
```

## Build

Create a production build:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

Open:

```txt
http://localhost:4173/
```

## Docker

Build and run:

```sh
docker build -t time-tracker .
docker run --rm -p 4173:4173 -v time-tracker-data:/app/data time-tracker
```

Or use the compose example:

```sh
docker compose -f compose.example.yml up --build
```
