//go:build windows

package web

import "fmt"

func runProcessAction(pid int, action string, nice int) error {
	return fmt.Errorf("process actions are not supported on Windows")
}
