"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Search, Check, Copy, ChevronDown, Terminal, Code2, Globe, Server, Braces, Sparkles, Database, Coffee, FileCode2 } from "lucide-react";

// Existing JS/TS Snippets
const cliInstallSnippet = `npx usetraceforge-cli init`;

const installSnippet = `npm install usetraceforge`;

const nextEnvSnippet = `NEXT_PUBLIC_TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
NEXT_PUBLIC_TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
NEXT_PUBLIC_TRACEFORGE_ENV=production
NEXT_PUBLIC_TRACEFORGE_RELEASE=web@1.0.0`;

const nextSetupSnippet = `"use client";

import { useEffect } from "react";
import TraceForge from "usetraceforge";

let initialized = false;

export function TraceForgeInit() {
  useEffect(() => {
    if (initialized) return;

    TraceForge.init({
      apiKey: process.env.NEXT_PUBLIC_TRACEFORGE_API_KEY!,
      endpoint: process.env.NEXT_PUBLIC_TRACEFORGE_INGEST_URL,
      autoCapture: true,
      environment: process.env.NEXT_PUBLIC_TRACEFORGE_ENV,
      release: process.env.NEXT_PUBLIC_TRACEFORGE_RELEASE
    });

    initialized = true;
  }, []);

  return null;
}`;

const reactEnvSnippet = `VITE_TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
VITE_TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
VITE_TRACEFORGE_ENV=production
VITE_TRACEFORGE_RELEASE=web@1.0.0`;

const reactSetupSnippet = `import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL,
  autoCapture: true,
  environment: import.meta.env.VITE_TRACEFORGE_ENV,
  release: import.meta.env.VITE_TRACEFORGE_RELEASE
});`;

const vueEnvSnippet = `VITE_TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
VITE_TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
VITE_TRACEFORGE_ENV=production
VITE_TRACEFORGE_RELEASE=web@1.0.0`;

const vueSetupSnippet = `import { createApp } from 'vue'
import App from './App.vue'
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: import.meta.env.VITE_TRACEFORGE_API_KEY,
  endpoint: import.meta.env.VITE_TRACEFORGE_INGEST_URL,
  autoCapture: true,
  environment: import.meta.env.VITE_TRACEFORGE_ENV,
  release: import.meta.env.VITE_TRACEFORGE_RELEASE
});

const app = createApp(App)
app.mount('#app')`;

const nodeEnvSnippet = `TRACEFORGE_INGEST_URL=http://localhost:3001/ingest
TRACEFORGE_API_KEY=YOUR_PROJECT_API_KEY
TRACEFORGE_ENV=production
TRACEFORGE_RELEASE=api@1.0.0`;

const nodeSetupSnippet = `import express, { NextFunction, Request, Response } from "express";
import TraceForge from "usetraceforge";

TraceForge.init({
  apiKey: process.env.TRACEFORGE_API_KEY!,
  endpoint: process.env.TRACEFORGE_INGEST_URL,
  environment: process.env.TRACEFORGE_ENV || "production",
  release: process.env.TRACEFORGE_RELEASE || "api@1.0.0"
});

const app = express();

app.use(async (error: unknown, req: Request, _res: Response, next: NextFunction) => {
  const err = error instanceof Error ? error : new Error(String(error));
  await TraceForge.captureException(err, {
    payload: { route: req.originalUrl, method: req.method }
  });

  next(error);
});`;

const pythonInstallSnippet = `pip install usetraceforge python-dotenv`;

const pythonSetupSnippet = `import traceforge
from dotenv import load_dotenv

load_dotenv()

# Automatically reads TRACEFORGE_API_KEY from the environment
traceforge.init()

# Usage in your exception handler:
# traceforge.capture_exception(exc)`;

const goInstallSnippet = `go get github.com/khushalp2004/TraceForge/packages/sdk-go@v1.0.2`;

const goSetupSnippet = `import (
    "github.com/joho/godotenv"
    "github.com/khushalp2004/TraceForge/packages/sdk-go"
)

func main() {
    _ = godotenv.Load()
    
    // Automatically reads from environment variables
    traceforge.Init()
    
    // Use native middleware (Gin, Echo, etc.) or capture manually
}`;

