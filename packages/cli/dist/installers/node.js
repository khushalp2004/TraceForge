import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";
export async function installNode(apiKey, endpoint) {
    const s = spinner();
    s.start("Agent: Configuring Node.js environment...");
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        const envVar = `\nTRACEFORGE_API_KEY="${apiKey}"\nTRACEFORGE_INGEST_URL="${endpoint}"\n`;
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, "utf-8");
            if (content.includes("TRACEFORGE_API_KEY")) {
                content = content.replace(/TRACEFORGE_API_KEY=.*/g, `TRACEFORGE_API_KEY="${apiKey}"`);
                content = content.replace(/TRACEFORGE_INGEST_URL=.*/g, `TRACEFORGE_INGEST_URL="${endpoint}"`);
                fs.writeFileSync(envPath, content);
            }
            else {
                fs.appendFileSync(envPath, envVar);
            }
        }
        else {
            fs.writeFileSync(envPath, envVar);
        }
        s.stop(chalk.green("Agent: .env configured successfully!"));
        console.log(chalk.cyan(`\n=================================================`));
        console.log(chalk.bold.white(`🚀 Node.js Manual Setup Instructions`));
        console.log(chalk.cyan(`=================================================\n`));
        console.log(`Add this at the VERY TOP of your entrypoint file (like index.js or server.js):`);
        console.log(chalk.yellow(`
import TraceForge from "usetraceforge";

TraceForge.init({ 
  apiKey: process.env.TRACEFORGE_API_KEY, 
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  autoCapture: true // This automatically catches ALL fatal Node crashes!
});
`));
        console.log(`(Optional) You can still manually capture handled errors like this:`);
        console.log(chalk.yellow(`
try {
  // your risky code
} catch (error) {
  TraceForge.captureException(error);
}

// NOTE: If you have a custom global error handler or router that catches 
// errors before they crash the app, make sure to add TraceForge.captureException(err) 
// inside it so they are successfully sent to your dashboard!
`));
    }
    catch (error) {
        s.stop(chalk.red("Agent: An error occurred."));
        console.error(error);
    }
}
