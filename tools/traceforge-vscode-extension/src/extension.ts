import * as path from "path";
import * as vscode from "vscode";

const SECRET_KEY = "traceforge.projectApiKey";

type PackageJson = {
  name?: string;
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const readJsonFile = async <T>(uri: vscode.Uri): Promise<T | null> => {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
  } catch {
    return null;
  }
};

const writeTextFile = async (uri: vscode.Uri, text: string) => {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text, "utf8"));
};

const fileExists = async (uri: vscode.Uri): Promise<boolean> => {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
};

const appendEnvVar = async (envUri: vscode.Uri, key: string, value: string) => {
  let existing = "";
  try {
    const existingBytes = await vscode.workspace.fs.readFile(envUri);
    existing = Buffer.from(existingBytes).toString("utf8");
  } catch {
    existing = "";
  }

  const lines = existing.split(/\r?\n/);
  const hasKey = lines.some((line) => line.trim().startsWith(`${key}=`));
  if (hasKey) return;

  const suffix = (existing.trim().length ? "\n" : "") + `${key}=${value}\n`;
  await writeTextFile(envUri, existing + suffix);
};

const findPackageJsons = async () =>
  vscode.workspace.findFiles("**/package.json", "**/node_modules/**");

const scorePackage = (pkg: PackageJson) => {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hasExpress = Boolean(deps.express);
  const hasNext = Boolean(deps.next);
  const hasVite = Boolean(deps.vite);
  const hasReact = Boolean(deps.react);

  return {
    isBackend: hasExpress && !hasNext,
    isFrontend: (hasNext || hasVite) && hasReact
  };
};

const pickWorkspaceFolder = async () => {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) return null;
  if (folders.length === 1) return folders[0];
  const pick = await vscode.window.showQuickPick(
    folders.map((f) => ({ label: f.name, folder: f })),
    { placeHolder: "Select workspace folder" }
  );
  return pick?.folder ?? null;
};

const findCandidates = async (root: vscode.WorkspaceFolder) => {
  const pkgs = await findPackageJsons();
  const entries: Array<{
    uri: vscode.Uri;
    pkg: PackageJson;
    rel: string;
    isBackend: boolean;
    isFrontend: boolean;
  }> = [];

  for (const uri of pkgs) {
    const pkg = await readJsonFile<PackageJson>(uri);
    if (!pkg) continue;
    const { isBackend, isFrontend } = scorePackage(pkg);
    const rel = path.posix
      .join(...path.relative(root.uri.fsPath, uri.fsPath).split(path.sep))
      .replace(/package\.json$/, "");
    entries.push({ uri, pkg, rel: rel || ".", isBackend, isFrontend });
  }

  return entries;
};

type CandidateEntry = Awaited<ReturnType<typeof findCandidates>>[number];

type CandidatePickItem = vscode.QuickPickItem & { entry: CandidateEntry };

const chooseProjectFolder = async (kind: "backend" | "frontend", entries: CandidateEntry[]) => {
  const filtered = entries.filter((e) => (kind === "backend" ? e.isBackend : e.isFrontend));
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return filtered[0];

  const pick = await vscode.window.showQuickPick<CandidatePickItem>(
    filtered.map((e) => ({
      label: e.rel || ".",
      description: e.pkg.name || "",
      entry: e
    })),
    { placeHolder: `Select ${kind} folder (package.json)` }
  );
  return pick?.entry ?? null;
};

