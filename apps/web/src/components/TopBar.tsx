import type { Deck } from '../types';

interface TopBarProps {
  deck?: Deck;
  apiBase?: string;
  status?: string;
  terminalMaximized: boolean;
  onCreateDeck: () => void;
  onCreateTerminal: () => void;
  onToggleTerminal: () => void;
}

export function TopBar({
  deck,
  apiBase,
  status,
  terminalMaximized,
  onCreateDeck,
  onCreateTerminal,
  onToggleTerminal
}: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <div className="brand">Deck IDE</div>
        <div className="deck-meta">
          <span>{deck?.name ?? 'デッキ'}</span>
          <span className="deck-root">{deck?.root ?? ''}</span>
          {apiBase ? <span className="api-base">{apiBase}</span> : null}
        </div>
      </div>
      <div className="topbar-actions">
        {status ? <div className="status-pill">{status}</div> : null}
        <button type="button" className="chip" onClick={onCreateDeck}>
          デッキ作成
        </button>
        <button type="button" className="chip" onClick={onCreateTerminal}>
          ターミナル作成
        </button>
        <button type="button" className="chip" onClick={onToggleTerminal}>
          {terminalMaximized ? '戻す' : '最大化'}
        </button>
      </div>
    </header>
  );
}
