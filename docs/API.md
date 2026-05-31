# Mobile API

Base URL:

```txt
http://localhost:5173/api/mobile
```

In production, use the same host as the web app:

```txt
https://your.domain.example/api/mobile
```

This API is read-only. It exposes just enough data for a mobile app to render
the event list and todo list.

## Endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/events` | Event summaries |
| `GET` | `/todos` | Todo list |

## Event Shape

```ts
type EventSummary = {
  id: string;
  name: string;
  accentColor: string;
  startDate: string;
  endDate: string;
};
```

The current web app has one event, so `/events` returns an array with one item.

## Todo Shape

```ts
type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};
```

## Tiny Client

```ts
const API_URL = "https://your.domain.example/api/mobile";

export async function getEvents() {
  const response = await fetch(`${API_URL}/events`);
  return response.json();
}

export async function getTodos() {
  const response = await fetch(`${API_URL}/todos`);
  return response.json();
}
```
