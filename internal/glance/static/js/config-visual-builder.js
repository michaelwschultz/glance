import { load as yamlLoad, dump as yamlDump } from "../vendor/yaml.mjs";
import { getWidgetSchema, getAllWidgetTypesForSelector } from "./widget-schemas.js";
import { renderWidgetForm } from "./widget-form-renderer.js"; // We reuse your existing renderer!

const GLOBAL_SCHEMAS = {
    server: {
      fields: [
        { key: "host", type: "string", label: "Host" },
        { key: "port", type: "number", label: "Port", default: 8080 },
        { key: "proxied", type: "boolean", label: "Proxied", default: false },
        { key: "assets-path", type: "string", label: "Assets Path" },
        { key: "base-url", type: "string", label: "Base URL" }
      ]
    },
    theme: {
      fields: [
        { key: "custom-css-file", type: "string", label: "Custom CSS File" },
        { key: "disable-picker", type: "boolean", label: "Disable Theme Picker", default: false }
      ]
    },
    branding: {
      fields: [
        { key: "app-name", type: "string", label: "App Name" },
        { key: "hide-footer", type: "boolean", label: "Hide Footer", default: false },
        { key: "logo-text", type: "string", label: "Logo Text" },
        { key: "logo-url", type: "string", label: "Logo URL" },
        { key: "favicon-url", type: "string", label: "Favicon URL" },
        { key: "app-icon-url", type: "string", label: "App Icon URL" },
        { key: "app-background-color", type: "string", label: "App Background Color" }
      ]
    },
    page: {
      fields: [
        { key: "name", type: "string", label: "Page Name", required: true },
        { key: "slug", type: "string", label: "Slug" },
        { key: "width", type: "select", label: "Width", options: ["", "slim", "wide"] },
        { key: "desktop-navigation-width", type: "select", label: "Nav Width", options: ["", "slim", "wide"] },
        { key: "show-mobile-header", type: "boolean", label: "Show Mobile Header", default: true },
        { key: "hide-desktop-navigation", type: "boolean", label: "Hide Desktop Nav", default: false },
        { key: "center-vertically", type: "boolean", label: "Center Vertically", default: false }
      ]
    },
    column: {
      fields: [
        { key: "size", type: "select", label: "Size", options: ["full", "small"], default: "full" }
      ]
    }
  };

