import { load as yamlLoad, dump as yamlDump } from "../vendor/yaml.mjs";
import { getWidgetSchema, getAllWidgetTypesForSelector, BASE_FIELD_KEYS } from "./widget-schemas.js";

function escapeHtml(s) {
	if (s == null) return "";
	const div = document.createElement("div");
	div.textContent = String(s);
	return div.innerHTML;
}

function getValue(data, key) {
	if (data == null) return undefined;
	return data[key];
}

function setValue(data, key, value) {
	const next = { ...data };
	next[key] = value;
	return next;
}

function renderStringField(field, value, onChange) {
	const v = value !== undefined && value !== null ? String(value) : "";
	const ph = field.placeholder || "";
	const div = document.createElement("div");
	div.className = "config-form-field";
	div.innerHTML = `
		<label class="form-label">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
		<div class="form-input">
			<input type="text" data-field-key="${escapeHtml(field.key)}" value="${escapeHtml(v)}" placeholder="${escapeHtml(ph)}">
		</div>
	`;
	const input = div.querySelector("input");
	input.addEventListener("input", () => onChange(field.key, input.value.trim()));
	input.addEventListener("change", () => onChange(field.key, input.value.trim()));
	return div;
}

function renderTextareaField(field, value, onChange) {
	const v = value !== undefined && value !== null ? String(value) : "";
	const ph = field.placeholder || "";
	const div = document.createElement("div");
	div.className = "config-form-field";
	div.innerHTML = `
		<label class="form-label">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
		<div class="form-input">
			<textarea data-field-key="${escapeHtml(field.key)}" placeholder="${escapeHtml(ph)}" rows="6">${escapeHtml(v)}</textarea>
		</div>
	`;
	const textarea = div.querySelector("textarea");
	textarea.addEventListener("input", () => onChange(field.key, textarea.value));
	textarea.addEventListener("change", () => onChange(field.key, textarea.value));
	return div;
}

function renderNumberField(field, value, onChange) {
	const v = value !== undefined && value !== null ? Number(value) : "";
	const ph = field.placeholder || "";
	const div = document.createElement("div");
	div.className = "config-form-field";
	div.innerHTML = `
		<label class="form-label">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
		<div class="form-input">
			<input type="number" data-field-key="${escapeHtml(field.key)}" value="${escapeHtml(v)}" placeholder="${escapeHtml(ph)}">
		</div>
	`;
	const input = div.querySelector("input");
	input.addEventListener("input", () => {
		const n = input.value === "" ? undefined : parseInt(input.value, 10);
		onChange(field.key, isNaN(n) ? undefined : n);
	});
	return div;
}

function renderBooleanField(field, value, onChange) {
	const checked = !!value;
	const div = document.createElement("div");
	div.className = "config-form-field config-form-field-toggle";
	div.innerHTML = `
		<label class="form-label">${escapeHtml(field.label)}</label>
		<label class="toggle-switch">
			<input type="checkbox" data-field-key="${escapeHtml(field.key)}" ${checked ? "checked" : ""}>
			<span class="toggle-slider"></span>
		</label>
	`;
	const input = div.querySelector("input");
	input.addEventListener("change", () => onChange(field.key, input.checked));
	return div;
}

