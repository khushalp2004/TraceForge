import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";

export async function installPython(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Agent: Generating Python setup instructions...");
  
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
    const readmeContent = `# TraceForge SDK Configuration

TraceForge has been initialized in your project! A \`.env\` file was created or updated with your API key and Ingest URL.

## Step 1: Install Dependencies
Run the following command to install the required packages:
\`\`\`bash
pip install usetraceforge python-dotenv
\`\`\`

## Step 2: Initialize TraceForge
Add this as early as possible in your application lifecycle (e.g., \`settings.py\` or \`main.py\`):

\`\`\`python
import traceforge
from dotenv import load_dotenv

load_dotenv() # Load variables from .env

# Automatically reads TRACEFORGE_API_KEY from .env
traceforge.init()
\`\`\`

### For Django Applications
Add the middleware to the **END** of your \`MIDDLEWARE\` list in \`settings.py\`:
\`\`\`python
MIDDLEWARE = [
    # ... your other middlewares
    'traceforge.integrations.django.TraceForgeMiddleware',
]
\`\`\`

### For FastAPI Applications
Register the exception handler immediately after creating your app instance:
\`\`\`python
from fastapi import FastAPI
from traceforge.integrations import fastapi
import traceforge

app = FastAPI()
fastapi.init(app)
\`\`\`

> **⚠️ Using pydantic-settings?**
> If your application uses \`pydantic-settings\` to load environment variables, Pydantic might throw a \`ValidationError\` (Extra inputs are not permitted) because the TraceForge CLI automatically added keys to your \`.env\` file.
> 
> To fix this, simply add the keys to your Settings class and set \`extra="ignore"\`:
> \`\`\`python
> from pydantic_settings import BaseSettings, SettingsConfigDict
>
> class Settings(BaseSettings):
>     # ... your existing variables
>     TRACEFORGE_API_KEY: str | None = None
>     TRACEFORGE_INGEST_URL: str | None = None
> 
>     model_config = SettingsConfigDict(env_file=".env", extra="ignore")
> \`\`\`

*(You can safely delete this file once you have finished configuring TraceForge!)*
`;
    fs.writeFileSync(readmePath, readmeContent);

  } catch (e) {
    // Ignore writing errors
  }

  setTimeout(() => {
    s.stop("Python setup instructions ready!");

    console.log(chalk.cyan(`\n=================================================`));
    console.log(chalk.bold(`Step 1: Install the SDK`));
    console.log(chalk.yellow(`pip install usetraceforge python-dotenv\n`));

    console.log(chalk.bold(`Step 2: Initialize the SDK`));
    console.log(`Add this as early as possible in your application lifecycle (e.g. settings.py or main.py):`);
    console.log(chalk.yellow(`import traceforge
import os
from dotenv import load_dotenv

load_dotenv() # Load variables from .env

traceforge.init() # Automatically reads TRACEFORGE_API_KEY from .env`));

    console.log(chalk.cyan(`\n-- Option A: Django --`));
    console.log(`Add the middleware to the END of your MIDDLEWARE list in settings.py:`);
    console.log(chalk.yellow(`MIDDLEWARE = [
    # ... your other middlewares
    'traceforge.integrations.django.TraceForgeMiddleware',
]`));

    console.log(chalk.cyan(`\n-- Option B: FastAPI --`));
    console.log(`Register the exception handler after creating your app:`);
    console.log(chalk.yellow(`from fastapi import FastAPI
from traceforge.integrations import fastapi

app = FastAPI()
fastapi.init(app)`));

    console.log(chalk.cyan(`=================================================\n`));
  }, 1000);
}
