package traceforge

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type Config struct {
	APIKey      string
	Endpoint    string
	Environment string
	Release     string
	Tags        map[string]string
}

type Event struct {
	Message     string            `json:"message"`
	StackTrace  string            `json:"stackTrace"`
	Environment string            `json:"environment,omitempty"`
	Release     string            `json:"release,omitempty"`
	Payload     map[string]any    `json:"payload,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
}

var (
	config    *Config
	isSetup   bool
)

const defaultEndpoint = "http://localhost:80/ingest"

// Init initializes the TraceForge SDK. It automatically reads TRACEFORGE_API_KEY and TRACEFORGE_INGEST_URL from the environment if no config is provided.
func Init() {
	InitWithConfig(Config{
		APIKey:   os.Getenv("TRACEFORGE_API_KEY"),
		Endpoint: os.Getenv("TRACEFORGE_INGEST_URL"),
	})
}

// InitWithConfig initializes the TraceForge SDK with extended options.
func InitWithConfig(c Config) {
	if c.APIKey == "" {
		c.APIKey = os.Getenv("TRACEFORGE_API_KEY")
	}
	if c.Endpoint == "" {
		c.Endpoint = os.Getenv("TRACEFORGE_INGEST_URL")
	}
	if c.Endpoint == "" {
		c.Endpoint = defaultEndpoint
	}
	config = &c
	go sendSetupHandshake()
}

func getSetupEndpoint() string {
	endpoint := config.Endpoint
	if len(endpoint) > 0 && endpoint[len(endpoint)-1] == '/' {
		endpoint = endpoint[:len(endpoint)-1]
	}
	if len(endpoint) > 6 && endpoint[len(endpoint)-6:] == "/setup" {
		return endpoint
	}
	return endpoint + "/setup"
}

func sendSetupHandshake() {
	if config == nil || config.APIKey == "" || isSetup {
		return
	}
	isSetup = true
	
	payload := map[string]interface{}{
		"environment": "go",
		"release":     config.Release,
		"tags":        config.Tags,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		isSetup = false
		return
	}
	
	req, err := http.NewRequest("POST", getSetupEndpoint(), bytes.NewBuffer(body))
	if err != nil {
		isSetup = false
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Traceforge-Key", config.APIKey)
	
	client := &http.Client{}
	res, err := client.Do(req)
	if err != nil {
		isSetup = false
		return
	}
	defer res.Body.Close()
	
	if res.StatusCode >= 400 {
		isSetup = false
	}
}

// CaptureException manually captures an error and sends it to TraceForge asynchronously.
func CaptureException(err error, tags map[string]string, payload map[string]any) {
	if err == nil || config == nil {
		return
	}
	
	// Create merged tags
	mergedTags := make(map[string]string)
	for k, v := range config.Tags {
		mergedTags[k] = v
	}
	for k, v := range tags {
		mergedTags[k] = v
	}
	
	event := Event{
		Message:     err.Error(),
		StackTrace:  fmt.Sprintf("%+v", err), // Simple stack formatting, real SDKs might use runtime.Callers
		Environment: config.Environment,
		Release:     config.Release,
		Tags:        mergedTags,
		Payload:     payload,
	}
	
	go sendEvent(event)
}

// CapturePanic captures a panic error and stack trace and sends it to TraceForge.
func CapturePanic(err interface{}, stack []byte, tags map[string]string, payload map[string]any) {
	if config == nil {
		return
	}
	
	mergedTags := make(map[string]string)
	for k, v := range config.Tags {
		mergedTags[k] = v
	}
	for k, v := range tags {
		mergedTags[k] = v
	}
	
	msg := fmt.Sprintf("%v", err)
	event := Event{
		Message:     msg,
		StackTrace:  string(stack),
		Environment: config.Environment,
		Release:     config.Release,
		Tags:        mergedTags,
		Payload:     payload,
	}
	
	go sendEvent(event)
}

func sendEvent(event Event) {
	if config == nil || config.APIKey == "" {
		return
	}
	
	body, err := json.Marshal(event)
	if err != nil {
		return
	}
	
	req, err := http.NewRequest("POST", config.Endpoint, bytes.NewBuffer(body))
	if err != nil {
		return
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Traceforge-Key", config.APIKey)
	
	client := &http.Client{}
	res, err := client.Do(req)
	if err == nil {
		res.Body.Close()
	}
}
