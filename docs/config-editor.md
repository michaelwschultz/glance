## Config Editor (API + Widget)

### Overview
- Adds a simple YAML config editor to Glance.
- Backend exposes endpoints to read/write the main `glance.yml`. Changes are validated and applied live.
- Frontend widget provides a textarea-based editor that loads current config and saves updates.

### Backend
- Endpoints:
  - `GET /api/config`: returns the current main config file as YAML.
  - `POST /api/config`: accepts raw YAML, validates the full configuration (with `!include`/`$include`), and writes atomically to the main config file.
- Validation:
  - Parses includes via `parseYAMLIncludes(...)` against the temporary file.
  - Validates with `newConfigFromYAML(...)` which also performs logical checks via `isConfigStateValid(...)`.
- File write is atomic (temp file + `os.Rename`) to safely trigger the existing file watcher and config reload.
- Request body size capped at ~1 MiB.
- No authentication gating (per current requirements).

### Frontend
- New widget type: `config-editor`
  - Renders a `<textarea>` with Load and Save buttons.
  - On mount, fetches `/api/config` and populates the editor.
  - On save, posts to `/api/config`, then polls `/api/healthz` and automatically reloads the page when the server is ready.

### Usage
Add the widget to any page in your `glance.yml`:

```yaml
pages:
  - name: Admin
    columns:
      - size: full
        widgets:
          - type: config-editor
            title: Config Editor
```

Open the page, edit YAML, and click Save. The app reloads automatically once the server has applied the new configuration.

### Notes and Limitations
- Only the main `glance.yml` is edited; include structure is preserved (no flattening).
- If the configuration becomes invalid, the server logs will show the error and the previous valid config will remain active.
- Frequent reloads can invalidate in-memory caches; avoid saving rapidly in production.


