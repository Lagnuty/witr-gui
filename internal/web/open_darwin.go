//go:build darwin

package web

import "os/exec"

func openBrowser(url string) error {
	return exec.Command("open", url).Start()
}
