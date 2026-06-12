"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Search, Check, Copy, ChevronDown, Terminal, Code2, Globe, Server, Braces, Sparkles, Database, Coffee, FileCode2 } from "lucide-react";

// Existing JS/TS Snippets
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

const pythonInstallSnippet = `pip install requests`;

const pythonSetupSnippet = `import sys
import requests
import traceback

TRACEFORGE_INGEST_URL = "http://localhost:3001/ingest"
TRACEFORGE_API_KEY = "YOUR_PROJECT_API_KEY"
TRACEFORGE_ENV = "production"
TRACEFORGE_RELEASE = "api@1.0.0"

def send_to_traceforge(exc_type, exc_value, exc_traceback):
    stack_trace = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    try:
        requests.post(
            TRACEFORGE_INGEST_URL,
            headers={
                "Content-Type": "application/json",
                "X-Traceforge-Key": TRACEFORGE_API_KEY
            },
            json={
                "message": str(exc_value),
                "stackTrace": stack_trace,
                "environment": TRACEFORGE_ENV,
                "release": TRACEFORGE_RELEASE,
            },
            timeout=3
        )
    except Exception:
        pass # Silently fail

# Catch all uncaught exceptions globally
sys.excepthook = send_to_traceforge`;

const goSetupSnippet = `package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "runtime/debug"
)

const (
    TraceForgeIngestURL = "http://localhost:3001/ingest"
    TraceForgeAPIKey    = "YOUR_PROJECT_API_KEY"
    TraceForgeEnv       = "production"
    TraceForgeRelease   = "api@1.0.0"
)

// Helper to manually send an error to TraceForge
func SendToTraceForge(err error) {
    stackTrace := string(debug.Stack())
    
    payload := map[string]interface{}{
        "message":     err.Error(),
        "stackTrace":  stackTrace,
        "environment": TraceForgeEnv,
        "release":     TraceForgeRelease,
    }
    
    jsonPayload, _ := json.Marshal(payload)
    
    req, _ := http.NewRequest("POST", TraceForgeIngestURL, bytes.NewBuffer(jsonPayload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("X-Traceforge-Key", TraceForgeAPIKey)
    
    client := &http.Client{}
    client.Do(req)
}`;

const javaSetupSnippet = `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class TraceForge {
    public static void captureException(Exception e) {
        try {
            String json = String.format("""
            {
                "message": "%s",
                "stackTrace": "%s",
                "environment": "production",
                "release": "api@1.0.0"
            }
            """, e.getMessage().replace("\"", "\\\""), java.util.Arrays.toString(e.getStackTrace()));

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:3001/ingest"))
                .header("Content-Type", "application/json")
                .header("X-Traceforge-Key", "YOUR_PROJECT_API_KEY")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

            HttpClient.newHttpClient().sendAsync(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception ignored) {}
    }
}`;

const phpSetupSnippet = `<?php
function sendToTraceForge($exception) {
    $url = "http://localhost:3001/ingest";
    $data = json_encode([
        "message" => $exception->getMessage(),
        "stackTrace" => $exception->getTraceAsString(),
        "environment" => "production",
        "release" => "web@1.0.0"
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "X-Traceforge-Key: YOUR_PROJECT_API_KEY"
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    
    curl_exec($ch);
    curl_close($ch);
}

// Automatically catch all unhandled exceptions
set_exception_handler('sendToTraceForge');
?>`;

const rustSetupSnippet = `use reqwest::Client;
use serde_json::json;
use std::env;

pub async fn send_to_traceforge(error_msg: &str, stack_trace: &str) {
    let client = Client::new();
    
    let payload = json!({
        "message": error_msg,
        "stackTrace": stack_trace,
        "environment": "production",
        "release": "api@1.0.0"
    });

    let _ = client.post("http://localhost:3001/ingest")
        .header("Content-Type", "application/json")
        .header("X-Traceforge-Key", "YOUR_PROJECT_API_KEY")
        .json(&payload)
        .send()
        .await;
}`;

