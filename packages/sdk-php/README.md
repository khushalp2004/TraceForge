# TraceForge SDK for PHP (Laravel)

Zero-touch application performance monitoring and error tracking for PHP and Laravel applications.

## Installation

Install the package via Composer:

```bash
composer require khushalp2004/traceforge-php
```

## Configuration (Laravel)

If you are using Laravel, the SDK is **Zero-Touch**! It will automatically register itself using Laravel's Package Auto-Discovery.

You only need to add your API Key and Ingest URL to your `.env` file:

```env
TRACEFORGE_API_KEY="your_api_key_here"
TRACEFORGE_INGEST_URL="http://localhost:3001/ingest"
```

**That's it!** TraceForge will automatically intercept all handled and unhandled exceptions in your Laravel application by seamlessly hooking into Laravel's core logging system.

## Configuration (Vanilla PHP)

If you are not using Laravel, you can manually capture exceptions:

```php
require 'vendor/autoload.php';

use TraceForge\TraceForgeClient;

$client = new TraceForgeClient();

try {
    // Your code here
    throw new Exception("Something went wrong!");
} catch (\Throwable $e) {
    $client->captureException($e, ['type' => 'manual_exception']);
}
```
