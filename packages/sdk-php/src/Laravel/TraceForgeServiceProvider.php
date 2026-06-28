<?php

namespace TraceForge\Laravel;

use Illuminate\Support\ServiceProvider;
use Illuminate\Contracts\Debug\ExceptionHandler;
use TraceForge\TraceForgeClient;
use Throwable;

class TraceForgeServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(TraceForgeClient::class, function () {
            return new TraceForgeClient();
        });
    }

    public function boot()
    {
        $client = $this->app->make(TraceForgeClient::class);

        if (!$client->isConfigured()) {
            return;
        }

        // Tap into the Laravel Exception Handler
        $this->app->resolving(ExceptionHandler::class, function (ExceptionHandler $handler, $app) use ($client) {
            // Depending on Laravel version, there are different ways to hook in.
            // A robust zero-touch way is to listen for Log events or use the 'reportable' callback in newer versions.
            // Since this runs during resolving, we can wrap the handler or just listen to the Log events.
            
            // For robust zero-touch error tracking, we'll hook into Laravel's Log events
            // which captures all reported exceptions and errors.
            $app['events']->listen(\Illuminate\Log\Events\MessageLogged::class, function ($event) use ($client) {
                if (isset($event->context['exception']) && $event->context['exception'] instanceof Throwable) {
                    $exception = $event->context['exception'];
                    
                    $request = request();
                    $payload = [
                        'url' => $request->fullUrl(),
                        'method' => $request->method(),
                        'ip' => $request->ip(),
                        'status' => 500,
                    ];
                    
                    $client->captureException($exception, ['framework' => 'laravel', 'type' => 'unhandled_exception'], $payload);
                }
            });
        });
    }
}