const csharpSetupSnippet = `using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public static class TraceForge
{
    private static readonly HttpClient client = new HttpClient();

    public static async Task CaptureException(Exception ex)
    {
        var payload = new
        {
            message = ex.Message,
            stackTrace = ex.StackTrace,
            environment = "production",
            release = "api@1.0.0"
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:3001/ingest");
        request.Content = content;
        request.Headers.Add("X-Traceforge-Key", "YOUR_PROJECT_API_KEY");

        try
        {
            await client.SendAsync(request);
        }
        catch { /* Silently ignore logging failures */ }
    }
}`;

const rubySetupSnippet = `require 'net/http'
require 'json'
require 'uri'

def send_to_traceforge(exception)
  uri = URI.parse("http://localhost:3001/ingest")
  request = Net::HTTP::Post.new(uri)
  request.content_type = "application/json"
  request["X-Traceforge-Key"] = "YOUR_PROJECT_API_KEY"
  
  request.body = JSON.dump({
    "message" => exception.message,
    "stackTrace" => exception.backtrace.join("\n"),
    "environment" => "production",
    "release" => "api@1.0.0"
  })

  Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https", open_timeout: 3, read_timeout: 3) do |http|
    http.request(request)
  end
rescue StandardError
  # Silently fail
end`;

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

