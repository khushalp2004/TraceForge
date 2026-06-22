import * as p from "@clack/prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";
export async function installNestJS(apiKey, endpoint) {
    const cwd = process.cwd();
    p.note("Setting up TraceForge for NestJS");
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
            p.note(`Please install the TraceForge SDK by running:\n\n  ${chalk.cyan("npm install usetraceforge")}\n  ${chalk.cyan("npm install -D @nestjs/config")} (if you don't already use ConfigModule)`, "Install Dependency");
        }
    }
    p.outro(`🎉 TraceForge setup complete for NestJS! Please copy the code below.`);
    console.log(chalk.cyan(`\n=================================================`));
    console.log(`Add this inside your ${chalk.bold("main.ts")} bootstrap function:`);
    console.log(chalk.yellow(`\nimport * as dotenv from 'dotenv';
dotenv.config(); // Ensure this is at the VERY TOP to load API keys!

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import TraceForgeNest from 'usetraceforge/nestjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Initialize the SDK
  TraceForgeNest.init({
    apiKey: process.env.TRACEFORGE_API_KEY as string,
    endpoint: process.env.TRACEFORGE_INGEST_URL, // Optional
  });`));
    console.log(chalk.cyan(`\n-- Option A: If you DO NOT have a custom Exception Filter --`));
    console.log(chalk.yellow(`  // 2. Register the Exception Filter Globally
  app.useGlobalFilters(new TraceForgeNest.TraceForgeExceptionFilter());`));
    console.log(chalk.cyan(`\n-- Option B: If you ALREADY have a custom Global Exception Filter --`));
    console.log(`Inject captureException into your existing filter so you don't overwrite it!`);
    console.log(chalk.yellow(`// In your custom filter file (e.g. global-exception.filter.ts):
import TraceForgeNest from 'usetraceforge/nestjs';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    // Natively capture the error without breaking your custom response!
    TraceForgeNest.captureException(exception, {
      tags: { framework: 'nestjs' },
      payload: { url: request.url, method: request.method }
    }).catch(() => {});
    
    // ... rest of your custom error handling ...
  }
}`));
    console.log(chalk.cyan(`\n-- Process-Level Error Handling --`));
    console.log(chalk.yellow(`// Don't forget to capture uncaught exceptions in main.ts!
  process.on('uncaughtException', (err) => {
    TraceForgeNest.captureException(err, { tags: { framework: 'nestjs' } } as any);
    setTimeout(() => process.exit(1), 500);
  });`));
    console.log(chalk.cyan(`=================================================\n`));
}
