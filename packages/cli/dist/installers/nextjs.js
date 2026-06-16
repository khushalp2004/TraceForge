import fs from "fs";
import path from "path";
import { spinner } from "@clack/prompts";
import chalk from "chalk";
import { Project, SyntaxKind } from "ts-morph";
export async function installNextJs(apiKey, endpoint) {
    const s = spinner();
    s.start("Agent: Configuring Next.js Instrumentation...");
    try {
        // 1. Add API key and endpoint to .env.local
        const envPath = path.resolve(process.cwd(), ".env.local");
        const envVar = `\nNEXT_PUBLIC_TRACEFORGE_API_KEY="${apiKey}"\nNEXT_PUBLIC_TRACEFORGE_INGEST_URL="${endpoint}"\n`;
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, "utf-8");
            if (content.includes("NEXT_PUBLIC_TRACEFORGE_API_KEY")) {
                content = content.replace(/NEXT_PUBLIC_TRACEFORGE_API_KEY=.*/g, `NEXT_PUBLIC_TRACEFORGE_API_KEY="${apiKey}"`);
                content = content.replace(/NEXT_PUBLIC_TRACEFORGE_INGEST_URL=.*/g, `NEXT_PUBLIC_TRACEFORGE_INGEST_URL="${endpoint}"`);
                fs.writeFileSync(envPath, content);
            }
            else {
                fs.appendFileSync(envPath, envVar);
            }
        }
        else {
            fs.writeFileSync(envPath, envVar);
        }
        // 2. Generate instrumentation.ts
        const isSrc = fs.existsSync(path.resolve(process.cwd(), "src"));
        const isAppRouter = fs.existsSync(path.resolve(process.cwd(), "app")) || fs.existsSync(path.resolve(process.cwd(), "src/app"));
        if (isAppRouter) {
            console.log(chalk.cyan(`\n=================================================`));
            console.log(chalk.yellow(`import TraceForgeNext from 'usetraceforge/next';

TraceForgeNext.init({
  apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY,
  endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL, // Optional
  autoCapture: true
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`));
            console.log(chalk.cyan(`=================================================\n`));
        }
        else {
            console.log(chalk.cyan(`\n=================================================`));
            console.log(chalk.yellow(`import TraceForgeNext from 'usetraceforge/next';

TraceForgeNext.init({
  apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY,
  endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL, // Optional
  autoCapture: true
});

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}`));
            console.log(chalk.cyan(`=================================================\n`));
        }
        // 3. Layout AST Injection (Client-side Provider)
        const project = new Project();
        const layoutPaths = [
            path.resolve(process.cwd(), "app/layout.tsx"),
            path.resolve(process.cwd(), "src/app/layout.tsx"),
        ];
        let targetLayout = null;
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
                }
                else {
                    console.log(chalk.yellow("\nAgent: Could not find <body> tag in layout.tsx. Please add <TraceForgeProvider> manually."));
                }
            }
            else {
                console.log(chalk.blue(`\nAgent: <TraceForgeProvider> already exists in layout.tsx`));
            }
        }
        else {
            console.log(chalk.yellow("\nAgent: Could not find layout.tsx. Please add <TraceForgeProvider> manually."));
        }
        s.stop(chalk.green("Agent: Next.js configuration complete!"));
    }
    catch (error) {
        s.stop(chalk.red("Agent: An error occurred."));
        console.error(error);
    }
}
