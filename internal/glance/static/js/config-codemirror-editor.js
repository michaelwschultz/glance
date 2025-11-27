let __cmLoaderPromise;

async function loadCodeMirrorOnce() {
	if (__cmLoaderPromise) return __cmLoaderPromise;

	__cmLoaderPromise = Promise.all([
		import(new URL("../vendor/codemirror/state.js", import.meta.url).toString()),
		import(new URL("../vendor/codemirror/view.js", import.meta.url).toString()),
		import(new URL("../vendor/codemirror/commands.js", import.meta.url).toString()),
		import(new URL("../vendor/codemirror/language.js", import.meta.url).toString()),
		import(new URL("../vendor/codemirror/lang-yaml.js", import.meta.url).toString()),
	]).then(([state, view, commands, language, langYaml]) => {
		return {
			EditorState: state.EditorState,
			EditorView: view.EditorView,
			keymap: view.keymap,
			lineNumbers: view.lineNumbers,
			highlightActiveLine: view.highlightActiveLine,
			drawSelection: view.drawSelection,
			lineWrapping: view.EditorView.lineWrapping,
			defaultKeymap: commands.defaultKeymap,
			history: commands.history,
			historyKeymap: commands.historyKeymap,
			indentWithTab: commands.indentWithTab,
			defaultHighlightStyle: language.defaultHighlightStyle,
			syntaxHighlighting: language.syntaxHighlighting,
			yaml: langYaml.yaml,
		};
	});

	return __cmLoaderPromise;
}

function setupCodeMirrorConfigEditor(root) {
	const baseURL = (typeof pageData !== "undefined" && pageData.baseURL) ? pageData.baseURL : (root.dataset.baseUrl || "");
	const textarea = root.querySelector(".config-editor-textarea");
	const loadBtn = root.querySelector("[data-load]");
	const saveBtn = root.querySelector("[data-save]");
	const status = root.querySelector(".status");

	let editorView = null;

	const setStatus = (text, isError = false) => {
		status.textContent = text;
		if (isError) {
			status.classList.add("text-negative");
		} else {
			status.classList.remove("text-negative");
		}
	};

	const setEditorValue = (text) => {
		if (editorView) {
			const doc = editorView.state.doc;
			editorView.dispatch({
				changes: { from: 0, to: doc.length, insert: text }
			});
		} else {
			textarea.value = text;
		}
	};

	const getEditorValue = () => {
		return editorView ? editorView.state.doc.toString() : textarea.value;
	};

	const load = async () => {
		setStatus("Loading…");
		try {
			const res = await fetch(`${baseURL}/api/config`, { method: "GET" });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const text = await res.text();
			setEditorValue(text);
			setStatus("Loaded");
		} catch (e) {
			setStatus(`Load failed: ${e.message}`, true);
		}
	};

	const save = async () => {
		setStatus("Saving…");
		try {
			const res = await fetch(`${baseURL}/api/config`, {
				method: "POST",
				headers: { "Content-Type": "text/plain; charset=utf-8" },
				body: getEditorValue(),
			});
			if (!res.ok) {
				const msg = await res.text();
				throw new Error(msg || `${res.status} ${res.statusText}`);
			}
			setStatus("Saved. Reloading…");
			const waitForServerAndReload = async () => {
				let sawFailure = false;
				for (let i = 0; i < 20; i++) {
					try {
						const r = await fetch(`${baseURL}/api/healthz?t=${Date.now()}`, { cache: "no-store" });
						if (r.ok) {
							if (sawFailure || i >= 2) {
								location.reload();
								return;
							}
						} else {
							sawFailure = true;
						}
					} catch (_) {
						sawFailure = true;
					}
					await new Promise(r => setTimeout(r, 300));
				}
				location.reload();
			};
			waitForServerAndReload();
		} catch (e) {
			setStatus(`Save failed: ${e.message}`, true);
		}
	};

	loadBtn.addEventListener("click", load);
	saveBtn.addEventListener("click", save);

	// Try to enhance with CodeMirror, fallback to textarea if it fails
	(async () => {
		try {
			const cm = await loadCodeMirrorOnce();
			const host = document.createElement("div");
			host.style.width = "100%";
			host.style.height = textarea.style.height || "300px";
			host.className = "cm-host";
			textarea.style.display = "none";
			textarea.parentElement.insertBefore(host, textarea);

			const themeFullHeight = cm.EditorView.theme({
				"&": { height: "100%" },
				".cm-scroller": { overflow: "auto" }
			});

			editorView = new cm.EditorView({
				state: cm.EditorState.create({
					doc: textarea.value || "",
					extensions: [
						cm.lineNumbers(),
						cm.highlightActiveLine(),
						cm.drawSelection(),
						cm.history(),
						cm.keymap.of([...cm.defaultKeymap, ...cm.historyKeymap, cm.indentWithTab]),
						cm.syntaxHighlighting(cm.defaultHighlightStyle),
						cm.lineWrapping,
						cm.yaml(),
						themeFullHeight,
					]
				}),
				parent: host,
			});
		} catch (e) {
			console.warn("CodeMirror failed to load, falling back to textarea:", e);
		} finally {
			// auto-load on mount
			load();
		}
	})();
}

export default function(element) {
	setupCodeMirrorConfigEditor(element);
}


