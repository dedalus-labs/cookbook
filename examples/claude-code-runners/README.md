# Claude Code runners for a team

Give each person on a Claude Team or Enterprise organization their own Dedalus Machine for
Claude Code cloud sessions. A person's machine sleeps when they are not using it and wakes
when they start a session.

## How it works

Claude Code [self-hosted environments](https://code.claude.com/docs/en/self-hosted-environments)
run cloud sessions on your infrastructure instead of Anthropic's. Three ideas from those docs
matter here:

- An **environment** is the entry people pick when they start a cloud session. An Owner creates
  it on the [Cloud environments](https://claude.ai/admin-settings/cloud-environments) admin page,
  which shows its one secret, the environment key.
- A **runner** is a `claude self-hosted-runner` process. It claims a queued session and runs it.
  A runner serves one person at a time.
- The **orchestrator** is a `claude self-hosted-runner orchestrator` process. When a session is
  queued and no runner is free, it calls the `spawn-runner` hook in this directory to start one.

When someone starts a session in your environment:

1. The orchestrator calls [`orchestrator/spawn-runner`](orchestrator/spawn-runner) with the
   session owner's account ID and a single-use work order.
2. `spawn-runner` looks up the owner's machine in `machines.json` on the orchestrator machine
   and runs [`machine/start-runner`](machine/start-runner) there. Running a command on a
   sleeping machine wakes it.
3. `start-runner` starts a runner with the work order and returns. The runner claims the session.
4. The runner clones the repository into `/workspace/slot-<n>/<owner>/<repo>` through the
   [Anthropic git proxy](https://code.claude.com/docs/en/self-hosted-environments-deploy#use-the-anthropic-git-proxy),
   which reaches GitHub through each person's GitHub connection on claude.ai. No machine holds a
   GitHub credential. The clone stays on the machine, so later sessions only fetch.
5. After 30 idle minutes the runner releases the session, pushes its commits, and exits. Ten
   minutes after the last runner exits, the machine autosleeps.
6. When the person writes to the session again, it goes back to step 1 and resumes from the
   pushed branch. Uncommitted changes from before the release are lost.

The runner is started by an execution, and processes started by an execution count as activity.
That keeps the machine awake during a session and lets it sleep afterwards.

### Runner slots

The runner clones each repository to `<base-dir>/<owner>/<repo>`, with nothing per session in the
path, and resets that clone when a session starts. Two runners sharing a base dir would share one
working tree.

So each machine has 4 slots, `/workspace/slot-0` to `slot-3`, and `start-runner` gives every
runner its own. A runner holds its slot's lock on a descriptor it inherits, so the slot frees
itself when the runner and its children exit, however they exit. Clones in a slot stay warm for
the next session there. A resumed session gets its previous slot back when that slot is free.
With all 4 busy, a fifth session retries until one frees.

A process that a session starts in the background and leaves running keeps its slot busy until it
exits.

### New and replaced machines

`spawn-runner` provisions a new machine when the owner has none that can serve them:

- They have no machine yet. This is how a person's first machine gets created.
- Their machine was deleted.
- The Machines API reports their machine as failed and not retryable.

A failed machine that the API marks retryable gets 30 minutes before it is replaced. If starting
a runner on a machine fails 3 times in a row, `spawn-runner` sleeps it so the next start wakes it
fresh. If starts keep failing after that, the owner gets a new machine. A replaced machine is kept,
not deleted. The counters live in `/var/lib/claude-cloud/recovery` on the orchestrator machine.

To keep all automation off a machine, for example while you work on it by hand, create
`/var/lib/claude-cloud/holds/<machine-id>` on the orchestrator machine with the reason inside.
Delete the file to release it.

Provisioning takes longer than the hook may run, so `spawn-runner` starts
[`orchestrator/provision-for`](orchestrator/provision-for) as a systemd unit named after the
account and exits 1. Anthropic retries the session, and once the new machine is recorded the next
attempt starts a runner on it. A new machine whose install fails is deleted, and the next retry
provisions again.

## Files

| Path | Runs on | Purpose |
| --- | --- | --- |
| `provision` | your laptop or the orchestrator machine | creates or updates one machine |
| `orchestrator/install` | orchestrator machine | installs Claude Code, the `dedalus` CLI, these scripts and the unit |
| `orchestrator/claude-orchestrator.service` | orchestrator machine | systemd unit for the orchestrator |
| `orchestrator/spawn-runner` | orchestrator machine | starts a runner on the session owner's machine, or provisions one |
| `orchestrator/provision-for` | orchestrator machine | provisions a machine for an account and records it |
| `machine/install` | each person's machine | installs tools, Claude Code and `start-runner` |
| `machine/start-runner` | each person's machine | starts one runner from a work order |
| `/var/lib/claude-cloud/machines.json` | orchestrator machine | account ID to machine ID, written by `provision-for` |

## Before you start

- A Claude Team or Enterprise organization. An Owner turns on **Allow self-hosted environments**
  and the GitHub connector, and each person connects GitHub on claude.ai.
- A Dedalus API key on a plan above Hobby. Hobby caps storage at 10 GiB, and each personal
  machine uses 50 GiB.
- On your laptop: the [`dedalus` CLI](https://docs.dedaluslabs.ai/dcs/dm/quickstart), `jq` and
  `tar`.

## Set up the orchestrator machine

The orchestrator machine holds the environment key and the Dedalus API key, and never runs a
session. It is a small machine with autosleep off, so it is always there to answer.

1. Create it. This installs Claude Code, the `dedalus` CLI, this directory at
   `/opt/claude-cloud` and the systemd unit, and prints the machine ID:

   ```bash
   export DEDALUS_API_KEY=your-api-key
   ORCHESTRATOR=$(./provision orchestrator)
   ```

2. Write the Dedalus credentials the hooks use. They travel on stdin, which the API never
   returns:

   ```bash
   dedalus machines executions create --machine-id "$ORCHESTRATOR" \
     --stdin "$(printf 'DEDALUS_API_KEY=%s\nDEDALUS_BASE_URL=%s\n' "$DEDALUS_API_KEY" "${DEDALUS_BASE_URL:-https://dcs.dedaluslabs.ai}")" \
     --command '["install", "-m", "0600", "/dev/stdin", "/etc/claude-cloud/env"]'
   ```

3. Create the environment on claude.ai, copy its environment key, and write it to a local file
   without it touching your shell history. Paste the key, press Enter, then Ctrl-D:

   ```bash
   (umask 077 && cat > environment-secret)
   dedalus machines executions create --machine-id "$ORCHESTRATOR" \
     --stdin "$(cat environment-secret)" \
     --command '["install", "-m", "0600", "/dev/stdin", "/etc/claude-cloud/environment-secret"]'
   rm environment-secret
   ```

4. Start the orchestrator and check it:

   ```bash
   dedalus ssh "$ORCHESTRATOR"
   systemctl start claude-orchestrator
   curl -s localhost:8080/healthz
   ```

   The `connected` field must be `true`. To ship changed scripts later, run
   `./provision orchestrator "$ORCHESTRATOR"` again. It restarts a running orchestrator.

## Add a person

Anyone in the claude.ai organization can use the environment. A person's first session
provisions their machine, and the session starts on it once the machine is ready. Find the
machine ID in `/var/lib/claude-cloud/machines.json`.

Each person adds one machine to the Dedalus organization's machine cap, next to the orchestrator
machine. Raise the cap before it runs out, or new people's sessions retry without starting.

To update `start-runner` or Claude Code on an existing machine, run `./provision <machine-id>`.

## Operate it

- **One orchestrator per environment.** Two would both answer spawn requests, each with its own
  `machines.json`. Before starting a new one, run `systemctl disable --now claude-orchestrator`
  on the old orchestrator machine.
- **Watch the orchestrator.** Sessions start only while it runs. Check `localhost:8080/healthz`
  from a monitor of your choice.
- **Back up `machines.json`.** It maps people to machines. A new orchestrator machine built
  without it provisions a fresh machine for everyone.
- **Machine shape.** Personal machines get 4 vCPU, 16 GiB of memory and 50 GiB of storage. A new
  shape in `provision` applies to new machines only.

The orchestrator machine stays awake, and each person's machine is billed while a session keeps it
awake. See [Dedalus pricing](https://docs.dedaluslabs.ai/dcs/dm/pricing).
