import { CheckCircle, Folder, Terminal } from "lucide-react";
export function WelcomeScreen({ onOpenWorkspaceModal, onOpenDeckModal, hasWorkspace, hasDeck, }) {
    return (<div className="welcome-screen">
      <div className="welcome-header">
        <h1>Welcome to S-IDE</h1>
        <p>Get started by adding your first workspace</p>
      </div>

      <div className="welcome-steps">
        <StepCard number={1} title="Add Workspace" description="Select a folder containing your project" iconName="folder" actionButton="Add Workspace" onAction={onOpenWorkspaceModal} completed={hasWorkspace || hasDeck}/>

        <StepCard number={2} title="Create Deck" description="Decks organize your terminals by project" iconName="grid" actionButton="Create Deck" onAction={onOpenDeckModal} disabled={!hasWorkspace} completed={hasDeck}/>

        <StepCard number={3} title="Add Terminals" description="Use + button or shortcuts (C/X) for Claude/Codex" iconName="terminal" disabled={!hasDeck} completed={false}/>
      </div>

      {hasWorkspace && hasDeck && (<div className="welcome-footer">
          <p className="welcome-success">
            <CheckCircle size={16}/>
            <span>You're all set! Start adding terminals to your deck.</span>
          </p>
        </div>)}
    </div>);
}
function StepCard({ number, title, description, iconName, actionButton, onAction, disabled = false, completed = false, }) {
    return (<div className={`step-card ${completed ? "completed" : ""} ${disabled ? "disabled" : ""}`}>
      <div className="step-card-header">
        <div className={`step-number ${completed ? "completed" : ""}`}>
          {completed ? <CheckCircle size={16}/> : number}
        </div>
        <div className="step-card-info">
          <h3 className="step-card-title">{title}</h3>
          <p className="step-card-description">{description}</p>
        </div>
        {iconName === "folder" && (<Folder size={24} className="step-card-icon" opacity={completed ? 1 : 0.3}/>)}
        {iconName === "grid" && (<div className="step-card-icon" style={{ opacity: completed ? 1 : 0.3 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>)}
        {iconName === "terminal" && <Terminal size={24} className="step-card-icon" opacity={0.3}/>}
      </div>

      {actionButton && onAction && !completed && (<div className="step-card-actions">
          <button type="button" className="primary-button" onClick={onAction} disabled={disabled}>
            {actionButton}
          </button>
          {disabled && <span className="step-card-hint">Complete the previous step first</span>}
        </div>)}

      {completed && (<div className="step-card-completed">
          <CheckCircle size={16}/>
          <span>Completed</span>
        </div>)}
    </div>);
}
