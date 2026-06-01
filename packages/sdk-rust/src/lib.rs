use lazy_static::lazy_static;
use reqwest::blocking::Client;
use serde_json::json;
use std::sync::Mutex;
use std::time::SystemTime;

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
            endpoint: "https://traceforge.io/api/ingest".to_string(),
        }
    }
}

pub fn init(api_key: &str) {
    let mut conf = Config::default();
    conf.api_key = api_key.to_string();
    init_with_config(conf);
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

        let location = if let Some(loc) = panic_info.location() {
            format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
        } else {
            "unknown_location".to_string()
        };

        let full_error = format!("Panic at {}: {}", location, message);
        capture_message(&full_error);

        // Continue with the default panic hook (which normally prints to stderr)
        default_hook(panic_info);
    }));
}

pub fn capture_message(message: &str) {
    let config_opt = CONFIG.lock().unwrap().clone();
    if let Some(config) = config_opt {
        let client = Client::new();
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis();

        let payload = json!({
            "message": message,
            "error": "RustPanic",
            "level": "error",
            "timestamp": timestamp,
            "status": 500
        });

        // We use reqwest::blocking to synchronously transmit the panic before the thread dies
        let _ = client
            .post(&config.endpoint)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send();
    }
}
