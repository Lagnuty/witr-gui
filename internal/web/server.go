//go:build linux || darwin || freebsd || windows

package web

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/pranshuparmar/witr/internal/output"
	"github.com/pranshuparmar/witr/internal/pipeline"
	procpkg "github.com/pranshuparmar/witr/internal/proc"
	"github.com/pranshuparmar/witr/internal/source"
	"github.com/pranshuparmar/witr/internal/target"
	"github.com/pranshuparmar/witr/pkg/model"
)

//go:embed static/*
var assets embed.FS

type Server struct {
	addr        string
	version     string
	openBrowser bool
	logger      *log.Logger
}

type analyzeRequest struct {
	Type    string `json:"type"`
	Value   string `json:"value"`
	Exact   bool   `json:"exact"`
	Verbose bool   `json:"verbose"`
}

type analyzeResponse struct {
	Result  *model.Result     `json:"result,omitempty"`
	Target  model.Target      `json:"target"`
	Matches []model.Process   `json:"matches,omitempty"`
	Error   string            `json:"error,omitempty"`
	Output  map[string]string `json:"output,omitempty"`
}

type renderRequest struct {
	Type    string `json:"type"`
	Value   string `json:"value"`
	Exact   bool   `json:"exact"`
	Verbose bool   `json:"verbose"`
	Mode    string `json:"mode"`
}

type actionRequest struct {
	PID    int    `json:"pid"`
	Action string `json:"action"`
	Nice   int    `json:"nice"`
}

type actionResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

type statusResponse struct {
	Version   string `json:"version"`
	OSPID     int    `json:"osPid"`
	StartedAt string `json:"startedAt"`
}

var startedAt = time.Now()

func Start(addr, version string, open bool) error {
	if strings.TrimSpace(addr) == "" {
		addr = "127.0.0.1:7331"
	}
	s := &Server{
		addr:        addr,
		version:     version,
		openBrowser: open,
		logger:      log.New(os.Stderr, "witr web: ", log.LstdFlags),
	}
	return s.ListenAndServe()
}

func (s *Server) ListenAndServe() error {
	staticFS, err := fs.Sub(assets, "static")
	if err != nil {
		return err
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("GET /api/processes", s.handleProcesses)
	mux.HandleFunc("GET /api/ports", s.handlePorts)
	mux.HandleFunc("GET /api/process/", s.handleProcess)
	mux.HandleFunc("POST /api/analyze", s.handleAnalyze)
	mux.HandleFunc("POST /api/render", s.handleRender)
	mux.HandleFunc("POST /api/action", s.handleAction)
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	url := browserURL(s.addr)
	if s.openBrowser {
		go func() {
			time.Sleep(200 * time.Millisecond)
			if err := openBrowser(url); err != nil {
				s.logger.Printf("open browser: %v", err)
			}
		}()
	}
	if url == "http://"+s.addr {
		s.logger.Printf("serving %s", url)
	} else {
		s.logger.Printf("serving %s (bound to %s)", url, s.addr)
	}
	return http.ListenAndServe(s.addr, securityHeaders(mux))
}

func browserURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		if strings.HasPrefix(addr, ":") {
			return "http://127.0.0.1" + addr
		}
		return "http://" + addr
	}
	switch host {
	case "", "0.0.0.0", "::", "[::]":
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, port)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, statusResponse{
		Version:   s.version,
		OSPID:     os.Getpid(),
		StartedAt: startedAt.Format(time.RFC3339),
	})
}

func (s *Server) handleProcesses(w http.ResponseWriter, r *http.Request) {
	procs, err := procpkg.ListProcesses()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}

	selfPID := os.Getpid()
	filtered := make([]model.Process, 0, len(procs))
	for _, p := range procs {
		if p.PID == selfPID {
			continue
		}
		filtered = append(filtered, p)
	}
	writeJSON(w, filtered)
}

func (s *Server) handlePorts(w http.ResponseWriter, r *http.Request) {
	ports, err := procpkg.ListOpenPorts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, ports)
}

func (s *Server) handleProcess(w http.ResponseWriter, r *http.Request) {
	pidText := strings.TrimPrefix(r.URL.Path, "/api/process/")
	pid, err := strconv.Atoi(pidText)
	if err != nil || pid <= 0 {
		writeError(w, http.StatusBadRequest, errors.New("invalid pid"))
		return
	}

	res, err := analyzePID(pid, true, model.Target{Type: model.TargetPID, Value: strconv.Itoa(pid)})
	if err != nil {
		writeError(w, statusForError(err), err)
		return
	}
	writeJSON(w, analyzeResponse{
		Result: &res,
		Target: model.Target{Type: model.TargetPID, Value: strconv.Itoa(pid)},
		Output: renderAll(res),
	})
}

