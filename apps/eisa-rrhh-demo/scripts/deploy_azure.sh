#!/usr/bin/env bash
set -euo pipefail
# Default is a read-only preflight. Azure credentials remain in the CLI cache.
exec "${PYTHON:-python3}" "$(dirname "$0")/deploy_azure.py" "$@"
