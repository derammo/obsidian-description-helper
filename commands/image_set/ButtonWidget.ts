import { CommandWidgetBase, EditorView, ParsedCommand } from "derobst/command";
import { WidgetContext } from "derobst/interfaces";
import { Host } from "main/Plugin";

export class ButtonWidget extends CommandWidgetBase<Host> {
	constructor(context: WidgetContext<Host>, command: ParsedCommand<Host>) {
		super(context, command);
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.classList.add("derammo-imageset-container");
		const label = document.createElement("span");
		label.classList.add("derammo-imageset-label");
		label.innerText = "Image Set";
		for (const range of this.fetchCurrentRanges()) {
			const text = view.state.doc.sliceString(range.from, range.to);
			const space = text.indexOf(" ");
			label.ariaLabel = (space < 0) ? text : text.substring(space + 1);
		}
		span.appendChild(label);
		span.appendChild(this.buildButtonSVG(view));
		return span;
	}

	buildButtonSVG(view: EditorView): HTMLElement {
		const control = document.createElement("button");
		control.classList.add("derammo-delete-button", "derammo-button");
		control.ariaLabel = "Discard Set";

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttr("width", "100%");
		svg.setAttr("height", "100%");
		svg.setAttr("viewBox", "0 0 12 12");
		svg.setAttr("fill", "none");
		svg.setAttr("stroke", "currentcolor");
		svg.setAttr("stroke-width", "1");
		svg.setAttr("stroke-linecap", "round");
		svg.setAttr("stroke-linejoin", "round");

		const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
		line1.setAttr("x1", "9");
		line1.setAttr("y1", "3");
		line1.setAttr("x2", "3"),
			line1.setAttr("y2", "9");
		svg.appendChild(line1);

		const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
		line2.setAttr("x1", "3");
		line2.setAttr("y1", "3");
		line2.setAttr("x2", "9"),
			line2.setAttr("y2", "9");
		svg.appendChild(line2);

		control.appendChild(svg);

		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.command.handleUsed(view);
			for (const range of this.fetchCurrentRanges()) {
				const line = view.state.doc.lineAt(range.from);
				view.dispatch({
					// remove including newline 
					// REVISIT: is this the correct way to do it? is there a way to explicitly target a line? what about EOF without EOL?
					changes: { from: line.from, to: line.to + 1 }
				});
			}
		});
		return control;
	}
}
