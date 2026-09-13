#!/bin/bash
# Terraform `external` data source contract: read JSON from stdin (unused here),
# write a flat JSON object of strings to stdout. Uses the caller's gh session
# to request a short-lived runner registration token.
set -euo pipefail

eval "$(jq -r '@sh "REPO=\(.repo)"')"

token="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" -q .token)"

jq -n --arg token "$token" '{token: $token}'
