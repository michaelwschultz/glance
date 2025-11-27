import { EditorView } from "@codemirror/view";

// Minimal self-hosted One Light-like theme. This is not a pixel-perfect
// clone of the official theme, but provides sane, readable defaults
// with visible selection and matching gutter/editor backgrounds.
export const oneLight = EditorView.theme(
	{
		"&": {
			color: "#24292e",
			backgroundColor: "#fafafa",
		},
		".cm-content": {
			caretColor: "#0969da",
		},
		".cm-cursor, .cm-dropCursor": {
			borderLeftColor: "#0969da",
		},
		".cm-selectionBackground, .cm-content ::selection": {
			background: "rgba(9, 105, 218, 0.28)",
		},
		".cm-activeLine": {
			backgroundColor: "#eaeef2",
		},
		".cm-gutters": {
			backgroundColor: "#fafafa",
			color: "#57606a",
			borderRight: "1px solid #d0d7de",
		},
	},
	{ dark: false }
);

export default oneLight;


