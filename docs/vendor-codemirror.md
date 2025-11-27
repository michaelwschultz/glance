## Vendoring CodeMirror (self-hosted)

To enable the CodeMirror-based config editor without relying on external CDNs, place the following files under `internal/glance/static/vendor/codemirror/`:

Required files (versions tested):
- state.js (ESM build of `@codemirror/state@6.4.1`)
- view.js (ESM build of `@codemirror/view@6.34.1`)
- commands.js (ESM build of `@codemirror/commands@6.5.0`)
- lang-yaml.js (ESM build of `@codemirror/lang-yaml@6.1.0`)
- language.js (ESM build of `@codemirror/language@6.x`)
- lezer-highlight.js (ESM build of `@lezer/highlight@1.x`)
- lezer-yaml.js (ESM build of `@lezer/yaml@1.x`)
- lezer-common.js (ESM build of `@lezer/common@1.x`)
- lezer-lr.js (ESM build of `@lezer/lr@1.x`)
- style-mod.js (ESM build of `style-mod@^4`)
- w3c-keyname.js (ESM build of `w3c-keyname@^2`)
- crelt.js (ESM build of `crelt@^1`)
  (Optional themes if you want to ship them)
  - theme-one-dark.js (ESM build of `@codemirror/theme-one-dark@6.x`)

Example (using curl; run from repo root):

```bash
mkdir -p internal/glance/static/vendor/codemirror
curl -fsSL https://unpkg.com/@codemirror/state@6.4.1/dist/index.js -o internal/glance/static/vendor/codemirror/state.js
curl -fsSL https://unpkg.com/@codemirror/view@6.34.1/dist/index.js -o internal/glance/static/vendor/codemirror/view.js
curl -fsSL https://unpkg.com/@codemirror/commands@6.5.0/dist/index.js -o internal/glance/static/vendor/codemirror/commands.js
curl -fsSL https://unpkg.com/@codemirror/lang-yaml@6.1.0/dist/index.js -o internal/glance/static/vendor/codemirror/lang-yaml.js
curl -fsSL https://unpkg.com/@codemirror/language@6.10.2/dist/index.js -o internal/glance/static/vendor/codemirror/language.js
curl -fsSL https://unpkg.com/@lezer/highlight@1.2.0/dist/index.js -o internal/glance/static/vendor/codemirror/lezer-highlight.js
curl -fsSL https://unpkg.com/@lezer/yaml@1.0.2/dist/index.js -o internal/glance/static/vendor/codemirror/lezer-yaml.js
curl -fsSL https://unpkg.com/@lezer/common@1.2.0/dist/index.js -o internal/glance/static/vendor/codemirror/lezer-common.js
curl -fsSL https://unpkg.com/@lezer/lr@1.4.0/dist/index.js -o internal/glance/static/vendor/codemirror/lezer-lr.js
curl -fsSL "https://unpkg.com/style-mod@4.1.0?module" -o internal/glance/static/vendor/codemirror/style-mod.js
curl -fsSL "https://unpkg.com/w3c-keyname@2.2.8?module" -o internal/glance/static/vendor/codemirror/w3c-keyname.js
curl -fsSL "https://unpkg.com/crelt@1.0.6?module" -o internal/glance/static/vendor/codemirror/crelt.js
## Optional: add the One Dark theme
curl -fsSL https://unpkg.com/@codemirror/theme-one-dark@6.1.2/dist/index.js -o internal/glance/static/vendor/codemirror/theme-one-dark.js
```

Notes:
- Make sure the downloaded files are the ESM builds (they should contain `export` statements and no UMD wrappers). The `dist/index.js` paths above are ESM for these packages.
- The editor injects a minimal base CSS at runtime, so a separate `style.css` file is not required. If you prefer the full view styles, you may copy `style.css` from `@codemirror/view` into the same folder and include it manually in your templates.
- After placing the files, Glance will serve them at `/static/<hash>/vendor/codemirror/...` and the config editor overlay will automatically import them.
- If you need to bump versions, update only these vendored files; no code changes are required unless breaking API changes occur.


