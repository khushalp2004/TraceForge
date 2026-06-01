<?php

namespace TraceForge;

class Client {
    private static $config = [];
    private static $isSetup = false;
    private static $defaultEndpoint = "http://localhost:3001/ingest";

    public static function init(array $options) {
        self::$config = array_merge([
            'endpoint' => self::$defaultEndpoint,
            'environment' => '',
            'release' => '',
            'tags' => []
        ], $options);

        self::sendSetupHandshake();
    }

    private static function getSetupEndpoint() {
        $endpoint = self::$config['endpoint'];
        $endpoint = rtrim($endpoint, '/');
        
        if (substr($endpoint, -6) === '/setup') {
            return $endpoint;
        }
        
        return $endpoint . '/setup';
    }

    private static function sendSetupHandshake() {
        if (empty(self::$config['apiKey']) || self::$isSetup) {
            return;
        }

        self::$isSetup = true;

        $payload = [
            'environment' => self::$config['environment'],
            'release' => self::$config['release'],
            'tags' => self::$config['tags']
        ];

        self::sendPostRequest(self::getSetupEndpoint(), $payload);
    }

    public static function captureException(\Throwable $exception, array $extras = []) {
        if (empty(self::$config['apiKey'])) {
            return;
        }

        $environment = $extras['environment'] ?? self::$config['environment'];
        $release = $extras['release'] ?? self::$config['release'];
        
        $tags = self::$config['tags'];
        if (isset($extras['tags']) && is_array($extras['tags'])) {
            $tags = array_merge($tags, $extras['tags']);
        }

        $payload = [
            'message' => $exception->getMessage(),
            'stackTrace' => $exception->getTraceAsString(),
            'environment' => $environment,
            'release' => $release,
            'tags' => $tags
        ];

        if (isset($extras['payload'])) {
            $payload['payload'] = $extras['payload'];
        }

        self::sendPostRequest(self::$config['endpoint'], $payload);
    }

    private static function sendPostRequest($url, $data) {
        $json = json_encode($data);
        
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-Traceforge-Key: ' . self::$config['apiKey']
        ]);
        
        // Timeout settings to avoid blocking the main app too long
        curl_setopt($ch, CURLOPT_TIMEOUT, 2);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
        
        curl_exec($ch);
        curl_close($ch);
    }
}
