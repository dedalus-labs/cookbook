import { action, stringInput } from "@dedalus-labs/hollywood";

export const teardownMachine = action({
	name: "Teardown Dedalus Machine",
	description: "Destroy the Dedalus Machine hosting this runner.",
	localActionPath: "dedalus/teardown-machine",
	inputs: {
		machineId: stringInput({ description: "Dedalus machine ID to destroy." }),
		dedalusApiKey: stringInput({ description: "Dedalus API key." }),
		dedalusBaseUrl: stringInput({ description: "Dedalus API base URL." }),
	},
	outputs: {},
	run: async ({ exec, input, log }) => {
		log.info(`destroying ${input.machineId}`);
		await exec("curl", [
			"-fsSL",
			"-X",
			"DELETE",
			"-H",
			`Authorization: Bearer ${input.dedalusApiKey}`,
			"-H",
			`Idempotency-Key: teardown-${input.machineId}-${Date.now()}`,
			`${input.dedalusBaseUrl}/v1/machines/${input.machineId}`,
		]);
		return {};
	},
});
