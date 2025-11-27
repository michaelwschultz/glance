package glance

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

const maxConfigBodySizeBytes = 1 << 20 // 1 MiB

func (a *application) handleConfigGet(w http.ResponseWriter, r *http.Request) {
	if a.ConfigPath == "" {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("config path is not set"))
		return
	}

	contents, err := os.ReadFile(a.ConfigPath)
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, os.ErrNotExist) {
			status = http.StatusNotFound
		}
		w.WriteHeader(status)
		w.Write([]byte(fmt.Sprintf("reading config: %v", err)))
		return
	}

	w.Header().Set("Content-Type", "text/yaml; charset=utf-8")
	w.Write(contents)
}

func (a *application) handleConfigPost(w http.ResponseWriter, r *http.Request) {
	if a.ConfigPath == "" {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("config path is not set"))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxConfigBodySizeBytes)
	defer r.Body.Close()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(fmt.Sprintf("reading request body: %v", err)))
		return
	}

	// Write to a temporary file in the same directory to allow atomic rename.
	configDir := filepath.Dir(a.ConfigPath)
	tmpFile, err := os.CreateTemp(configDir, ".glance.yml.tmp-*")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(fmt.Sprintf("creating temp file: %v", err)))
		return
	}
	tmpPath := tmpFile.Name()
	_, writeErr := tmpFile.Write(body)
	closeErr := tmpFile.Close()
	if writeErr != nil || closeErr != nil {
		os.Remove(tmpPath)
		w.WriteHeader(http.StatusInternalServerError)
		if writeErr != nil {
			w.Write([]byte(fmt.Sprintf("writing temp file: %v", writeErr)))
		} else {
			w.Write([]byte(fmt.Sprintf("closing temp file: %v", closeErr)))
		}
		return
	}

	// Compose includes using the temp file to validate the full config.
	composed, _, err := parseYAMLIncludes(tmpPath)
	if err != nil {
		os.Remove(tmpPath)
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(fmt.Sprintf("parsing includes: %v", err)))
		return
	}

	if _, err := newConfigFromYAML(composed); err != nil {
		os.Remove(tmpPath)
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(fmt.Sprintf("validation error: %v", err)))
		return
	}

	// Match existing file permissions if possible.
	if stat, err := os.Stat(a.ConfigPath); err == nil {
		_ = os.Chmod(tmpPath, stat.Mode())
	} else {
		_ = os.Chmod(tmpPath, 0o644)
	}

	// Atomic replace.
	if err := os.Rename(tmpPath, a.ConfigPath); err != nil {
		os.Remove(tmpPath)
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(fmt.Sprintf("replacing config file: %v", err)))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}


