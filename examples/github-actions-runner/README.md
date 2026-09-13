# GitHub Actions runner

Run a self-hosted GitHub Actions runner on a Dedalus Machine. The [Dedalus Terraform provider](https://registry.terraform.io/providers/dedalus-labs/dedalus/latest/docs) provisions the machine and bootstraps the runner. [Hollywood](https://oss.dedaluslabs.ai/hollywood) generates the workflow and its cleanup action from TypeScript.

## Setup

Fork this cookbook, enable Actions, and clone your fork. Install Terraform 1.5 or later, Go, make, jq, and the GitHub CLI. Authenticate `gh` with administrator access to your fork.

```bash
git clone https://github.com/YOUR_ACCOUNT/cookbook.git
cd cookbook/examples/github-actions-runner
export TF_VAR_github_repo=YOUR_ACCOUNT/cookbook
export DEDALUS_BASE_URL=https://dcs.dedaluslabs.ai
export DEDALUS_API_KEY=your-api-key
make init
make apply
make verify REPO="$TF_VAR_github_repo"
```

Review Terraform's plan before approving it. This example creates a machine with 2 vCPUs, 4 GiB of memory, 20 GiB of storage, and autosleep disabled. `make verify` checks that GitHub reports the runner as online.

## Run a job

Set the machine ID and endpoint as repository variables. Enter your Dedalus API key when `gh secret set` prompts for it.

```bash
gh variable set DM_MACHINE_ID --repo "$TF_VAR_github_repo" \
  --body "$(terraform -chdir=terraform output -raw machine_id)"
gh variable set DEDALUS_BASE_URL --repo "$TF_VAR_github_repo" \
  --body "$DEDALUS_BASE_URL"
gh secret set DEDALUS_API_KEY --repo "$TF_VAR_github_repo"
gh workflow run github-actions-runner.yml --repo "$TF_VAR_github_repo"
gh run list --workflow github-actions-runner.yml --repo "$TF_VAR_github_repo"
```

The [workflow](../../.github/workflows/github-actions-runner.yml) selects `[self-hosted, dedalus]` for the first job. It checks out the repository and prints the machine's operating system and filesystem information. A second job runs on a GitHub-hosted runner and deletes the machine, including when the first job fails.

Open the run in GitHub and check both jobs. Run this example one workflow at a time because cleanup reads one shared `DM_MACHINE_ID`. Before another run, provision a new machine and update that variable.

## Cleanup

The workflow normally deletes its machine. To delete it manually from this directory:

```bash
make destroy
```

Confirm deletion because autosleep is disabled. Compute and storage charges follow [Dedalus pricing](https://docs.dedaluslabs.ai/dcs/dm/pricing).

## Layout

| Path | Purpose |
| --- | --- |
| `terraform/` | Machine and execution resources, with local waits for bootstrap completion. |
| `scripts/` | Runner setup, online verification, and the Go execution waiter. |
| `ci/` | Hollywood workflow and cleanup action source. |
| `../../.github/` | Generated workflow, local action entrypoint, and bundled action. |

The runner and workspace use a 2 GiB memory-backed filesystem. The registered identity persists across sleep and wake, while the workspace resets on boot. This example does not provide persistent build caches.

To edit the workload, change [ci/github-actions-runner.ts](ci/github-actions-runner.ts). From the cookbook root, run:

```bash
npm ci
npm run generate
npm run build
npm run check
```
