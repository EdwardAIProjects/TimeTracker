import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
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
const maxBodyBytes = 1_000_000;
const authCookieName = "time_tracker_auth";
const authToken = randomBytes(32).toString("base64url");

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

function getAuthPassword(): string {
  return process.env.TIME_TRACKER_PASSWORD?.trim() ?? "";
}

function isAuthEnabled(): boolean {
  return getAuthPassword().length > 0;
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, cookie) => {
      const separatorIndex = cookie.indexOf("=");
      const name =
        separatorIndex === -1 ? cookie : cookie.slice(0, separatorIndex);
      const rawValue =
        separatorIndex === -1 ? "" : cookie.slice(separatorIndex + 1);

      try {
        cookies[name] = decodeURIComponent(rawValue);
      } catch {
        cookies[name] = rawValue;
      }

      return cookies;
    }, {});
}

function isAuthenticated(request: IncomingMessage): boolean {
  if (!isAuthEnabled()) {
    return true;
  }

  return parseCookies(request.headers.cookie)[authCookieName] === authToken;
}

function getAuthStatus(request: IncomingMessage) {
  return {
    requiresAuth: isAuthEnabled(),
    isAuthenticated: isAuthenticated(request)
  };
}

function getAuthCookie(value: string, maxAge: number): string {
  return [
    `${authCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
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

async function writeState(state: TrackerState): Promise<TrackerState> {
  const nextState = sanitizeState(state);
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(nextState, null, 2)}\n`);
  return nextState;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    let bytes = 0;

    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        rejectBody(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      body += chunk.toString();
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function sendError(
  response: ServerResponse,
  statusCode: number,
  error: string
): void {
  sendJson(response, statusCode, { error });
}

async function handleStateRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method === "GET") {
    sendJson(response, 200, await readState());
    return;
  }

  if (request.method === "PUT") {
    if (!isAuthenticated(request)) {
      sendError(response, 401, "Login required");
      return;
    }

    try {
      const nextState = sanitizeState(JSON.parse(await readBody(request)));
      sendJson(response, 200, await writeState(nextState));
    } catch {
      sendError(response, 400, "Invalid state payload");
    }
    return;
  }

  sendError(response, 405, "Method not allowed");
}

async function handleAuthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): Promise<void> {
  if (pathname === "/api/auth/status") {
    if (request.method !== "GET") {
      sendError(response, 405, "Method not allowed");
      return;
    }

    sendJson(response, 200, getAuthStatus(request));
    return;
  }

  if (pathname === "/api/auth/login") {
    if (request.method !== "POST") {
      sendError(response, 405, "Method not allowed");
      return;
    }

    if (!isAuthEnabled()) {
      sendJson(response, 200, getAuthStatus(request));
      return;
    }

    try {
      const payload = JSON.parse(await readBody(request)) as unknown;
      const password =
        isObject(payload) && typeof payload.password === "string"
          ? payload.password
          : "";

      if (!safeEquals(password, getAuthPassword())) {
        sendError(response, 401, "Incorrect password");
        return;
      }

      response.setHeader(
        "Set-Cookie",
        getAuthCookie(authToken, 60 * 60 * 24 * 30)
      );
      sendJson(response, 200, {
        requiresAuth: true,
        isAuthenticated: true
      });
    } catch {
      sendError(response, 400, "Invalid login payload");
    }
    return;
  }

  if (pathname === "/api/auth/logout") {
    if (request.method !== "POST") {
      sendError(response, 405, "Method not allowed");
      return;
    }

    response.setHeader("Set-Cookie", getAuthCookie("", 0));
    sendJson(response, 200, {
      requiresAuth: isAuthEnabled(),
      isAuthenticated: !isAuthEnabled()
    });
    return;
  }

  sendError(response, 404, "API route not found");
}

async function handleReadOnlyRequest(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string
): Promise<void> {
  if (request.method !== "GET") {
    sendError(response, 405, "Method not allowed");
    return;
  }

  const state = await readState();

  if (pathname === "/api/events") {
    sendJson(response, 200, [
      {
        id: "main",
        name: state.eventName,
        accentColor: state.accentColor,
        startDate: state.dates.startDate,
        endDate: state.dates.endDate
      }
    ]);
    return;
  }

  if (pathname === "/api/todos") {
    sendJson(response, 200, state.todos);
    return;
  }

  sendError(response, 404, "API route not found");
}

async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (pathname === "/api/health") {
    if (request.method !== "GET") {
      sendError(response, 405, "Method not allowed");
      return;
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname.startsWith("/api/auth/")) {
    await handleAuthRequest(request, response, pathname);
    return;
  }

  if (pathname === "/api/state") {
    await handleStateRequest(request, response);
    return;
  }

  if (pathname === "/api/events" || pathname === "/api/todos") {
    await handleReadOnlyRequest(request, response, pathname);
    return;
  }

  sendError(response, 404, "API route not found");
}

function stateApiPlugin(): Plugin {
  return {
    name: "tracker-state-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/")) {
          next();
          return;
        }

        await handleApiRequest(request, response);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/")) {
          next();
          return;
        }

        await handleApiRequest(request, response);
      });
    }
  };
}

function getPreviewAllowedHosts(): true | string[] | undefined {
  const value = process.env.PREVIEW_ALLOWED_HOSTS?.trim();
  if (!value) {
    return undefined;
  }

  if (value === "*") {
    return true;
  }

  return value
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

export default defineConfig({
  preview: {
    allowedHosts: getPreviewAllowedHosts()
  },
  plugins: [react(), stateApiPlugin()]
});