func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	var req analyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	t, err := requestTarget(req.Type, req.Value)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	pids, err := target.Resolve(t, req.Exact)
	if err != nil {
		writeJSONStatus(w, statusForError(err), analyzeResponse{Target: t, Error: err.Error()})
		return
	}
	if len(pids) == 0 {
		writeJSONStatus(w, http.StatusNotFound, analyzeResponse{Target: t, Error: "no matching process found"})
		return
	}
	if len(pids) > 1 {
		matches := make([]model.Process, 0, len(pids))
		for _, pid := range pids {
			if p, err := procpkg.ReadProcess(pid); err == nil {
				matches = append(matches, p)
				continue
			}
			matches = append(matches, model.Process{PID: pid, Command: procpkg.GetCmdline(pid)})
		}
		writeJSONStatus(w, http.StatusConflict, analyzeResponse{
			Target:  t,
			Matches: matches,
			Error:   fmt.Sprintf("multiple processes matched (%d results)", len(matches)),
		})
		return
	}

	res, err := analyzePID(pids[0], req.Verbose, t)
	if err != nil {
		writeJSONStatus(w, statusForError(err), analyzeResponse{Target: t, Error: err.Error()})
		return
	}
	writeJSON(w, analyzeResponse{Result: &res, Target: t, Output: renderAll(res)})
}

func (s *Server) handleRender(w http.ResponseWriter, r *http.Request) {
	var req renderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}

	t, err := requestTarget(req.Type, req.Value)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	pids, err := target.Resolve(t, req.Exact)
	if err != nil {
		writeError(w, statusForError(err), err)
		return
	}
	if len(pids) != 1 {
		writeError(w, http.StatusConflict, fmt.Errorf("expected one process, got %d", len(pids)))
		return
	}

	res, err := analyzePID(pids[0], req.Verbose, t)
	if err != nil {
		writeError(w, statusForError(err), err)
		return
	}

	text, err := renderMode(res, req.Mode)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, map[string]string{"mode": req.Mode, "text": text})
}

func (s *Server) handleAction(w http.ResponseWriter, r *http.Request) {
	var req actionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if req.PID <= 0 {
		writeError(w, http.StatusBadRequest, errors.New("invalid pid"))
		return
	}
	if err := runProcessAction(req.PID, req.Action, req.Nice); err != nil {
		writeJSONStatus(w, statusForError(err), actionResponse{OK: false, Message: err.Error()})
		return
	}
	writeJSON(w, actionResponse{OK: true, Message: "action completed"})
}

func requestTarget(kind, value string) (model.Target, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return model.Target{}, errors.New("target value is required")
	}

	switch strings.ToLower(strings.TrimSpace(kind)) {
	case "", "name":
		return model.Target{Type: model.TargetName, Value: value}, nil
	case "pid":
		return model.Target{Type: model.TargetPID, Value: value}, nil
	case "port":
		return model.Target{Type: model.TargetPort, Value: value}, nil
	case "file":
		return model.Target{Type: model.TargetFile, Value: value}, nil
	default:
		return model.Target{}, fmt.Errorf("unknown target type %q", kind)
	}
}

func analyzePID(pid int, verbose bool, t model.Target) (model.Result, error) {
	res, err := pipeline.AnalyzePID(pipeline.AnalyzeConfig{
		PID:     pid,
		Verbose: verbose,
		Tree:    true,
		Target:  t,
	})
	if err != nil {
		return model.Result{}, err
	}

	if t.Type == model.TargetPort {
		if portNum, err := strconv.Atoi(t.Value); err == nil && portNum > 0 {
			res.SocketInfo = procpkg.GetSocketStateForPort(portNum)
			source.EnrichSocketInfo(res.SocketInfo)
		}
	}
	return res, nil
}

func renderAll(res model.Result) map[string]string {
	modes := []string{"standard", "tree", "short", "warnings", "env", "json"}
	out := make(map[string]string, len(modes))
	for _, mode := range modes {
		if text, err := renderMode(res, mode); err == nil {
			out[mode] = text
		}
	}
	return out
}

func renderMode(res model.Result, mode string) (string, error) {
	var b bytes.Buffer
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", "standard":
		output.RenderStandard(&b, res, false, true)
	case "tree":
		output.PrintTree(&b, res.Ancestry, res.Children, false)
	case "short":
		output.RenderShort(&b, res, false)
	case "warnings":
		output.RenderWarnings(&b, res, false)
	case "env":
		output.RenderEnvOnly(&b, res, false)
	case "json":
		return output.ToJSON(res)
	default:
		return "", fmt.Errorf("unknown render mode %q", mode)
	}
	return b.String(), nil
}

func writeJSON(w http.ResponseWriter, v any) {
	writeJSONStatus(w, http.StatusOK, v)
}

func writeJSONStatus(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSONStatus(w, status, map[string]string{"error": err.Error()})
}

func statusForError(err error) int {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "permission denied") ||
		strings.Contains(msg, "operation not permitted") ||
		strings.Contains(msg, "not supported"):
		return http.StatusForbidden
	case strings.Contains(msg, "not found") ||
		strings.Contains(msg, "does not exist") ||
		strings.Contains(msg, "no matching"):
		return http.StatusNotFound
	case strings.Contains(msg, "invalid"):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}
