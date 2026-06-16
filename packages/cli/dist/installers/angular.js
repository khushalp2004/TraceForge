import { spinner } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs";
import path from "path";
export async function installAngular(apiKey, endpoint) {
    const s = spinner();
    s.start("Agent: Configuring Angular environment...");
    try {
        // Angular typically uses environment.ts rather than .env
        const envDir = path.resolve(process.cwd(), "src", "environments");
        const envFile = path.resolve(envDir, "environment.ts");
        if (fs.existsSync(envDir)) {
            if (!fs.existsSync(envFile)) {
                fs.writeFileSync(envFile, `export const environment = {\n  production: false,\n  traceforgeApiKey: '${apiKey}',\n  traceforgeEndpoint: '${endpoint}'\n};\n`);
            }
            else {
                let content = fs.readFileSync(envFile, "utf-8");
                // Simple append if it doesn't exist, though usually it's an object. 
                // For safety, we just let them do it manually if it's complex, but we can try appending to the object.
                if (!content.includes("traceforgeApiKey")) {
                    content = content.replace(/environment\s*=\s*\{/, `environment = {\n  traceforgeApiKey: '${apiKey}',\n  traceforgeEndpoint: '${endpoint}',`);
                    fs.writeFileSync(envFile, content);
                }
            }
        }
        s.stop(chalk.green("Agent: Angular configuration ready!"));
        console.log(chalk.cyan(`\n=================================================`));
        console.log(chalk.bold.white(`🚀 Angular Manual Setup Instructions`));
        console.log(chalk.cyan(`=================================================\n`));
        console.log(`1. Ensure your environment file has your keys:`);
        console.log(chalk.yellow(`
export const environment = {
  traceforgeApiKey: '${apiKey}',
  traceforgeEndpoint: '${endpoint}'
};
`));
        console.log(`2. Initialize TraceForge in your app.config.ts (or app.module.ts):`);
        console.log(chalk.yellow(`
import TraceForge from 'usetraceforge';
import { environment } from '../environments/environment';

TraceForge.init({
  apiKey: environment.traceforgeApiKey,
  endpoint: environment.traceforgeEndpoint,
  autoCapture: true
});
`));
        console.log(chalk.bold.magenta(`\n⚠️ OPTION A: If you DO NOT have a custom ErrorHandler:`));
        console.log(`Simply provide TraceForgeErrorHandler in your app.config.ts:`);
        console.log(chalk.yellow(`
import { TraceForgeErrorHandler } from 'usetraceforge/angular';
import { ErrorHandler } from '@angular/core';

export const appConfig = {
  providers: [
    { provide: ErrorHandler, useClass: TraceForgeErrorHandler }
  ]
};
`));
        console.log(chalk.bold.magenta(`\n⚠️ OPTION B: If you ALREADY HAVE a custom ErrorHandler:`));
        console.log(`Do NOT use TraceForgeErrorHandler. Instead, call captureException inside your existing handler!`);
        console.log(chalk.yellow(`
import TraceForge from 'usetraceforge';

@Injectable()
export class MyCustomErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    // 1. Send to TraceForge
    TraceForge.captureException(error, { tags: { framework: 'angular' } });
    
    // 2. Do your own custom logging...
    console.error(error);
  }
}
`));
    }
    catch (error) {
        s.stop(chalk.red("Agent: An error occurred."));
        console.error(error);
    }
}
