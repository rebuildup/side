import { useEffect, useRef } from 'react';
import { Terminal, type IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { WebglAddon } from 'xterm-addon-webgl';
import 'xterm/css/xterm.css';
import type { TerminalSession } from '../types';
import {
  TERMINAL_FONT_FAMILY,
  TERMINAL_FONT_SIZE,
  TERMINAL_BACKGROUND_COLOR,
  TERMINAL_FOREGROUND_COLOR
} from '../constants';

interface TerminalTileProps {
  session: TerminalSession;
  wsUrl: string;
  onDelete: () => void;
}

const TEXT_BOOT = 'ターミナルを起動しました: ';
const TEXT_CONNECTED = '接続しました。';
const TEXT_CLOSED = '切断しました。';
const RESIZE_MESSAGE_PREFIX = '\u0000resize:';

export function TerminalTile({
  session,
  wsUrl,
  onDelete
}: TerminalTileProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.innerHTML = '';
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: TERMINAL_FONT_FAMILY,
      fontSize: TERMINAL_FONT_SIZE,
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: false,
      // Don't use windowsMode with ConPTY - it handles line discipline itself
      windowsMode: false,
      theme: {
        background: TERMINAL_BACKGROUND_COLOR,
        foreground: TERMINAL_FOREGROUND_COLOR
      }
    });

    // Load addons for better TUI support
    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(unicode11Addon);
    term.loadAddon(webLinksAddon);

    // Enable Unicode 11 for proper emoji and wide character support
    term.unicode.activeVersion = '11';

    fitAddonRef.current = fitAddon;
    term.open(containerRef.current);

    // Register terminal query handlers to prevent TUI apps from hanging
    const sendResponse = (response: string) => {
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(response);
      }
    };

    // DSR (Device Status Report) - CSI n
    term.parser.registerCsiHandler({ final: 'n' }, (params) => {
      const param = params.length > 0 ? params.params[0] : 0;

      if (param === 6) {
        // CPR - Cursor Position Report
        const buffer = term.buffer.active;
        const row = buffer.cursorY + buffer.baseY + 1;
        const col = buffer.cursorX + 1;
        console.log(`[CPR] Responding with row=${row}, col=${col}`);
        sendResponse(`\x1b[${row};${col}R`);
        return true;
      } else if (param === 5) {
        // Device Status Report - terminal OK
        console.log('[DSR] Terminal OK');
        sendResponse('\x1b[0n');
        return true;
      }
      return false;
    });

    // DA1 (Primary Device Attributes) - CSI c
    term.parser.registerCsiHandler({ final: 'c' }, (params) => {
      // Respond as VT100 with some common extensions
      console.log('[DA1] Responding to Primary Device Attributes query');
      sendResponse('\x1b[?1;2c');
      return true;
    });

    // DA2 (Secondary Device Attributes) - CSI > c
    term.parser.registerCsiHandler({ prefix: '>', final: 'c' }, (params) => {
      // Respond as VT220
      console.log('[DA2] Responding to Secondary Device Attributes query');
      sendResponse('\x1b[>1;10;0c');
      return true;
    });

    // DECRQM (Request Mode) - CSI ? Ps $ p
    term.parser.registerCsiHandler({ prefix: '?', final: 'p', intermediates: '$' }, (params) => {
      const mode = params.params[0] || 0;
      console.log(`[DECRQM] Mode query for ${mode}`);
      // Respond with "not recognized" (0) for most modes
      // Common modes: 1049 (alt screen), 2004 (bracketed paste), 1004 (focus events)
      sendResponse(`\x1b[?${mode};0$y`);
      return true;
    });

    // OSC handlers for color queries
    // Helper to convert 8-bit color to 16-bit hex format
    const colorTo16BitHex = (value: number): string => {
      // Convert 8-bit (0-255) to 16-bit (0-65535) by multiplying by 257
      const val16 = value * 257;
      return val16.toString(16).padStart(4, '0');
    };

    // OSC 10 - Foreground color query
    term.parser.registerOscHandler(10, (data) => {
      if (data === '?') {
        console.log('[OSC 10] Foreground color query');
        const fgColor = TERMINAL_FOREGROUND_COLOR || '#ffffff';
        const r = parseInt(fgColor.slice(1, 3), 16);
        const g = parseInt(fgColor.slice(3, 5), 16);
        const b = parseInt(fgColor.slice(5, 7), 16);
        sendResponse(`\x1b]10;rgb:${colorTo16BitHex(r)}/${colorTo16BitHex(g)}/${colorTo16BitHex(b)}\x07`);
        return true;
      }
      return false;
    });

    // OSC 11 - Background color query (CRITICAL for dark/light mode detection)
    term.parser.registerOscHandler(11, (data) => {
      if (data === '?') {
        console.log('[OSC 11] Background color query');
        const bgColor = TERMINAL_BACKGROUND_COLOR || '#000000';
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        sendResponse(`\x1b]11;rgb:${colorTo16BitHex(r)}/${colorTo16BitHex(g)}/${colorTo16BitHex(b)}\x07`);
        return true;
      }
      return false;
    });

    // OSC 12 - Cursor color query
    term.parser.registerOscHandler(12, (data) => {
      if (data === '?') {
        console.log('[OSC 12] Cursor color query');
        sendResponse(`\x1b]12;rgb:ffff/ffff/ffff\x07`);
        return true;
      }
      return false;
    });

    // Load WebGL addon for better rendering performance (may fail on some systems)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      console.warn('WebGL addon failed to load, using canvas renderer');
    }

    fitAddon.fit();
    term.write(`${TEXT_BOOT}${session.title}\r\n\r\n`);

    const sendResize = () => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cols = term.cols;
      const rows = term.rows;
      if (!cols || !rows) return;
      socket.send(`${RESIZE_MESSAGE_PREFIX}${cols},${rows}`);
    };

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize();
    });
    resizeObserver.observe(containerRef.current);

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      sendResize();
      term.write(`\r\n${TEXT_CONNECTED}\r\n\r\n`);
    });
    socket.addEventListener('message', (event) => {
      // All messages are strings (UTF-8 encoded)
      // DSR/CPR is now handled by the CSI handler registered above
      if (typeof event.data === 'string') {
        term.write(event.data);
      }
    });
    socket.addEventListener('close', () => {
      term.write(`\r\n${TEXT_CLOSED}\r\n\r\n`);
    });

    const dataDisposable: IDisposable = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    return () => {
      resizeObserver.disconnect();
      dataDisposable.dispose();
      socket.close();
      socketRef.current = null;
      fitAddonRef.current = null;
      term.dispose();
    };
  }, [session.id, session.title, wsUrl]);

  return (
    <div className="terminal-tile">
      <div className="terminal-tile-header">
        <span>{session.title}</span>
        <button
          type="button"
          className="terminal-close-btn"
          onClick={onDelete}
          aria-label="ターミナルを閉じる"
        >
          ×
        </button>
      </div>
      <div className="terminal-tile-body" ref={containerRef} />
    </div>
  );
}