export default function setupVisualBuilder(root) {
	const baseURL = (typeof pageData !== "undefined" && pageData.baseURL) ? pageData.baseURL : root.dataset.baseUrl || "";
	
	let configData = null;
	
	// THE SELECTION STATE: This tracks what is currently active in the right sidebar
	let selection = { type: 'global', target: 'server' }; // e.g., {type: 'widget', pageIdx: 0, colIdx: 0, widgetIdx: 1}
	let activePageIdx = 0;

	// DOM Elements
	const globalNavList = root.querySelector("#global-nav-list");
	const widgetLibrary = root.querySelector("#widget-library");
	const canvasContainer = root.querySelector("#canvas-container");
	const canvasPageTabs = root.querySelector("#canvas-page-tabs");
	const addPageBtn = root.querySelector("#add-page-btn");
	const loadBtn = root.querySelector("[data-load]");
	const saveBtn = root.querySelector("[data-save]");
	const statusEl = root.querySelector(".builder-toolbar .status");
	const inspectorContent = root.querySelector("#inspector-content");
	const inspectorTitle = root.querySelector("#inspector-title");
	const removeWidgetBtn = root.querySelector("[data-remove-widget]");
	const removeColumnBtn = root.querySelector("[data-remove-column]");
	const removePageBtn = root.querySelector("[data-remove-page]");

	const defaultHeaders = { "X-Requested-With": "XMLHttpRequest" };

	function setStatus(text, isError = false) {
		if (!statusEl) return;
		statusEl.textContent = text;
		statusEl.classList.toggle("color-negative", isError);
	}

	async function doLoad() {
		setStatus("Loading…");
		try {
			const res = await fetch(`${baseURL}/api/config`, { method: "GET", headers: defaultHeaders });
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const rawYaml = await res.text();
			configData = yamlLoad(rawYaml) || {};
			ensurePageStructure();
			renderLeftSidebar();
			renderCanvas();
			renderInspector();
			setStatus("Loaded");
		} catch (e) {
			console.error("Failed to load config", e);
			setStatus(`Load failed: ${e.message}`, true);
		}
	}

	async function doSave() {
		if (!configData) return;
		setStatus("Saving…");
		try {
			const yamlText = yamlDump(configData, { lineWidth: -1 });
			const res = await fetch(`${baseURL}/api/config`, {
				method: "POST",
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					...defaultHeaders,
				},
				body: yamlText,
			});
			if (!res.ok) {
				const msg = await res.text();
				throw new Error(msg || `${res.status} ${res.statusText}`);
			}
			setStatus("Saved. Reloading…");
			for (let i = 0; i < 20; i++) {
				try {
					const r = await fetch(`${baseURL}/api/healthz?t=${Date.now()}`, { cache: "no-store" });
					if (r.ok && i >= 2) {
						location.reload();
						return;
					}
				} catch (_) {}
				await new Promise((r) => setTimeout(r, 300));
			}
			location.reload();
		} catch (e) {
			setStatus(`Save failed: ${e.message}`, true);
		}
	}

	// --- 1. INITIALIZATION & DATA FETCHING ---
	function ensurePageStructure() {
		if (!configData.pages) configData.pages = [];
		configData.pages.forEach((p) => {
			if (!p.columns || p.columns.length === 0) {
				p.columns = [{ size: "full", widgets: [] }];
			}
			p.columns.forEach((col) => {
				if (!col.widgets) col.widgets = [];
			});
		});
	}

	function wireToolbarButtons() {
		if (addPageBtn) {
			addPageBtn.addEventListener("click", () => {
				configData.pages.push({
					name: "New Page",
					slug: "",
					columns: [{ size: "full", widgets: [] }]
				});
				activePageIdx = configData.pages.length - 1;
				selection = { type: "page", pageIdx: activePageIdx };
				renderLeftSidebar();
				renderCanvas();
				renderInspector();
			});
		}
	}

	function init() {
		wireToolbarButtons();
		if (loadBtn) loadBtn.addEventListener("click", () => doLoad());
		if (saveBtn) saveBtn.addEventListener("click", () => doSave());
		if (removeWidgetBtn) removeWidgetBtn.addEventListener("click", removeSelectedWidget);
		if (removeColumnBtn) removeColumnBtn.addEventListener("click", removeSelectedColumn);
		if (removePageBtn) removePageBtn.addEventListener("click", removeSelectedPage);
		doLoad();
	}

	// --- 2. LEFT SIDEBAR (Navigation & Library) ---
	function renderLeftSidebar() {
		// Global Settings nav: update active state and attach click handlers
		if (globalNavList) {
			globalNavList.querySelectorAll('li').forEach(li => {
				li.replaceWith(li.cloneNode(true));
			});
			globalNavList.querySelectorAll('li').forEach(li => {
				const target = li.dataset.target;
				li.classList.toggle('active', selection.type === 'global' && selection.target === target);
				li.addEventListener('click', () => {
					selection = { type: 'global', target: li.dataset.target };
					renderLeftSidebar();
					renderInspector();
				});
			});
		}

		// Render Widget Library (Click to add to currently selected column)
		const types = getAllWidgetTypesForSelector();
        widgetLibrary.innerHTML = types.map(t => `<div class="library-item" data-type="${t}">${t}</div>`).join('');

        widgetLibrary.querySelectorAll(".library-item").forEach((item) => {
            item.addEventListener("click", (e) => {
                const type = e.currentTarget.dataset.type;
                const page = configData.pages[activePageIdx];
                if (!page || !page.columns || page.columns.length === 0) return;
                let targetColIdx = 0;
                if (selection.type === "column" && selection.pageIdx === activePageIdx) {
                    targetColIdx = selection.colIdx;
                } else if (selection.type === "widget" && selection.pageIdx === activePageIdx) {
                    targetColIdx = selection.colIdx;
                }
                const col = page.columns[targetColIdx];
                if (!col) return;
                if (!col.widgets) col.widgets = [];
                const newWidgetIdx = col.widgets.length;
                col.widgets.push({ type });
                selection = { type: "widget", pageIdx: activePageIdx, colIdx: targetColIdx, widgetIdx: newWidgetIdx };
                renderCanvas();
                renderInspector();
            });
        });
	}

	const MAX_COLUMNS_PER_PAGE = 3;

	function renderCanvasPageTabs() {
		if (!canvasPageTabs) return;
		canvasPageTabs.innerHTML = "";
		const pages = configData.pages || [];
		pages.forEach((p, i) => {
			const tab = document.createElement("button");
			tab.type = "button";
			tab.className = `canvas-page-tab${activePageIdx === i ? " active" : ""}`;
			tab.dataset.index = String(i);
			tab.textContent = p.name || "Untitled Page";
			tab.addEventListener("click", (e) => {
				if (tab.querySelector("input")) return;
				const idx = parseInt(e.currentTarget.dataset.index, 10);
				if (Number.isNaN(idx)) return;
				activePageIdx = idx;
				selection = { type: "page", pageIdx: activePageIdx };
				renderLeftSidebar();
				renderCanvas();
				renderInspector();
			});
			tab.addEventListener("dblclick", (e) => {
				e.preventDefault();
				const idx = parseInt(tab.dataset.index, 10);
				const page = configData.pages[idx];
				if (!page) return;
				const input = document.createElement("input");
				input.type = "text";
				input.value = page.name || "";
				input.className = "canvas-page-tab-input";
				tab.textContent = "";
				tab.appendChild(input);
				input.focus();
				input.select();
				const commit = () => {
					const name = input.value.trim() || "Untitled Page";
					page.name = name;
					tab.textContent = name;
					input.remove();
					renderCanvas();
				};
				input.addEventListener("blur", commit);
				input.addEventListener("keydown", (k) => {
					if (k.key === "Enter") {
						k.preventDefault();
						commit();
					}
					if (k.key === "Escape") {
						tab.textContent = page.name || "Untitled Page";
						input.remove();
					}
				});
			});
			canvasPageTabs.appendChild(tab);
		});
	}

	// --- 3. CENTER CANVAS (Abstract Layout) ---
	function renderCanvas() {
		renderCanvasPageTabs();
		canvasContainer.innerHTML = "";
		if (!configData.pages[activePageIdx]) {
			const empty = document.createElement("p");
			empty.className = "color-subdue";
			empty.textContent = configData.pages.length === 0 ? "No pages yet. Click \"Add page\" to create one." : "Select a page above.";
			canvasContainer.appendChild(empty);
			return;
		}
		const page = configData.pages[activePageIdx];
		const columns = page.columns || [];

		columns.forEach((col, cIdx) => {
			const isColumnSelected = selection.type === "column" && selection.pageIdx === activePageIdx && selection.colIdx === cIdx;
			const colEl = document.createElement("div");
			colEl.className = `canvas-column size-${col.size || "full"}${isColumnSelected ? " selected" : ""}`;
			colEl.addEventListener("click", (e) => {
				if (e.target === colEl) {
					selection = { type: "column", pageIdx: activePageIdx, colIdx: cIdx };
					renderCanvas();
					renderInspector();
				}
			});

			const widgets = col.widgets || [];
			widgets.forEach((widget, wIdx) => {
				const isSelected = selection.type === "widget" && selection.pageIdx === activePageIdx && selection.colIdx === cIdx && selection.widgetIdx === wIdx;
				const block = document.createElement('div');
				block.className = `canvas-widget-block ${isSelected ? 'selected' : ''}`;
				block.innerHTML = `<strong>${widget.type}</strong> <span>${widget.title || ''}</span>`;
				
				// Click block to edit widget settings
				block.addEventListener('click', (e) => {
					e.stopPropagation();
					selection = { type: 'widget', pageIdx: activePageIdx, colIdx: cIdx, widgetIdx: wIdx };
					renderCanvas(); // Update active state styling
					renderInspector();
				});

				colEl.appendChild(block);
			});

			canvasContainer.appendChild(colEl);
		});

		if (columns.length < MAX_COLUMNS_PER_PAGE) {
			const addSlot = document.createElement("button");
			addSlot.type = "button";
			addSlot.className = "canvas-add-column-slot";
			addSlot.textContent = "Add column";
			addSlot.addEventListener("click", () => {
				if (!page.columns) page.columns = [];
				page.columns.push({ size: "full", widgets: [] });
				selection = { type: "column", pageIdx: activePageIdx, colIdx: page.columns.length - 1 };
				renderCanvas();
				renderInspector();
			});
			canvasContainer.appendChild(addSlot);
		}
	}

	function removeSelectedWidget() {
		if (selection.type !== "widget") return;
		const { pageIdx, colIdx, widgetIdx } = selection;
		const col = configData.pages[pageIdx].columns[colIdx];
		if (!col.widgets || col.widgets.length <= widgetIdx) return;
		col.widgets.splice(widgetIdx, 1);
		selection = { type: "column", pageIdx, colIdx };
		renderCanvas();
		renderInspector();
	}

	function removeSelectedColumn() {
		if (selection.type !== "column") return;
		const { pageIdx, colIdx } = selection;
		const page = configData.pages[pageIdx];
		if (!page.columns || page.columns.length <= 1) return;
		page.columns.splice(colIdx, 1);
		const newColIdx = Math.min(colIdx, page.columns.length - 1);
		selection = newColIdx >= 0 ? { type: "column", pageIdx, colIdx: newColIdx } : { type: "page", pageIdx };
		renderCanvas();
		renderInspector();
	}

	function removeSelectedPage() {
		if (selection.type !== "page") return;
		if (!configData.pages || configData.pages.length <= 1) return;
		const pageIdx = selection.pageIdx;
		configData.pages.splice(pageIdx, 1);
		activePageIdx = Math.min(pageIdx, configData.pages.length - 1);
		selection = { type: "page", pageIdx: activePageIdx };
		renderLeftSidebar();
		renderCanvas();
		renderInspector();
	}

	// --- 4. RIGHT SIDEBAR (The Inspector) ---
	function renderInspector() {
		inspectorContent.innerHTML = "";
		if (removeWidgetBtn) {
			removeWidgetBtn.classList.toggle("is-hidden", selection.type !== "widget");
		}
		if (removeColumnBtn) {
			const page = configData.pages?.[selection.pageIdx];
			const canRemoveColumn = selection.type === "column" && page?.columns?.length > 1;
			removeColumnBtn.classList.toggle("is-hidden", !canRemoveColumn);
		}
		if (removePageBtn) {
			const canRemovePage = selection.type === "page" && (configData.pages?.length ?? 0) > 1;
			removePageBtn.classList.toggle("is-hidden", !canRemovePage);
		}

        if (selection.type === 'global') {
            const schema = GLOBAL_SCHEMAS[selection.target];
            const label = selection.target.charAt(0).toUpperCase() + selection.target.slice(1);
            inspectorTitle.textContent = label;
            if (!schema) {
                inspectorContent.innerHTML = `<p>No schema for "${selection.target}".</p>`;
                return;
            }
            if (!configData[selection.target]) configData[selection.target] = {};
            const data = configData[selection.target];
            const formEl = renderWidgetForm(schema, data, (newData) => {
                configData[selection.target] = newData;
            });
            inspectorContent.appendChild(formEl);
        }
        else if (selection.type === "column") {
            const { pageIdx, colIdx } = selection;
            const schema = GLOBAL_SCHEMAS.column;
            const col = configData.pages[pageIdx].columns[colIdx];
            inspectorTitle.textContent = "Column Settings";
            const formEl = renderWidgetForm(schema, col, (newData) => {
                configData.pages[pageIdx].columns[colIdx] = { ...col, ...newData };
                renderCanvas();
            });
            inspectorContent.appendChild(formEl);
        }
        else if (selection.type === 'page') {
            inspectorTitle.textContent = 'Page Settings';
            const schema = GLOBAL_SCHEMAS.page;
            const data = configData.pages[selection.pageIdx];

            const formEl = renderWidgetForm(schema, data, (newData) => {
                configData.pages[selection.pageIdx] = newData;
                renderLeftSidebar();
            });
            inspectorContent.appendChild(formEl);
        }
		else if (selection.type === 'widget') {
			const { pageIdx, colIdx, widgetIdx } = selection;
			const widgetData = configData.pages[pageIdx].columns[colIdx].widgets[widgetIdx];
			inspectorTitle.textContent = `Widget: ${widgetData.type}`;

			const schema = getWidgetSchema(widgetData.type);
			
			if (schema) {
				const formEl = renderWidgetForm(schema, widgetData, (newData) => {
					// Update the state
					configData.pages[pageIdx].columns[colIdx].widgets[widgetIdx] = { ...widgetData, ...newData };
					// Re-render canvas in case title/type changed
					renderCanvas();
				});
				inspectorContent.appendChild(formEl);
			} else {
				inspectorContent.innerHTML = `<p>No schema found for ${widgetData.type}. Use YAML editor.</p>`;
			}
		}
	}

	// Boot up
	init();
}