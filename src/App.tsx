import type { CSSProperties } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

type EventDates = {
  startDate: string;
  endDate: string;
};

type SettingsDraft = EventDates & {
  eventName: string;
  accentColor: string;
};

type TrackerState = {
  eventName: string;
  accentColor: string;
  dates: EventDates;
  todos: Todo[];
};

type AuthStatus = {
  requiresAuth: boolean;
  isAuthenticated: boolean;
};

type Theme = "light" | "dark";

const DEFAULT_EVENT_NAME = "Summer internship";
const DEFAULT_ACCENT_COLOR = "#f4b400";
const THEME_STORAGE_KEY = "time-tracker-theme";

const DEFAULT_DATES: EventDates = {
  startDate: "2026-06-01",
  endDate: "2026-08-14"
};

const DEFAULT_TODOS: Todo[] = [
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
];

const DEFAULT_STATE: TrackerState = {
  eventName: DEFAULT_EVENT_NAME,
  accentColor: DEFAULT_ACCENT_COLOR,
  dates: DEFAULT_DATES,
  todos: DEFAULT_TODOS
};

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1
});

const percentFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function createTodo(title: string): Todo {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    title,
    done: false,
    createdAt: new Date().toISOString()
  };
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function differenceInDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / msPerDay);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
  } catch {
    return "light";
  }

  return "light";
}

function getEventEnd(value: string): Date {
  const end = parseLocalDate(value);
  end.setDate(end.getDate() + 1);
  return end;
}

function getProgress(dates: EventDates, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = parseLocalDate(dates.startDate);
  const end = getEventEnd(dates.endDate);
  const displayEnd = parseLocalDate(dates.endDate);
  const totalMs = Math.max(end.getTime() - start.getTime(), 1);
  const elapsedMs = clamp(now.getTime() - start.getTime(), 0, totalMs);
  const remainingMs = clamp(end.getTime() - now.getTime(), 0, totalMs);
  const totalDays = Math.max(differenceInDays(start, end), 1);
  const elapsedDays = clamp(differenceInDays(start, today), 0, totalDays);
  const daysLeft = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const percent = clamp((elapsedMs / totalMs) * 100, 0, 100);

  return {
    today,
    start,
    end: displayEnd,
    totalDays,
    totalWeeks: totalDays / 7,
    elapsedDays,
    daysLeft,
    weeksLeft: daysLeft / 7,
    percent
  };
}

