import { spinner, log } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { execa } from "execa";
export async function installJava(apiKey, ingestUrl) {
    const s = spinner();
    s.start("Installing TraceForge for Java (Spring Boot)...");
    try {
        // 1. Add dependency to pom.xml or build.gradle
        const pomPath = path.join(process.cwd(), "pom.xml");
        const gradlePath = path.join(process.cwd(), "build.gradle");
        try {
            await execa("mvn", [
                "dependency:get",
                "-Dartifact=com.usetraceforge:traceforge-spring-boot:1.0.0"
            ]);
        }
        catch (error) {
            // Maven might fail if it's not a standard setup, but we'll still try to inject the XML
        }
        if (fs.existsSync(pomPath)) {
            s.message("Injecting traceforge-spring-boot into pom.xml...");
            let pomContent = fs.readFileSync(pomPath, "utf-8");
            if (!pomContent.includes("traceforge-spring-boot")) {
                const dependencyXml = `
        <dependency>
            <groupId>com.usetraceforge</groupId>
            <artifactId>traceforge-spring-boot</artifactId>
            <version>1.0.0</version>
        </dependency>`;
                // Find </dependencies> tag
                const depIndex = pomContent.lastIndexOf("</dependencies>");
                if (depIndex !== -1) {
                    pomContent = pomContent.substring(0, depIndex) + dependencyXml + "\n    " + pomContent.substring(depIndex);
                    fs.writeFileSync(pomPath, pomContent);
                }
                else {
                    log.warn(chalk.yellow("Could not find <dependencies> in pom.xml. Please add traceforge-spring-boot manually."));
                }
            }
        }
        else if (fs.existsSync(gradlePath)) {
            s.message("Injecting traceforge-spring-boot into build.gradle...");
            let gradleContent = fs.readFileSync(gradlePath, "utf-8");
            if (!gradleContent.includes("traceforge-spring-boot")) {
                const dependencyStr = `\n    implementation 'com.usetraceforge:traceforge-spring-boot:1.0.0'`;
                const depIndex = gradleContent.indexOf("dependencies {");
                if (depIndex !== -1) {
                    const insertIndex = gradleContent.indexOf("\n", depIndex);
                    gradleContent = gradleContent.substring(0, insertIndex) + dependencyStr + gradleContent.substring(insertIndex);
                    fs.writeFileSync(gradlePath, gradleContent);
                }
                else {
                    log.warn(chalk.yellow("Could not find dependencies block in build.gradle. Please add traceforge-spring-boot manually."));
                }
            }
        }
        else {
            log.warn(chalk.yellow("Could not find pom.xml or build.gradle. Please add traceforge-spring-boot manually."));
        }
        // 2. Setup application.properties
        s.message("Configuring application.properties...");
        const propertiesPath = path.join(process.cwd(), "src/main/resources/application.properties");
        const ymlPath = path.join(process.cwd(), "src/main/resources/application.yml");
        if (fs.existsSync(ymlPath)) {
            let ymlContent = fs.readFileSync(ymlPath, "utf-8");
            if (!ymlContent.includes("traceforge:")) {
                ymlContent += `\n\ntraceforge:\n  api-key: ${apiKey}\n  ingest-url: ${ingestUrl}\n`;
                fs.writeFileSync(ymlPath, ymlContent);
            }
        }
        else {
            // Default to application.properties
            // Ensure directory exists
            const resourcesDir = path.dirname(propertiesPath);
            if (!fs.existsSync(resourcesDir)) {
                fs.mkdirSync(resourcesDir, { recursive: true });
            }
            let propsContent = "";
            if (fs.existsSync(propertiesPath)) {
                propsContent = fs.readFileSync(propertiesPath, "utf-8");
            }
            if (!propsContent.includes("traceforge.api-key")) {
                propsContent += `\ntraceforge.api-key=${apiKey}`;
            }
            if (!propsContent.includes("traceforge.ingest-url")) {
                propsContent += `\ntraceforge.ingest-url=${ingestUrl}`;
            }
            fs.writeFileSync(propertiesPath, propsContent.trim() + "\n");
        }
        // 3. Create TRACEFORGE-README.md
        s.message("Creating TRACEFORGE-README.md...");
        const readmeContent = `# TraceForge Java SDK Installation

TraceForge has been successfully configured for your Spring Boot application!

## What was installed?
1. **TraceForge Spring Boot Starter**: Added to your \`pom.xml\` or \`build.gradle\`.
2. **Configuration**: Your API key and Ingest URL were added to \`src/main/resources/application.properties\` (or \`.yml\`).
3. **Zero-Touch Configuration**: The SDK will automatically use Spring Boot's AutoConfiguration to intercept all unhandled Exceptions globally!

## How to Test It
To verify everything is working, intentionally crash your app:
1. Open one of your Spring \`@RestController\` classes.
2. Add a division by zero error inside an endpoint:
   \`\`\`java
   @GetMapping("/crash")
   public String crash() {
       int x = 1 / 0; // Boom!
       return "Crash";
   }
   \`\`\`
3. Run your app: \`./mvnw spring-boot:run\` or \`./gradlew bootRun\`
4. Visit \`http://localhost:8080/crash\` in your browser.
5. Check your TraceForge Dashboard to see the \`ArithmeticException\` logged natively!

## Support
For full documentation, visit [usetraceforge.com/docs](https://usetraceforge.com/docs).
`;
        fs.writeFileSync(path.join(process.cwd(), "TRACEFORGE-README.md"), readmeContent);
        s.stop("TraceForge Java SDK installed successfully!");
        log.info(chalk.cyan("Next steps:"));
        log.info("1. Read " + chalk.bold("TRACEFORGE-README.md") + " for testing instructions.");
        log.info("2. Trigger a crash in your code to see it captured!");
    }
    catch (error) {
        s.stop("Failed to install TraceForge Java SDK");
        log.error(chalk.red(error.message));
        process.exit(1);
    }
}
