#!/usr/bin/env node
import { intro, outro, text, select, spinner } from "@clack/prompts";
import chalk from "chalk";
import { execa } from "execa";
import { installNextJs } from "./installers/nextjs.js";

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
      { value: "express", label: "Express.js (Prebuilt)" },
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
    console.log(chalk.yellow("Express auto-installation coming soon."));
  }

  outro(chalk.green("✨ You're all set! TraceForge is now protecting your application."));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
