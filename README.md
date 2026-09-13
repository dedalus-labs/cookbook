# Dedalus Cookbook

Runnable examples for building with Dedalus. Each example includes its own setup, source, and cleanup instructions.

| Example | What it shows |
| --- | --- |
| [GitHub Actions runner](examples/github-actions-runner/) | Provision a runner with Terraform, run a job, then delete the machine from a separate cleanup job. |

To edit the GitHub Actions source, run `npm ci` at the repository root, then `npm run generate`, `npm run build`, and `npm run check`. Hollywood generates workflows and local actions in the root `.github/` directory.