function renderSelectField(field, value, onChange) {
	const options = field.options || [];
	const opts = options.map((o) => {
		const val = typeof o === "object" ? o.value : o;
		const label = typeof o === "object" ? (o.label ?? o.value) : o;
		return { value: val, label };
	});
	const v = value !== undefined && value !== null ? String(value) : (field.default ?? "");
	const div = document.createElement("div");
	div.className = "config-form-field";
	let optionsHtml = opts.map((o) => `<option value="${escapeHtml(o.value)}" ${o.value === v ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("");
	if (!opts.some((o) => o.value === v) && v) {
		optionsHtml = `<option value="${escapeHtml(v)}" selected>${escapeHtml(v)}</option>` + optionsHtml;
	}
	div.innerHTML = `
		<label class="form-label">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
		<div class="form-input">
			<select data-field-key="${escapeHtml(field.key)}">${optionsHtml}</select>
		</div>
	`;
	const sel = div.querySelector("select");
	sel.addEventListener("change", () => onChange(field.key, sel.value));
	return div;
}

function renderArrayField(field, value, onChange, renderItemFields) {
	const isStringArray = field.itemType === "string";
	let items = Array.isArray(value) ? [...value] : [];
	// Normalize: string arrays must contain strings
	if (isStringArray) {
		items = items.map((x) => (typeof x === "string" ? x : x?.value ?? String(x ?? "")));
	}
	const container = document.createElement("div");
	container.className = "config-form-field config-form-array-field";
	container.dataset.fieldKey = field.key;

	const label = document.createElement("label");
	label.className = "form-label";
	label.textContent = field.label + (field.required ? " *" : "");
	container.appendChild(label);

	const itemsContainer = document.createElement("div");
	itemsContainer.className = "config-form-array-items";
	container.appendChild(itemsContainer);

	const addBtn = document.createElement("button");
	addBtn.type = "button";
	addBtn.className = "config-form-add-item-btn";
	addBtn.textContent = "Add";
	container.appendChild(addBtn);

	function renderItem(index, itemData) {
		const itemEl = document.createElement("div");
		itemEl.className = "config-form-array-item";
		itemEl.dataset.index = String(index);

		const header = document.createElement("div");
		header.className = "config-form-array-item-header";
		const removeBtn = document.createElement("button");
		removeBtn.type = "button";
		removeBtn.className = "config-form-remove-item-btn";
		removeBtn.textContent = "Remove";
		removeBtn.addEventListener("click", () => {
			const next = items.filter((_, i) => i !== index);
			items = next;
			onChange(field.key, next);
			syncItems();
		});
		header.appendChild(removeBtn);
		itemEl.appendChild(header);

		if (isStringArray) {
			const strVal = typeof itemData === "string" ? itemData : "";
			const wrap = document.createElement("div");
			wrap.className = "form-input";
			const input = document.createElement("input");
			input.type = "text";
			input.value = strVal;
			input.placeholder = field.itemPlaceholder || "";
			input.addEventListener("input", () => {
				const next = [...items];
				next[index] = input.value.trim();
				items = next;
				onChange(field.key, next);
			});
			wrap.appendChild(input);
			itemEl.appendChild(wrap);
		} else {
			const itemFields = renderItemFields(field.itemSchema, itemData || {}, (key, val) => {
				const next = [...items];
				next[index] = { ...(next[index] || {}), [key]: val };
				items = next;
				onChange(field.key, next);
			});
			itemEl.appendChild(itemFields);
		}

		return itemEl;
	}

	function syncItems() {
		itemsContainer.innerHTML = "";
		items.forEach((item, i) => {
			itemsContainer.appendChild(renderItem(i, item));
		});
	}

	addBtn.addEventListener("click", () => {
		const next = isStringArray ? [...items, ""] : [...items, {}];
		items = next;
		onChange(field.key, next);
		syncItems();
	});

	syncItems();
	return container;
}

function renderArrayItems(schema, data, onChange) {
	const wrapper = document.createElement("div");
	wrapper.className = "config-form-array-item-fields";
	if (!schema || !schema.fields) return wrapper;
	for (const f of schema.fields) {
		const val = getValue(data, f.key);
		wrapper.appendChild(renderField(f, val, (k, v) => onChange(k, v)));
	}
	return wrapper;
}

function renderWidgetsField(field, value, onChange, parentData) {
	let widgets = Array.isArray(value) ? [...value] : [];
	const excludedTypes = field.excludedTypes || [];
	const container = document.createElement("div");
	container.className = "config-form-field config-form-widgets-field";

	const label = document.createElement("label");
	label.className = "config-form-widgets-label";
	label.textContent = field.label || "Widgets";
	container.appendChild(label);

	const widgetsContainer = document.createElement("div");
	widgetsContainer.className = "config-form-widgets-container";
	container.appendChild(widgetsContainer);

	const addBtn = document.createElement("button");
	addBtn.type = "button";
	addBtn.className = "config-form-add-widget-btn";
	addBtn.textContent = "Add widget";
	container.appendChild(addBtn);

	function renderAllCards() {
		widgetsContainer.innerHTML = "";
		for (let wi = 0; wi < widgets.length; wi++) {
			const w = widgets[wi] || { type: "clock" };
			const wCard = renderWidgetCard(
				w,
				wi,
				(newData, shouldRerender) => {
					widgets[wi] = newData;
					onChange(field.key, [...widgets], shouldRerender);
				},
				() => {
					widgets.splice(wi, 1);
					onChange(field.key, [...widgets], true);
				},
				() => {
					if (wi === 0) return;
					[widgets[wi - 1], widgets[wi]] = [widgets[wi], widgets[wi - 1]];
					onChange(field.key, [...widgets], true);
				},
				() => {
					if (wi >= widgets.length - 1) return;
					[widgets[wi], widgets[wi + 1]] = [widgets[wi + 1], widgets[wi]];
					onChange(field.key, [...widgets], true);
				},
				wi > 0,
				wi < widgets.length - 1,
				excludedTypes
			);
			widgetsContainer.appendChild(wCard);
		}
	}

	addBtn.addEventListener("click", () => {
		widgets = [...widgets, { type: "clock" }];
		onChange(field.key, widgets, true);
	});

	renderAllCards();
	return container;
}

function renderField(field, value, onChange, parentData) {
	switch (field.type) {
		case "string":
			return renderStringField(field, value, onChange);
		case "textarea":
			return renderTextareaField(field, value, onChange);
		case "number":
			return renderNumberField(field, value, onChange);
		case "boolean":
			return renderBooleanField(field, value, onChange);
		case "select":
			return renderSelectField(field, value, onChange);
		case "array":
			return renderArrayField(field, value, onChange, (itemSchema, itemData, itemOnChange) => {
				const innerOnChange = (key, val) => {
					itemOnChange(key, val);
				};
				return renderArrayItems(itemSchema, itemData, innerOnChange);
			});
		case "widgets":
			return renderWidgetsField(field, value, onChange, parentData);
		default:
			return renderStringField(field, value, onChange);
	}
}

export function renderWidgetForm(schema, data, onChange) {
	const container = document.createElement("div");
	container.className = "config-form-widget-form";

	if (!schema || !schema.fields) return container;

	let currentData = { ...data };
	const notify = (key, value, shouldRerender = false) => {
		currentData = setValue(currentData, key, value);
		onChange(currentData, shouldRerender);
	};

	const baseFields = [];
	const widgetFields = [];
	for (const field of schema.fields) {
		if (BASE_FIELD_KEYS.has(field.key)) {
			baseFields.push(field);
		} else {
			widgetFields.push(field);
		}
	}

	if (baseFields.length > 0) {
		const details = document.createElement("details");
		details.className = "config-form-widget-base-fields details margin-block-10";
		const summary = document.createElement("summary");
		summary.className = "summary size-h6";
		summary.textContent = "Title, cache & display";
		details.appendChild(summary);
		const baseContent = document.createElement("div");
		baseContent.className = "config-form-fields margin-block-10";
		for (const field of baseFields) {
			const val = getValue(currentData, field.key);
			baseContent.appendChild(renderField(field, val, (k, v) => notify(k, v)));
		}
		details.appendChild(baseContent);
		container.appendChild(details);
	}

	for (const field of widgetFields) {
		const val = getValue(currentData, field.key);
		const fieldEl = renderField(field, val, (k, v, sr) => notify(k, v, sr), currentData);
		container.appendChild(fieldEl);
	}

	return container;
}

export function renderWidgetCard(widgetData, index, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, excludedTypes = []) {
	const type = widgetData?.type || "clock";
	const schema = getWidgetSchema(type);
	const allTypes = getAllWidgetTypesForSelector().filter(
		(t) => !excludedTypes.includes(t) || t === type
	);

	const card = document.createElement("div");
	card.className = "config-form-widget-card";
	card.dataset.widgetIndex = String(index);

	const header = document.createElement("div");
	header.className = "config-form-widget-card-header";
	header.innerHTML = `
		<select class="config-form-widget-type-select" data-widget-field="type">
			${allTypes.map((t) => `<option value="${escapeHtml(t)}" ${t === type ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
		</select>
		<div class="config-form-widget-card-actions">
			<button type="button" data-action="move-up" ${canMoveUp ? "" : "disabled"}>Up</button>
			<button type="button" data-action="move-down" ${canMoveDown ? "" : "disabled"}>Down</button>
			<button type="button" data-action="remove">Remove</button>
		</div>
	`;
	card.appendChild(header);

	const formArea = document.createElement("div");
	formArea.className = "config-form-widget-form-area";

	if (schema) {
		const form = renderWidgetForm(schema, widgetData, (data, shouldRerender) => {
			onChange({ ...widgetData, ...data }, shouldRerender ?? false);
		});
		formArea.appendChild(form);
	} else {
		formArea.innerHTML = `
			<details class="details margin-block-10" open>
				<summary class="summary size-h6">Edit YAML</summary>
				<textarea class="config-form-widgets-yaml config-form-widget-yaml-fallback" data-widget-yaml placeholder="- type: ${escapeHtml(type)}"></textarea>
			</details>
		`;
		const textarea = formArea.querySelector("textarea");
		try {
			textarea.value = yamlDump(widgetData || { type }, { lineWidth: -1 });
		} catch (_) {
			textarea.value = JSON.stringify(widgetData || {}, null, 2);
		}
		textarea.addEventListener("change", () => {
			try {
				const parsed = yamlLoad(textarea.value);
				onChange(parsed, false);
			} catch (_) {}
		});
	}

	card.appendChild(formArea);

	header.querySelector('[data-widget-field="type"]').addEventListener("change", (e) => {
		const newType = e.target.value;
		onChange({ ...widgetData, type: newType }, true);
	});

	header.querySelector('[data-action="remove"]').addEventListener("click", onRemove);
	header.querySelector('[data-action="move-up"]').addEventListener("click", () => canMoveUp && onMoveUp());
	header.querySelector('[data-action="move-down"]').addEventListener("click", () => canMoveDown && onMoveDown());

	return card;
}
