import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";
export async function installGo(apiKey, endpoint) {
    const s = spinner();
    s.start("Agent: Generating Go setup instructions...");
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
            }
            else {
                fs.appendFileSync(envPath, envVar);
            }
        }
        else {
            fs.writeFileSync(envPath, envVar);
        }
        // 2. Generate TRACEFORGE-README.md
        const readmePath = path.resolve(process.cwd(), "TRACEFORGE-README.md");
        const readmeContent = `# TraceForge SDK Configuration for Go

TraceForge has been initialized in your project! A \`.env\` file was created or updated with your API key and Ingest URL.

## Step 1: Install Dependency
Run the following command in your terminal:
\`\`\`bash
go get github.com/khushalp2004/TraceForge/packages/sdk-go@latest
\`\`\`

## Step 2: Initialize TraceForge
Add this to your \`main.go\` file as early as possible. (Make sure you load your \`.env\` file using something like \`godotenv\` first!)

\`\`\`go
import "github.com/khushalp2004/TraceForge/packages/sdk-go"

func main() {
    // Load your .env file here (e.g. godotenv.Load())
    
    // Automatically reads TRACEFORGE_API_KEY and TRACEFORGE_INGEST_URL from the environment
    traceforge.Init()
    
    // ... rest of your code
}
\`\`\`

## Step 3: Register Middleware
TraceForge provides a **Zero-Touch APM Middleware**! 

When you add this middleware, it will automatically wrap your HTTP responses. It requires **zero manual configuration in your handlers** to capture:
- Unhandled Panics (via standard \`recover()\`)
- Handled Errors (intercepts any HTTP 400-599 responses)
- Route Not Found (intercepts HTTP 404 responses)

### For Gin
\`\`\`go
import tfgin "github.com/khushalp2004/TraceForge/packages/sdk-go/integrations/gin"

// Note: Ensure TraceForge is added AFTER global catch-alls like gin.Recovery()
router := gin.Default()
router.Use(tfgin.TraceForge())
\`\`\`

### For Echo
\`\`\`go
import tfecho "github.com/khushalp2004/TraceForge/packages/sdk-go/integrations/echo"

e := echo.New()
e.Use(tfecho.TraceForge())
\`\`\`

### For net/http
\`\`\`go
import tfhttp "github.com/khushalp2004/TraceForge/packages/sdk-go/integrations/nethttp"

mux := http.NewServeMux()
// ... register routes on mux ...

// Wrap your entire router
log.Fatal(http.ListenAndServe(":8080", tfhttp.TraceForge(mux)))
\`\`\`

*(You can safely delete this file once you have finished configuring TraceForge!)*
`;
        fs.writeFileSync(readmePath, readmeContent);
    }
    catch (e) {
        // Ignore writing errors
    }
    setTimeout(() => {
        s.stop("Go setup instructions ready!");
        console.log(chalk.green(`\n✅ Setup instructions generated in TRACEFORGE-README.md!`));
        console.log(chalk.cyan(`Open TRACEFORGE-README.md in your editor to complete the Go integration.\n`));
    }, 1000);
}
