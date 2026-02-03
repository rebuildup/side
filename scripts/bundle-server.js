import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "apps", "server");
const serverDistDir = path.join(serverDir, "dist");
const resourcesDir = path.join(rootDir, "apps", "desktop", "src-tauri", "resources");
const bundleDir = path.join(resourcesDir, "server");

console.log("[Bundle] Starting server file bundling...");

// Clean and create bundle directory
if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// Copy server dist files
console.log(`[Bundle] Copying server files from ${serverDistDir} to ${bundleDir}`);
copyDirectory(serverDistDir, bundleDir);

// Copy package.json (production only)
console.log("[Bundle] Creating production package.json...");
const serverPackageJson = JSON.parse(fs.readFileSync(path.join(serverDir, "package.json"), "utf8"));
const prodPackageJson = {
  name: serverPackageJson.name,
  version: serverPackageJson.version,
  type: "module",
  dependencies: serverPackageJson.dependencies,
};
fs.writeFileSync(path.join(bundleDir, "package.json"), JSON.stringify(prodPackageJson, null, 2));

// Use npm to install production dependencies in the bundle directory
// Note: We use npm here because pnpm's symlink-based node_modules are hard to copy
console.log("[Bundle] Installing production dependencies...");
try {
  execSync("npm install --production --no-package-lock --omit=dev", {
    cwd: bundleDir,
    stdio: "inherit",
    shell: true,
  });
  console.log("[Bundle] Server files bundled successfully!");
} catch (error) {
  throw new Error(`npm install failed: ${error.message}`);
}

console.log("[Bundle] Complete!");

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory does not exist: ${src}`);
  }

  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules when copying dist
      if (entry.name !== "node_modules") {
        copyDirectory(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
