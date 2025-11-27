package glance

import "html/template"

var configEditorWidgetTemplate = mustParseTemplate("config-editor.html", "widget-base.html")

type configEditorWidget struct {
	widgetBase `yaml:",inline"`
}

func (widget *configEditorWidget) initialize() error {
	widget.withTitle("Config Editor").withError(nil)
	return nil
}

func (widget *configEditorWidget) Render() template.HTML {
	return widget.renderTemplate(widget, configEditorWidgetTemplate)
}


