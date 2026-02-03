export function getDefaultShell() {
    return process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "bash");
}
