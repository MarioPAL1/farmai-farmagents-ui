import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

const AGENTS = [
  { id: "orchestrator", name: "Orchestrator" },
  { id: "pm", name: "PM / Planner" },
  { id: "dev", name: "Developer" },
  { id: "qa", name: "QA / Reviewer" },
  { id: "devops", name: "DevOps" },
];

const API_BASE = "https://api.farmai-farmagents.it";

function App() {
  const [activeAgentId, setActiveAgentId] = useState(AGENTS[0].id);
  const [draft, setDraft] = useState("");

  const [messagesByAgent, setMessagesByAgent] = useState(() => {
    const init = {};
    for (const a of AGENTS) init[a.id] = [];
    init[AGENTS[0].id] = [
      { role: "assistant", text: "Ciao! Access OK ✅ Dimmi cosa vuoi costruire ora." },
    ];
    return init;
  });

  // Projects
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

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

  async function loadProjects() {
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const res = await fetch(`${API_BASE}/kb/projects/index`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const list = data?.index?.projects ?? [];
      setProjects(list);
    } catch (e) {
      setProjectsError(e?.message || String(e));
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function onSend() {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    pushMessage(activeAgentId, { role: "user", text });

    // Placeholder: in futuro collegheremo chat → orchestrator API
    setTimeout(() => {
      pushMessage(activeAgentId, {
        role: "assistant",
        text: `Ricevuto da ${activeAgent?.name}. Prossimo step: collego questa chat alla tua API.`,
      });
    }, 250);
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>FarmaAI UI</div>
          <div style={styles.subtitle}>Cloudflare Pages • {window.location.host}</div>
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

          <div style={styles.divider} />

          <div style={styles.sidebarTitleRow}>
            <div style={styles.sidebarTitle}>Projects</div>
            <button onClick={loadProjects} style={styles.smallBtn} disabled={projectsLoading}>
              {projectsLoading ? "…" : "↻"}
            </button>
          </div>

          {projectsError ? (
            <div style={styles.errorBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Errore</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{projectsError}</div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                Tip: se non sei “connesso”, apri prima /auth/start sul dominio API.
              </div>
            </div>
          ) : projectsLoading ? (
            <div style={styles.muted}>Caricamento…</div>
          ) : projects.length === 0 ? (
            <div style={styles.muted}>Nessun progetto.</div>
          ) : (
            <div style={styles.projectsList}>
              {projects.map((p) => (
                <div key={p.id} style={styles.projectItem}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                  <div style={styles.projectMeta}>{p.id}</div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main style={styles.main}>
          <div style={styles.chatHeader}>
            <div style={{ fontWeight: 700 }}>{activeAgent?.name}</div>
            <div style={styles.chatHeaderHint}>UI pronta (next: API)</div>
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
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sidebarTitle: { fontWeight: 800, fontSize: 14 },
  sidebarTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  smallBtn: {
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 900,
  },
  divider: { height: 1, background: "#e5e7eb", margin: "6px 0" },
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
  projectsList: { display: "flex", flexDirection: "column", gap: 8 },
  projectItem: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: "10px 10px",
  },
  projectMeta: { fontSize: 12, opacity: 0.65, marginTop: 4, wordBreak: "break-word" },
  muted: { fontSize: 13, opacity: 0.65 },
  errorBox: {
    border: "1px solid #fecaca",
    background: "#fff5f5",
    borderRadius: 12,
    padding: 10,
  },
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
  msgText: { fontSize: 14, lineHeight: 1.35 },
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
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
