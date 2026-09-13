SHELL := /bin/bash
REPO  := dedalus-labs/cookbook

.PHONY: help check-env build init plan apply verify demo up destroy

help:
	@echo "targets:"
	@echo "  check-env  - fail fast if required tools/credentials are missing"
	@echo "  build      - compile and vet the Go execution-waiter"
	@echo "  init       - terraform init"
	@echo "  plan       - terraform plan"
	@echo "  apply      - terraform apply (provisions the machine + runner)"
	@echo "  verify     - confirm the runner is registered and online"
	@echo "  demo       - trigger .github/workflows/github-actions-runner.yml and watch it run"
	@echo "  up         - build + init + apply + verify + demo, in order"
	@echo "  destroy    - terraform destroy"

check-env:
	@command -v terraform >/dev/null || { echo "terraform not found"; exit 1; }
	@command -v go        >/dev/null || { echo "go not found"; exit 1; }
	@command -v gh         >/dev/null || { echo "gh not found"; exit 1; }
	@command -v jq         >/dev/null || { echo "jq not found"; exit 1; }
	@gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated: run 'gh auth login'"; exit 1; }
	@[ -n "$$DEDALUS_API_KEY" ]  || { echo "DEDALUS_API_KEY is not set"; exit 1; }
	@[ -n "$$DEDALUS_BASE_URL" ] || { echo "DEDALUS_BASE_URL is not set"; exit 1; }
	@echo "environment OK"

build:
	cd scripts/wait-for-execution && go vet ./... && go build -o /dev/null .

init: check-env
	cd terraform && terraform init

plan: check-env
	cd terraform && terraform plan

apply: check-env build
	cd terraform && terraform apply

verify:
	./scripts/verify-runner.sh $(REPO)

demo: verify
	gh workflow run github-actions-runner.yml --repo $(REPO)
	sleep 3
	gh run watch --repo $(REPO) --exit-status "$$(gh run list --repo $(REPO) --limit 1 --json databaseId -q '.[0].databaseId')"

up: build init apply verify demo

destroy: check-env
	cd terraform && terraform destroy