const javaInstallSnippet = `<!-- Add to pom.xml -->
<repositories>
    <repository>
        <id>jitpack.io</id>
        <url>https://jitpack.io</url>
    </repository>
</repositories>

<dependency>
    <groupId>com.github.khushalp2004.TraceForge</groupId>
    <artifactId>traceforge-spring-boot</artifactId>
    <version>dacb764e3e</version>
</dependency>`;

const javaSetupSnippet = `import com.usetraceforge.TraceForge;
import com.usetraceforge.Config;

// Initialize in main
Config config = new Config();
config.setApiKey("YOUR_TRACEFORGE_JAVA_KEY");
config.setEndpoint("http://localhost:3001/ingest");
TraceForge.initWithConfig(config);

// Usage in @ControllerAdvice
@ExceptionHandler(Exception.class)
public ResponseEntity<Map<String, Object>> handleAllExceptions(Exception ex) {
    TraceForge.captureException(ex);
    // Return standard 500 response...
}`;

const phpInstallSnippet = `composer require khushalp2004/traceforge-php`;

const phpSetupSnippet = `// For Laravel: Zero-Touch setup!
// Just add TRACEFORGE_API_KEY to your .env file.

// For Vanilla PHP:
require_once __DIR__ . '/vendor/autoload.php';

use TraceForge\\TraceForgeClient;
$client = new TraceForgeClient();

try {
    // Code
} catch (\\Throwable $e) {
    $client->captureException($e, ['type' => 'manual_exception']);
}`;

const rustInstallSnippet = `# Add to Cargo.toml
[dependencies]
traceforge = { git = "https://github.com/khushalp2004/TraceForge.git", branch = "main" }`;

const rustSetupSnippet = `// Initialize in main
tokio::task::spawn_blocking(|| {
    // Automatically reads TRACEFORGE_API_KEY from .env
    traceforge::init();
}).await.unwrap();

// Usage in handlers:
// tokio::task::spawn_blocking(|| {
//     traceforge::capture_message("Rust route panic triggered");
//     panic!("Intentional panic");
// }).await;`;

const rubyInstallSnippet = `# Add to Gemfile
gem 'traceforge', git: 'https://github.com/khushalp2004/TraceForge.git', branch: 'main', glob: 'packages/sdk-ruby/traceforge.gemspec'`;

const rubySetupSnippet = `require 'traceforge'

TraceForge.configure do |config|
  config.api_key = 'YOUR_TRACEFORGE_RUBY_KEY'
  config.ingest_url = 'http://localhost:3001/ingest'
end

# Usage in Sinatra error block:
# error do
#   exception = env['sinatra.error']
#   TraceForge.capture_exception(exception)
# end`;

const restSnippet = `POST /ingest
X-Traceforge-Key: <PROJECT_API_KEY>
Content-Type: application/json

{
  "message": "Database connection timeout",
  "stackTrace": "Error: Database connection timeout\\n    at connect (/app/db.ts:17:13)",
  "environment": "production",
  "release": "api@2.8.0",
  "payload": {
    "service": "billing-api",
    "region": "us-east-1"
  }
}`;

type TechStack = "nextjs" | "react" | "vue" | "nodejs" | "python" | "go" | "java" | "php" | "rust" | "ruby" | "rest";

type Toast = {
  message: string;
  tone: "success" | "error";
};

