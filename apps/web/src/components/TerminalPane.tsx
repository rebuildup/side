import { useEffect, useRef } from 'react';
import { Terminal, type IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import type { TerminalSession } from '../types';

interface TerminalPaneProps {
  session?: TerminalSession | null;
  terminals: TerminalSession[];
  onSelectTerminal: (terminalId: string) => void;
  onNewTerminal: () => void;
  onToggleMaximize: () => void;
  isMaximized: boolean;
  wsUrl?: string;
}

export function TerminalPane({
  session,
  terminals,
  onSelectTerminal,
  onNewTerminal,
  onToggleMaximize,
  isMaximized,
  wsUrl
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isMaximized]);

  useEffect(() => {
    if (!containerRef.current || !session) {
      return;
    }
    containerRef.current.innerHTML = '';
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      theme: {
        background: '#000000',
        foreground: '#ffffff'
      }
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    term.open(containerRef.current);
    fitAddon.fit();
    term.write(`ターミナル準備完了: ${session.title}\r\n`);

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    let socket: WebSocket | null = null;
    let dataDisposable: IDisposable | undefined;
    if (wsUrl) {
      const liveSocket = new WebSocket(wsUrl);
      socket = liveSocket;
      liveSocket.addEventListener('open', () => {
        term.write('\r\n接続しました。\r\n');
      });
      liveSocket.addEventListener('message', (event) => {
        term.write(event.data);
      });
      liveSocket.addEventListener('close', () => {
        term.write('\r\n切断しました。\r\n');
      });
      dataDisposable = term.onData((data) => {
        if (liveSocket.readyState === WebSocket.OPEN) {
          liveSocket.send(data);
        }
      });
    } else {
      term.write('\r\nサーバー未接続。\r\n');
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      dataDisposable?.dispose();
      socket?.close();
      fitAddonRef.current = null;
      term.dispose();
    };
  }, [session?.id, wsUrl]);

  return (
    <section className="panel terminal-pane">
      <div className="panel-header">
        <div>
          <div className="panel-title">ターミナル</div>
          <div className="panel-subtitle">
            {session ? session.title : '未開始'}
          </div>
        </div>
        <div className="terminal-actions">
          <button type="button" className="chip" onClick={onNewTerminal}>
            新規
          </button>
          <button type="button" className="chip" onClick={onToggleMaximize}>
            {isMaximized ? '戻す' : '全画面'}
          </button>
        </div>
      </div>
      <div className="terminal-tabs">
        {terminals.map((terminal) => (
          <button
            key={terminal.id}
            type="button"
            className={`tab ${
              terminal.id === session?.id ? 'is-active' : ''
            }`}
            onClick={() => onSelectTerminal(terminal.id)}
          >
            {terminal.title}
          </button>
        ))}
      </div>
      <div className="panel-body terminal-body">
        {session ? (
          <div className="terminal-surface" ref={containerRef} />
        ) : (
          <div className="empty-state">ターミナルを作成してください。</div>
        )}
      </div>
    </section>
  );
}
