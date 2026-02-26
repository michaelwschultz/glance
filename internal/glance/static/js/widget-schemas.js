const BASE_FIELD_KEYS = new Set(["title", "title-url", "hide-header", "css-class", "cache"]);

const BASE_FIELDS = [
	{ key: "title", type: "string", label: "Title", placeholder: "" },
	{ key: "title-url", type: "string", label: "Title URL", placeholder: "" },
	{ key: "hide-header", type: "boolean", label: "Hide header", default: false },
	{ key: "css-class", type: "string", label: "CSS class", placeholder: "" },
	{ key: "cache", type: "string", label: "Cache duration", placeholder: "e.g. 30s, 5m, 12h" },
];

const WIDGET_SCHEMAS = {
	clock: {
		type: "clock",
		label: "Clock",
		fields: [
			{ key: "hour-format", type: "select", label: "Hour format", options: ["12h", "24h"], default: "24h" },
			{
				key: "timezones",
				type: "array",
				label: "Timezones",
				itemSchema: {
					fields: [
						{ key: "timezone", type: "string", label: "Timezone", required: true, placeholder: "e.g. UTC, America/New_York" },
						{ key: "label", type: "string", label: "Label", placeholder: "" },
					],
				},
			},
		],
	},
	calendar: {
		type: "calendar",
		label: "Calendar",
		fields: [
			{
				key: "first-day-of-week",
				type: "select",
				label: "First day of week",
				options: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
				default: "monday",
			},
		],
	},
	weather: {
		type: "weather",
		label: "Weather",
		fields: [
			{ key: "location", type: "string", label: "Location", required: true, placeholder: "e.g. London, United Kingdom" },
			{ key: "show-area-name", type: "boolean", label: "Show area name", default: false },
			{ key: "hide-location", type: "boolean", label: "Hide location", default: false },
			{ key: "hour-format", type: "select", label: "Hour format", options: ["12h", "24h"], default: "12h" },
			{ key: "units", type: "select", label: "Units", options: ["metric", "imperial"], default: "metric" },
		],
	},
	iframe: {
		type: "iframe",
		label: "IFrame",
		fields: [
			{ key: "source", type: "string", label: "Source URL", required: true, placeholder: "https://..." },
			{ key: "height", type: "number", label: "Height (px)", default: 300, placeholder: "300" },
		],
	},
	html: {
		type: "html",
		label: "HTML",
		fields: [
			{ key: "source", type: "textarea", label: "HTML source", placeholder: "Raw HTML content" },
		],
	},
	rss: {
		type: "rss",
		label: "RSS",
		fields: [
			{
				key: "style",
				type: "select",
				label: "Style",
				options: ["", "detailed-list", "horizontal-cards", "horizontal-cards-2"],
				default: "",
			},
			{ key: "limit", type: "number", label: "Limit", default: 25, placeholder: "25" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{ key: "cache", type: "string", label: "Cache duration", placeholder: "e.g. 12h" },
			{
				key: "feeds",
				type: "array",
				label: "Feeds",
				itemSchema: {
					fields: [
						{ key: "url", type: "string", label: "URL", required: true, placeholder: "https://..." },
						{ key: "title", type: "string", label: "Title", placeholder: "Feed title" },
						{ key: "limit", type: "number", label: "Limit", placeholder: "Per-feed limit" },
					],
				},
			},
		],
	},
	releases: {
		type: "releases",
		label: "Releases",
		fields: [
			{ key: "limit", type: "number", label: "Limit", default: 10, placeholder: "10" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{ key: "cache", type: "string", label: "Cache duration", placeholder: "e.g. 1d" },
			{ key: "token", type: "string", label: "GitHub token", placeholder: "ghp_..." },
			{ key: "gitlab-token", type: "string", label: "GitLab token", placeholder: "" },
			{
				key: "repositories",
				type: "array",
				label: "Repositories",
				itemSchema: {
					fields: [
						{ key: "repository", type: "string", label: "Repository", required: true, placeholder: "owner/repo" },
						{ key: "include-prereleases", type: "boolean", label: "Include prereleases", default: false },
					],
				},
			},
		],
	},
	markets: {
		type: "markets",
		label: "Markets",
		fields: [
			{
				key: "markets",
				type: "array",
				label: "Markets",
				itemSchema: {
					fields: [
						{ key: "symbol", type: "string", label: "Symbol", required: true, placeholder: "e.g. SPY, BTC-USD" },
						{ key: "name", type: "string", label: "Name", placeholder: "Display name" },
					],
				},
			},
		],
	},
	reddit: {
		type: "reddit",
		label: "Reddit",
		fields: [
			{ key: "subreddit", type: "string", label: "Subreddit", required: true, placeholder: "e.g. technology" },
			{ key: "limit", type: "number", label: "Limit", default: 15, placeholder: "15" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{ key: "show-thumbnails", type: "boolean", label: "Show thumbnails", default: true },
			{
				key: "sort-by",
				type: "select",
				label: "Sort by",
				options: ["hot", "new", "top", "rising"],
				default: "hot",
			},
		],
	},
	videos: {
		type: "videos",
		label: "Videos",
		fields: [
			{ key: "limit", type: "number", label: "Limit", default: 10, placeholder: "10" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{
				key: "channels",
				type: "array",
				label: "Channels",
				itemType: "string",
				itemPlaceholder: "YouTube channel ID (e.g. UCXuqSBlHAE6Xw-yeJA0Tunw)",
			},
		],
	},
	"twitch-channels": {
		type: "twitch-channels",
		label: "Twitch Channels",
		fields: [
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{
				key: "channels",
				type: "array",
				label: "Channels",
				itemType: "string",
				itemPlaceholder: "Channel username",
			},
		],
	},
	"hacker-news": {
		type: "hacker-news",
		label: "Hacker News",
		fields: [
			{ key: "limit", type: "number", label: "Limit", default: 15, placeholder: "15" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{
				key: "sort-by",
				type: "select",
				label: "Sort by",
				options: ["hot", "new", "top", "best"],
				default: "hot",
			},
		],
	},
	lobsters: {
		type: "lobsters",
		label: "Lobsters",
		fields: [
			{ key: "instance-url", type: "string", label: "Instance URL", placeholder: "https://lobste.rs" },
			{ key: "limit", type: "number", label: "Limit", default: 15, placeholder: "15" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{
				key: "sort-by",
				type: "select",
				label: "Sort by",
				options: ["hot", "new"],
				default: "hot",
			},
			{
				key: "tags",
				type: "array",
				label: "Tags",
				itemType: "string",
				itemPlaceholder: "tag",
			},
		],
	},
	"to-do": {
		type: "to-do",
		label: "To-do",
		fields: [
			{ key: "id", type: "string", label: "To-do list ID", required: true, placeholder: "Unique identifier for this list" },
		],
	},
	extension: {
		type: "extension",
		label: "Extension",
		fields: [
			{ key: "url", type: "string", label: "Extension URL", required: true, placeholder: "https://..." },
			{ key: "allow-potentially-dangerous-html", type: "boolean", label: "Allow raw HTML", default: false },
		],
	},
	"docker-containers": {
		type: "docker-containers",
		label: "Docker Containers",
		fields: [
			{ key: "sock-path", type: "string", label: "Socket path", placeholder: "/var/run/docker.sock" },
			{ key: "hide-by-default", type: "boolean", label: "Hide by default", default: false },
			{ key: "running-only", type: "boolean", label: "Running only", default: false },
			{ key: "category", type: "string", label: "Category", placeholder: "Filter by label" },
			{ key: "format-container-names", type: "boolean", label: "Format container names", default: false },
		],
	},
	repository: {
		type: "repository",
		label: "Repository",
		fields: [
			{ key: "repository", type: "string", label: "Repository", required: true, placeholder: "owner/repo" },
			{ key: "token", type: "string", label: "GitHub token", placeholder: "ghp_..." },
			{ key: "pull-requests-limit", type: "number", label: "Pull requests limit", default: 3, placeholder: "3" },
			{ key: "issues-limit", type: "number", label: "Issues limit", default: 3, placeholder: "3" },
			{ key: "commits-limit", type: "number", label: "Commits limit", default: -1, placeholder: "-1 for all" },
		],
	},
	search: {
		type: "search",
		label: "Search",
		fields: [
			{
				key: "search-engine",
				type: "select",
				label: "Search engine",
				options: ["duckduckgo", "google", "bing", "perplexity", "kagi", "startpage"],
				default: "duckduckgo",
			},
			{ key: "placeholder", type: "string", label: "Placeholder", placeholder: "Type here to search…" },
			{ key: "new-tab", type: "boolean", label: "Open in new tab", default: false },
			{ key: "autofocus", type: "boolean", label: "Autofocus", default: false },
			{
				key: "bangs",
				type: "array",
				label: "Search bangs",
				itemSchema: {
					fields: [
						{ key: "shortcut", type: "string", label: "Shortcut", required: true, placeholder: "e.g. g" },
						{ key: "title", type: "string", label: "Title", placeholder: "Display name" },
						{ key: "url", type: "string", label: "URL", required: true, placeholder: "https://...?q={QUERY}" },
					],
				},
			},
		],
	},
	monitor: {
		type: "monitor",
		label: "Monitor",
		fields: [
			{
				key: "style",
				type: "select",
				label: "Style",
				options: ["", "compact"],
				default: "",
			},
			{ key: "show-failing-only", type: "boolean", label: "Show failing only", default: false },
			{
				key: "sites",
				type: "array",
				label: "Sites",
				itemSchema: {
					fields: [
						{ key: "url", type: "string", label: "URL", required: true, placeholder: "https://..." },
						{ key: "title", type: "string", label: "Title", placeholder: "Display name" },
						{ key: "error-url", type: "string", label: "Error URL", placeholder: "Fallback when down" },
						{ key: "same-tab", type: "boolean", label: "Same tab", default: false },
					],
				},
			},
		],
	},
	"twitch-top-games": {
		type: "twitch-top-games",
		label: "Twitch Top Games",
		fields: [
			{ key: "limit", type: "number", label: "Limit", default: 10, placeholder: "10" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{
				key: "exclude",
				type: "array",
				label: "Exclude",
				itemType: "string",
				itemPlaceholder: "Game name to exclude",
			},
		],
	},
	"change-detection": {
		type: "change-detection",
		label: "Change Detection",
		fields: [
			{ key: "instance-url", type: "string", label: "Instance URL", placeholder: "https://www.changedetection.io" },
			{ key: "token", type: "string", label: "Token", placeholder: "API token" },
			{ key: "limit", type: "number", label: "Limit", default: 10, placeholder: "10" },
			{ key: "collapse-after", type: "number", label: "Collapse after", default: 5, placeholder: "5" },
			{
				key: "watches",
				type: "array",
				label: "Watch UUIDs",
				itemType: "string",
				itemPlaceholder: "UUID",
			},
		],
	},
	"dns-stats": {
		type: "dns-stats",
		label: "DNS Stats",
		fields: [
			{
				key: "service",
				type: "select",
				label: "Service",
				options: ["adguard", "pihole", "pihole-v6", "technitium"],
				default: "pihole",
			},
			{ key: "url", type: "string", label: "URL", required: true, placeholder: "https://..." },
			{ key: "token", type: "string", label: "Token", placeholder: "API token" },
			{ key: "username", type: "string", label: "Username", placeholder: "" },
			{ key: "password", type: "string", label: "Password", placeholder: "" },
			{ key: "allow-insecure", type: "boolean", label: "Allow insecure", default: false },
			{ key: "hide-graph", type: "boolean", label: "Hide graph", default: false },
			{ key: "hide-top-domains", type: "boolean", label: "Hide top domains", default: false },
			{
				key: "hour-format",
				type: "select",
				label: "Hour format",
				options: ["12h", "24h"],
				default: "24h",
			},
		],
	},
	"split-column": {
		type: "split-column",
		label: "Split Column",
		fields: [
			{ key: "max-columns", type: "number", label: "Max columns", default: 2, placeholder: "2" },
		],
	},
	group: {
		type: "group",
		label: "Group",
		fields: [
			{
				key: "widgets",
				type: "widgets",
				label: "Widgets",
				excludedTypes: ["group", "split-column"],
			},
		],
	},
	bookmarks: {
		type: "bookmarks",
		label: "Bookmarks",
		fields: [
			{
				key: "groups",
				type: "array",
				label: "Groups",
				itemSchema: {
					fields: [
						{ key: "title", type: "string", label: "Group title", placeholder: "Section name" },
						{ key: "same-tab", type: "boolean", label: "Open in same tab", default: false },
						{
							key: "links",
							type: "array",
							label: "Links",
							itemSchema: {
								fields: [
									{ key: "title", type: "string", label: "Title", required: true, placeholder: "" },
									{ key: "url", type: "string", label: "URL", required: true, placeholder: "https://..." },
									{ key: "description", type: "string", label: "Description", placeholder: "" },
								],
							},
						},
					],
				},
			},
		],
	},
};

function mergeSchema(schema) {
	if (!schema || !schema.fields) return null;
	return {
		...schema,
		fields: [...BASE_FIELDS, ...schema.fields],
	};
}

export function getWidgetSchema(type) {
	const schema = WIDGET_SCHEMAS[type];
	return schema ? mergeSchema(schema) : null;
}

export function getWidgetTypes() {
	return Object.keys(WIDGET_SCHEMAS).sort();
}

const ALL_WIDGET_TYPES = [
	"calendar", "calendar-legacy", "clock", "weather", "bookmarks", "iframe", "html",
	"hacker-news", "releases", "videos", "markets", "reddit", "rss", "monitor",
	"twitch-top-games", "twitch-channels", "lobsters", "change-detection", "repository",
	"search", "extension", "group", "dns-stats", "split-column", "custom-api",
	"docker-containers", "server-stats", "to-do", "config-editor",
].sort();

export function getAllWidgetTypesForSelector() {
	return [...ALL_WIDGET_TYPES];
}

export { WIDGET_SCHEMAS, BASE_FIELDS, BASE_FIELD_KEYS };
