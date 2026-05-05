//go:build freebsd

package web

import "os/exec"

func openBrowser(url string) error {
	return exec.Command("xdg-open", url).Start()
}
