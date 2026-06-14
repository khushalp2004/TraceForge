import fs from "fs";
import path from "path";
import { text, spinner } from "@clack/prompts";
import chalk from "chalk";
import { GoogleGenerativeAI } from "@google/generative-ai";
function getFiles(dir, fileList = [], depth = 0) {
    if (depth > 3)
        return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === "node_modules" || file === ".git" || file === ".next" || file === "dist") {
            continue;
        }
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, fileList, depth + 1);
        }
        else {
            fileList.push(filePath.replace(process.cwd(), ""));
        }
    }
    return fileList;
}
export async function runGeminiAgent(apiKey, endpoint) {
    console.log(chalk.blue("\n🤖 Initializing TraceForge AI Agent..."));
    // Try to find Gemini Key in .env
    let geminiKey = process.env.GEMINI_API_KEY;
    const envPath = path.resolve(process.cwd(), ".env");
    if (!geminiKey && fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/GEMINI_API_KEY="?([^"\n]+)"?/);
        if (match)
            geminiKey = match[1];
    }
    if (!geminiKey) {
        const keyResponse = await text({
            message: "Please enter your Google Gemini API Key (we won't save this):",
            placeholder: "AIzaSy...",
        });
        if (typeof keyResponse === "symbol" || !keyResponse) {
            console.log(chalk.red("Agent: Cancelled."));
            return;
        }
        geminiKey = keyResponse;
    }
    const s = spinner();
    s.start("Agent: Scanning your codebase...");
    const files = getFiles(process.cwd());
    const folderStructure = files.join("\n");
    s.message("Agent: Analyzing architecture with Gemini...");
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        // Use gemini-pro as a safe fallback since 1.5-flash threw a 404 on your key
        const model = genAI.getGenerativeModel({ model: "gemini/gemini-3.1-flash-lite" });
        const prompt = `
I am trying to install an SDK called "usetraceforge".
I have the following files in my project:

${folderStructure}

Here is the documentation for usetraceforge:
- Next.js 15+ Server: Create 'instrumentation.ts' (or 'src/instrumentation.ts') exporting 'register' and 'onRequestError(err, request)' which calls 'TraceForge.captureException(err, { tags: { route: request.url } })'.
- Next.js App Router API Routes: If developers use try/catch in their API routes, they must wrap their route export with 'withTraceForgeRoute' from 'usetraceforge/next' to auto-initialize and catch errors (e.g. 'export const GET = withTraceForgeRoute(async (req) => { ... })').
- Next.js Client: Wrap your app with '<TraceForgeProvider>' from 'usetraceforge/react'.
- Express: Call 'app.use(TraceForge.expressErrorHandler())' AFTER all routes but BEFORE custom error handlers.
- Initialization: You must always call 'TraceForge.init({ apiKey, endpoint })' as early as possible.

The user's API Key is: ${apiKey}
The user's Endpoint is: ${endpoint}

Based on the folder structure above, tell the developer exactly which files they need to edit and provide the exact code snippets they need to copy and paste to configure TraceForge. Be concise, accurate, and professional.
`;
        const result = await model.generateContent(prompt);
        const response = result.response;
        s.stop(chalk.green("Agent: Analysis complete!"));
        console.log("\n" + chalk.cyan(response.text()) + "\n");
    }
    catch (error) {
        s.stop(chalk.red("Agent: Failed to communicate with Gemini API."));
        console.error(error.message || error);
    }
}
