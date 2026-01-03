import React, { useMemo, useState, useEffect } from "react";
import ReactDOM from "react-dom/client";

const DEFAULT_AGENTS = [
  { id: "orchestrator", name: "Orchestrator" },
  { id: "pm", name: "PM / Planner" },
  { id: "dev", name: "Developer" },
  { id: "qa", name: "QA / Reviewer" },
  { id: "devops", name: "DevOps" },
];

const API_BASE = "https://api.farmai-farmagents.it";

function parseAgentProfile(content) {
  const text = String(content || "");
  const lines = text.split(/\r?\n/);
  const nameLine = lines.find((l) => /^\s*Name\s*:/i.test(l)) || "";
  const roleLine = lines.find((l) => /^\s*Role\s*:/i.test(l)) || "";

  const name = nameLine.split(":").slice(1).join(":").trim() || null;
  const role = roleLine.split(":").slice(1).join(":").trim() || null;

  return { name, role };
}

function App() {
  // Agents (loaded from OneDrive via API)
  const [agents, setAgents] = useState(DEFAULT_AGENTS);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState("");

  const [activeAgentId, setActiveAgentId] = useState(DEFAULT_AGENTS[0].id);
  const [draft, setDraft] = useState("");

  const [messagesByAgent, setMessagesByAgent] = useState(() => {
    const init = {};
    for (const a of DEFAULT_AGENTS) init[a.id] = [];
    init[DEFAULT_AGENTS[0].id] = [
      { role: "assistant", text: "Ciao! Access OK ✅ Dimmi cosa vuoi costruire ora." },
    ];
    return init;
  });

  // Active agent profile
  const [agentProfileLoading, setAgentProfileLoading] = useState(false);
  const [agentProfileError, setAgentProfileError] = useState("");
  const [agentProfile, setAgentProfile] = useState(null); // { agent, content, parsed }

  // Projects
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [connected, setConnected] = useState(null); // null=checking, false=no, true=yes

  // Active project
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Create project UI
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Delete project UI
  const [deletingProjectId, setDeletingProjectId] = useState(null);

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeAgentId) || agents[0],
    [agents, activeAgentId]
  );

  const activeMessages = messagesByAgent[activeAgentId] ?? [];

  function pushMessage(agentId, msg) {
    setMessagesByAgent((prev) => ({
      ...prev,
      [agentId]: [...(prev[agentId] ?? []), msg],
    }));
  }

  function connectOneDrive() {
    const returnTo = window.location.origin;
    window.location.href = `${API_BASE}/auth/start?returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function loadAgents() {
    setAgentsLoading(true);
    setAgentsError("");

    try {
      const res = await fetch(`${API_BASE}/agents`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AGENTS ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const list = (data?.agents || [])
        .map((a) => ({ id: a.id, name: a.name }))
        .filter((a) => a.id && a.name);

      if (list.length > 0) {
        setAgents(list);

        // ensure activeAgentId is valid
        setActiveAgentId((prev) => (list.some((x) => x.id === prev) ? prev : list[0].id));

        // ensure messages buckets exist
        setMessagesByAgent((prev) => {
          const next = { ...prev };
          for (const a of list) {
            if (!next[a.id]) next[a.id] = [];
          }
          return next;
        });
      } else {
        setAgents(DEFAULT_AGENTS);
      }
    } catch (e) {
      setAgentsError(e?.message || String(e));
      setAgents(DEFAULT_AGENTS);
    } finally {
      setAgentsLoading(false);
    }
  }

  async function loadAgentProfile(agentId) {
    if (!agentId) return;

    setAgentProfileLoading(true);
    setAgentProfileError("");

    try {
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`PROFILE ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const content = data?.content || "";
      const parsed = parseAgentProfile(content);

      setAgentProfile({
        agent: data?.agent || { id: agentId, name: agentId },
        content,
        parsed,
      });
    } catch (e) {
      setAgentProfile(null);
      setAgentProfileError(e?.message || String(e));
    } finally {
      setAgentProfileLoading(false);
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    setProjectsError("");

    try {
      // 1) Auth status
      const s = await fetch(`${API_BASE}/auth/status`, {
        method: "GET",
        credentials: "include",
      });

      if (!s.ok) {
        const txt = await s.text();
        throw new Error(`AUTH STATUS ${s.status}: ${txt}`);
      }

      const sj = await s.json();

      if (!sj.connected) {
        setConnected(false);
        setProjects([]);
        setActiveProjectId(null);
        return;
      }

      setConnected(true);

      // 2) Projects index
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

      setActiveProjectId((prev) => {
        if (!prev) return list[0]?.id ?? null;
        const exists = list.some((p) => p.id === prev);
        return exists ? prev : (list[0]?.id ?? null);
      });
    } catch (e) {
      setProjectsError(e?.message || String(e));
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }

  async function createProject() {
    const name = newProjectName.trim();
    if (!name) return;

    setCreatingProject(true);
    setProjectsError("");

    try {
      const res = await fetch(`${API_BASE}/kb/projects/create`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`CREATE ${res.status}: ${txt}`);
      }

      setNewProjectName("");
      await loadProjects();
    } catch (e) {
      setProjectsError(e?.message || String(e));
    } finally {
      setCreatingProject(false);
    }
  }

  async function deleteProject(project) {
    if (!project?.id) return;

    const ok = window.confirm(
      `Eliminare il progetto "${project.name}"?\n\nQuesta azione rimuoverà il progetto dall'indice (e se l'API è implementata così, anche la cartella).`
    );
    if (!ok) return;

    setDeletingProjectId(project.id);
    setProjectsError("");

    try {
      const res = await fetch(`${API_BASE}/kb/projects/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`DELETE ${res.status}: ${txt}`);
      }

      await loadProjects();
    } catch (e) {
      setProjectsError(e?.message || String(e));
    } finally {
      setDeletingProjectId(null);
    }
  }

  useEffect(() => {
    loadAgents();
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAgentProfile(activeAgentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgentId]);

  async function onSend() {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    pushMessage(activeAgentId, { role: "user", text });

    // Placeholder: in futuro collegheremo chat → orchestrator API
    setTimeout(() => {
      pushMessage(activeAgentId, {
        role: "assistant",
        text: `Ricevuto da ${activeAgent?.name}. Prossimo step: collego questa chat alla tua API (progetto: ${activeProjectId || "—"}).`,
      });
    }, 250);
  }

  const agentProfileName = agentProfile?.parsed?.name || agentProfile?.agent?.name || activeAgent?.name || "—";
  const agentProfileRole = agentProfile?.parsed?.role || "—";

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
          <div style={styles.sidebarTitleRow}>
            <div style={styles.sidebarTitle}>Agents</div>
            <button onClick={loadAgents} style={styles.smallBtn} disabled={agentsLoading}>
              {agentsLoading ? "…" : "↻"}
            </button>
          </div>

          {agentsError ? (
            <div style={styles.errorBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Errore Agents</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{agentsError}</div>
            </div>
          ) : null}

          <div style={styles.agentList}>
            {agents.map((a) => {
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
            <div style={styles.sidebarTitle}>Agent Profile</div>
            <button
              onClick={() => loadAgentProfile(activeAgentId)}
              style={styles.smallBtn}
              disabled={agentProfileLoading || !activeAgentId}
              title="Ricarica profilo agente"
            >
              {agentProfileLoading ? "…" : "↻"}
            </button>
          </div>

          {agentProfileError ? (
            <div style={styles.errorBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Errore Profile</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{agentProfileError}</div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                Tip: se non sei connesso, premi “Connect OneDrive”.
              </div>
            </div>
          ) : agentProfileLoading ? (
            <div style={styles.muted}>Caricamento profilo…</div>
          ) : agentProfile ? (
            <div style={styles.profileBox}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>{agentProfileName}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{agentProfileRole}</div>
                {agentProfile?.agent?.lastModifiedDateTime ? (
                  <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>
                    Updated: {agentProfile.agent.lastModifiedDateTime}
                  </div>
                ) : null}
              </div>

              <pre style={styles.profilePre}>{agentProfile.content}</pre>
            </div>
          ) : (
            <div style={styles.muted}>Nessun profilo.</div>
          )}

          <div style={styles.divider} />

          <div style={styles.sidebarTitleRow}>
            <div style={styles.sidebarTitle}>Projects</div>
            <button onClick={loadProjects} style={styles.smallBtn} disabled={projectsLoading}>
              {projectsLoading ? "…" : "↻"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nuovo progetto…"
              style={{ ...styles.input, padding: "8px 10px", fontSize: 13 }}
            />
            <button
              onClick={createProject}
              style={styles.smallBtn}
              disabled={creatingProject || !newProjectName.trim()}
              title="Crea progetto"
            >
              {creatingProject ? "…" : "+"}
            </button>
          </div>

          {connected === false ? (
            <div style={styles.errorBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Non connesso</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Connetti OneDrive per caricare agenti e progetti.
              </div>
              <button onClick={connectOneDrive} style={{ ...styles.smallBtn, marginTop: 10 }}>
                Connect OneDrive
              </button>
            </div>
          ) : projectsError ? (
            <div style={styles.errorBox}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Errore Projects</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{projectsError}</div>
            </div>
          ) : projectsLoading || connected === null ? (
            <div style={styles.muted}>Caricamento…</div>
          ) : projects.length === 0 ? (
            <div style={styles.muted}>Nessun progetto.</div>
          ) : (
            <div style={styles.projectsList}>
              {projects.map((p) => {
                const isActive = p.id === activeProjectId;
                const isDeleting = deletingProjectId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => setActiveProjectId(p.id)}
                    style={{
                      ...styles.projectItem,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                      ...(isActive ? { border: "1px solid #111" } : null),
                    }}
                    title="Seleziona progetto"
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{p.name}</div>
                      <div style={styles.projectMeta}>{p.id}</div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteProject(p);
                      }}
                      style={{
                        ...styles.smallBtn,
                        padding: "6px 8px",
                        fontWeight: 900,
                        opacity: isDeleting ? 0.6 : 1,
                      }}
                      disabled={isDeleting}
                      title="Elimina progetto"
                    >
                      {isDeleting ? "…" : "🗑"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <main style={styles.main}>
          <div style={styles.chatHeader}>
            <div style={{ fontWeight: 700 }}>{activeAgent?.name}</div>
            <div style={styles.chatHeaderHint}>
              Project: {activeProjectId || "—"} • Role: {agentProfileRole}
            </div>
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
    gridTemplateColumns: "320px 1fr",
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
    overflow: "auto",
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
    whiteSpace: "nowrap",
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
  profileBox: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  profilePre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 12,
    lineHeight: 1.35,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    background: "#fafafa",
    maxHeight: 220,
    overflow: "auto",
  },
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
    overflow: "auto",
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
    minWidth: 0,
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

