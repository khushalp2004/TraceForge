#!/usr/bin/env node
import { intro, outro, text, select, spinner } from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import { installNextJs } from "./installers/nextjs.js";
import { installExpress } from "./installers/express.js";
import { installReact } from "./installers/react.js";
import { installNode } from "./installers/node.js";
import { installVue } from "./installers/vue.js";
import { installAngular } from "./installers/angular.js";
import { installSvelte } from "./installers/svelte.js";
import { installFastify } from "./installers/fastify.js";
import { installPython } from "./installers/python.js";

async function main() {
  console.log();
  intro(chalk.bgBlue(chalk.white(" Welcome to TraceForge ")));

  const apiKey = await text({
    message: "What is your TraceForge API Key?",
    placeholder: "tf_...",
    validate(value) {
      if (value.length === 0) return "API Key is required!";
    },
  });

  if (typeof apiKey !== "string") {
    outro(chalk.red("Installation cancelled."));
    process.exit(1);
  }

  const endpoint = await text({
    message: "What is your TraceForge Ingest Endpoint URL?",
    placeholder: "http://localhost:80/ingest",
    defaultValue: "http://localhost:80/ingest",
  });

  const framework = await select({
    message: "Which framework are you using?",
    options: [
      { value: "nextjs", label: "Next.js (Prebuilt)" },
      { value: "express", label: "Express.js (Auto Setup)" },
      { value: "fastify", label: "Fastify (Manual Setup)" },
      { value: "nestjs", label: "NestJS (Manual Setup)" },
      { value: "react", label: "React (Manual Setup)" },
      { value: "vue", label: "Vue.js (Manual Setup)" },
      { value: "angular", label: "Angular (Manual Setup)" },
      { value: "svelte", label: "Svelte / SvelteKit (Manual Setup)" },
      { value: "python", label: "Python (Django / FastAPI)" },
      { value: "node", label: "Raw Node.js (Manual Setup)" },
    ],
  });

  if (typeof framework !== "string") {
    outro(chalk.red("Installation cancelled."));
    process.exit(1);
  }

  const s = spinner();
  s.start("Installing usetraceforge...");
  
  try {
    await execa("npm", ["install", "usetraceforge"]);
    s.stop(chalk.green("Package usetraceforge installed successfully!"));
  } catch (error) {
    s.stop(chalk.red("Failed to install usetraceforge."));
    console.error(error);
    process.exit(1);
  }

  if (framework === "nextjs") {
    await installNextJs(apiKey as string, endpoint as string);
  } else if (framework === "express") {
    await installExpress(apiKey as string, endpoint as string);
  } else if (framework === "fastify") {
    await installFastify(apiKey as string, endpoint as string);
  } else if (framework === "nestjs") {
    const { installNestJS } = await import("./installers/nestjs.js");
    await installNestJS(apiKey as string, endpoint as string);
  } else if (framework === "react") {
    await installReact(apiKey as string, endpoint as string);
  } else if (framework === "vue") {
    await installVue(apiKey as string, endpoint as string);
  } else if (framework === "angular") {
    await installAngular(apiKey as string, endpoint as string);
  } else if (framework === "svelte") {
    await installSvelte(apiKey as string, endpoint as string);
  } else if (framework === "python") {
    await installPython(apiKey as string, endpoint as string);
  } else if (framework === "node") {
    await installNode(apiKey as string, endpoint as string);
  }

  outro(chalk.green("✨ You're all set! TraceForge is now protecting your application."));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
