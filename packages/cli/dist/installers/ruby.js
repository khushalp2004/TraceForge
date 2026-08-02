import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";
export async function installRuby(apiKey, endpoint) {
    const s = spinner();
    s.start("Agent: Generating Ruby on Rails setup instructions...");
    try {
        const envPath = path.resolve(process.cwd(), ".env");
        const envVar = `\nTRACEFORGE_API_KEY="${apiKey}"\nTRACEFORGE_INGEST_URL="${endpoint}"\n`;
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, "utf-8");
            if (!content.includes("TRACEFORGE_API_KEY")) {
                fs.appendFileSync(envPath, envVar);
            }
        }
        else {
            fs.writeFileSync(envPath, envVar);
        }
        const readmePath = path.resolve(process.cwd(), "TRACEFORGE-README.md");
        const readmeContent = `# TraceForge SDK for Ruby on Rails

I have automatically configured your \`.env\` file with your TraceForge API Key!

## Installation

Because we built this as a Zero-Touch SDK using Rails Railties, there is ZERO manual configuration required in your application code! 

1. Install the SDK:
   \`\`\`bash
   bundle add traceforge
   # Or manually: gem install traceforge
   \`\`\`

2. Start your Rails server!
   \`\`\`bash
   rails server
   \`\`\`

The TraceForge SDK will automatically discover itself, inject our Rack middleware, and start capturing all unhandled exceptions instantly!

### Testing it out
Throw an exception anywhere in your Rails controllers:
\`\`\`ruby
def index
  raise "This is a zero-touch Rails exception!"
end
\`\`\`
Check your TraceForge Dashboard and you will see the exception appear instantly!
`;
        fs.writeFileSync(readmePath, readmeContent);
        s.stop(chalk.green("Agent: Successfully configured Ruby on Rails!"));
        console.log(chalk.cyan("\nNext Steps:"));
        console.log(`1. Open ${chalk.bold("TRACEFORGE-README.md")} for final instructions.`);
        console.log(`2. Run ${chalk.yellow("bundle add traceforge")}`);
    }
    catch (error) {
        s.stop(chalk.red("Agent: Failed to configure Ruby on Rails setup."));
        console.error(error);
    }
}
