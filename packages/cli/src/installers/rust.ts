import { spinner, log } from "@clack/prompts";
import { execa } from "execa";
import chalk from "chalk";
import fs from "fs";
import path from "path";

export async function installRust(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Installing TraceForge for Rust...");

  try {
    // 1. Add usetraceforge crate
    s.message("Adding usetraceforge crate...");
    await execa("cargo", ["add", "usetraceforge"]);

    // 2. Setup .env file
    s.message("Configuring .env file...");
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    if (!envContent.includes("TRACEFORGE_API_KEY")) {
      envContent += `\nTRACEFORGE_API_KEY="${apiKey}"\nTRACEFORGE_INGEST_URL="${endpoint}"\n`;
      fs.writeFileSync(envPath, envContent.trim() + "\n");
    }

    // 3. Inject usetraceforge::init() into src/main.rs
    s.message("Injecting SDK into src/main.rs...");
    const mainPath = path.join(process.cwd(), "src", "main.rs");
    if (fs.existsSync(mainPath)) {
      let mainContent = fs.readFileSync(mainPath, "utf-8");
      
      if (!mainContent.includes("usetraceforge::init()")) {
        // Insert usetraceforge::init() at the beginning of fn main()
        const mainFnRegex = /fn\s+main\s*\(\s*\)\s*(?:->\s*[^{]+)?\{/;
        const match = mainContent.match(mainFnRegex);
        
        if (match) {
          const insertIndex = match.index! + match[0].length;
          mainContent = 
            mainContent.slice(0, insertIndex) + 
            "\n    usetraceforge::init();\n" + 
            mainContent.slice(insertIndex);
            
          fs.writeFileSync(mainPath, mainContent);
        } else {
          log.warn(chalk.yellow("Could not automatically find fn main() in src/main.rs. Please add 'usetraceforge::init();' manually."));
        }
      }
    } else {
      log.warn(chalk.yellow("Could not find src/main.rs. Please add 'usetraceforge::init();' manually."));
    }

    // 4. Create TRACEFORGE-README.md
    s.message("Creating TRACEFORGE-README.md...");
    const readmeContent = `# TraceForge Rust SDK Installation

TraceForge has been successfully configured for your Rust application!

## What was installed?
1. **usetraceforge crate**: Added to your \`Cargo.toml\`.
2. **.env File**: Your \`TRACEFORGE_API_KEY\` and \`TRACEFORGE_INGEST_URL\` were added.
3. **SDK Initialization**: We automatically injected \`usetraceforge::init();\` into your \`src/main.rs\`.

## How to Test It
To verify everything is working, intentionally crash your app:
1. Open \`src/main.rs\`.
2. Add a panic statement somewhere:
   \`\`\`rust
   panic!("This is a TraceForge test crash!");
   \`\`\`
3. Run your app: \`cargo run\`
4. Check your TraceForge Dashboard to see the crash logged natively!

## Support
For full documentation, visit [usetraceforge.com/docs](https://usetraceforge.com/docs).
`;
    fs.writeFileSync(path.join(process.cwd(), "TRACEFORGE-README.md"), readmeContent);

    s.stop("TraceForge Rust SDK installed successfully!");

    log.info(chalk.cyan("Next steps:"));
    log.info("1. Read " + chalk.bold("TRACEFORGE-README.md") + " for testing instructions.");
    log.info("2. Trigger a panic in your code to see it captured!");

  } catch (error: any) {
    s.stop("Failed to install TraceForge Rust SDK.");
    log.error(chalk.red(error.message));
    process.exit(1);
  }
}
