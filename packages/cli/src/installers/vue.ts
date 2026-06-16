import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";

export async function installVue(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Agent: Configuring Vue.js environment...");

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    const envVar = `\nVITE_TRACEFORGE_API_KEY="${apiKey}"\nVITE_TRACEFORGE_INGEST_URL="${endpoint}"\n`;
    
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      if (content.includes("VITE_TRACEFORGE_API_KEY")) {
        content = content.replace(/VITE_TRACEFORGE_API_KEY=.*/g, `VITE_TRACEFORGE_API_KEY="${apiKey}"`);
        content = content.replace(/VITE_TRACEFORGE_INGEST_URL=.*/g, `VITE_TRACEFORGE_INGEST_URL="${endpoint}"`);
        fs.writeFileSync(envPath, content);
      } else {
        fs.appendFileSync(envPath, envVar);
      }
    } else {
      fs.writeFileSync(envPath, envVar);
    }

    s.stop(chalk.green("Agent: .env configured successfully!"));

    console.log(chalk.cyan(`\n=================================================`));
    console.log(chalk.bold.white(`🚀 Vue.js Manual Setup Instructions`));
    console.log(chalk.cyan(`=================================================\n`));
    console.log(`Please initialize TraceForge in your ${chalk.bold("src/main.ts")}:`);
    
    console.log(chalk.cyan(`\n=================================================`));
    console.log(chalk.yellow(`import { createApp } from 'vue';
import App from './App.vue';
import TraceForgeVue from 'usetraceforge/vue';

const app = createApp(App);

TraceForgeVue.init(app, {
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL, // Optional
});

app.mount('#app');`));
    console.log(chalk.cyan(`=================================================\n`));
  } catch (error) {
    s.stop(chalk.red("Agent: An error occurred."));
    console.error(error);
  }
}
