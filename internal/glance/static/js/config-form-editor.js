import { load as yamlLoad, dump as yamlDump } from "../vendor/yaml.mjs";
import { renderWidgetCard } from "./widget-form-renderer.js";

function titleToSlug(title) {
	return title
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function getAtPath(obj, path) {
	const parts = path.split(".");
	let current = obj;
	for (const p of parts) {
		if (current == null) return undefined;
		current = current[p];
	}
	return current;
}

function isIncludeItem(item) {
	return item && typeof item === "object" && ("$include" in item || "!include" in item);
}

function getIncludePath(item) {
	return item["$include"] ?? item["!include"] ?? "";
}

function setupConfigFormEditor(root) {
	const baseURL =
		(typeof pageData !== "undefined" && pageData.baseURL)
			? pageData.baseURL
			: root.dataset.baseUrl || "";
	const defaultHeaders = { "X-Requested-With": "XMLHttpRequest" };

	const formView = root.querySelector('[data-view="form"]');
	const yamlView = root.querySelector('[data-view="yaml"]');
	const yamlTextarea = root.querySelector("[data-yaml-editor]");
	const pagesContainer = root.querySelector("[data-pages-container]");
	const pageTabsEl = root.querySelector("[data-page-tabs]");
	const addPageBtn = root.querySelector("[data-add-page]");
	const loadBtn = root.querySelector("[data-load]");
	const saveBtn = root.querySelector("[data-save]");
	const status = root.querySelector(".status");
	const includesBanner = root.querySelector("[data-includes-banner]");
	const modeFormBtn = root.querySelector('[data-mode="form"]');
	const modeYamlBtn = root.querySelector('[data-mode="yaml"]');

	let configData = null;
	let rawYaml = "";
	let activeTabIndex = 0;

	const setStatus = (text, isError = false) => {
		status.textContent = text;
		if (isError) status.classList.add("text-negative");
		else status.classList.remove("text-negative");
	};

	const fieldMap = [
		["server.host", "server", "host"],
		["server.port", "server", "port"],
		["server.proxied", "server", "proxied"],
		["server.assets-path", "server", "assets-path"],
		["server.base-url", "server", "base-url"],
		["theme.custom-css-file", "theme", "custom-css-file"],
		["theme.disable-picker", "theme", "disable-picker"],
		["branding.hide-footer", "branding", "hide-footer"],
		["branding.logo-text", "branding", "logo-text"],
		["branding.logo-url", "branding", "logo-url"],
		["branding.favicon-url", "branding", "favicon-url"],
		["branding.app-name", "branding", "app-name"],
		["branding.app-icon-url", "branding", "app-icon-url"],
		["branding.app-background-color", "branding", "app-background-color"],
	];

	function ensurePath(obj, pathParts) {
		let current = obj;
		for (const p of pathParts) {
			if (!(p in current) || current[p] == null) current[p] = {};
			current = current[p];
		}
		return current;
	}

	function configToForm() {
		if (!configData) return;
		const s = configData.server || {};
		const t = configData.theme || {};
		const b = configData.branding || {};

		for (const [dataField, ...pathParts] of fieldMap) {
			const input = root.querySelector(`[data-field="${dataField}"]`);
			if (!input) continue;
			let val = getAtPath(configData, pathParts.join("."));
			if (val === undefined) val = "";
			if (input.type === "checkbox") {
				input.checked = !!val;
			} else if (input.type === "number") {
				input.value = val === undefined || val === "" ? "" : Number(val);
			} else {
				input.value = val === undefined || val === null ? "" : String(val);
			}
		}
		renderPages();
	}

	function formToConfig() {
		const cfg = configData ? JSON.parse(JSON.stringify(configData)) : {};
		cfg.server = cfg.server || {};
		cfg.theme = cfg.theme || {};
		cfg.branding = cfg.branding || {};
		cfg.pages = cfg.pages || [];

		for (const [dataField, ...pathParts] of fieldMap) {
			const input = root.querySelector(`[data-field="${dataField}"]`);
			if (!input) continue;
			const parent = ensurePath(cfg, pathParts.slice(0, -1));
			const key = pathParts[pathParts.length - 1];
			if (input.type === "checkbox") {
				parent[key] = input.checked;
			} else if (input.type === "number") {
				const v = input.value.trim();
				parent[key] = v === "" ? (key === "port" ? 8080 : 0) : parseInt(v, 10);
			} else {
				parent[key] = input.value.trim();
			}
		}

		// Build pages from configData (source of truth for which pages exist) with form overlays
		const sourcePages = configData?.pages || [];
		cfg.pages = [];
		const pageCards = pagesContainer.querySelectorAll("[data-page-index]");
		for (let i = 0; i < sourcePages.length; i++) {
			const card = pageCards[i];
			const pageData = sourcePages[i];
			if (!card) continue; // DOM may be out of sync, skip
			if (isIncludeItem(pageData)) {
				const pathInput = card.querySelector("[data-include-path]");
				const path = pathInput?.value?.trim() || "";
				const key = "!include" in pageData ? "!include" : "$include";
				cfg.pages.push({ [key]: path });
				continue;
			}
			const nameInput = card.querySelector('[data-page-field="name"]');
			const slugInput = card.querySelector('[data-page-field="slug"]');
			const widthSelect = card.querySelector('[data-page-field="width"]');
			const navWidthSelect = card.querySelector('[data-page-field="desktop-navigation-width"]');
			const showMobileInput = card.querySelector('[data-page-field="show-mobile-header"]');
			const hideNavInput = card.querySelector('[data-page-field="hide-desktop-navigation"]');
			const centerInput = card.querySelector('[data-page-field="center-vertically"]');

			const page = {
				name: nameInput?.value?.trim() || "Page",
				slug: slugInput?.value?.trim() || "",
				width: widthSelect?.value || "",
				"desktop-navigation-width": navWidthSelect?.value || "",
				"show-mobile-header": showMobileInput?.checked ?? true,
				"hide-desktop-navigation": hideNavInput?.checked ?? false,
				"center-vertically": centerInput?.checked ?? false,
				"head-widgets": Array.isArray(pageData?.["head-widgets"]) ? pageData["head-widgets"] : [],
				columns: [],
			};

			const colCards = card.querySelectorAll("[data-column-index]");
			for (const colCard of colCards) {
				const sizeSelect = colCard.querySelector('[data-column-field="size"]');
				const colIdx = parseInt(colCard.dataset.columnIndex, 10);
				const col = {
					size: sizeSelect?.value || "full",
					widgets: [],
				};
				if (pageData?.columns?.[colIdx]?.widgets) {
					col.widgets = [...pageData.columns[colIdx].widgets];
				}
				page.columns.push(col);
			}
			if (page.columns.length === 0) page.columns = [{ size: "full", widgets: [] }];
			cfg.pages.push(page);
		}
		return cfg;
	}

	function renderPages() {
		pageTabsEl.innerHTML = "";
		pagesContainer.innerHTML = "";
		const pages = configData?.pages || [];
		if (activeTabIndex >= pages.length && pages.length > 0) {
			activeTabIndex = Math.max(0, pages.length - 1);
		} else if (pages.length === 0) {
			activeTabIndex = 0;
		}

		for (let i = 0; i < pages.length; i++) {
			const page = pages[i];
			const isActive = i === activeTabIndex;

			// Tab button
			const tabLabel = isIncludeItem(page)
				? `Include: ${getIncludePath(page) || "..."}`
				: (page.name ?? "Page") || "New page";
			const tab = document.createElement("button");
			tab.type = "button";
			tab.className = `config-form-page-tab ${isActive ? "active" : ""}`;
			tab.dataset.pageIndex = String(i);
			tab.setAttribute("role", "tab");
			tab.setAttribute("aria-selected", isActive ? "true" : "false");
			tab.innerHTML = `
				<span class="config-form-page-tab-label">${escapeHtml(tabLabel)}</span>
				<button type="button" class="config-form-page-tab-close" data-tab-close aria-label="Remove page">&times;</button>
			`;
			pageTabsEl.appendChild(tab);

			if (isIncludeItem(page)) {
				const path = getIncludePath(page);
				const card = document.createElement("div");
				card.className = "config-form-page-card";
				card.dataset.include = "true";
				card.innerHTML = `
					<div class="config-form-page-header">
						<span class="config-form-page-title">Include: ${escapeHtml(path)}</span>
						<div class="config-form-page-actions">
							<button type="button" data-action="remove">Remove</button>
						</div>
					</div>
					<div class="config-form-field">
						<label class="form-label">Include path</label>
						<div class="form-input">
							<input type="text" data-include-path value="${escapeHtml(path)}" placeholder="path/to/file.yml">
						</div>
					</div>
				`;
				const panel = document.createElement("div");
				panel.className = `config-form-page-panel ${isActive ? "active" : ""}`;
				panel.dataset.pageIndex = String(i);
				panel.dataset.include = "true";
				panel.setAttribute("role", "tabpanel");
				panel.appendChild(card);
				pagesContainer.appendChild(panel);
				continue;
			}

			const name = page.name ?? "Page";
			const slug = page.slug ?? "";
			const width = page.width ?? "";
			const navWidth = page["desktop-navigation-width"] ?? "";
			const showMobile = page["show-mobile-header"] !== false;
			const hideNav = page["hide-desktop-navigation"] === true;
			const center = page["center-vertically"] === true;
			const headWidgets = Array.isArray(page["head-widgets"]) ? page["head-widgets"] : [];
			const columns = page.columns || [{ size: "full", widgets: [] }];

			const card = document.createElement("div");
			card.className = "config-form-page-card";

			let columnsHtml = "";
			for (let c = 0; c < columns.length; c++) {
				const col = columns[c];
				columnsHtml += `
					<div class="config-form-column-card" data-column-index="${c}">
						<div class="config-form-column-header">
							<span class="config-form-column-label">Column ${c + 1}</span>
							<div class="config-form-column-actions">
								<button type="button" data-action="remove-column">Remove</button>
							</div>
						</div>
						<div class="config-form-fields-inline margin-block-10">
							<div class="config-form-field">
								<label class="form-label">Size</label>
								<div class="form-input">
									<select data-column-field="size">
										<option value="small" ${col.size === "small" ? "selected" : ""}>Small</option>
										<option value="full" ${col.size === "full" ? "selected" : ""}>Full</option>
									</select>
								</div>
							</div>
						</div>
						<label class="config-form-widgets-label">Widgets</label>
						<div class="config-form-widgets-container" data-widgets-container></div>
						<button type="button" class="config-form-add-widget-btn" data-add-widget>Add widget</button>
					</div>
				`;
			}

			card.innerHTML = `
				<div class="config-form-page-header">
					<div class="config-form-page-header-inputs">
						<input type="text" class="config-form-page-name-input" data-page-field="name" value="${escapeHtml(name)}" placeholder="Page name">
						<input type="text" class="config-form-page-slug-input" data-page-field="slug" value="${escapeHtml(slug)}" placeholder="slug">
					</div>
				</div>
				<div class="config-form-fields margin-block-10">
					<div class="config-form-page-top-fields">
						<div class="config-form-page-top-row">
							<div class="config-form-field config-form-field-compact">
								<label class="form-label">Width</label>
								<div class="form-input">
									<select data-page-field="width">
										<option value="" ${width === "" ? "selected" : ""}>Default</option>
										<option value="slim" ${width === "slim" ? "selected" : ""}>Slim</option>
										<option value="wide" ${width === "wide" ? "selected" : ""}>Wide</option>
									</select>
								</div>
							</div>
							<div class="config-form-field config-form-field-compact">
								<label class="form-label">Nav width</label>
								<div class="form-input">
									<select data-page-field="desktop-navigation-width">
										<option value="" ${navWidth === "" ? "selected" : ""}>Default</option>
										<option value="slim" ${navWidth === "slim" ? "selected" : ""}>Slim</option>
										<option value="wide" ${navWidth === "wide" ? "selected" : ""}>Wide</option>
									</select>
								</div>
							</div>
						</div>
						<div class="config-form-page-toggles">
							<label class="config-form-toggle-item">
								<label class="toggle-switch">
									<input type="checkbox" data-page-field="show-mobile-header" ${showMobile ? "checked" : ""}>
									<span class="toggle-slider"></span>
								</label>
								<span>Mobile header</span>
							</label>
							<label class="config-form-toggle-item">
								<label class="toggle-switch">
									<input type="checkbox" data-page-field="hide-desktop-navigation" ${hideNav ? "checked" : ""}>
									<span class="toggle-slider"></span>
								</label>
								<span>Hide nav</span>
							</label>
							<label class="config-form-toggle-item">
								<label class="toggle-switch">
									<input type="checkbox" data-page-field="center-vertically" ${center ? "checked" : ""}>
									<span class="toggle-slider"></span>
								</label>
								<span>Center</span>
							</label>
						</div>
					</div>
					<details class="details margin-block-10">
						<summary class="summary size-h6">Head widgets</summary>
						<div class="margin-block-10">
							<label class="config-form-widgets-label">Widgets</label>
							<div class="config-form-head-widgets-container" data-head-widgets-container></div>
							<button type="button" class="config-form-add-widget-btn" data-add-head-widget>Add widget</button>
						</div>
					</details>
					<div class="margin-block-10">
						<span class="config-form-widgets-label">Columns</span>
						<div class="config-form-columns margin-block-10">
							${columnsHtml}
						</div>
						<button type="button" class="config-form-add-column-btn" data-add-column>Add column</button>
					</div>
				</div>
			`;
			const panel = document.createElement("div");
			panel.className = `config-form-page-panel ${isActive ? "active" : ""}`;
			panel.dataset.pageIndex = String(i);
			panel.setAttribute("role", "tabpanel");
			panel.appendChild(card);
			pagesContainer.appendChild(panel);

			// Populate head widget cards
			const headWidgetsContainer = card.querySelector("[data-head-widgets-container]");
			if (headWidgetsContainer) {
				headWidgetsContainer.innerHTML = "";
				for (let hwi = 0; hwi < headWidgets.length; hwi++) {
					const w = headWidgets[hwi] || { type: "clock" };
					const wCard = renderWidgetCard(
						w,
						hwi,
						(newData, shouldRerender) => {
							configData.pages[i]["head-widgets"] = configData.pages[i]["head-widgets"] || [];
							configData.pages[i]["head-widgets"][hwi] = newData;
							if (shouldRerender) configToForm();
						},
						() => {
							configData.pages[i]["head-widgets"].splice(hwi, 1);
							configToForm();
						},
						() => {
							if (hwi === 0) return;
							const hw = configData.pages[i]["head-widgets"];
							[hw[hwi - 1], hw[hwi]] = [hw[hwi], hw[hwi - 1]];
							configToForm();
						},
						() => {
							const hw = configData.pages[i]["head-widgets"];
							if (hwi >= hw.length - 1) return;
							[hw[hwi], hw[hwi + 1]] = [hw[hwi + 1], hw[hwi]];
							configToForm();
						},
						hwi > 0,
						hwi < headWidgets.length - 1
					);
					headWidgetsContainer.appendChild(wCard);
				}
			}

			// Populate widget cards for each column
			const colCards = card.querySelectorAll("[data-column-index]");
			for (const colCard of colCards) {
				const colIdx = parseInt(colCard.dataset.columnIndex, 10);
				const page = configData.pages[i];
				if (isIncludeItem(page)) continue;
				const col = page.columns[colIdx] || { size: "full", widgets: [] };
				const widgets = Array.isArray(col.widgets) ? col.widgets : [];
				const widgetsContainer = colCard.querySelector("[data-widgets-container]");
				if (!widgetsContainer) continue;
				widgetsContainer.innerHTML = "";
				for (let wi = 0; wi < widgets.length; wi++) {
					const w = widgets[wi] || { type: "clock" };
					const wCard = renderWidgetCard(
						w,
						wi,
						(newData, shouldRerender) => {
							configData.pages[i].columns[colIdx].widgets[wi] = newData;
							if (shouldRerender) configToForm();
						},
						() => {
							configData.pages[i].columns[colIdx].widgets.splice(wi, 1);
							configToForm();
						},
						() => {
							if (wi === 0) return;
							const wg = configData.pages[i].columns[colIdx].widgets;
							[wg[wi - 1], wg[wi]] = [wg[wi], wg[wi - 1]];
							configToForm();
						},
						() => {
							const wg = configData.pages[i].columns[colIdx].widgets;
							if (wi >= wg.length - 1) return;
							[wg[wi], wg[wi + 1]] = [wg[wi + 1], wg[wi]];
							configToForm();
						},
						wi > 0,
						wi < widgets.length - 1
					);
					widgetsContainer.appendChild(wCard);
				}
			}
		}

		// Tab click to switch page
		pageTabsEl.querySelectorAll(".config-form-page-tab").forEach((tab) => {
			tab.addEventListener("click", (e) => {
				if (e.target.closest("[data-tab-close]")) return;
				const idx = parseInt(tab.dataset.pageIndex, 10);
				activeTabIndex = idx;
				configToForm();
			});
		});

		// Tab close to remove page
		pageTabsEl.querySelectorAll("[data-tab-close]").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const tab = btn.closest(".config-form-page-tab");
				const idx = parseInt(tab.dataset.pageIndex, 10);
				const label = tab.querySelector(".config-form-page-tab-label")?.textContent || "this page";
				if (!confirm(`Are you sure you want to delete "${label}"?`)) return;
				configData.pages.splice(idx, 1);
				if (activeTabIndex >= configData.pages.length && configData.pages.length > 0) {
					activeTabIndex = configData.pages.length - 1;
				} else if (activeTabIndex >= idx && activeTabIndex > 0) {
					activeTabIndex--;
				}
				configToForm();
			});
		});

		// Include page remove button (in header)
		pagesContainer.querySelectorAll(".config-form-page-header [data-action='remove']").forEach((btn) => {
			btn.addEventListener("click", () => {
				const panel = btn.closest("[data-page-index]");
				const idx = parseInt(panel.dataset.pageIndex, 10);
				const pathInput = panel?.querySelector("[data-include-path]");
				const label = pathInput?.value?.trim() ? `Include: ${pathInput.value.trim()}` : "this include";
				if (!confirm(`Are you sure you want to delete "${label}"?`)) return;
				configData.pages.splice(idx, 1);
				if (activeTabIndex >= configData.pages.length && configData.pages.length > 0) {
					activeTabIndex = configData.pages.length - 1;
				} else if (activeTabIndex >= idx && activeTabIndex > 0) {
					activeTabIndex--;
				}
				configToForm();
			});
		});

		pagesContainer.querySelectorAll("[data-include-path]").forEach((input) => {
			input.addEventListener("change", () => {
				const panel = input.closest("[data-page-index]");
				const idx = parseInt(panel?.dataset.pageIndex ?? "-1", 10);
				const key = configData.pages[idx]?.["$include"] ? "$include" : "!include";
				configData.pages[idx] = { [key]: input.value.trim() };
				// Update tab label
				const tab = pageTabsEl.querySelector(`.config-form-page-tab[data-page-index="${idx}"]`);
				if (tab) {
					const label = tab.querySelector(".config-form-page-tab-label");
					if (label) label.textContent = `Include: ${input.value?.trim() || "..."}`;
				}
			});
		});

		pagesContainer.querySelectorAll("[data-add-column]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const card = btn.closest("[data-page-index]");
				const idx = parseInt(card.dataset.pageIndex, 10);
				if (!configData.pages[idx] || isIncludeItem(configData.pages[idx])) return;
				if (!configData.pages[idx].columns) configData.pages[idx].columns = [];
				configData.pages[idx].columns.push({ size: "full", widgets: [] });
				configToForm();
			});
		});

		pagesContainer.querySelectorAll("[data-action='remove-column']").forEach((btn) => {
			btn.addEventListener("click", () => {
				const colCard = btn.closest("[data-column-index]");
				const pageCard = colCard.closest("[data-page-index]");
				const pageIdx = parseInt(pageCard.dataset.pageIndex, 10);
				const colIdx = parseInt(colCard.dataset.columnIndex, 10);
				const page = configData.pages[pageIdx];
				if (isIncludeItem(page)) return;
				if (page.columns.length <= 1) return;
				page.columns.splice(colIdx, 1);
				configToForm();
			});
		});

		pagesContainer.querySelectorAll("[data-add-head-widget]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const pageCard = btn.closest("[data-page-index]");
				const pageIdx = parseInt(pageCard.dataset.pageIndex, 10);
				const page = configData.pages[pageIdx];
				if (isIncludeItem(page)) return;
				if (!page["head-widgets"]) page["head-widgets"] = [];
				page["head-widgets"].push({ type: "clock" });
				configToForm();
			});
		});

		pagesContainer.querySelectorAll("[data-add-widget]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const colCard = btn.closest("[data-column-index]");
				const pageCard = colCard.closest("[data-page-index]");
				const pageIdx = parseInt(pageCard.dataset.pageIndex, 10);
				const colIdx = parseInt(colCard.dataset.columnIndex, 10);
				const page = configData.pages[pageIdx];
				if (isIncludeItem(page)) return;
				if (!page.columns[colIdx]) page.columns[colIdx] = { size: "full", widgets: [] };
				page.columns[colIdx].widgets = page.columns[colIdx].widgets || [];
				page.columns[colIdx].widgets.push({ type: "clock" });
				configToForm();
			});
		});

		pagesContainer.querySelectorAll('[data-page-field="name"]').forEach((input) => {
			input.addEventListener("blur", () => {
				const panel = input.closest("[data-page-index]");
				const slugInput = panel?.querySelector('[data-page-field="slug"]');
				if (slugInput && !slugInput.value) {
					slugInput.value = titleToSlug(input.value);
				}
				// Update tab label
				const idx = parseInt(panel?.dataset.pageIndex ?? "-1", 10);
				const tab = pageTabsEl.querySelector(`.config-form-page-tab[data-page-index="${idx}"]`);
				if (tab) {
					const label = tab.querySelector(".config-form-page-tab-label");
					if (label) label.textContent = input.value?.trim() || "New page";
				}
			});
		});
	}

	function escapeHtml(s) {
		if (s == null) return "";
		const div = document.createElement("div");
		div.textContent = String(s);
		return div.innerHTML;
	}

	function switchToFormMode() {
		formView.style.display = "";
		yamlView.style.display = "none";
		modeFormBtn.classList.add("active");
		modeFormBtn.setAttribute("aria-pressed", "true");
		modeYamlBtn.classList.remove("active");
		modeYamlBtn.setAttribute("aria-pressed", "false");
		configToForm();
	}

	function switchToYamlMode() {
		formView.style.display = "none";
		yamlView.style.display = "";
		modeYamlBtn.classList.add("active");
		modeYamlBtn.setAttribute("aria-pressed", "true");
		modeFormBtn.classList.remove("active");
		modeFormBtn.setAttribute("aria-pressed", "false");
		const cfg = formToConfig();
		if (cfg) {
			rawYaml = yamlDump(cfg, { lineWidth: -1 });
		}
		yamlTextarea.value = rawYaml;
	}

	function updateRawFromForm() {
		const cfg = formToConfig();
		if (cfg) rawYaml = yamlDump(cfg, { lineWidth: -1 });
	}

	const load = async () => {
		setStatus("Loading…");
		try {
			const res = await fetch(`${baseURL}/api/config`, { method: "GET", headers: defaultHeaders });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			rawYaml = await res.text();
			configData = yamlLoad(rawYaml);
			if (!configData || typeof configData !== "object") configData = {};
			if (!configData.server) configData.server = {};
			if (configData.server.port === undefined || configData.server.port === null) {
				configData.server.port = 8080;
			}

			const pages = configData.pages || [];
			const hasIncludes = pages.some(isIncludeItem);
			if (hasIncludes && includesBanner) {
				includesBanner.style.display = "";
			} else if (includesBanner) {
				includesBanner.style.display = "none";
			}

			if (formView.style.display !== "none") {
				configToForm();
			} else {
				yamlTextarea.value = rawYaml;
			}
			setStatus("Loaded");
		} catch (e) {
			setStatus(`Load failed: ${e.message}`, true);
		}
	};

	const save = async () => {
		setStatus("Saving…");
		try {
			let body;
			if (formView.style.display !== "none") {
				updateRawFromForm();
				const cfg = formToConfig();
				if (!cfg.pages || cfg.pages.length === 0) {
					setStatus("At least one page is required", true);
					return;
				}
				body = yamlDump(cfg, { lineWidth: -1 });
			} else {
				body = yamlTextarea.value;
			}

			const res = await fetch(`${baseURL}/api/config`, {
				method: "POST",
				headers: { "Content-Type": "text/plain; charset=utf-8", ...defaultHeaders },
				body,
			});
			if (!res.ok) {
				const msg = await res.text();
				throw new Error(msg || `${res.status} ${res.statusText}`);
			}
			setStatus("Saved. Reloading…");
			let sawFailure = false;
			for (let i = 0; i < 20; i++) {
				try {
					const r = await fetch(`${baseURL}/api/healthz?t=${Date.now()}`, { cache: "no-store" });
					if (r.ok) {
						if (sawFailure || i >= 2) {
							location.reload();
							return;
						}
					} else sawFailure = true;
				} catch (_) {
					sawFailure = true;
				}
				await new Promise((r) => setTimeout(r, 300));
			}
			location.reload();
		} catch (e) {
			setStatus(`Save failed: ${e.message}`, true);
		}
	};

	modeFormBtn.addEventListener("click", switchToFormMode);
	modeYamlBtn.addEventListener("click", switchToYamlMode);
	loadBtn.addEventListener("click", load);
	saveBtn.addEventListener("click", save);

	addPageBtn.addEventListener("click", () => {
		if (!configData) configData = {};
		if (!configData.pages) configData.pages = [];
		configData.pages.push({
			name: "New page",
			slug: "",
			width: "",
			"desktop-navigation-width": "",
			"show-mobile-header": true,
			"hide-desktop-navigation": false,
			"center-vertically": false,
			"head-widgets": [],
			columns: [{ size: "full", widgets: [] }],
		});
		activeTabIndex = configData.pages.length - 1;
		configToForm();
	});

	load();
}

export default function (element) {
	setupConfigFormEditor(element);
}