const getSetupUrlFromIngestUrl = (ingestUrl: string) => {
  try {
    const url = new URL(ingestUrl);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/setup`;
    return url.toString();
  } catch {
    return "";
  }
};

const markProjectConfigured = async (ingestUrl: string, projectKey: string) => {
  const setupUrl = getSetupUrlFromIngestUrl(ingestUrl);
  if (!setupUrl || !projectKey) return { ok: false as const, reason: "invalid_setup_url" };

  try {
    const response = await fetch(setupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Traceforge-Key": projectKey
      },
      body: JSON.stringify({ source: "extension" })
    });

    if (!response.ok) {
      return { ok: false as const, reason: `setup_request_failed_${response.status}` };
    }

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "setup_request_unreachable" };
  }
};

const ensureBackendFiles = async (
  backendRoot: vscode.Uri,
  ingestUrl: string,
  projectKey: string,
  backendProxyPath: string
) => {
  const envUri = vscode.Uri.joinPath(backendRoot, ".env");
  await appendEnvVar(envUri, "TRACEFORGE_INGEST_URL", ingestUrl);
  await appendEnvVar(envUri, "TRACEFORGE_PROJECT_KEY", projectKey);
  await appendEnvVar(envUri, "TRACEFORGE_PROXY_PATH", backendProxyPath);
  await appendEnvVar(envUri, "APP_ENV", "local");
  await appendEnvVar(envUri, "APP_RELEASE", "otherapp-backend@1.0.0");

  const installTsUri = vscode.Uri.joinPath(backendRoot, "src", "traceforge", "install.ts");
  const installJsUri = vscode.Uri.joinPath(backendRoot, "src", "traceforge", "install.js");
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(backendRoot, "src", "traceforge"));

  const installCodeTs = `import express, { type Express, type NextFunction, type Request, type Response } from "express";

type CapturePayload = {
  message: string;
  stackTrace: string;
  environment?: string;
  release?: string;
  payload?: Record<string, unknown>;
};

const getSetupUrl = () => {
  const ingestUrl = process.env.TRACEFORGE_INGEST_URL || "";
  if (!ingestUrl) return "";

  try {
    const url = new URL(ingestUrl);
    url.pathname = \`\${url.pathname.replace(/\\/$/, "")}/setup\`;
    return url.toString();
  } catch {
    return "";
  }
};

const captureToTraceForge = async (payload: CapturePayload) => {
  const ingestUrl = process.env.TRACEFORGE_INGEST_URL || "";
  const projectKey = process.env.TRACEFORGE_PROJECT_KEY || "";
  if (!ingestUrl || !projectKey) return;

  try {
    await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Traceforge-Key": projectKey
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore
  }
};

const notifyTraceForgeConfigured = async (runtime: "backend" | "frontend") => {
  const setupUrl = getSetupUrl();
  const projectKey = process.env.TRACEFORGE_PROJECT_KEY || "";
  if (!setupUrl || !projectKey) return;

  try {
    await fetch(setupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Traceforge-Key": projectKey
      },
      body: JSON.stringify({ runtime })
    });
  } catch {
    // ignore
  }
};

const normalizeError = (err: unknown) => {
  if (err instanceof Error) {
    return { message: err.message || "Error", stackTrace: err.stack || err.message };
  }
  const message = typeof err === "string" ? err : JSON.stringify(err);
  return { message: message || "Error", stackTrace: message || "Error" };
};

export const installTraceForge = (app: Express) => {
  const proxyPath = process.env.TRACEFORGE_PROXY_PATH || "/api/traceforge/ingest";
  let setupSent = false;

  const sendSetupSignal = async (runtime: "backend" | "frontend") => {
    if (runtime === "backend" && setupSent) return;
    await notifyTraceForgeConfigured(runtime);
    if (runtime === "backend") {
      setupSent = true;
    }
  };

  void sendSetupSignal("backend");

  app.post(proxyPath, express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
    const { type, runtime, message, stackTrace, environment, release, payload } = (req.body || {}) as
      Partial<CapturePayload> & { type?: string; runtime?: "backend" | "frontend" };

    if (type === "setup") {
      await sendSetupSignal(runtime === "frontend" ? "frontend" : "backend");
      return res.json({ ok: true, status: "configured" });
    }

    if (!message || !stackTrace) {
      return res.status(400).json({ error: "message and stackTrace are required" });
    }

    await captureToTraceForge({
      message,
      stackTrace,
      environment,
      release,
      payload
    });
    return res.json({ ok: true });
  });

  app.use(async (err: unknown, req: Request, _res: Response, next: NextFunction) => {
    const normalized = normalizeError(err);
    await captureToTraceForge({
      ...normalized,
      environment: process.env.APP_ENV,
      release: process.env.APP_RELEASE,
      payload: {
        route: req.originalUrl,
        method: req.method
      }
    });
    return next(err);
  });

  process.on("unhandledRejection", async (reason) => {
    const normalized = normalizeError(reason);
    await captureToTraceForge({
      ...normalized,
      environment: process.env.APP_ENV,
      release: process.env.APP_RELEASE,
      payload: { source: "unhandledRejection" }
    });
  });

  process.on("uncaughtException", async (error) => {
    const normalized = normalizeError(error);
    await captureToTraceForge({
      ...normalized,
      environment: process.env.APP_ENV,
      release: process.env.APP_RELEASE,
      payload: { source: "uncaughtException" }
    });
  });
};
`;

  const installCodeJs = `import express from "express";

const captureToTraceForge = async (payload) => {
  const ingestUrl = process.env.TRACEFORGE_INGEST_URL || "";
  const projectKey = process.env.TRACEFORGE_PROJECT_KEY || "";
  if (!ingestUrl || !projectKey) return;

  try {
    await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Traceforge-Key": projectKey
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore
  }
};

const getSetupUrl = () => {
  const ingestUrl = process.env.TRACEFORGE_INGEST_URL || "";
  if (!ingestUrl) return "";

  try {
    const url = new URL(ingestUrl);
    url.pathname = \`\${url.pathname.replace(/\\/$/, "")}/setup\`;
    return url.toString();
  } catch {
    return "";
  }
};

const notifyTraceForgeConfigured = async (runtime) => {
  const setupUrl = getSetupUrl();
  const projectKey = process.env.TRACEFORGE_PROJECT_KEY || "";
  if (!setupUrl || !projectKey) return;

  try {
    await fetch(setupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Traceforge-Key": projectKey
      },
      body: JSON.stringify({ runtime })
    });
  } catch {
    // ignore
  }
};

const normalizeError = (err) => {
  if (err instanceof Error) {
    return { message: err.message || "Error", stackTrace: err.stack || err.message };
  }
  const message = typeof err === "string" ? err : JSON.stringify(err);
  return { message: message || "Error", stackTrace: message || "Error" };
};

export const installTraceForge = (app) => {
  const proxyPath = process.env.TRACEFORGE_PROXY_PATH || "/api/traceforge/ingest";
  let setupSent = false;

  const sendSetupSignal = async (runtime) => {
    if (runtime === "backend" && setupSent) return;
    await notifyTraceForgeConfigured(runtime);
    if (runtime === "backend") {
      setupSent = true;
    }
  };

  void sendSetupSignal("backend");

  app.post(proxyPath, express.json({ limit: "1mb" }), async (req, res) => {
    const { type, runtime, message, stackTrace, environment, release, payload } = req.body || {};
    if (type === "setup") {
      await sendSetupSignal(runtime === "frontend" ? "frontend" : "backend");
      return res.json({ ok: true, status: "configured" });
    }

    if (!message || !stackTrace) {
      return res.status(400).json({ error: "message and stackTrace are required" });
    }

    await captureToTraceForge({
      message,
      stackTrace,
      environment,
      release,
      payload
    });
    return res.json({ ok: true });
  });

  app.use(async (err, req, _res, next) => {
    const normalized = normalizeError(err);
    await captureToTraceForge({
      ...normalized,
      environment: process.env.APP_ENV,
      release: process.env.APP_RELEASE,
      payload: {
        route: req.originalUrl,
        method: req.method
      }
    });
    return next(err);
  });

  process.on("unhandledRejection", async (reason) => {
    const normalized = normalizeError(reason);
    await captureToTraceForge({
      ...normalized,
      environment: process.env.APP_ENV,
      release: process.env.APP_RELEASE,
      payload: { source: "unhandledRejection" }
    });
  });

  process.on("uncaughtException", async (error) => {
    const normalized = normalizeError(error);
    await captureToTraceForge({
      ...normalized,
      environment: process.env.APP_ENV,
      release: process.env.APP_RELEASE,
      payload: { source: "uncaughtException" }
    });
  });
};
`;

  await writeTextFile(installTsUri, installCodeTs);
  await writeTextFile(installJsUri, installCodeJs);
};

const patchBackendEntrypoint = async (entryUri: vscode.Uri, backendRoot: vscode.Uri) => {
  const doc = await vscode.workspace.openTextDocument(entryUri);
  const text = doc.getText();

  if (!text.includes("installTraceForge")) {
    const usesImports = /^\s*import\s/m.test(text);
    if (!usesImports) {
      throw new Error("Backend entry file does not use ESM imports. CommonJS projects are not supported yet.");
    }

    // Find express app identifier.
    const appMatch =
      text.match(/const\s+(\w+)\s*=\s*express\s*\(\s*\)\s*;?/m) ||
      text.match(/let\s+(\w+)\s*=\s*express\s*\(\s*\)\s*;?/m) ||
      text.match(/var\s+(\w+)\s*=\s*express\s*\(\s*\)\s*;?/m);
    const appVar = appMatch?.[1] || "app";

    const listenMatch = text.match(/^\s*(\w+)\s*\.\s*listen\s*\(/m);
    if (!listenMatch || listenMatch.index === undefined) {
      throw new Error("Could not find app.listen(...) in backend entry file.");
    }

    const entryDir = path.dirname(entryUri.fsPath);
    const ext = path.extname(entryUri.fsPath).toLowerCase();
    const installFile = ext === ".js" ? "install.js" : "install";
    const installPath = vscode.Uri.joinPath(backendRoot, "src", "traceforge", installFile).fsPath;
    const relImport = path
      .relative(entryDir, installPath)
      .split(path.sep)
      .join(path.posix.sep);
    const importPath = relImport.startsWith(".") ? relImport : `./${relImport}`;

    const importLine = `import { installTraceForge } from "${importPath}";\n`;
    const dotenvLine = text.includes('import "dotenv/config"') ? "" : `import "dotenv/config";\n`;

    // Insert imports at top (after "use strict" if present).
    const firstImport = text.search(/^\s*import\s/m);
    const insertAt = firstImport !== -1 ? firstImport : 0;
    const patchedImports =
      text.slice(0, insertAt) +
      dotenvLine +
      importLine +
      text.slice(insertAt);

    // Insert installTraceForge(...) before listen call line.
    const patchedListenMatch = patchedImports.match(/^\s*\w+\s*\.\s*listen\s*\(/m);
    if (!patchedListenMatch || patchedListenMatch.index === undefined) {
      throw new Error("Could not find app.listen(...) after patching imports.");
    }
    const listenLineStart = patchedImports.lastIndexOf("\n", patchedListenMatch.index) + 1;
    const beforeListen = patchedImports.slice(0, listenLineStart);
    const afterListen = patchedImports.slice(listenLineStart);
    const callLine = `installTraceForge(${appVar});\n`;

    const finalText = beforeListen + callLine + afterListen;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      entryUri,
      new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)),
      finalText
    );
    await vscode.workspace.applyEdit(edit);
    await doc.save();
  }
};

const ensureFrontendFiles = async (
  frontendRoot: vscode.Uri,
  backendBaseUrl: string,
  backendProxyPath: string
) => {
  await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(frontendRoot, "src", "traceforge"));
  const browserUri = vscode.Uri.joinPath(frontendRoot, "src", "traceforge", "browser.ts");
  const proxyUrl = (() => {
    if (!backendBaseUrl.trim()) {
      return backendProxyPath;
    }

    try {
      return new URL(backendProxyPath, backendBaseUrl).toString();
    } catch {
      return backendProxyPath;
    }
  })();
  const browserCode = `type CapturePayload = {
  message: string;
  stackTrace: string;
  environment?: string;
  release?: string;
  payload?: Record<string, unknown>;
};

const proxyUrl = "${proxyUrl}";

const normalizeError = (err: unknown) => {
  if (err instanceof Error) {
    return { message: err.message || "Error", stackTrace: err.stack || err.message };
  }
  const message = typeof err === "string" ? err : JSON.stringify(err);
  return { message: message || "Error", stackTrace: message || "Error" };
};

const send = async (payload: CapturePayload) => {
  try {
    await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    // ignore
  }
};

export const initTraceForgeBrowser = () => {
  void fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "setup", runtime: "frontend" })
  }).catch(() => undefined);

  window.addEventListener("error", (event) => {
    const normalized = normalizeError(event.error ?? event.message);
    void send({ ...normalized });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const normalized = normalizeError((event as PromiseRejectionEvent).reason);
    void send({ ...normalized });
  });
};
`;
  await writeTextFile(browserUri, browserCode);

  // Patch Vite/React entrypoint if present.
  const candidates = ["src/main.tsx", "src/main.jsx", "src/index.tsx", "src/index.jsx"];
  for (const rel of candidates) {
    const uri = vscode.Uri.joinPath(frontendRoot, rel);
    const exists = await fileExists(uri);
    if (!exists) continue;

    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();
    if (text.includes("initTraceForgeBrowser")) return;

    const importLine = `import { initTraceForgeBrowser } from "./traceforge/browser";\n`;
    const callLine = `initTraceForgeBrowser();\n`;
    const firstImport = text.search(/^\s*import\s/m);
    const insertAt = firstImport !== -1 ? firstImport : 0;
    const next = text.slice(0, insertAt) + importLine + text.slice(insertAt);

    const afterImports = next + `\n${callLine}`;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)), afterImports);
    await vscode.workspace.applyEdit(edit);
    await doc.save();
    return;
  }
};

