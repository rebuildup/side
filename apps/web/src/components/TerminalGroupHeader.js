import { ChevronDown, ChevronRight, Edit2, Plus, Tag, Trash2 } from "lucide-react";
export function TerminalGroupHeader({ group, terminalCount, onToggleCollapsed, onCreateTerminal, onDeleteGroup, onRenameGroup, }) {
    return (<div className="terminal-group-header" style={{ borderTopColor: group.color }}>
      <button type="button" className="terminal-group-toggle" onClick={onToggleCollapsed}>
        {group.collapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
        <span className="terminal-group-name">{group.name}</span>
        <span className="terminal-group-count">({terminalCount})</span>
      </button>
      <div className="terminal-group-actions">
        {onCreateTerminal && (<button type="button" className="terminal-group-action-btn" onClick={onCreateTerminal} title="Add terminal to group">
            <Plus size={12}/>
          </button>)}
        {onRenameGroup && (<button type="button" className="terminal-group-action-btn" onClick={onRenameGroup} title="Rename group">
            <Edit2 size={12}/>
          </button>)}
        {onDeleteGroup && (<button type="button" className="terminal-group-action-btn terminal-group-delete" onClick={onDeleteGroup} title="Delete group">
            <Trash2 size={12}/>
          </button>)}
      </div>
    </div>);
}
export function TerminalTag({ tag, color }) {
    return (<span className="terminal-tag" style={{ borderColor: color || "var(--border-dim)" }}>
      <Tag size={10}/>
      {tag}
    </span>);
}
