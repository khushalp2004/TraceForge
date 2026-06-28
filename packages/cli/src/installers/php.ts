import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";

export async function installPHP(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Agent: Generating PHP/Laravel setup instructions...");
  
  try {
    // 1. Add API key and endpoint to .env
    const envPath = path.resolve(process.cwd(), ".env");
    const envVar = `\nTRACEFORGE_API_KEY="${apiKey}"\nTRACEFORGE_INGEST_URL="${endpoint}"\n`;
    
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, "utf-8");
      if (content.includes("TRACEFORGE_API_KEY")) {
        content = content.replace(/TRACEFORGE_API_KEY=.*/g, `TRACEFORGE_API_KEY="${apiKey}"`);
        content = content.replace(/TRACEFORGE_INGEST_URL=.*/g, `TRACEFORGE_INGEST_URL="${endpoint}"`);
        fs.writeFileSync(envPath, content);
      } else {
        fs.appendFileSync(envPath, envVar);
      }
    } else {
      fs.writeFileSync(envPath, envVar);
    }

    // 2. Generate TRACEFORGE-README.md
    const readmePath = path.resolve(process.cwd(), "TRACEFORGE-README.md");
    const readmeContent = `# TraceForge SDK Configuration for PHP (Laravel)

TraceForge has been initialized in your project! A \`.env\` file was created or updated with your API key and Ingest URL.

## Step 1: Install Dependency
Run the following command in your terminal to install the SDK via Composer:
\`\`\`bash
composer require khushalp2004/traceforge-php
\`\`\`

## Step 2: Zero-Touch Configuration
That's it! Because you are using Laravel, the TraceForge SDK uses **Laravel Package Auto-Discovery**. 

A Service Provider is automatically registered when you run Composer. It seamlessly hooks into Laravel's core \`ExceptionHandler\` and \`Log\` system.

It requires **zero manual configuration in your controllers** to capture:
- Unhandled PHP Fatal Errors
- Standard Exceptions
- Laravel 404s and 500s

*(You can safely delete this file once you have finished configuring TraceForge!)*
`;
    fs.writeFileSync(readmePath, readmeContent);

  } catch (e) {
    // Ignore writing errors
  }

  setTimeout(() => {
    s.stop("PHP setup instructions ready!");
    console.log(chalk.green(`\n✅ Setup instructions generated in TRACEFORGE-README.md!`));
    console.log(chalk.cyan(`Open TRACEFORGE-README.md in your editor to complete the PHP/Laravel integration.\n`));
  }, 1000);
}
