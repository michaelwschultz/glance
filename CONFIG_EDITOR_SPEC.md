## Design for Config Editing Feature

**Current Validation:**
- The app uses `gopkg.in/yaml.v3` for YAML parsing
- `newConfigFromYAML()` handles variable substitution and unmarshaling
- `isConfigStateValid()` performs logical validation (pages exist, auth settings, etc.)
- There's already a JSON schema available at https://github.com/not-first/glance-schema

**Proposed Implementation:**
1. **Backend API**: Simple endpoints to read/write the YAML file
   - `GET /api/config` - Returns current config as YAML string
   - `POST /api/config` - Accepts YAML string, validates it, saves it

2. **Frontend Widget**: A code editor with YAML syntax highlighting
   - Use a library like CodeMirror or Monaco Editor (if available)
   - Fallback to textarea with basic YAML validation via js-yaml
   - Show validation errors before saving

3. **UX Flow**:
   - Widget loads current YAML into editor
   - User edits YAML text
   - Client-side validation with js-yaml (optional, since server validates)
   - Save button sends YAML to server
   - Server validates and saves, triggers auto-reload

**Benefits of This Approach:**
- Leverages existing validation infrastructure
- Simple client-side implementation
- No need for complex structured editing
- Works with any YAML editor library

**Potential Libraries:**
- js-yaml for parsing/validation in browser
- CodeMirror for syntax highlighting (if we add it to the bundle)
- Or just use a `<textarea>` with basic CSS