function SnippetBlock({
  title,
  code,
  onCopy
}: {
  title?: string;
  code: string;
  onCopy: (value: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-[16px] border border-border/40 bg-[#0C0C0E] shadow-sm transition-all duration-300 hover:border-border/60">
      {/* Mac window header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] bg-[#141416] px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex gap-1.5 shrink-0">
            <div className="h-3 w-3 rounded-full bg-[#FF5F56] border border-black/10"></div>
            <div className="h-3 w-3 rounded-full bg-[#FFBD2E] border border-black/10"></div>
            <div className="h-3 w-3 rounded-full bg-[#27C93F] border border-black/10"></div>
          </div>
          {title && <span className="ml-2 text-xs font-medium text-white/50 font-mono truncate">{title}</span>}
        </div>
        <button
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-sm bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 opacity-100 sm:opacity-0 transition-all hover:bg-white/10 hover:text-white sm:group-hover:opacity-100"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      
      {/* Code Area */}
      <div className="relative">
        <div className="absolute -left-20 top-0 h-40 w-40 rounded-full bg-primary/10 blur-[80px] pointer-events-none"></div>
        
        <pre className="relative overflow-x-auto p-5 text-[14px] leading-relaxed text-white/90 font-mono max-h-[400px] custom-scrollbar selection:bg-primary/30">
          <code className="block w-max min-w-full whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [toast, setToast] = useState<Toast | null>(null);
  const [activeTab, setActiveTab] = useState<TechStack | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const showToast = (message: string, tone: Toast["tone"]) => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2200);
  };

  const copySnippet = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      showToast("Failed to copy snippet", "error");
    }
  };

  const tabs: { id: TechStack; label: string; icon: React.ReactNode; hint?: string }[] = [
    { id: "nextjs", label: "Next.js", icon: <Globe className="w-4 h-4" />, hint: "Full-stack web apps" },
    { id: "react", label: "React / Vite", icon: <Code2 className="w-4 h-4" />, hint: "Frontend UI components" },
    { id: "vue", label: "Vue.js", icon: <Code2 className="w-4 h-4" />, hint: "Frontend UI components" },
    { id: "nodejs", label: "Node.js", icon: <Server className="w-4 h-4" />, hint: "JavaScript backend" },
    { id: "python", label: "Python", icon: <Terminal className="w-4 h-4" />, hint: "Backend + AI apps" },
    { id: "java", label: "Java", icon: <Coffee className="w-4 h-4" />, hint: "Enterprise systems" },
    { id: "php", label: "PHP", icon: <Globe className="w-4 h-4" />, hint: "Websites & CMS" },
    { id: "go", label: "Go", icon: <Terminal className="w-4 h-4" />, hint: "High-performance backend" },
    { id: "rust", label: "Rust", icon: <Database className="w-4 h-4" />, hint: "Ultra-fast secure systems" },
    { id: "ruby", label: "Ruby", icon: <FileCode2 className="w-4 h-4" />, hint: "Fast MVP/startups" },
    { id: "rest", label: "REST API", icon: <Braces className="w-4 h-4" /> },
  ];

  type WizardStep = { title: string; description: string; codeSnippet: string; codeTitle: string; };
  
  const frameworkSteps: Record<string, WizardStep[]> = {
    nextjs: [
      { title: "1-Click Install", description: "Use our CLI wizard to automatically install and configure TraceForge!", codeSnippet: cliInstallSnippet, codeTitle: "Terminal" },
      { title: "Manual Install", description: "Or install the package manually.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: nextEnvSnippet, codeTitle: ".env" },
      { title: "Initialize", description: "Create a client component to initialize the SDK globally.", codeSnippet: nextSetupSnippet, codeTitle: "components/TraceForgeInit.tsx" }
    ],
    react: [
      { title: "1-Click Install", description: "Use our CLI wizard to automatically install and configure TraceForge!", codeSnippet: cliInstallSnippet, codeTitle: "Terminal" },
      { title: "Manual Install", description: "Or install the package manually.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: reactEnvSnippet, codeTitle: ".env" },
      { title: "Initialize", description: "Call `init` as early as possible (e.g. `main.tsx` or `index.tsx`).", codeSnippet: reactSetupSnippet, codeTitle: "src/main.tsx" }
    ],
    vue: [
      { title: "1-Click Install", description: "Use our CLI wizard to automatically install and configure TraceForge!", codeSnippet: cliInstallSnippet, codeTitle: "Terminal" },
      { title: "Manual Install", description: "Or install the package manually.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: vueEnvSnippet, codeTitle: ".env" },
      { title: "Initialize", description: "Call `init` before mounting your Vue app.", codeSnippet: vueSetupSnippet, codeTitle: "src/main.ts" }
    ],
    nodejs: [
      { title: "1-Click Install", description: "Use our CLI wizard to automatically install and configure TraceForge!", codeSnippet: cliInstallSnippet, codeTitle: "Terminal" },
      { title: "Manual Install", description: "Or install the package manually.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: nodeEnvSnippet, codeTitle: ".env" },
      { title: "Add Express Middleware", description: "Place the error handler *before* your final catch-all error middleware.", codeSnippet: nodeSetupSnippet, codeTitle: "server.ts" }
    ],
    python: [
      { title: "Install the SDK", description: "Install the TraceForge Python SDK.", codeSnippet: pythonInstallSnippet, codeTitle: "Terminal" },
      { title: "Initialize & Capture", description: "Initialize the SDK and hook into your framework's exception handler.", codeSnippet: pythonSetupSnippet, codeTitle: "app/main.py" }
    ],
    go: [
      { title: "Install the SDK", description: "Get the TraceForge Go SDK package.", codeSnippet: goInstallSnippet, codeTitle: "Terminal" },
      { title: "Initialize & Capture", description: "Initialize in your main loop and capture panics in recovery middleware.", codeSnippet: goSetupSnippet, codeTitle: "main.go" }
    ],
    java: [
      { title: "Install the SDK", description: "Add the JitPack repository and TraceForge dependency to your `pom.xml`.", codeSnippet: javaInstallSnippet, codeTitle: "pom.xml" },
      { title: "Initialize & Capture", description: "Initialize in your main class and capture exceptions via `@ControllerAdvice`.", codeSnippet: javaSetupSnippet, codeTitle: "Application.java" }
    ],
    php: [
      { title: "Install the SDK", description: "Require the TraceForge PHP SDK via Composer.", codeSnippet: phpInstallSnippet, codeTitle: "Terminal" },
      { title: "Initialize & Capture", description: "Initialize the client and hook into your global error handler.", codeSnippet: phpSetupSnippet, codeTitle: "index.php" }
    ],
    rust: [
      { title: "Install the SDK", description: "Add the TraceForge crate to your `Cargo.toml` dependencies.", codeSnippet: rustInstallSnippet, codeTitle: "Cargo.toml" },
      { title: "Initialize & Capture", description: "Initialize the SDK and capture panics in your Axum handlers.", codeSnippet: rustSetupSnippet, codeTitle: "src/main.rs" }
    ],
    ruby: [
      { title: "Install the SDK", description: "Add the TraceForge gem to your `Gemfile`.", codeSnippet: rubyInstallSnippet, codeTitle: "Gemfile" },
      { title: "Initialize & Capture", description: "Initialize the SDK and catch exceptions in your Sinatra routes.", codeSnippet: rubySetupSnippet, codeTitle: "app.rb" }
    ],
    rest: [
      { title: "Raw Payload Format", description: "Send a simple JSON payload to the ingest endpoint from any environment, CI script, or language.", codeSnippet: restSnippet, codeTitle: "cURL / HTTP" }
    ]
  };

  const demoRepoLinks: Record<string, string> = {
    nextjs: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/nextjs-project",
    react: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/react-vite-project",
    vue: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/vue-project",
    nodejs: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/nodejs-project",
    python: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/python-project",
    java: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/java-project",
    php: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/php-project",
    go: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/go-project",
    rust: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/rust-project",
    ruby: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/ruby-project",
    rest: "PLACE_YOUR_REST_LINK_HERE"
  };

  const steps = frameworkSteps[activeTab] || [];
  const totalWizardSteps = activeTab ? steps.length : 1; 
  const isComplete = currentStep > totalWizardSteps;

  const filteredTabs = tabs.filter(t => 
    t.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTabLabel = tabs.find(t => t.id === activeTab)?.label || "";

  const handleNextStep = () => {
    if (currentStep === 0) {
      if (!activeTab || !tabs.find(t => t.id === activeTab)) {
        showToast("Please select a valid framework", "error");
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  return (
    <main className="tf-page pb-20 pt-16 relative overflow-hidden min-h-screen flex flex-col">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none -z-10" />
      {/* Background Decorative Gradients */}
      <div className="pointer-events-none absolute -top-[20%] left-1/2 -translate-x-1/2 w-[120%] h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(var(--primary-rgb),0.08)_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute -left-40 top-40 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
      
      <div className="tf-container w-full max-w-4xl mx-auto relative z-10 flex flex-col items-center">
        
        {/* Header */}
        <header className="text-center max-w-2xl mx-auto mb-6 sm:mb-10 w-full px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 mb-4 sm:mb-6">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
            <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-widest">Setup Wizard</span>
          </div>
          <h1 className="tf-title text-3xl sm:text-5xl tracking-tight mb-4">
            Ship with confidence, <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-primary/70 animate-gradient-x">in any language.</span>
          </h1>
        </header>

        {/* 
          STRICTLY FIXED CONTAINER:
          w-full max-w-4xl h-[600px] ensures it NEVER resizes width or height.
          min-w-0 ensures flex children cannot expand it.
        */}
        <div className="w-full max-w-4xl h-[600px] sm:h-[650px] min-w-0 bg-card/60 backdrop-blur-2xl border border-white/5 shadow-[0_8px_40px_rgba(0,0,0,0.08)] rounded-sm p-6 sm:p-10 relative overflow-hidden flex flex-col ring-1 ring-white/10">
          
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

          {/* Progress Bar (Fixed Height Top Area) */}
          <div className="mb-6 sm:mb-10 flex-shrink-0 relative z-10 w-full">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(currentStep / (totalWizardSteps + 1)) * 100}%` }}
                />
              </div>
              
              <button 
                onClick={() => setCurrentStep(0)}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm relative z-10 transition-colors duration-300 ${currentStep >= 0 ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] cursor-pointer hover:scale-110" : "bg-secondary text-text-secondary cursor-default"}`}
              >
                <Check className={`w-4 h-4 ${currentStep > 0 ? "block" : "hidden"}`} />
                <span className={currentStep > 0 ? "hidden" : "block"}>1</span>
              </button>

              {steps.map((_, idx) => (
                <button 
                  key={idx} 
                  onClick={() => { if (currentStep >= idx + 1) setCurrentStep(idx + 1) }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm relative z-10 transition-colors duration-300 ${currentStep >= idx + 1 ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] cursor-pointer hover:scale-110" : "bg-secondary text-text-secondary cursor-not-allowed"}`}
                >
                  <Check className={`w-4 h-4 ${currentStep > idx + 1 ? "block" : "hidden"}`} />
                  <span className={currentStep > idx + 1 ? "hidden" : "block"}>{idx + 2}</span>
                </button>
              ))}

              <button 
                onClick={() => { if (isComplete) setCurrentStep(totalWizardSteps + 1) }}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm relative z-10 transition-colors duration-300 ${isComplete ? "bg-primary text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] cursor-pointer hover:scale-110" : "bg-secondary text-text-secondary cursor-not-allowed"}`}
              >
                <Check className={`w-4 h-4 ${isComplete ? "block" : "hidden"}`} />
                <span className={isComplete ? "hidden" : "block"}>{totalWizardSteps + 2}</span>
              </button>
            </div>
            <div className="flex justify-between mt-3 text-xs font-medium text-text-secondary">
              <span>Framework</span>
              {steps.length > 0 && <span className="absolute left-1/2 -translate-x-1/2">Configuration</span>}
              <span>Complete</span>
            </div>
          </div>

          {/* Content Area (Flex-1, Scrollable, Min-w-0 to prevent width expansion) */}
          <div className="flex-1 relative z-10 w-full min-w-0 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentStep}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full h-full overflow-y-auto px-1 pb-4 custom-scrollbar"
              >
                {currentStep === 0 && (
                  <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto pt-2 sm:pt-4">
                    <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary">Select your framework</h2>
                      <p className="text-sm sm:text-base text-text-secondary mt-1 sm:mt-2">Search and select the primary language for your application.</p>
                    </div>
                    
                    {/* Search & Grid Wrapper */}
                    <div className="mt-4 sm:mt-8 flex flex-col h-full">
                      <div className="relative group mb-6">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-text-secondary group-focus-within:text-primary transition-colors">
                          <Search className="w-5 h-5" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search frameworks (e.g. Next.js, Python)..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full appearance-none bg-background/50 border border-border/50 text-text-primary placeholder:text-text-secondary/50 rounded-sm py-3.5 pl-12 pr-6 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm backdrop-blur-md"
                        />
                      </div>

                      {/* Framework Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 pb-10">
                        {filteredTabs.length === 0 ? (
                          <div className="col-span-full py-10 text-center text-text-secondary">
                            No frameworks found matching "{searchQuery}"
                          </div>
                        ) : (
                          filteredTabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => {
                                setActiveTab(tab.id);
                                setCurrentStep(1); // Advance immediately for a seamless UX
                              }}
                              className={`relative group flex flex-col items-center justify-center p-5 rounded-sm border transition-all duration-300 overflow-hidden
                                ${activeTab === tab.id 
                                  ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)] ring-1 ring-primary/20" 
                                  : "bg-secondary/20 border-border/30 hover:bg-secondary/40 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5"
                                }
                              `}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                              <div className={`p-3 rounded-sm mb-3 transition-colors duration-300 ${activeTab === tab.id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-card text-text-secondary group-hover:text-primary group-hover:bg-primary/10"}`}>
                                {tab.icon}
                              </div>
                              <span className={`text-[14px] font-semibold transition-colors ${activeTab === tab.id ? "text-primary" : "text-text-primary"}`}>
                                {tab.label}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep > 0 && currentStep <= totalWizardSteps && (
                  <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">{steps[currentStep - 1].title}</h2>
                      <p className="text-xs sm:text-sm text-text-secondary mt-1">{steps[currentStep - 1].description}</p>
                    </div>
                    <SnippetBlock 
                    title={steps[currentStep - 1].codeTitle} 
                    code={steps[currentStep - 1].codeSnippet} 
                    onCopy={copySnippet} 
                  />
                  </div>
                )}

                {isComplete && (
                  <div className="flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6 py-6 sm:py-10 max-w-xl mx-auto">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                      <Check className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">You're all set! 🎉</h2>
                      <p className="text-sm sm:text-base text-text-secondary mt-2">
                        Your application is now configured to send events to TraceForge. Trigger a test error in your app to verify everything is working.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full mt-4">
                      <Link 
                        href="/dashboard" 
                        className="w-full sm:w-auto px-6 py-3 rounded-sm bg-primary hover:bg-primary-hover font-semibold text-[15px] text-primary-foreground shadow-sm transition-colors flex justify-center"
                      >
                        Go to Dashboard
                      </Link>
                      
                      {activeTab && demoRepoLinks[activeTab] && (
                        <a 
                          href={demoRepoLinks[activeTab]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group w-full sm:w-auto relative inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-sm border border-border/40 bg-secondary/30 font-semibold text-[15px] text-text-secondary transition-colors hover:bg-secondary/50 hover:text-text-primary overflow-hidden shadow-sm"
                        >
                          <Globe className="w-4 h-4 text-primary/80 group-hover:text-primary transition-colors relative z-10" />
                          <span className="relative z-10">Explore {tabs.find(t => t.id === activeTab)?.label} Demo</span>
                          <span className="relative z-10 ml-0.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">→</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons (Fixed Height Bottom Area) */}
          <div className="flex items-center justify-between mt-6 sm:mt-10 pt-6 border-t border-border/40 shrink-0">
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className={`px-5 py-2.5 rounded-sm font-medium text-[14px] transition-all ${currentStep === 0 ? "opacity-0 pointer-events-none" : "text-text-secondary hover:text-text-primary hover:bg-secondary/50"}`}
          >
            Back
          </button>

          <button
            onClick={handleNextStep}
            disabled={isComplete}
            className={`px-6 py-2.5 rounded-sm font-semibold text-[14px] transition-all shadow-sm ${isComplete ? "opacity-0 pointer-events-none" : "bg-primary hover:bg-primary-hover hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] text-primary-foreground"}`}
          >
            {currentStep === totalWizardSteps ? "Finish" : "Next Step"}
          </button>
        </div>
        </div>
      </div>

      {/* Verification & Troubleshooting Section (Below Wizard) */}
      <div className="tf-container w-full max-w-4xl mx-auto relative z-10 mt-10 sm:mt-16 space-y-6 sm:space-y-8 px-4 sm:px-0">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary/50 text-text-secondary flex items-center justify-center font-bold font-mono text-xs border border-border/50">?</div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">Need help?</h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-sm border border-border/40 bg-card p-6 shadow-sm">
            <h3 className="text-[17px] font-bold text-text-primary mb-3">Operational Checklist</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[14px] text-text-secondary leading-relaxed">Keep environment tags consistent (production, staging, development).</p>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[14px] text-text-secondary leading-relaxed">Send a stable release like `api@2.8.0` to correlate deploys with spikes.</p>
              </div>
            </div>
          </div>

          <div className="rounded-sm border border-border/40 bg-card p-6 shadow-sm">
            <h3 className="text-[17px] font-bold text-text-primary mb-3">Troubleshooting</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-[14px] text-text-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5"></span>
                Check that the project API key matches the project.
              </li>
              <li className="flex items-start gap-2 text-[14px] text-text-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5"></span>
                Verify the ingest endpoint is reachable from your service.
              </li>
              <li className="flex items-start gap-2 text-[14px] text-text-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5"></span>
                Browser-originated ingest requires CORS. Backend events avoid this.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`tf-dashboard-toast animate-fade-up ${
            toast.tone === "success"
              ? "bg-[hsl(var(--success))] text-white"
              : "bg-[hsl(var(--destructive))] text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
