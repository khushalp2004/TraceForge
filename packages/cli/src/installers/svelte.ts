import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";

export async function installSvelte(apiKey: string, endpoint: string) {
  const cwd = process.cwd();
  const isSvelteKit = fs.existsSync(path.join(cwd, "svelte.config.js"));

  p.note("Setting up TraceForge for Svelte");

  const envPath = path.join(cwd, ".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  
  if (envContent.includes("VITE_TRACEFORGE_API_KEY")) {
    envContent = envContent.replace(/VITE_TRACEFORGE_API_KEY=.*/g, `VITE_TRACEFORGE_API_KEY=${apiKey}`);
    if (envContent.includes("VITE_TRACEFORGE_INGEST_URL")) {
      envContent = envContent.replace(/VITE_TRACEFORGE_INGEST_URL=.*/g, `VITE_TRACEFORGE_INGEST_URL=${endpoint}`);
    } else {
      envContent += `\nVITE_TRACEFORGE_INGEST_URL=${endpoint}`;
    }
  } else {
    envContent += `\nVITE_TRACEFORGE_API_KEY=${apiKey}\nVITE_TRACEFORGE_INGEST_URL=${endpoint}\n`;
  }
  
  fs.writeFileSync(envPath, envContent.trim() + "\n");
  p.note(`Injected or updated VITE_TRACEFORGE_API_KEY in ${chalk.bold(".env")}`);

  const packageJsonPath = path.join(cwd, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    if (!pkg.dependencies?.["usetraceforge"]) {
      p.note(
        `Please install the TraceForge SDK by running:\n\n  ${chalk.cyan(
          "npm install usetraceforge"
        )}`,
        "Install Dependency"
      );
    }
  }

  p.outro(`🎉 TraceForge setup complete for Svelte! Please copy the code below.`);

  if (isSvelteKit) {
    console.log(chalk.cyan(`\n=================================================`));
    console.log(`In SvelteKit, errors are caught in hooks. Please update or create ${chalk.bold("src/hooks.client.ts")} (and optionally ${chalk.bold("src/hooks.server.ts")}):`);
    console.log(chalk.yellow(`\nimport TraceForgeSvelte from 'usetraceforge/svelte';

TraceForgeSvelte.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL, // Optional
  autoCapture: true
});

export const handleError = ({ error, event }) => {
  TraceForgeSvelte.handleError(error, event);
};`));
    console.log(chalk.cyan(`=================================================\n`));
  } else {
    console.log(chalk.cyan(`\n=================================================`));
    console.log(`For Vanilla Svelte/Vite, please initialize TraceForge in your ${chalk.bold("src/main.ts")}:`);
    console.log(chalk.yellow(`\nimport TraceForge from 'usetraceforge';

TraceForge.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL, // Optional
  autoCapture: true
});`));
    console.log(chalk.cyan(`=================================================\n`));
  }
}
