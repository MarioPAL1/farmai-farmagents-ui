import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

const AGENTS = [
  { id: "orchestrator", name: "Orchestrator" },
  { id: "pm", name: "PM / Planner" },
  { id: "dev", name: "Developer" },
  { id: "qa", name: "QA / Reviewer" },
  { id: "devops", name: "DevOps" },
];

function App() {
  const host = typeof window !== "undefined" ? window.location.host : "";

  // Gate state
  const [session, setSession] = useState({ loading: true, authenticated: false, email: null });
  const [loginEmail, setLoginEmail] = useState("mario_palermo97@live.it");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Chat UI state
  const [activeAgentId, setActiveAgentId] = useState(AGENTS[0].id);
  const [draft, setDraft] = useState("");
  const [messagesByAgent, setMessagesByAgent] = useState(() => {
    const init = {};
    for (const a of AGENTS) init[a.id] = [];
    init[AGENTS[0].id] = [
      { role: "assistant", text: "Ciao! UI online ✅ Dimmi cosa vuoi costruire ora." },
    ];
    return init;
  });

  const activeAgent = useMemo(
    () => AGENTS.find((a) => a.id === activeAgentId),
    [activeAgentId]
  );

  const activeMessages = messagesByAgent[activeAgentId] ?? [];

  function pushMessage(agentId, msg) {
    setMessagesByAgent((prev) => ({
      ...prev,
      [agentId]: [...(prev[agentId] ?? []), msg],
    }));
  }

  async function loadSession() {
    try {
      const res = await fetch("/api/session", { credentials: "include" });
      const data = await res.json();
      setSession({
        loading: false,
        authenticated: !!data.authenticated,
        email: data.email ?? null,
      });
    } catch {
      setSession({ loading: false, authenticated: false, email: null });
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function onLogin() {
    setLoginError("");
    setLoginBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setLoginError(data.error || "Login failed");
        return;
      }

      await loadSession();
    } finally {
      setLoginBusy(false);
    }
  }

  async function onSend() {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    pushMessage(activeAgentId, { role: "user", text });

    // placeholder: fino a quando non colleghiamo la chat API
    setTimeout(() => {
      pushMessage(activeAgentId, {
        role: "assistant",
        text: `Ricevuto da ${activeAgent?.name}. Prossimo step: collego questa chat alla tua API.`,
      });
    }, 250);
  }

  // ====== GATE SCREEN ======
  if (session.loading) {
    return (
      <div style={styles.page}>
        <div style={styles.cardCenter}>Loading…</div>
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <div style={styles.page}>
        <div style={styles.cardCenter}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.2 }}>FarmaAI UI</div>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.7 }}>
            Cloudflare Pages • {host || "—"}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={styles.label}>Email</div>
            <input
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={styles.input}
              placeholder="email"
              autoComplete="username"
            />

            <div style={{ ...styles.label, marginTop: 10 }}>Password</div>
            <input
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={styles.input}
              placeholder="password"
              type="password"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") onLogin();
              }}
            />

            {loginError ? (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700 }}>
                {loginError}
              </div>
            ) : null}

            <button
              onClick={onLogin}
              style={{ ...styles.sendBtn, marginTop: 14, width: "100%", opacity: loginBusy ? 0.7 : 1 }}
              disabled={loginBusy}
            >
              {loginBusy ? "Logging in…" : "Login"}
            </button>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
              (Server: <code>/functions/api/login.js</code> + <code>/functions/api/session.js</code>)
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====== APP UI ======
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>FarmaAI UI</div>
          <div style={styles.subtitle}>
            Cloudflare Pages • {host || "—"} • <span style={{ fontWeight: 800 }}>User:</span>{" "}
            {session.email || "—"}
          </div>
        </div>
        <div style={styles.badge}>Online</div>
      </div>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Agents</div>
          <div style={styles.agentList}>
            {AGENTS.map((a) => {
              const isActive = a.id === activeAgentId;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveAgentId(a.id)}
                  style={{
                    ...styles.agentBtn,
                    ...(isActive ? styles.agentBtnActive : null),
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div style={styles.agentHint}>chat • {a.id}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={styles.main}>
          <div style={styles.chatHeader}>
            <div style={{ fontWeight: 700 }}>{activeAgent?.name}</div>
            <div style={styles.chatHeaderHint}>placeholder UI (next: API)</div>
          </div>

          <div style={styles.chat}>
            {activeMessages.length === 0 ? (
              <div style={styles.empty}>Nessun messaggio ancora.</div>
            ) : (
              activeMessages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.msg,
                    ...(m.role === "user" ? styles.msgUser : styles.msgAssistant),
                  }}
                >
                  <div style={styles.msgRole}>{m.role.toUpperCase()}</div>
                  <div style={styles.msgText}>{m.text}</div>
                </div>
              ))
            )}
          </div>

          <div style={styles.composer}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSend();
              }}
              placeholder="Scrivi qui e premi Invio…"
              style={styles.input}
            />
            <button onClick={onSend} style={styles.sendBtn}>
              Send
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    margin: 0,
    padding: 24,
    background: "#fff",
    color: "#111",
    minHeight: "100vh",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: -0.2 },
  subtitle: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  badge: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 700,
  },
  body: {
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: 16,
    alignItems: "stretch",
    minHeight: "70vh",
  },
  sidebar: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fafafa",
  },
  sidebarTitle: { fontWeight: 800, fontSize: 14, marginBottom: 10 },
  agentList: { display: "flex", flexDirection: "column", gap: 8 },
  agentBtn: {
    textAlign: "left",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: "10px 10px",
    cursor: "pointer",
  },
  agentBtnActive: {
    border: "1px solid #111",
    boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
  },
  agentHint: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  main: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    padding: "12px 14px",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    background: "#fff",
  },
  chatHeaderHint: { fontSize: 12, opacity: 0.6 },
  chat: {
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    background: "#fff",
    flex: 1,
  },
  empty: { opacity: 0.6, fontSize: 13 },
  msg: {
    borderRadius: 12,
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    maxWidth: 760,
  },
  msgUser: { alignSelf: "flex-end", background: "#f9fafb" },
  msgAssistant: { alignSelf: "flex-start", background: "#fff" },
  msgRole: { fontSize: 11, fontWeight: 900, opacity: 0.55, marginBottom: 6 },
  msgText: { fontSize: 14, lineHeight: 1.35, whiteSpace: "pre-wrap" },
  composer: {
    borderTop: "1px solid #e5e7eb",
    padding: 12,
    display: "flex",
    gap: 10,
    background: "#fafafa",
  },
  input: {
    flex: 1,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  sendBtn: {
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  cardCenter: {
    maxWidth: 520,
    margin: "10vh auto",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    background: "#fff",
  },
  label: { fontSize: 12, fontWeight: 800, opacity: 0.8, marginBottom: 6 },
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
