import { DiffEditor } from "@monaco-editor/react";
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from "../constants";
const LABEL_DIFF_VIEWER = "差分ビューア";
const LABEL_LOADING = "読み込み中...";
const LABEL_CLOSE = "閉じる";
const MONACO_THEME = "vs-dark";
function getLanguageFromPath(path) {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const languageMap = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        json: "json",
        html: "html",
        css: "css",
        scss: "scss",
        less: "less",
        md: "markdown",
        py: "python",
        rb: "ruby",
        go: "go",
        rs: "rust",
        java: "java",
        c: "c",
        cpp: "cpp",
        h: "c",
        hpp: "cpp",
        sh: "shell",
        bash: "shell",
        zsh: "shell",
        yaml: "yaml",
        yml: "yaml",
        xml: "xml",
        sql: "sql",
        graphql: "graphql",
        dockerfile: "dockerfile",
    };
    return languageMap[ext] || "plaintext";
}
export function DiffViewer({ diff, loading, onClose }) {
    const language = diff ? getLanguageFromPath(diff.path) : "plaintext";
    return (<div className="diff-viewer-overlay">
      <div className="diff-viewer-header">
        <div>
          <div className="diff-viewer-title">{LABEL_DIFF_VIEWER}</div>
          {diff && <div className="diff-viewer-path">{diff.path}</div>}
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          {LABEL_CLOSE}
        </button>
      </div>
      <div className="diff-viewer-body">
        {loading ? (<div className="empty-state">{LABEL_LOADING}</div>) : diff ? (<DiffEditor height="100%" theme={MONACO_THEME} language={language} original={diff.original} modified={diff.modified} options={{
                fontFamily: EDITOR_FONT_FAMILY,
                fontSize: EDITOR_FONT_SIZE,
                readOnly: true,
                renderSideBySide: true,
                minimap: { enabled: false },
                smoothScrolling: true,
            }}/>) : null}
      </div>
    </div>);
}
