import { useEffect, useState } from "react";

interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

interface AgentTabContentProps {
  agentId: string;
  agentName: string;
}

interface AgentDetails {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  config: AgentConfig;
}

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  status?: string;
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

const STYLES = {
  container: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    padding: "16px",
    height: "100%",
    overflowY: "auto" as const,
  } as const,
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  } as const,
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    color: "var(--ink-muted)",
    letterSpacing: "0.5px",
  } as const,
  card: {
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--bg-secondary)",
  } as const,
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    padding: "4px 0",
  } as const,
  infoLabel: {
    color: "var(--ink-muted)",
  } as const,
  infoValue: {
    color: "var(--ink)",
    fontWeight: 500,
  } as const,
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px",
    color: "var(--ink-muted)",
  } as const,
  error: {
    padding: "12px",
    borderRadius: "6px",
    backgroundColor: "#7f1d1d",
    color: "#fecaca",
    fontSize: "13px",
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
    padding: "8px 12px",
    borderRadius: "4px",
    backgroundColor: "var(--bg-tertiary)",
    fontSize: "13px",
  } as const,
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  } as const,
  statusActive: {
    backgroundColor: "#4caf50",
  } as const,
  statusInactive: {
    backgroundColor: "#9e9e9e",
  } as const,
  statusError: {
    backgroundColor: "#f44336",
  } as const,
} as const;

export function AgentTabContent({ agentId, agentName }: AgentTabContentProps) {
  const [agent, setAgent] = useState<AgentDetails | null>(null);
  const [mcps, setMcps] = useState<MCPServer[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgentData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch agent details
        const detailsRes = await fetch(`/api/agents/${agentId}`);
        if (!detailsRes.ok) throw new Error("Failed to fetch agent details");
        const details = await detailsRes.json();
        setAgent(details);

        // Fetch MCP servers
        const mcpsRes = await fetch(`/api/agents/${agentId}/mcps`);
        if (mcpsRes.ok) {
          const mcpsData = await mcpsRes.json();
          setMcps(mcpsData);
        }

        // Fetch Skills
        const skillsRes = await fetch(`/api/agents/${agentId}/skills`);
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json();
          setSkills(skillsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agent data");
      } finally {
        setLoading(false);
      }
    };

    fetchAgentData();
  }, [agentId]);

  if (loading) {
    return <div style={STYLES.loading}>Loading {agentName}...</div>;
  }

  if (error && !agent) {
    return <div style={STYLES.error}>{error}</div>;
  }

  if (!agent) {
    return <div style={STYLES.loading}>No data available</div>;
  }

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "active":
        return STYLES.statusActive;
      case "inactive":
        return STYLES.statusInactive;
      case "error":
        return STYLES.statusError;
      default:
        return STYLES.statusInactive;
    }
  };

  return (
    <div style={STYLES.container}>
      {/* Agent Info Section */}
      <div style={STYLES.section}>
        <div style={STYLES.sectionTitle}>Agent Information</div>
        <div style={STYLES.card}>
          <div style={STYLES.infoRow}>
            <span style={STYLES.infoLabel}>Status</span>
            <span
              style={{
                ...STYLES.infoValue,
                color: agent.enabled ? "#4caf50" : "#f44336",
              }}
            >
              {agent.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          {agent.config.model && (
            <div style={STYLES.infoRow}>
              <span style={STYLES.infoLabel}>Model</span>
              <span style={STYLES.infoValue}>{agent.config.model}</span>
            </div>
          )}
          {agent.config.temperature !== undefined && (
            <div style={STYLES.infoRow}>
              <span style={STYLES.infoLabel}>Temperature</span>
              <span style={STYLES.infoValue}>{agent.config.temperature}</span>
            </div>
          )}
          {agent.config.maxTokens !== undefined && (
            <div style={STYLES.infoRow}>
              <span style={STYLES.infoLabel}>Max Tokens</span>
              <span style={STYLES.infoValue}>{agent.config.maxTokens}</span>
            </div>
          )}
        </div>
      </div>

      {/* MCP Servers Section */}
      <div style={STYLES.section}>
        <div style={STYLES.sectionTitle}>
          MCP Servers ({mcps.length})
        </div>
        {mcps.length === 0 ? (
          <div style={{ ...STYLES.card, fontSize: "13px", color: "var(--ink-muted)" }}>
            No MCP servers configured
          </div>
        ) : (
          <div style={STYLES.list}>
            {mcps.map((mcp) => (
              <div key={mcp.id} style={STYLES.listItem}>
                <div style={{ ...STYLES.statusDot, ...getStatusStyle(mcp.status) }} />
                <span style={{ flex: 1 }}>{mcp.name}</span>
                <span style={{ color: "var(--ink-muted)", fontSize: "11px" }}>
                  {mcp.command}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div style={STYLES.section}>
        <div style={STYLES.sectionTitle}>Skills ({skills.length})</div>
        {skills.length === 0 ? (
          <div style={{ ...STYLES.card, fontSize: "13px", color: "var(--ink-muted)" }}>
            No skills configured
          </div>
        ) : (
          <div style={STYLES.list}>
            {skills.map((skill) => (
              <div key={skill.id} style={STYLES.listItem}>
                <div style={{ ...STYLES.statusDot, ...getStatusStyle(skill.status) }} />
                <span style={{ flex: 1 }}>{skill.name}</span>
                {skill.description && (
                  <span style={{ color: "var(--ink-muted)", fontSize: "11px" }}>
                    {skill.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description Section */}
      {agent.description && (
        <div style={STYLES.section}>
          <div style={STYLES.sectionTitle}>Description</div>
          <div style={{ ...STYLES.card, fontSize: "13px", color: "var(--ink-dim)" }}>
            {agent.description}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentTabContent;
