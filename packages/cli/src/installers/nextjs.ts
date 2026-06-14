import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";
import { Project, SyntaxKind } from "ts-morph";

export async function installNextJs(apiKey: string, endpoint: string) {
  const s = spinner();
  s.start("Agent: Configuring Next.js Instrumentation...");

  try {
    // 1. Add API key and endpoint to .env.local
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envVar = `\nNEXT_PUBLIC_TRACEFORGE_API_KEY="${apiKey}"\nNEXT_PUBLIC_TRACEFORGE_INGEST_URL="${endpoint}"\n`;
    
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      if (!content.includes("NEXT_PUBLIC_TRACEFORGE_API_KEY")) {
        fs.appendFileSync(envPath, envVar);
      }
    } else {
      fs.writeFileSync(envPath, envVar);
    }

    // 2. Generate instrumentation.ts
    const isSrc = fs.existsSync(path.resolve(process.cwd(), "src"));
    const instrumentationDir = isSrc ? path.resolve(process.cwd(), "src") : process.cwd();
    const instrumentationPath = path.resolve(instrumentationDir, "instrumentation.ts");

    const instrumentationCode = `import TraceForge from "usetraceforge";

export function register() {
  TraceForge.init({
    apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY!,
    endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL,
    autoCapture: true,
  });
}

export function onRequestError(err: any, request: any) {
  TraceForge.captureException(err, { tags: { route: request.url } });
}
`;

    if (!fs.existsSync(instrumentationPath)) {
      fs.writeFileSync(instrumentationPath, instrumentationCode);
      console.log(chalk.green(`\nAgent: Created ${isSrc ? "src/" : ""}instrumentation.ts!`));
    } else {
      console.log(chalk.yellow(`\nAgent: instrumentation.ts already exists. Please manually add TraceForge.`));
    }

    // 3. Layout AST Injection (Client-side Provider)
    const project = new Project();
    const layoutPaths = [
      path.resolve(process.cwd(), "app/layout.tsx"),
      path.resolve(process.cwd(), "src/app/layout.tsx"),
    ];

    let targetLayout: string | null = null;
    for (const p of layoutPaths) {
      if (fs.existsSync(p)) {
        targetLayout = p;
        break;
      }
    }

    if (targetLayout) {
      const sourceFile = project.addSourceFileAtPath(targetLayout);
      if (!sourceFile.getFullText().includes("TraceForgeProvider")) {
        sourceFile.addImportDeclaration({
          namedImports: ["TraceForgeProvider"],
          moduleSpecifier: "usetraceforge/react"
        });

        // Find body tag
        const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxElement);
        let bodyTag = jsxElements.find(el => el.getOpeningElement().getTagNameNode().getText() === "body");

        if (bodyTag) {
          const childrenText = bodyTag.getJsxChildren().map(c => c.getText()).join("");
          const opening = bodyTag.getOpeningElement().getText();
          const closing = bodyTag.getClosingElement().getText();
          
          bodyTag.replaceWithText(`${opening}\n        <TraceForgeProvider>\n          ${childrenText}\n        </TraceForgeProvider>\n      ${closing}`);
          
          sourceFile.saveSync();
          console.log(chalk.green(`\nAgent: Injected <TraceForgeProvider> into ${targetLayout.replace(process.cwd(), "")}`));
        } else {
           console.log(chalk.yellow("\nAgent: Could not find <body> tag in layout.tsx. Please add <TraceForgeProvider> manually."));
        }
      } else {
        console.log(chalk.blue(`\nAgent: <TraceForgeProvider> already exists in layout.tsx`));
      }
    } else {
      console.log(chalk.yellow("\nAgent: Could not find layout.tsx. Please add <TraceForgeProvider> manually."));
    }

    s.stop(chalk.green("Agent: Next.js configuration complete!"));

  } catch (error) {
    s.stop(chalk.red("Agent: An error occurred."));
    console.error(error);
  }
}
