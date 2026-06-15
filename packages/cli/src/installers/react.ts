import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";

export async function installReact(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Agent: Configuring React environment...");

  try {
    // For React, usually Vite uses VITE_ prefix, CRA uses REACT_APP_
    // Let's create a generic .env but also print the keys
    const envPath = path.resolve(process.cwd(), ".env");
    const envVar = `\nVITE_TRACEFORGE_API_KEY="${apiKey}"\nVITE_TRACEFORGE_INGEST_URL="${endpoint}"\nREACT_APP_TRACEFORGE_API_KEY="${apiKey}"\nREACT_APP_TRACEFORGE_INGEST_URL="${endpoint}"\n`;
    
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      if (content.includes("TRACEFORGE_API_KEY")) {
        content = content.replace(/VITE_TRACEFORGE_API_KEY=.*/g, `VITE_TRACEFORGE_API_KEY="${apiKey}"`);
        content = content.replace(/VITE_TRACEFORGE_INGEST_URL=.*/g, `VITE_TRACEFORGE_INGEST_URL="${endpoint}"`);
        content = content.replace(/REACT_APP_TRACEFORGE_API_KEY=.*/g, `REACT_APP_TRACEFORGE_API_KEY="${apiKey}"`);
        content = content.replace(/REACT_APP_TRACEFORGE_INGEST_URL=.*/g, `REACT_APP_TRACEFORGE_INGEST_URL="${endpoint}"`);
        fs.writeFileSync(envPath, content);
      } else {
        fs.appendFileSync(envPath, envVar);
      }
    } else {
      fs.writeFileSync(envPath, envVar);
    }

    s.stop(chalk.green("Agent: .env configured successfully!"));

    console.log(chalk.cyan(`\n=================================================`));
    console.log(chalk.bold.white(`🚀 React Manual Setup Instructions`));
    console.log(chalk.cyan(`=================================================\n`));
    console.log(`Open your main file (e.g. App.tsx or main.tsx) and wrap your app:`);
    console.log(chalk.yellow(`
import TraceForge from "usetraceforge";
import { TraceForgeProvider } from "usetraceforge/react";

// For Vite use import.meta.env, for CRA use process.env
TraceForge.init({ 
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY, 
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL,
  autoCapture: true // automatically catches onClick and promise errors!
});

export default function App() {
  return (
    <TraceForgeProvider>
      <YourComponents />
    </TraceForgeProvider>
  );
}
`));
  } catch (error) {
    s.stop(chalk.red("Agent: An error occurred."));
    console.error(error);
  }
}