export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.commands.registerCommand("traceforge.configure", async () => {
      const ingestUrl = await vscode.window.showInputBox({
        title: "TraceForge ingest URL",
        value: vscode.workspace.getConfiguration("traceforge").get<string>("ingestUrl") || "http://localhost:3001/ingest"
      });
      if (!ingestUrl) return;

      const backendBaseUrl = await vscode.window.showInputBox({
        title: "Other app backend URL (optional)",
        value: vscode.workspace.getConfiguration("traceforge").get<string>("backendBaseUrl") || "",
        prompt: "Example: http://localhost:4000. Leave empty if frontend and backend share the same origin."
      });
      if (backendBaseUrl === undefined) return;

      const projectKey = await vscode.window.showInputBox({
        title: "TraceForge Project API key",
        password: true,
        prompt: "Paste your TraceForge Project API key"
      });
      if (!projectKey) return;

      await context.secrets.store(SECRET_KEY, projectKey);
      await vscode.workspace.getConfiguration("traceforge").update("ingestUrl", ingestUrl, vscode.ConfigurationTarget.Workspace);
      await vscode.workspace.getConfiguration("traceforge").update("backendBaseUrl", backendBaseUrl, vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage("TraceForge configured for this workspace.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("traceforge.initialize", async () => {
      const root = await pickWorkspaceFolder();
      if (!root) return;

      const ingestUrl =
        vscode.workspace.getConfiguration("traceforge").get<string>("ingestUrl") || "http://localhost:3001/ingest";
      const backendBaseUrl =
        vscode.workspace.getConfiguration("traceforge").get<string>("backendBaseUrl") || "";
      const backendProxyPath =
        vscode.workspace.getConfiguration("traceforge").get<string>("backendProxyPath") || "/api/traceforge/ingest";
      const projectKey = (await context.secrets.get(SECRET_KEY)) || "";

      if (!projectKey) {
        vscode.window.showWarningMessage("TraceForge is not configured yet. Run “TraceForge: Configure” first.");
        return;
      }

      const entries = await findCandidates(root);
      const backend = await chooseProjectFolder("backend", entries);
      const frontend = await chooseProjectFolder("frontend", entries);

      if (!backend) {
        vscode.window.showErrorMessage("Could not find a backend package.json with express. Initialize manually.");
        return;
      }

      const backendRoot = vscode.Uri.joinPath(root.uri, backend.rel);
      await ensureBackendFiles(backendRoot, ingestUrl, projectKey, backendProxyPath);

      // Patch backend entry point.
      const entryCandidates = [
        "src/index.ts",
        "src/server.ts",
        "src/main.ts",
        "src/index.js",
        "src/server.js",
        "src/main.js",
        "index.ts",
        "server.ts",
        "app.ts",
        "index.js",
        "server.js",
        "app.js"
      ];
      let patched = false;
      for (const rel of entryCandidates) {
        const uri = vscode.Uri.joinPath(backendRoot, rel);
        const exists = await fileExists(uri);
        if (!exists) continue;
        await patchBackendEntrypoint(uri, backendRoot);
        patched = true;
        break;
      }

      if (!patched) {
        vscode.window.showWarningMessage(
          "Backend initialized, but entrypoint patch was not applied. Add installTraceForge(app) before app.listen()."
        );
      }

      if (frontend) {
        const frontendRoot = vscode.Uri.joinPath(root.uri, frontend.rel);
        await ensureFrontendFiles(frontendRoot, backendBaseUrl, backendProxyPath);
      } else {
        vscode.window.showWarningMessage("No frontend detected. Backend instrumentation is ready.");
      }

      const configurationResult = await markProjectConfigured(ingestUrl, projectKey);
      if (!configurationResult.ok) {
        vscode.window.showWarningMessage(
          "TraceForge initialized in this workspace, but the setup handshake could not reach your TraceForge backend yet."
        );
        return;
      }

      vscode.window.showInformationMessage("TraceForge initialized in this workspace and marked as configured.");
    })
  );
};

export const deactivate = () => {};
