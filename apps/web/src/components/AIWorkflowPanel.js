import { Bot, Brain, Code, History, Settings } from "lucide-react";
import { useState } from "react";
const TABS = [
    { id: "skills", label: "Skills", icon: Code },
    { id: "templates", label: "Templates", icon: Brain },
    { id: "history", label: "History", icon: History },
    { id: "agents", label: "Multi-Agent", icon: Bot },
    { id: "settings", label: "Settings", icon: Settings },
];
export function AIWorkflowPanel({ workspaceId }) {
    const [activeTab, setActiveTab] = useState("skills");
    return (<div className="ai-workflow-panel">
      <div className="ai-workflow-tabs">
        {TABS.map((tab) => (<button key={tab.id} type="button" className={`ai-workflow-tab ${activeTab === tab.id ? "active" : ""}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={14}/>
            <span>{tab.label}</span>
          </button>))}
      </div>
      <div className="ai-workflow-content">
        {activeTab === "skills" && (<div className="ai-workflow-placeholder">
            <div className="empty-state">Skills Manager</div>
            <div className="panel-body">
              <p style={{ padding: "12px", color: "var(--muted)" }}>
                Manage AI skills and capabilities...
              </p>
            </div>
          </div>)}
        {activeTab === "templates" && (<div className="ai-workflow-placeholder">
            <div className="empty-state">Prompt Templates</div>
            <div className="panel-body">
              <p style={{ padding: "12px", color: "var(--muted)" }}>
                Create and manage prompt templates...
              </p>
            </div>
          </div>)}
        {activeTab === "history" && (<div className="ai-workflow-placeholder">
            <div className="empty-state">Prompt History</div>
            <div className="panel-body">
              <p style={{ padding: "12px", color: "var(--muted)" }}>
                View and search prompt history...
              </p>
            </div>
          </div>)}
        {activeTab === "agents" && (<div className="ai-workflow-placeholder">
            <div className="empty-state">Multi-Agent Configuration</div>
            <div className="panel-body">
              <p style={{ padding: "12px", color: "var(--muted)" }}>
                Configure multiple AI agents...
              </p>
            </div>
          </div>)}
        {activeTab === "settings" && (<div className="ai-workflow-placeholder">
            <div className="empty-state">CLAUDE Settings</div>
            <div className="panel-body">
              <p style={{ padding: "12px", color: "var(--muted)" }}>
                Configure Claude API settings...
              </p>
            </div>
          </div>)}
      </div>
    </div>);
}
