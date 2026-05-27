import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

type TrackerState = {
  eventName: string;
  accentColor: string;
  dates: {
    startDate: string;
    endDate: string;
  };
  todos: Todo[];
};

const dataFile = resolve(process.cwd(), "data/state.json");

const defaultState: TrackerState = {
  eventName: "Summer internship",
  accentColor: "#f4b400",
  dates: {
    startDate: "2026-06-01",
    endDate: "2026-08-14"
  },
  todos: [
    {
      id: "default-ship-project",
      title: "Ship one project or visible improvement",
      done: false,
      createdAt: "2026-06-01T00:00:00.000Z"
    },
    {
      id: "default-manager-feedback",
      title: "Ask my manager for midpoint and final feedback",
      done: false,
      createdAt: "2026-06-01T00:00:00.000Z"
    },
    {
      id: "default-coffee-chats",
      title: "Schedule coffee chats with people on adjacent teams",
      done: false,
      createdAt: "2026-06-01T00:00:00.000Z"
    },
    {
      id: "default-handoff-notes",
      title: "Write handoff notes and capture what I learned",
      done: false,
      createdAt: "2026-06-01T00:00:00.000Z"
    }
  ]
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeState(value: unknown): TrackerState {
  if (!isObject(value)) {
    return defaultState;
  }

  const dates = isObject(value.dates) ? value.dates : {};
  const todos = Array.isArray(value.todos) ? value.todos : defaultState.todos;

  return {
    eventName: cleanString(value.eventName, defaultState.eventName),
    accentColor: isValidHexColor(value.accentColor)
      ? value.accentColor
      : defaultState.accentColor,
    dates: {
      startDate: cleanString(dates.startDate, defaultState.dates.startDate),
      endDate: cleanString(dates.endDate, defaultState.dates.endDate)
    },
    todos: todos
      .filter(isObject)
      .map((todo, index) => ({
        id: cleanString(todo.id, `todo-${index}`),
        title: cleanString(todo.title, "Untitled todo"),
        done: typeof todo.done === "boolean" ? todo.done : false,
        createdAt: cleanString(todo.createdAt, new Date().toISOString())
      }))
  };
}

async function readState(): Promise<TrackerState> {
  try {
    const rawState = await readFile(dataFile, "utf8");
    return sanitizeState(JSON.parse(rawState));
  } catch {
    await writeState(defaultState);
    return defaultState;
  }
}

async function writeState(state: TrackerState): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(state, null, 2)}\n`);
}

function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";

    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

function stateApiPlugin(): Plugin {
  return {
    name: "tracker-state-api",
    configureServer(server) {
      server.middlewares.use("/api/state", async (request, response) => {
        response.setHeader("Content-Type", "application/json");

        if (request.method === "GET") {
          response.end(JSON.stringify(await readState()));
          return;
        }

        if (request.method === "PUT") {
          try {
            const nextState = sanitizeState(JSON.parse(await readBody(request)));
            await writeState(nextState);
            response.end(JSON.stringify(nextState));
          } catch {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: "Invalid state payload" }));
          }
          return;
        }

        response.statusCode = 405;
        response.end(JSON.stringify({ error: "Method not allowed" }));
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/state", async (request, response) => {
        response.setHeader("Content-Type", "application/json");

        if (request.method === "GET") {
          response.end(JSON.stringify(await readState()));
          return;
        }

        if (request.method === "PUT") {
          try {
            const nextState = sanitizeState(JSON.parse(await readBody(request)));
            await writeState(nextState);
            response.end(JSON.stringify(nextState));
          } catch {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: "Invalid state payload" }));
          }
          return;
        }

        response.statusCode = 405;
        response.end(JSON.stringify({ error: "Method not allowed" }));
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), stateApiPlugin()]
});
