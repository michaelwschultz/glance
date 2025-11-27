function setupConfigEditor(root) {
	const baseURL = (typeof pageData !== "undefined" && pageData.baseURL) ? pageData.baseURL : (root.dataset.baseUrl || "");
	const textarea = root.querySelector(".config-editor-textarea");
	const loadBtn = root.querySelector("[data-load]");
	const saveBtn = root.querySelector("[data-save]");
	const status = root.querySelector(".status");

	const setStatus = (text, isError = false) => {
		status.textContent = text;
		if (isError) {
			status.classList.add("text-negative");
		} else {
			status.classList.remove("text-negative");
		}
	};

	const load = async () => {
		setStatus("Loading…");
		try {
			const res = await fetch(`${baseURL}/api/config`, { method: "GET" });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			textarea.value = await res.text();
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
				body: textarea.value,
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

	// auto-load on mount
	load();
}

export default function(element) {
	setupConfigEditor(element);
}


