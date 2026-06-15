import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";
import { Project, SyntaxKind, CallExpression } from "ts-morph";

function printManualInstructions() {
  console.log(chalk.cyan(`\n=================================================`));
  console.log(chalk.bold.white(`🚀 Express.js Manual Setup Instructions`));
  console.log(chalk.cyan(`=================================================\n`));
  console.log(`Add this at the ${chalk.bold('TOP')} of your main file (e.g. app.js or server.js):`);
  console.log(chalk.yellow(`
import TraceForge from "usetraceforge";
import { expressErrorHandler } from "usetraceforge/express";

TraceForge.init({ 
  apiKey: process.env.TRACEFORGE_API_KEY, 
  endpoint: process.env.TRACEFORGE_INGEST_URL 
});
`));
  console.log(`Then, add the middleware at the ${chalk.bold('VERY END')} of your routes:`);
  console.log(chalk.yellow(`
// ... all your other app.use() and app.get() routes ...

app.use(expressErrorHandler());

// ... your custom error handlers (if any) ...
app.listen(3000);
`));
}

export async function installExpress(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Agent: Configuring Express.js environment...");

  try {
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

    s.stop(chalk.green("Agent: .env configured successfully!"));

    const project = new Project();
    const possiblePaths = [
      "app.ts", "app.js",
      "server.ts", "server.js",
      "index.ts", "index.js",
      "src/app.ts", "src/app.js",
      "src/server.ts", "src/server.js",
      "src/index.ts", "src/index.js",
      "bin/www", "bin/www.js"
    ];

    let targetFile: string | null = null;
    for (const p of possiblePaths) {
      const fullPath = path.resolve(process.cwd(), p);
      if (fs.existsSync(fullPath)) {
        targetFile = fullPath;
        break; // First match wins
      }
    }

    if (!targetFile) {
      console.log(chalk.yellow("\nAgent: Could not find your Express entrypoint file automatically."));
      printManualInstructions();
      return;
    }

    const sourceFile = project.addSourceFileAtPath(targetFile);
    let astSuccess = false;

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    let listenCall: CallExpression | null = null;
    let appVariableName: string | null = null;

    for (const callExpr of callExpressions) {
      const expression = callExpr.getExpression();
      if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expression.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
        if (propAccess.getName() === "listen") {
          listenCall = callExpr;
          appVariableName = propAccess.getExpression().getText();
          break;
        }
      }
    }

    if (listenCall && appVariableName) {
      const listenStatement = listenCall.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
      if (listenStatement) {
        if (!sourceFile.getFullText().includes("TraceForge.init")) {
          // Inject imports and init at the top
          sourceFile.insertStatements(0, `import TraceForge from "usetraceforge";\nimport { expressErrorHandler } from "usetraceforge/express";\n\nTraceForge.init({\n  apiKey: process.env.TRACEFORGE_API_KEY as string,\n  endpoint: process.env.TRACEFORGE_INGEST_URL\n});\n`);
          
          // Inject middleware right before app.listen()
          const listenIndex = listenStatement.getChildIndex();
          sourceFile.insertStatements(listenIndex, `\n// TraceForge must be the last middleware before listen\n${appVariableName}.use(expressErrorHandler());\n`);
          
          sourceFile.saveSync();
          console.log(chalk.green(`\nAgent: Auto-injected TraceForge into ${targetFile.replace(process.cwd(), "")}!`));
          astSuccess = true;
        } else {
           console.log(chalk.blue(`\nAgent: TraceForge is already configured in ${targetFile.replace(process.cwd(), "")}`));
           astSuccess = true;
        }
      }
    }

    if (!astSuccess) {
      console.log(chalk.yellow(`\nAgent: Found ${targetFile.replace(process.cwd(), "")} but could not auto-inject safely.`));
      printManualInstructions();
    }

  } catch (error) {
    s.stop(chalk.red("Agent: An error occurred during Express configuration."));
    console.error(error);
    printManualInstructions();
  }
}
