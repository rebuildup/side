import { useCallback, useEffect, useState } from "react";

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

interface CommonSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const STYLES = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  } as const,
  content: {
    backgroundColor: "var(--bg-primary)",
    borderRadius: "8px",
    width: "90%",
    maxWidth: "700px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column" as const,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
  } as const,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
  } as const,
  title: {
    fontSize: "16px",
    fontWeight: 600,
    margin: 0,
  } as const,
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "var(--ink-muted)",
    padding: 0,
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
  } as const,
  body: {
    padding: "20px",
    overflowY: "auto" as const,
    flex: 1,
  } as const,
  section: {
    marginBottom: "24px",
  } as const,
  sectionTitle: {
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "12px",
    color: "var(--ink)",
  } as const,
  sectionDescription: {
    fontSize: "12px",
    color: "var(--ink-muted)",
    marginBottom: "12px",
  } as const,
  list: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as const,
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg-secondary)",
  } as const,
  listItemName: {
    flex: 1,
    fontSize: "13px",
    fontWeight: 500,
  } as const,
  listItemCommand: {
    fontSize: "12px",
    color: "var(--ink-muted)",
    fontFamily: "monospace",
  } as const,
  listItemActions: {
    display: "flex",
    gap: "4px",
  } as const,
  button: {
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--ink)",
    transition: "background-color 0.15s ease",
  } as const,
  buttonHover: {
    backgroundColor: "var(--bg-hover)",
  } as const,
  buttonPrimary: {
    backgroundColor: "var(--accent-primary)",
    color: "white",
    border: "none",
  } as const,
  buttonDanger: {
    backgroundColor: "#f44336",
    color: "white",
    border: "none",
  } as const,
  addButton: {
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "13px",
    cursor: "pointer",
    border: "1px dashed var(--border)",
    backgroundColor: "transparent",
    color: "var(--ink-muted)",
    transition: "all 0.15s ease",
  } as const,
  addButtonHover: {
    borderColor: "var(--accent-primary)",
    color: "var(--accent-primary)",
  } as const,
  tabs: {
    display: "flex",
    gap: "4px",
    marginBottom: "16px",
    borderBottom: "1px solid var(--border)",
  } as const,
  tab: {
    padding: "8px 16px",
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    fontSize: "13px",
    color: "var(--ink-muted)",
    transition: "all 0.15s ease",
  } as const,
  tabActive: {
    color: "var(--accent-primary)",
    borderBottomColor: "var(--accent-primary)",
  } as const,
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "16px 20px",
    borderTop: "1px solid var(--border)",
  } as const,
  emptyState: {
    padding: "20px",
    textAlign: "center",
    color: "var(--ink-muted)",
    fontSize: "13px",
  } as const,
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    marginBottom: "4px",
    color: "var(--ink)",
  } as const,
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "4px",
    border: "1px solid var(--border)",
    fontSize: "13px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--ink)",
  } as const,
  formRow: {
    marginBottom: "12px",
  } as const,
} as const;

