use backtrace::Backtrace;
use dotenv::dotenv;
use lazy_static::lazy_static;
use reqwest::blocking::Client;
use serde_json::json;
use std::env;
use std::sync::Mutex;

lazy_static! {
    static ref CONFIG: Mutex<Option<Config>> = Mutex::new(None);
}

#[derive(Clone)]
pub struct Config {
    pub api_key: String,
    pub endpoint: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            api_key: "".to_string(),
            endpoint: "http://localhost:3001/ingest".to_string(),
        }
    }
}

/// Initializes the TraceForge SDK. 
/// Automatically reads TRACEFORGE_API_KEY and TRACEFORGE_INGEST_URL from .env if present.
pub fn init() {
    dotenv().ok();
    
    let mut conf = Config::default();
    
    if let Ok(key) = env::var("TRACEFORGE_API_KEY") {
        conf.api_key = key;
    }
    
    if let Ok(url) = env::var("TRACEFORGE_INGEST_URL") {
        conf.endpoint = url;
    }
    
    // Only set hook if API key is present
    if !conf.api_key.is_empty() {
        init_with_config(conf);
    } else {
        eprintln!("[TraceForge] SDK initialized but no TRACEFORGE_API_KEY found. Tracking is disabled.");
    }
}

pub fn init_with_config(config: Config) {
    *CONFIG.lock().unwrap() = Some(config);

    // Setup global panic hook
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            *s
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.as_str()
        } else {
            "Unknown Rust Panic"
        };

        // Capture backtrace
        let bt = Backtrace::new();
        let mut frames_str = String::new();
        let mut first_file = String::from("unknown_file");
        let mut first_line = 0;
        let mut found_first = false;

        for frame in bt.frames() {
            for symbol in frame.symbols() {
                if let Some(name) = symbol.name() {
                    let name_str = name.to_string();
                    if name_str.contains("rust_begin_unwind") || name_str.contains("core::panicking") {
                        continue; // Skip panic handler internals
                    }
                    frames_str.push_str(&format!("{}\n", name_str));
                }
                
                if !found_first {
                    if let Some(file) = symbol.filename() {
                        if let Some(path) = file.to_str() {
                            if !path.contains("/rustc/") && !path.contains(".cargo/") {
                                first_file = path.to_string();
                                first_line = symbol.lineno().unwrap_or(0);
                                found_first = true;
                            }
                        }
                    }
                }
            }
        }

        // Fallback to panic_info location if backtrace didn't yield a user file
        if !found_first {
            if let Some(loc) = panic_info.location() {
                first_file = loc.file().to_string();
                first_line = loc.line();
            }
        }

        capture_exception(message, &frames_str, &first_file, first_line);

        // Continue with the default panic hook (which normally prints to stderr)
        default_hook(panic_info);
    }));
}

pub fn capture_exception(message: &str, stack_trace: &str, file: &str, line: u32) {
    let config_opt = CONFIG.lock().unwrap().clone();
    if let Some(config) = config_opt {
        let client = Client::new();

        let payload = json!({
            "type": "panic",
            "message": message,
            "stackTrace": stack_trace,
            "file": file,
            "line": line,
            "metadata": {
                "framework": "rust-core",
                "language": "rust"
            }
        });

        // We use reqwest::blocking to synchronously transmit the panic before the thread dies
        let _ = client
            .post(&config.endpoint)
            .header("X-Traceforge-Key", &config.api_key)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send();
    }
}
