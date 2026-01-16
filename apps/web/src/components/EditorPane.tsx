import { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { EditorFile } from '../types';

interface EditorPaneProps {
  files: EditorFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onChangeFile: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId: string | null;
}

export function EditorPane({
  files,
  activeFileId,
  onSelectFile,
  onChangeFile,
  onSaveFile,
  savingFileId
}: EditorPaneProps) {
  const activeFile = files.find((file) => file.id === activeFileId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeFile) return;
      const isSave =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's';
      if (!isSave) return;
      event.preventDefault();
      onSaveFile?.(activeFile.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, onSaveFile]);

  return (
    <section className="panel editor-pane">
      <div className="panel-header">
        <div>
          <div className="panel-title">エディタ</div>
          <div className="panel-subtitle">Monaco Editor</div>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="chip"
            onClick={() => activeFile && onSaveFile?.(activeFile.id)}
            disabled={!activeFile || savingFileId === activeFile.id}
          >
            {savingFileId === activeFile?.id ? '保存中...' : '保存'}
          </button>
          <div className="tab-strip">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                className={`tab ${file.id === activeFileId ? 'is-active' : ''}`}
                onClick={() => onSelectFile(file.id)}
              >
                {file.name}
                {file.dirty ? ' *' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="panel-body editor-body">
        {activeFile ? (
          <Editor
            height="100%"
            theme="vs-dark"
            language={activeFile.language}
            value={activeFile.contents}
            onChange={(value) => onChangeFile(activeFile.id, value ?? '')}
            options={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 14,
              minimap: { enabled: false },
              smoothScrolling: true
            }}
          />
        ) : (
          <div className="empty-state">編集するファイルを選択してください。</div>
        )}
      </div>
    </section>
  );
}
