// wait-for-execution polls a Dedalus Machine execution to a terminal status
// and exits with the remote command's exit code. The Terraform
// dedalus_machine_execution resource only submits the exec and stores
// whatever snapshot the create response returns (queued/running); it does
// not block until completion. This fills that gap as a local-exec
// provisioner so `terraform apply` only succeeds once the bootstrap script
// actually finished inside the guest.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
)

func main() {
	machineID := os.Getenv("DM_MACHINE_ID")
	executionID := os.Getenv("DM_EXECUTION_ID")
	if machineID == "" || executionID == "" {
		fmt.Fprintln(os.Stderr, "DM_MACHINE_ID and DM_EXECUTION_ID are required")
		os.Exit(2)
	}

	client := dedalus.NewClient(
		option.WithBaseURL(os.Getenv("DEDALUS_BASE_URL")),
		option.WithAPIKey(os.Getenv("DEDALUS_API_KEY")),
	)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	for {
		exec, err := client.Machines.Executions.Get(ctx, dedalus.MachineExecutionGetParams{
			MachineID:   machineID,
			ExecutionID: executionID,
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, "get execution:", err)
			os.Exit(1)
		}

		switch exec.Status {
		case dedalus.ExecutionStatusSucceeded, dedalus.ExecutionStatusFailed,
			dedalus.ExecutionStatusCancelled, dedalus.ExecutionStatusExpired:
			output, err := client.Machines.Executions.Output(ctx, dedalus.MachineExecutionOutputParams{
				MachineID:   machineID,
				ExecutionID: executionID,
			})
			if err == nil {
				fmt.Println("--- stdout ---")
				fmt.Println(output.Stdout)
				fmt.Println("--- stderr ---")
				fmt.Println(output.Stderr)
			}
			fmt.Printf("status=%s exit_code=%d error=%s\n", exec.Status, exec.ExitCode, exec.ErrorMessage)
			if exec.Status != dedalus.ExecutionStatusSucceeded || exec.ExitCode != 0 {
				os.Exit(1)
			}
			return
		default:
			time.Sleep(5 * time.Second)
		}
	}
}