export default function App() {
  const [trackerState, setTrackerState] = useState<TrackerState>(DEFAULT_STATE);
  const [newTodo, setNewTodo] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    eventName: DEFAULT_STATE.eventName,
    accentColor: DEFAULT_STATE.accentColor,
    ...DEFAULT_STATE.dates
  });
  const [now, setNow] = useState(() => new Date());
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    requiresAuth: true,
    isAuthenticated: false
  });
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const { accentColor, dates, eventName, todos } = trackerState;
  const isInitialLoading = (isLoadingState || isLoadingAuth) && !stateError;
  const canEdit = !authStatus.requiresAuth || authStatus.isAuthenticated;

  const progress = useMemo(() => getProgress(dates, now), [dates, now]);
  const completedCount = todos.filter((todo) => todo.done).length;
  const todoPercent =
    todos.length === 0 ? 0 : (completedCount / todos.length) * 100;
  const previewAccentColor = isValidHexColor(settingsDraft.accentColor)
    ? settingsDraft.accentColor
    : DEFAULT_ACCENT_COLOR;
  const isDraftAccentInvalid = !isValidHexColor(settingsDraft.accentColor);
  const isDraftDateRangeInvalid =
    parseLocalDate(settingsDraft.endDate) <=
    parseLocalDate(settingsDraft.startDate);
  const isSettingsInvalid = isDraftDateRangeInvalid || isDraftAccentInvalid;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme selection still applies for this session if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthStatus() {
      try {
        const response = await fetch("/api/auth/status");
        if (!response.ok) {
          throw new Error("Unable to load auth status.");
        }

        if (isMounted) {
          setAuthStatus((await response.json()) as AuthStatus);
        }
      } catch {
        if (isMounted) {
          setStateError("Could not load login status.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }
    }

    async function loadState() {
      try {
        const response = await fetch("/api/state");
        if (!response.ok) {
          throw new Error("Unable to load tracker state.");
        }

        const nextState = (await response.json()) as TrackerState;
        if (!isMounted) {
          return;
        }

        setTrackerState(nextState);
        setSettingsDraft({
          eventName: nextState.eventName,
          accentColor: nextState.accentColor,
          ...nextState.dates
        });
        setStateError(null);
      } catch {
        if (isMounted) {
          setStateError("Could not load shared tracker state.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingState(false);
        }
      }
    }

    void loadAuthStatus();
    void loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  async function saveTrackerState(nextState: TrackerState) {
    if (!canEdit) {
      return;
    }

    setTrackerState(nextState);
    setStateError(null);

    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(nextState)
      });

      if (!response.ok) {
        if (response.status === 401) {
          setAuthStatus({
            requiresAuth: true,
            isAuthenticated: false
          });
          setIsLoginOpen(true);
        }
        throw new Error("Unable to save tracker state.");
      }

      setTrackerState((await response.json()) as TrackerState);
    } catch {
      setStateError("Could not save shared tracker state.");
    }
  }

  function openSettings() {
    if (!canEdit) {
      setIsLoginOpen(true);
      return;
    }

    setSettingsDraft({ eventName, accentColor, ...dates });
    setIsSettingsOpen(true);
  }

  function updateSettingsDraft(field: keyof SettingsDraft, value: string) {
    setSettingsDraft({ ...settingsDraft, [field]: value });
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSettingsInvalid || !canEdit) {
      return;
    }

    const nextEventName = settingsDraft.eventName.trim() || "Event";
    void saveTrackerState({
      ...trackerState,
      eventName: nextEventName,
      accentColor: previewAccentColor,
      dates: {
        startDate: settingsDraft.startDate,
        endDate: settingsDraft.endDate
      }
    });
    setIsSettingsOpen(false);
  }

  function resetAll() {
    if (!canEdit) {
      return;
    }

    const confirmed = window.confirm(
      "Reset the tracker to defaults? This will clear your event settings and todos."
    );
    if (!confirmed) {
      return;
    }

    void saveTrackerState(DEFAULT_STATE);
    setNewTodo("");
    setSettingsDraft({
      eventName: DEFAULT_EVENT_NAME,
      accentColor: DEFAULT_ACCENT_COLOR,
      ...DEFAULT_DATES
    });
    setIsSettingsOpen(false);
  }

  function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    const title = newTodo.trim();
    if (!title) {
      return;
    }

    void saveTrackerState({
      ...trackerState,
      todos: [createTodo(title), ...todos]
    });
    setNewTodo("");
  }

  function toggleTodo(id: string) {
    if (!canEdit) {
      return;
    }

    void saveTrackerState({
      ...trackerState,
      todos: todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    });
  }

  function deleteTodo(id: string) {
    if (!canEdit) {
      return;
    }

    void saveTrackerState({
      ...trackerState,
      todos: todos.filter((todo) => todo.id !== id)
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: loginPassword })
      });

      if (!response.ok) {
        throw new Error("Incorrect password.");
      }

      const nextAuthStatus = (await response.json()) as AuthStatus;
      setAuthStatus(nextAuthStatus);
      setLoginPassword("");
      setIsLoginOpen(false);
      setStateError(null);
    } catch {
      setLoginError("Incorrect password.");
    }
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      setAuthStatus((await response.json()) as AuthStatus);
      setIsSettingsOpen(false);
      setLoginPassword("");
      setLoginError(null);
    } catch {
      setStateError("Could not log out.");
    }
  }

  if (isInitialLoading) {
    return (
      <main className="app-shell">
        <div className="initial-loader" role="status">
          Loading tracker...
        </div>
      </main>
    );
  }

  return (
    <main
      className="app-shell"
      style={{ "--accent-color": accentColor } as CSSProperties}
    >
      <header className="top-bar">
        <div>
          <p className="eyebrow">{eventName}</p>
          <h1 id="page-title">Time Tracker</h1>
        </div>
        <div className="top-actions">
          {canEdit ? (
            <button
              className="settings-button"
              type="button"
              onClick={openSettings}
            >
              Settings
            </button>
          ) : (
            <button
              className="settings-button"
              type="button"
              onClick={() => {
                setLoginError(null);
                setIsLoginOpen(true);
              }}
            >
              Login
            </button>
          )}
          {authStatus.requiresAuth && authStatus.isAuthenticated ? (
            <button
              className="secondary-top-button logout-button"
              type="button"
              onClick={logout}
            >
              Logout
            </button>
          ) : null}
          <button
            className="secondary-top-button theme-toggle top-theme-toggle"
            type="button"
            onClick={() =>
              setTheme((currentTheme) =>
                currentTheme === "dark" ? "light" : "dark"
              )
            }
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-pressed={theme === "dark"}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" size={22} strokeWidth={2.5} />
            ) : (
              <Moon aria-hidden="true" size={22} strokeWidth={2.5} />
            )}
          </button>
        </div>
        {isSettingsOpen ? (
          <div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            style={{ "--accent-color": previewAccentColor } as CSSProperties}
          >
            <form className="settings-dialog" onSubmit={saveSettings}>
              <div className="settings-header">
                <div>
                  <p className="eyebrow">Tracker setup</p>
                  <h2 id="settings-title">Settings</h2>
                </div>
                <button
                  className="close-button"
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Close settings"
                >
                  X
                </button>
              </div>

              <div className="accent-preview" aria-hidden="true" />

              <label className="settings-field">
                <span>Event name/type</span>
                <input
                  value={settingsDraft.eventName}
                  onChange={(event) =>
                    updateSettingsDraft("eventName", event.target.value)
                  }
                  placeholder="Summer internship, exchange, school term"
                />
              </label>

              <label className="settings-field">
                <span>Accent color</span>
                <div className="color-control">
                  <label className="color-picker-shell">
                    <span aria-hidden="true">🎨</span>
                    <input
                      type="color"
                      value={previewAccentColor}
                      onChange={(event) =>
                        updateSettingsDraft("accentColor", event.target.value)
                      }
                      aria-label="Accent color"
                    />
                  </label>
                  <input
                    value={settingsDraft.accentColor}
                    onChange={(event) =>
                      updateSettingsDraft("accentColor", event.target.value)
                    }
                    placeholder="#f4b400"
                    aria-label="Accent color hex value"
                  />
                </div>
                {isDraftAccentInvalid ? (
                  <p className="date-warning">Use a hex color like #f4b400.</p>
                ) : null}
              </label>

              <div className="settings-field">
                <span>Theme</span>
                <div className="theme-choice" role="group" aria-label="Theme">
                  <button
                    className={theme === "light" ? "active" : ""}
                    type="button"
                    onClick={() => setTheme("light")}
                    aria-pressed={theme === "light"}
                  >
                    <Sun aria-hidden="true" size={20} strokeWidth={2.5} />
                    Light
                  </button>
                  <button
                    className={theme === "dark" ? "active" : ""}
                    type="button"
                    onClick={() => setTheme("dark")}
                    aria-pressed={theme === "dark"}
                  >
                    <Moon aria-hidden="true" size={20} strokeWidth={2.5} />
                    Dark
                  </button>
                </div>
              </div>

              <div className="date-panel" aria-label="Event dates">
                <div className="date-grid">
                  <label>
                    <span>Start</span>
                    <input
                      type="date"
                      value={settingsDraft.startDate}
                      onChange={(event) =>
                        updateSettingsDraft("startDate", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>End</span>
                    <input
                      type="date"
                      value={settingsDraft.endDate}
                      onChange={(event) =>
                        updateSettingsDraft("endDate", event.target.value)
                      }
                    />
                  </label>
                </div>
                {isDraftDateRangeInvalid ? (
                  <p className="date-warning">
                    End date must be after start date.
                  </p>
                ) : null}
              </div>

              <div className="settings-actions">
                <button
                  className="danger-button"
                  type="button"
                  onClick={resetAll}
                >
                  Reset all
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSettingsInvalid}>
                  Save
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {isLoginOpen ? (
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <form className="auth-dialog" onSubmit={login}>
              <div className="settings-header">
                <div>
                  <h2 id="login-title">Password required</h2>
                </div>
                <button
                  className="close-button"
                  type="button"
                  onClick={() => {
                    setIsLoginOpen(false);
                    setLoginError(null);
                  }}
                  aria-label="Close login"
                >
                  X
                </button>
              </div>

              <label className="settings-field">
                <span>Password</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoFocus
                />
              </label>

              {loginError ? (
                <p className="login-error" role="status">
                  {loginError}
                </p>
              ) : null}

              <div className="settings-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setIsLoginOpen(false);
                    setLoginError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit">Login</button>
              </div>
            </form>
          </div>
        ) : null}
      </header>
      {stateError ? (
        <div className="state-banner" role="status">
          {stateError}
        </div>
      ) : null}

      <section
        className="progress-section"
        aria-labelledby="page-title"
        aria-label={`${eventName} progress`}
      >
        <div className="progress-summary">
          <span className="metric-label">Progress through {eventName}</span>
          <strong className="progress-value">
            <span>{percentFormatter.format(progress.percent)}</span>
            <small>%</small>
          </strong>
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="metric-label date-range">
            {dayFormatter.format(progress.start)} to{" "}
            {dayFormatter.format(progress.end)}
          </p>
        </div>

        <div className="metric-grid">
          <article className="metric-card">
            <strong className="stat-value">
              <span>{progress.daysLeft}</span>
              <small>/ {progress.totalDays}</small>
            </strong>
            <span className="metric-label">Days left</span>
          </article>
          <article className="metric-card">
            <strong className="stat-value">
              <span>{numberFormatter.format(progress.weeksLeft)}</span>
              <small>/ {numberFormatter.format(progress.totalWeeks)}</small>
            </strong>
            <span className="metric-label">Weeks left</span>
          </article>
          <article className="metric-card">
            <strong className="stat-value">
              <span>{progress.elapsedDays}</span>
              <small>/ {progress.totalDays}</small>
            </strong>
            <span className="metric-label">Days done</span>
          </article>
          <article className="metric-card mobile-only-metric">
            <strong className="stat-value">
              <span>{numberFormatter.format(progress.elapsedDays / 7)}</span>
              <small>/ {numberFormatter.format(progress.totalWeeks)}</small>
            </strong>
            <span className="metric-label">Weeks done</span>
          </article>
        </div>
      </section>

      <section className="todo-section" aria-labelledby="todo-heading">
        <div className="section-header">
          <h2 id="todo-heading">Key things to do</h2>
          <span className="todo-count">
            {completedCount}/{todos.length} done
          </span>
        </div>

        <div className="todo-progress" aria-hidden="true">
          <div style={{ width: `${todoPercent}%` }} />
        </div>

        {canEdit ? (
          <form className="todo-form" onSubmit={addTodo}>
            <input
              value={newTodo}
              onChange={(event) => setNewTodo(event.target.value)}
              placeholder="Add a goal, conversation, or task"
              aria-label="New todo"
            />
            <button type="submit">Add</button>
          </form>
        ) : null}

        <ul className="todo-list">
          {todos.map((todo) => (
            <li className="todo-item" key={todo.id}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  disabled={!canEdit}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span className={todo.done ? "complete" : ""}>
                  {todo.title}
                </span>
              </label>
              {canEdit ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => deleteTodo(todo.id)}
                  aria-label={`Delete ${todo.title}`}
                >
                  Delete
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
