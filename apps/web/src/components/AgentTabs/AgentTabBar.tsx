import { useCallback, useState } from "react";

interface Agent {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

interface AgentTabBarProps {
  agents: Agent[];
  activeAgent: string | null;
  onAgentSelect: (agentId: string) => void;
  onAgentClose?: (agentId: string) => void;
}

const STYLES = {
  tabBar: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "4px 8px 0",
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    minHeight: "35px",
  } as const,
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px",
    borderRadius: "4px 4px 0 0",
    cursor: "pointer",
    userSelect: "none" as const,
    transition: "all 0.15s ease",
    border: "1px solid transparent",
    borderBottom: "none",
    fontSize: "13px",
    fontWeight: 500,
  } as const,
  tabActive: {
    backgroundColor: "var(--bg-primary)",
    borderColor: "var(--border) var(--border) var(--bg-primary) var(--border)",
  } as const,
  tabHover: {
    backgroundColor: "var(--bg-tertiary)",
  } as const,
  tabDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as const,
  tabIcon: {
    width: "16px",
    height: "16px",
  } as const,
  tabLabel: {
    whiteSpace: "nowrap" as const,
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    maxWidth: "120px",
  } as const,
  tabClose: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    borderRadius: "3px",
    marginLeft: "4px",
    opacity: 0,
    transition: "opacity 0.15s ease, background-color 0.15s ease",
    cursor: "pointer",
  } as const,
  tabCloseVisible: {
    opacity: 0.7,
  } as const,
  tabCloseHover: {
    backgroundColor: "var(--bg-hover)",
    opacity: 1,
  } as const,
  closeButton: {
    width: "10px",
    height: "10px",
  } as const,
  addAgentButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "background-color 0.15s ease",
    marginLeft: "4px",
  } as const,
  addAgentButtonHover: {
    backgroundColor: "var(--bg-hover)",
  } as const,
  addAgentIcon: {
    width: "16px",
    height: "16px",
    color: "var(--ink-muted)",
  } as const,
} as const;

export function AgentTabBar({
  agents,
  activeAgent,
  onAgentSelect,
  onAgentClose,
}: AgentTabBarProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [hoveredClose, setHoveredClose] = useState<string | null>(null);

  const handleTabClick = useCallback(
    (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (agent && agent.enabled) {
        onAgentSelect(agentId);
      }
    },
    [agents, onAgentSelect]
  );

  const handleTabClose = useCallback(
    (e: React.MouseEvent, agentId: string) => {
      e.stopPropagation();
      onAgentClose?.(agentId);
    },
    [onAgentClose]
  );

  return (
    <div style={STYLES.tabBar}>
      {agents.map((agent) => {
        const isActive = activeAgent === agent.id;
        const isHovered = hoveredTab === agent.id;
        const isCloseHovered = hoveredClose === agent.id;

        return (
          <div
            key={agent.id}
            style={{
              ...STYLES.tab,
              ...(isActive ? STYLES.tabActive : {}),
              ...(isHovered && !isActive ? STYLES.tabHover : {}),
              ...(!agent.enabled ? STYLES.tabDisabled : {}),
            }}
            onClick={() => handleTabClick(agent.id)}
            onMouseEnter={() => setHoveredTab(agent.id)}
            onMouseLeave={() => setHoveredTab(null)}
            title={`${agent.name}${agent.enabled ? "" : " (not available)"}`}
          >
            {/* Agent Icon */}
            <img
              src={agent.icon}
              alt={agent.name}
              style={STYLES.tabIcon}
              onError={(e) => {
                // Fallback to default icon
                (e.target as HTMLImageElement).src = "/icons/agents/default.svg";
              }}
            />

            {/* Agent Name */}
            <span style={STYLES.tabLabel}>{agent.name}</span>

            {/* Close Button */}
            {isActive && onAgentClose && (
              <div
                style={{
                  ...STYLES.tabClose,
                  ...(isHovered || isCloseHover ? STYLES.tabCloseVisible : {}),
                  ...(isCloseHover ? STYLES.tabCloseHover : {}),
                }}
                onClick={(e) => handleTabClose(e, agent.id)}
                onMouseEnter={() => setHoveredClose(agent.id)}
                onMouseLeave={() => setHoveredClose(null)}
                title="Close agent tab"
              >
                <svg
                  viewBox="0 0 10 10"
                  style={STYLES.closeButton}
                >
                  <path
                    d="M1 1L9 9M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
