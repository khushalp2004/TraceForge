import { spinner, log } from "@clack/prompts";
import { execa } from "execa";
import chalk from "chalk";
import fs from "fs";
import path from "path";
export async function installRust(apiKey, endpoint) {
    const s = spinner();
    s.start("Installing TraceForge for Rust...");
    try {
        // 1. Add traceforge crate
        s.message("Adding traceforge crate...");
        await execa("cargo", ["add", "traceforge"]);
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
        // 3. Inject traceforge::init() into src/main.rs
        s.message("Injecting SDK into src/main.rs...");
        const mainPath = path.join(process.cwd(), "src", "main.rs");
        if (fs.existsSync(mainPath)) {
            let mainContent = fs.readFileSync(mainPath, "utf-8");
            if (!mainContent.includes("traceforge::init()")) {
                // Insert traceforge::init() at the beginning of fn main()
                const mainFnRegex = /fn\s+main\s*\(\s*\)\s*(?:->\s*[^{]+)?\{/;
                const match = mainContent.match(mainFnRegex);
                if (match) {
                    const insertIndex = match.index + match[0].length;
                    mainContent =
                        mainContent.slice(0, insertIndex) +
                            "\n    traceforge::init();\n" +
                            mainContent.slice(insertIndex);
                    fs.writeFileSync(mainPath, mainContent);
                }
                else {
                    log.warn(chalk.yellow("Could not automatically find fn main() in src/main.rs. Please add 'traceforge::init();' manually."));
                }
            }
        }
        else {
            log.warn(chalk.yellow("Could not find src/main.rs. Please add 'traceforge::init();' manually."));
        }
        s.stop("TraceForge Rust SDK installed successfully!");
        log.info(chalk.cyan("Next steps:"));
        log.info("1. Run " + chalk.bold("cargo run"));
        log.info("2. Trigger a panic in your code to see it captured!");
    }
    catch (error) {
        s.stop("Failed to install TraceForge Rust SDK.");
        log.error(chalk.red(error.message));
        process.exit(1);
    }
}
