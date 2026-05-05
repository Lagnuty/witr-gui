//go:build linux || darwin || freebsd

package web

import (
	"fmt"
	"os"
	"strings"
	"syscall"
)

func runProcessAction(pid int, action string, nice int) error {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "kill":
		return sendSignal(pid, syscall.SIGKILL)
	case "term", "terminate":
		return sendSignal(pid, syscall.SIGTERM)
	case "pause":
		return sendSignal(pid, syscall.SIGSTOP)
	case "resume":
		return sendSignal(pid, syscall.SIGCONT)
	case "renice":
		if nice < -20 || nice > 19 {
			return fmt.Errorf("nice value %d out of range (-20..19)", nice)
		}
		if err := syscall.Setpriority(syscall.PRIO_PROCESS, pid, nice); err != nil {
			return fmt.Errorf("renice PID %d to %d failed: %w", pid, nice, err)
		}
		return nil
	default:
		return fmt.Errorf("unknown action %q", action)
	}
}

func sendSignal(pid int, sig syscall.Signal) error {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return fmt.Errorf("process %d not found: %w", pid, err)
	}
	if err := proc.Signal(sig); err != nil {
		return fmt.Errorf("signal %v to PID %d failed: %w", sig, pid, err)
	}
	return nil
}
