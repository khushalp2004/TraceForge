<?php

namespace TraceForge;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class TraceForgeClient
{
    private ?string $apiKey = null;
    private string $ingestUrl = 'http://localhost:3001/ingest';
    private Client $httpClient;

    public function __construct()
    {
        $this->apiKey = $_ENV['TRACEFORGE_API_KEY'] ?? getenv('TRACEFORGE_API_KEY') ?: null;
        $this->ingestUrl = $_ENV['TRACEFORGE_INGEST_URL'] ?? getenv('TRACEFORGE_INGEST_URL') ?: 'http://localhost:3001/ingest';
        
        $this->httpClient = new Client([
            'timeout' => 1.0,
            'headers' => [
                'X-Traceforge-Key' => $this->apiKey,
                'Content-Type' => 'application/json',
                'User-Agent' => 'traceforge-php-sdk/1.0',
            ],
        ]);
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    public function captureException(\Throwable $exception, array $metadata = [], array $payload = []): void
    {
        if (!$this->isConfigured()) {
            return;
        }

        $event = [
            'type' => $metadata['type'] ?? 'exception',
            'message' => $exception->getMessage(),
            'stack' => $exception->getTraceAsString(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'metadata' => $metadata,
            'payload' => $payload,
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
            'framework' => $metadata['framework'] ?? 'php',
        ];

        try {
            // Using fire-and-forget logic if possible, or very short timeout
            $this->httpClient->post($this->ingestUrl, [
                'json' => $event,
            ]);
        } catch (GuzzleException $e) {
            // Fail silently to not crash the host application
        }
    }
}