type TechStack = "nextjs" | "react" | "nodejs" | "python" | "go" | "java" | "php" | "rust" | "csharp" | "ruby" | "rest";

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
    <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-[#0C0C0E] shadow-2xl transition-all duration-300 hover:border-border/80">
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
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 opacity-100 sm:opacity-0 transition-all hover:bg-white/10 hover:text-white sm:group-hover:opacity-100"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      
      {/* Code Area */}
      <div className="relative">
        <div className="absolute -left-20 top-0 h-40 w-40 rounded-full bg-primary/5 blur-[80px]"></div>
        
        <pre className="relative overflow-x-auto p-5 text-[13px] leading-relaxed text-white/90 font-mono max-h-[400px]">
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
    { id: "nodejs", label: "Node.js", icon: <Server className="w-4 h-4" />, hint: "JavaScript backend" },
    { id: "python", label: "Python", icon: <Terminal className="w-4 h-4" />, hint: "Backend + AI apps" },
    { id: "java", label: "Java", icon: <Coffee className="w-4 h-4" />, hint: "Enterprise systems" },
    { id: "php", label: "PHP", icon: <Globe className="w-4 h-4" />, hint: "Websites & CMS" },
    { id: "go", label: "Go", icon: <Terminal className="w-4 h-4" />, hint: "High-performance backend" },
    { id: "rust", label: "Rust", icon: <Database className="w-4 h-4" />, hint: "Ultra-fast secure systems" },
    { id: "csharp", label: "C#", icon: <FileCode2 className="w-4 h-4" />, hint: "Enterprise & Microsoft stack" },
    { id: "ruby", label: "Ruby", icon: <FileCode2 className="w-4 h-4" />, hint: "Fast MVP/startups" },
    { id: "rest", label: "REST API", icon: <Braces className="w-4 h-4" /> },
  ];

  type WizardStep = { title: string; description: string; codeSnippet: string; codeTitle: string; };
  
  const frameworkSteps: Record<string, WizardStep[]> = {
    nextjs: [
      { title: "Install the SDK", description: "Install the official TraceForge package.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: nextEnvSnippet, codeTitle: ".env" },
      { title: "Initialize", description: "Create a client component to initialize the SDK globally.", codeSnippet: nextSetupSnippet, codeTitle: "components/TraceForgeInit.tsx" }
    ],
    react: [
      { title: "Install the SDK", description: "Install the official TraceForge package.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: reactEnvSnippet, codeTitle: ".env" },
      { title: "Initialize", description: "Call `init` as early as possible (e.g. `main.tsx` or `index.tsx`).", codeSnippet: reactSetupSnippet, codeTitle: "src/main.tsx" }
    ],
    nodejs: [
      { title: "Install the SDK", description: "Install the official TraceForge package.", codeSnippet: installSnippet, codeTitle: "Terminal" },
      { title: "Configure Environment", description: "Add your project keys to `.env`.", codeSnippet: nodeEnvSnippet, codeTitle: ".env" },
      { title: "Add Express Middleware", description: "Place the error handler *before* your final catch-all error middleware.", codeSnippet: nodeSetupSnippet, codeTitle: "server.ts" }
    ],
    python: [
      { title: "Requirements", description: "You only need a simple HTTP client to post data.", codeSnippet: pythonInstallSnippet, codeTitle: "Terminal" },
      { title: "Send via REST", description: "Hook into your framework's exception handler or `sys.excepthook` to send JSON payloads.", codeSnippet: pythonSetupSnippet, codeTitle: "app.py" }
    ],
    go: [
      { title: "Send via HTTP", description: "Use Go's standard library to format errors and send them to the ingest endpoint.", codeSnippet: goSetupSnippet, codeTitle: "traceforge.go" }
    ],
    java: [
      { title: "Send via HTTP Client", description: "Use Java's built-in `HttpClient` (Java 11+) to push stack traces asynchronously to TraceForge.", codeSnippet: javaSetupSnippet, codeTitle: "TraceForge.java" }
    ],
    php: [
      { title: "Send via cURL", description: "Catch exceptions globally and fire a JSON payload using standard PHP `curl_init()`.", codeSnippet: phpSetupSnippet, codeTitle: "traceforge.php" }
    ],
    rust: [
      { title: "Send via reqwest", description: "Use the popular `reqwest` crate to dispatch memory-safe error logs to the ingest endpoint.", codeSnippet: rustSetupSnippet, codeTitle: "traceforge.rs" }
    ],
    csharp: [
      { title: "Send via HttpClient", description: "Integrate TraceForge seamlessly into your .NET Enterprise apps using `System.Net.Http`.", codeSnippet: csharpSetupSnippet, codeTitle: "TraceForge.cs" }
    ],
    ruby: [
      { title: "Send via net/http", description: "Track errors in your Rails or Sinatra apps by dumping backtraces via Ruby's standard `net/http` library.", codeSnippet: rubySetupSnippet, codeTitle: "traceforge.rb" }
    ],
    rest: [
      { title: "Raw Payload Format", description: "Send a simple JSON payload to the ingest endpoint from any environment, CI script, or language.", codeSnippet: restSnippet, codeTitle: "cURL / HTTP" }
    ]
  };

  const demoRepoLinks: Record<string, string> = {
    nextjs: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/nextjs-project",
    react: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/react-vite-project",
    nodejs: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/nodejs-project",
    python: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/python-project",
    java: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/java-project",
    php: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/php-project",
    go: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/go-project",
    rust: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/rust-project",
    csharp: "https://github.com/khushalp2004/Testing-apps-for-traceforge/tree/main/csharp-project",
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
        <div className="w-full max-w-4xl h-[550px] sm:h-[600px] min-w-0 bg-card/60 backdrop-blur-xl border border-border/50 shadow-2xl rounded-[28px] sm:rounded-[32px] p-5 sm:p-10 relative overflow-hidden flex flex-col">
          
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

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
                    
                    {/* Combobox Wrapper */}
                    <div className="relative mt-4 sm:mt-8">
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-3 sm:left-4 flex items-center pointer-events-none text-text-secondary group-focus-within:text-primary transition-colors">
                          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search frameworks (e.g. Next.js, Python)..."
                          value={isDropdownOpen ? searchQuery : (selectedTabLabel || searchQuery)}
                          onFocus={() => {
                            setIsDropdownOpen(true);
                            setSearchQuery("");
                          }}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsDropdownOpen(true);
                            setActiveTab("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && isDropdownOpen && filteredTabs.length > 0) {
                              setActiveTab(filteredTabs[0].id);
                              setSearchQuery("");
                              setIsDropdownOpen(false);
                            }
                          }}
                          className="w-full bg-secondary/30 border border-border/50 text-text-primary placeholder:text-text-secondary/50 rounded-xl sm:rounded-2xl py-3 sm:py-4 pl-10 sm:pl-12 pr-10 sm:pr-12 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-inner"
                        />
                        {activeTab && !isDropdownOpen && (
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-emerald-500">
                            <Check className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Dropdown Suggestions */}
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden z-50 max-h-60 overflow-y-auto custom-scrollbar">
                          {filteredTabs.length === 0 ? (
                            <div className="p-4 text-center text-text-secondary">
                              No frameworks found matching "{searchQuery}"
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {filteredTabs.map((tab) => (
                                <button
                                  key={tab.id}
                                  onClick={() => {
                                    setActiveTab(tab.id);
                                    setSearchQuery("");
                                    setIsDropdownOpen(false);
                                  }}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors text-left border-b border-border/20 last:border-0"
                                >
                                  <span className="text-primary">{tab.icon}</span>
                                  <div className="flex flex-col flex-1">
                                    <span className="font-medium text-text-primary">{tab.label}</span>
                                    {tab.hint && <span className="text-xs text-text-secondary">{tab.hint}</span>}
                                  </div>
                                  <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-500 border border-emerald-500/20">Supported</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
                        className="w-full sm:w-auto px-6 py-3 bg-primary text-white rounded-xl font-medium text-sm sm:text-base hover:bg-primary/90 transition-all duration-300 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] hover:-translate-y-0.5 flex justify-center"
                      >
                        Go to Dashboard
                      </Link>
                      
                      {activeTab && demoRepoLinks[activeTab] && (
                        <a 
                          href={demoRepoLinks[activeTab]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group w-full sm:w-auto relative inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl border border-border/50 bg-secondary/30 backdrop-blur-md text-sm sm:text-base font-medium text-text-secondary transition-all duration-300 hover:bg-secondary/60 hover:border-border/80 hover:text-text-primary hover:-translate-y-0.5 overflow-hidden"
                        >
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <Globe className="w-4 h-4 text-primary/80 group-hover:text-primary transition-colors relative z-10" />
                          <span className="relative z-10">Explore {tabs.find(t => t.id === activeTab)?.label} Demo</span>
                          <span className="relative z-10 ml-0.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">→</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons (Fixed Height Bottom Area) */}
          <div className="mt-4 pt-4 sm:pt-6 border-t border-border/50 flex justify-between items-center relative z-10 flex-shrink-0 w-full">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-medium text-sm sm:text-base transition-all duration-300 ${currentStep === 0 ? "opacity-0 pointer-events-none" : "bg-secondary text-text-primary hover:bg-secondary/80"}`}
            >
              ← Back
            </button>

            {!isComplete && (
              <button
                onClick={handleNextStep}
                className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl font-semibold text-sm sm:text-base bg-primary text-white hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/20 flex items-center gap-1 sm:gap-2"
              >
                {currentStep === 0 ? "Continue to Setup" : currentStep === totalWizardSteps ? "Finish Setup" : "Next Step"}
                <span className="text-base sm:text-lg leading-none">→</span>
              </button>
            )}
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
          <div className="rounded-[24px] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
            <h3 className="text-lg font-semibold text-text-primary mb-3">Operational Checklist</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">Keep environment tags consistent (production, staging, development).</p>
              </div>
              <div className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">Send a stable release like `api@2.8.0` to correlate deploys with spikes.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
            <h3 className="text-lg font-semibold text-text-primary mb-3">Troubleshooting</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0 mt-1"></span>
                Check that the project API key matches the project.
              </li>
              <li className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0 mt-1"></span>
                Verify the ingest endpoint is reachable from your service.
              </li>
              <li className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0 mt-1"></span>
                Browser-originated ingest requires CORS. Backend events avoid this.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-xl animate-in slide-in-from-bottom-4 ${
            toast.tone === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