export function CommonSettings({ isOpen, onClose }: CommonSettingsProps) {
  const [activeTab, setActiveTab] = useState<"mcps" | "skills">("mcps");
  const [agents, setAgents] = useState<string[]>([]);
  const [sharedMCPs, setSharedMCPs] = useState<MCPServer[]>([]);
  const [sharedSkills, setSharedSkills] = useState<Skill[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showAddMCP, setShowAddMCP] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
      fetchSharedResources();
    }
  }, [isOpen]);

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.filter((a: { enabled: boolean }) => a.enabled).map((a: { id: string }) => a.id));
        // Default to all agents selected
        setSelectedAgents(new Set(data.filter((a: { enabled: boolean }) => a.enabled).map((a: { id: string }) => a.id)));
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  };

  const fetchSharedResources = async () => {
    setLoading(true);
    try {
      // For now, fetch from first available agent
      // In future, this will be from shared resources API
      const agentId = agents[0];
      if (agentId) {
        const [mcpsRes, skillsRes] = await Promise.all([
          fetch(`/api/agents/${agentId}/mcps`),
          fetch(`/api/agents/${agentId}/skills`),
        ]);

        if (mcpsRes.ok) setSharedMCPs(await mcpsRes.json());
        if (skillsRes.ok) setSharedSkills(await skillsRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch shared resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const handleShareMCP = async (mcp: MCPServer) => {
    // Share MCP with selected agents
    for (const agentId of selectedAgents) {
      try {
        await fetch(`/api/agents/${agentId}/mcps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mcp),
        });
      } catch (err) {
        console.error(`Failed to add MCP to ${agentId}:`, err);
      }
    }
    await fetchSharedResources();
  };

  const handleRemoveMCP = async (mcpId: string) => {
    // Remove MCP from selected agents
    for (const agentId of selectedAgents) {
      try {
        await fetch(`/api/agents/${agentId}/mcps/${mcpId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error(`Failed to remove MCP from ${agentId}:`, err);
      }
    }
    await fetchSharedResources();
  };

  const handleShareSkill = async (skill: Skill) => {
    // Share skill with selected agents
    for (const agentId of selectedAgents) {
      try {
        await fetch(`/api/agents/${agentId}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(skill),
        });
      } catch (err) {
        console.error(`Failed to add skill to ${agentId}:`, err);
      }
    }
    await fetchSharedResources();
  };

  const handleRemoveSkill = async (skillId: string) => {
    // Remove skill from selected agents
    for (const agentId of selectedAgents) {
      try {
        await fetch(`/api/agents/${agentId}/skills/${skillId}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error(`Failed to remove skill from ${agentId}:`, err);
      }
    }
    await fetchSharedResources();
  };

  if (!isOpen) return null;

  return (
    <div style={STYLES.overlay} onClick={onClose}>
      <div style={STYLES.content} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={STYLES.header}>
          <h2 style={STYLES.title}>Shared Resources Settings</h2>
          <button
            style={STYLES.closeButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={STYLES.body}>
          {/* Agent Selection */}
          <div style={STYLES.section}>
            <div style={STYLES.sectionTitle}>Share with Agents</div>
            <div style={STYLES.sectionDescription}>
              Select which agents should use the shared resources below
            </div>
            <div style={STYLES.list}>
              {agents.map((agentId) => (
                <label
                  key={agentId}
                  style={{
                    ...STYLES.listItem,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAgents.has(agentId)}
                    onChange={() => toggleAgent(agentId)}
                  />
                  <span style={{ ...STYLES.listItemName, textTransform: "capitalize" }}}>
                    {agentId}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={STYLES.tabs}>
            <div
              style={{ ...STYLES.tab, ...(activeTab === "mcps" ? STYLES.tabActive : {}) }}
              onClick={() => setActiveTab("mcps")}
            >
              MCP Servers
            </div>
            <div
              style={{ ...STYLES.tab, ...(activeTab === "skills" ? STYLES.tabActive : {}) }}
              onClick={() => setActiveTab("skills")}
            >
              Skills
            </div>
          </div>

          {/* MCP Servers Tab */}
          {activeTab === "mcps" && (
            <div style={STYLES.section}>
              <div style={STYLES.sectionTitle}>Shared MCP Servers</div>
              <div style={STYLES.sectionDescription}>
                These MCP servers will be available to all selected agents
              </div>

              {loading ? (
                <div style={STYLES.emptyState}>Loading...</div>
              ) : sharedMCPs.length === 0 ? (
                <div style={STYLES.emptyState}>No shared MCP servers configured</div>
              ) : (
                <div style={STYLES.list}>
                  {sharedMCPs.map((mcp) => (
                    <div key={mcp.id} style={STYLES.listItem}>
                      <span style={STYLES.listItemName}>{mcp.name}</span>
                      <span style={STYLES.listItemCommand}>{mcp.command}</span>
                      <div style={STYLES.listItemActions}>
                        <button
                          style={{ ...STYLES.button, ...STYLES.buttonDanger }}
                          onClick={() => handleRemoveMCP(mcp.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                style={{ ...STYLES.addButton, marginTop: "12px" }}
                onClick={() => setShowAddMCP(true)}
              >
                + Add MCP Server
              </button>
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === "skills" && (
            <div style={STYLES.section}>
              <div style={STYLES.sectionTitle}>Shared Skills</div>
              <div style={STYLES.sectionDescription}>
                These skills will be available to all selected agents
              </div>

              {loading ? (
                <div style={STYLES.emptyState}>Loading...</div>
              ) : sharedSkills.length === 0 ? (
                <div style={STYLES.emptyState}>No shared skills configured</div>
              ) : (
                <div style={STYLES.list}>
                  {sharedSkills.map((skill) => (
                    <div key={skill.id} style={STYLES.listItem}>
                      <span style={STYLES.listItemName}>{skill.name}</span>
                      {skill.description && (
                        <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                          {skill.description}
                        </span>
                      )}
                      <div style={STYLES.listItemActions}>
                        <button
                          style={{ ...STYLES.button, ...STYLES.buttonDanger }}
                          onClick={() => handleRemoveSkill(skill.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                style={{ ...STYLES.addButton, marginTop: "12px" }}
                onClick={() => setShowAddSkill(true)}
              >
                + Add Skill
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={STYLES.footer}>
          <button style={STYLES.button} onClick={onClose}>
            Close
          </button>
          <button style={{ ...STYLES.button, ...STYLES.buttonPrimary }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommonSettings;
