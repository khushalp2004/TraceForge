package traceforge

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
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

const defaultEndpoint = "http://localhost:3001/ingest"

// Init initializes the TraceForge SDK.
func Init(apiKey string) {
	InitWithConfig(Config{APIKey: apiKey})
}

// InitWithConfig initializes the TraceForge SDK with extended options.
func InitWithConfig(c Config) {
	if c.Endpoint == "" {
		c.Endpoint = defaultEndpoint
	}
	config = &c
	sendSetupHandshake()
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
		"environment": config.Environment,
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
	_, err = client.Do(req)
	if err != nil {
		isSetup = false
	}
}

// CapturePanic captures a panic error and stack trace and sends it to TraceForge.
func CapturePanic(err interface{}, stack []byte) {
	if config == nil {
		return
	}
	
	msg := fmt.Sprintf("%v", err)
	event := Event{
		Message:     msg,
		StackTrace:  string(stack),
		Environment: config.Environment,
		Release:     config.Release,
		Tags:        config.Tags,
	}
	
	sendEvent(event)
}

func sendEvent(event Event) {
	if config == nil {
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
	_, _ = client.Do(req)
}
