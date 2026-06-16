import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";
export async function installFastify(apiKey, endpoint) {
    const cwd = process.cwd();
    p.note("Setting up TraceForge for Fastify");
    const envPath = path.join(cwd, ".env");
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
    if (envContent.includes("TRACEFORGE_API_KEY")) {
        envContent = envContent.replace(/TRACEFORGE_API_KEY=.*/g, `TRACEFORGE_API_KEY=${apiKey}`);
        if (envContent.includes("TRACEFORGE_INGEST_URL")) {
            envContent = envContent.replace(/TRACEFORGE_INGEST_URL=.*/g, `TRACEFORGE_INGEST_URL=${endpoint}`);
        }
        else {
            envContent += `\nTRACEFORGE_INGEST_URL=${endpoint}`;
        }
    }
    else {
        envContent += `\nTRACEFORGE_API_KEY=${apiKey}\nTRACEFORGE_INGEST_URL=${endpoint}\n`;
    }
    fs.writeFileSync(envPath, envContent.trim() + "\n");
    p.note(`Injected or updated TRACEFORGE_API_KEY in ${chalk.bold(".env")}`);
    const packageJsonPath = path.join(cwd, "package.json");
    if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        if (!pkg.dependencies?.["usetraceforge"]) {
            p.note(`Please install the TraceForge SDK by running:\n\n  ${chalk.cyan("npm install usetraceforge dotenv")}`, "Install Dependency");
        }
    }
    p.outro(`🎉 TraceForge setup complete for Fastify! Please copy the code below.`);
    console.log(chalk.cyan(`\n=================================================`));
    console.log(`Add this at the top of your Fastify server initialization (e.g. ${chalk.bold("server.js")} or ${chalk.bold("src/index.ts")}):`);
    console.log(chalk.yellow(`\nrequire('dotenv').config();
import TraceForgeFastify from 'usetraceforge/fastify';

TraceForgeFastify.init({
  apiKey: process.env.TRACEFORGE_API_KEY,
  endpoint: process.env.TRACEFORGE_INGEST_URL, // Optional
});`));
    console.log(chalk.cyan(`\n-- Option A: If you DO NOT have a custom error handler --`));
    console.log(chalk.yellow(`fastify.setErrorHandler(TraceForgeFastify.errorHandler);`));
    console.log(chalk.cyan(`\n-- Option B: If you ALREADY have a custom error handler --`));
    console.log(`Inject captureException into your existing handler so you don't overwrite it:`);
    console.log(chalk.yellow(`// 1. Ensure you import it at the top of the file!
import TraceForgeFastify from 'usetraceforge/fastify';

// 2. Add captureException inside your custom handler
fastify.setErrorHandler((error, request, reply) => {
  TraceForgeFastify.captureException(error, { 
    tags: { framework: 'fastify' },
    payload: { url: request.url }
  });
  
  // ... rest of your custom error handling logic ...
});`));
    console.log(chalk.cyan(`\n-- ⚠️ IMPORTANT: Process-Level Errors (uncaughtException) --`));
    console.log(`If you use process.on('uncaughtException'), give TraceForge time to send the network request!`);
    console.log(chalk.yellow(`process.on('uncaughtException', (err) => {
  TraceForgeFastify.captureException(err);
  // Do NOT instantly process.exit(1). Add a small delay:
  setTimeout(() => process.exit(1), 500); 
});`));
    console.log(chalk.cyan(`=================================================\n`));
}
