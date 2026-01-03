import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

const API_BASE = "https://api.farmai-farmagents.it";

const AGENTS = [
  { id: "orchestrator", name: "Orchestrator" },
  { id: "pm", name: "PM / Planner" },
  { id: "dev", name: "Developer" },
  { id: "qa", name: "QA / Reviewer" },
  { id: "devops", name: "DevOps" },
];

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  const text = await res.text();
  // prova comunque a parsare, altrimenti ritorna testo
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

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

  // Projects state
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [projects, setProjects] = useState([]);

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

  async function onSend() {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    pushMessage(activeAgentId, { role: "user", text });

    // TODO: qui collegheremo l’API reale (Worker/FastAPI)
    setTimeout(() => {
      pushMessage(activeAgentId, {
        role: "assistant",
        text: `Ricevuto da ${activeAgent?.name}. Prossimo step: collego questa chat alla tua API.`,
      });
    }, 300);
  }

  async function loadProjects() {
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const res = await fetch(`${API_BASE}/kb/projects/index`, {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);

      if (!res.ok) {
        const msg =
          data?.error ||
          data?._raw ||
          `Errore API (${res.status})`;
        setProjectsError(String(msg));
        setProjects([]);
        return;
      }

      const list = data?.index?.projects;
      setProjects(Array.isArray(list) ? list : []);
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

          {/* Projects */}
          <div style={{ ...styles.sidebarTitle, marginTop: 14 }}>Projects</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              onClick={loadProjects}
              style={styles.smallBtn}
              disabled={projectsLoading}
              title="Ricarica"
            >
              {projectsLoading ? "Loading…" : "Refresh"}
            </button>

            <a
              href={`${API_BASE}/auth/start`}
              style={{ ...styles.smallBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              title="Collega OneDrive (se non sei connesso)"
            >
              Connect OneDrive
            </a>
          </div>

          {projectsError ? (
            <div style={styles.errBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>API error</div>
              <div style={{ fontSize: 12, lineHeight: 1.35 }}>{projectsError}</div>
              <div style={{ fontSize: 12, marginTop: 8, opacity: 0.85 }}>
                Se vedi “Not connected…”, clicca <b>Connect OneDrive</b> sopra.
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div style={{ fontSize: 13, opacity: 0.65 }}>
              {projectsLoading ? "Caricamento..." : "Nessun progetto ancora."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {projects.map((p) => (
                <div key={p.id} style={styles.projectCard}>
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  {p.description ? (
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                      {p.description}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                    id: {p.id}
                  </div>
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
