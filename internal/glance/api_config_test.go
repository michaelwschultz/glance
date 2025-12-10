package glance

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	validConfigYAML = `
pages:
  - name: Home
    columns:
      - size: full
        widgets:
          - type: clock
            timezones:
              - timezone: UTC
                label: UTC
`
	updatedConfigYAML = `
pages:
  - name: Admin
    columns:
      - size: full
        widgets:
          - type: clock
            hour-format: 12h
            timezones:
              - timezone: America/New_York
                label: NYC
`
	glanceConfigSlugYAML = `
pages:
  - name: Config
    slug: glance-config
    columns:
      - size: full
        widgets:
          - type: clock
            timezones:
              - timezone: UTC
                label: UTC
`
	configSlugYAML = `
pages:
  - name: Custom
    slug: config
    columns:
      - size: full
        widgets:
          - type: clock
            timezones:
              - timezone: UTC
                label: UTC
`
)

func TestHandleConfigGetRequiresAuth(t *testing.T) {
	app := &application{
		RequiresAuth: true,
		ConfigPath:   filepath.Join(t.TempDir(), "glance.yml"),
	}

	req := httptest.NewRequest(http.MethodGet, "http://example.com/api/config", nil)
	rr := httptest.NewRecorder()

	app.handleConfigGet(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthorized request, got %d", rr.Code)
	}
}

func TestHandleConfigPostRequiresAuth(t *testing.T) {
	app := &application{
		RequiresAuth: true,
		ConfigPath:   filepath.Join(t.TempDir(), "glance.yml"),
	}

	req := httptest.NewRequest(http.MethodPost, "http://example.com/api/config", strings.NewReader(validConfigYAML))
	rr := httptest.NewRecorder()

	app.handleConfigPost(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthorized request, got %d", rr.Code)
	}
}

func TestHandleConfigPostRequiresXsrfHeader(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "glance.yml")
	if err := os.WriteFile(configPath, []byte(validConfigYAML), 0o644); err != nil {
		t.Fatalf("writing initial config: %v", err)
	}

	app := &application{
		ConfigPath: configPath,
	}

	req := httptest.NewRequest(http.MethodPost, "http://example.com/api/config", strings.NewReader(updatedConfigYAML))
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	rr := httptest.NewRecorder()

	app.handleConfigPost(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 when X-Requested-With is missing, got %d", rr.Code)
	}
}

func TestHandleConfigPostSucceeds(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "glance.yml")
	if err := os.WriteFile(configPath, []byte(validConfigYAML), 0o644); err != nil {
		t.Fatalf("writing initial config: %v", err)
	}

	app := &application{
		ConfigPath: configPath,
	}

	req := httptest.NewRequest(http.MethodPost, "http://example.com/api/config", strings.NewReader(updatedConfigYAML))
	req.Header.Set("Content-Type", "text/plain; charset=utf-8")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("Origin", "http://example.com")

	rr := httptest.NewRecorder()
	app.handleConfigPost(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 on success, got %d: %s", rr.Code, rr.Body.String())
	}

	contents, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatalf("reading config file: %v", err)
	}

	if string(contents) != updatedConfigYAML {
		t.Fatalf("config file not updated, got:\n%s", string(contents))
	}
}

func TestGlanceConfigSlugIsReserved(t *testing.T) {
	cfg, err := newConfigFromYAML([]byte(glanceConfigSlugYAML))
	if err != nil {
		t.Fatalf("parsing config: %v", err)
	}

	if _, err := newApplication(cfg); err == nil {
		t.Fatal("expected reserved slug error")
	}
}

func TestConfigSlugAllowed(t *testing.T) {
	cfg, err := newConfigFromYAML([]byte(configSlugYAML))
	if err != nil {
		t.Fatalf("parsing config: %v", err)
	}

	if _, err := newApplication(cfg); err != nil {
		t.Fatalf("config slug should be allowed, got error: %v", err)
	}
}
