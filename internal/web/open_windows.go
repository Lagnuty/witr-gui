//go:build windows

package web

import "os/exec"

func openBrowser(url string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
