import { always, expr, secret, workflow } from "@dedalus-labs/hollywood";

import { teardownMachine } from "./teardown-machine.ts";

export const demoWorkflow = workflow({
	name: "Demo on Dedalus Machine",
	on: {
		workflow_dispatch: {},
	},
	jobs: {
		"hello-from-dm": {
			"runs-on": ["self-hosted", "dedalus"],
			steps: [
				{ uses: "actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955" }, // v4.3.0
				{
					name: "Prove this ran on a Dedalus Machine",
					run: [
						'echo "host: $(hostname)"',
						"uname -a",
						"cat /etc/os-release",
						"mount | grep dedalusfs",
					].join("\n"),
				},
			],
		},
		// Delete the machine from another runner so cleanup can finish after
		// the self-hosted runner process stops.
		teardown: {
			"runs-on": "ubuntu-latest",
			needs: "hello-from-dm",
			if: always(),
			steps: [
				{ uses: "actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955" }, // v4.3.0
				{
					name: "Teardown Dedalus Machine",
					uses: `./.github/actions/${teardownMachine.localActionPath}`,
					with: {
						"machine-id": expr("vars.DM_MACHINE_ID"),
						"dedalus-api-key": secret("DEDALUS_API_KEY"),
						"dedalus-base-url": expr("vars.DEDALUS_BASE_URL"),
					},
				},
			],
		},
	},
});
