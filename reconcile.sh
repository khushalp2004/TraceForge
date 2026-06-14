#!/bin/bash

echo "Starting manual TraceForge Billing Reconciliation..."
echo ""

# We run this inside the worker container because it has all the necessary
# network connections (DB, Redis) and compiled dependencies ready to go.
docker compose exec worker node dist/test-reconciliation.js

echo ""
echo "Reconciliation complete!"
