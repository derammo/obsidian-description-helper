import { TextIterator } from "@codemirror/state";
import { CommandWidgetBase, EditorView, ParsedCommand, SyntaxNode } from "derobst/command";
import { Host } from "main/Plugin";

import { ALT_TEXT_PREFIX } from "./Command";

export class EditWidget extends CommandWidgetBase<Host> {
	generated: string;
	previousValue: string | undefined;
	currentValue: string = "";

	constructor(
		host: Host, 
		command: ParsedCommand<Host>, 
		public quoteStart: SyntaxNode, 
		public quoteEnd: SyntaxNode,
		public descriptors: Set<string>) {
		super(host, command);
	}

	toDOM(view: EditorView): HTMLElement {
		const line = document.createElement("div");
		line.style.width = "100%";
		line.style.marginTop = "-24px";
		line.style.marginBottom = "-24px";
		// line.style.marginTop = "calc(0px - var(--line-height-normal) )";
		// line.style.marginBottom = "calc(0px - var(--line-height-normal))";
		line.style.width = "100%";
		line.style.display = "flex";
		line.appendChild(this.buildTextEdit(view));
		line.appendChild(this.buildButton(view));

		return line;
	}

	buildTextEdit(view: EditorView): HTMLElement {
		const promptParts: string[] = Array.from(this.descriptors);
		promptParts.push("portrait");
		promptParts.push("colored pencil");
		promptParts.push("realistic");
		promptParts.push("white background");
		this.generated = promptParts.join(", ");

		const control = document.createElement("textarea");
		control.style.flexGrow = "1";
		control.style.height = "6em";

		control.placeholder = this.generated;
		this.loadContent(view, control);

		this.host.registerDomEvent(control, "change", async (event: Event) => {
			let input: string = ((event.target as HTMLTextAreaElement)?.value ?? "").trim();

			// if set back to default, store nothing
			if (input == this.generated) {
				input = "";
			}

			this.previousValue = undefined;
			this.currentValue = input;
			await this.replaceQuote(view, input);
		});

		this.host.registerDomEvent(control, "focusin", async (_event: Event) => {
			this.previousValue = control.value;
			if (control.value.length < 1) {
				control.value = this.generated;
			}
		});

		this.host.registerDomEvent(control, "focusout", async (_event: Event) => {
			if (this.previousValue !== undefined) {
				control.value = this.previousValue;
				this.previousValue = undefined;
			}
		});
		return control;
	}

	// XXX on download, use meta-png or similar library to add prompt used as metadata to the PNG?

	buildButton(view: EditorView): HTMLElement {
		const control = document.createElement("button");
		const prompt = (this.currentValue.length > 0)? this.currentValue: this.generated;
		
		control.innerText = "AI draw";
		control.style.marginLeft = "0.5em";

		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.host.generateImages(prompt)
			.then((results: { generationId: string, urls: string[] }) => {
				if (this.command.commandNode === undefined) {
					return;
				}
				// XXX config
				const presentSize = 256;
				let prefix = "\n\n";
				let insertionLocation: number = this.command.commandNode.to + 1;
				const walk: TextIterator = view.state.doc.iterRange(insertionLocation);
				// skip over entire line as enumeration
				walk.next();
				if (!walk.done) {
					if (walk.lineBreak) {
						// we don't know the size of a LF or CRLF sequence, so we have to measure it like this
						const offset = walk.value.length;
						walk.next();
						if (!walk.done) {
							if (walk.lineBreak) {
								// reuse empty line following our command
								insertionLocation += offset;
								prefix = "\n";
							}
						}
					}
				}
				const chunks: string[] = [ `${prefix}\`!image-set ${results.generationId} ${prompt}\` ` ];
				results.urls.forEach((url, imageIndex) => {
					chunks.push(`${imageIndex > 0?" ":""}![${ALT_TEXT_PREFIX}${results.generationId} ${imageIndex + 1}|${presentSize}](${url})`);
				});

				view.dispatch({
					changes: { from: insertionLocation, to: insertionLocation, insert: chunks.join("") }
				});

				// XXX optionally, create an obsidian vault file /DALL-E/${generationId}.md containing the prompt info and links to the images
				this.command.handleUsed(view);			
			});
		});
		return control;
	}

	private loadContent(view: EditorView, control: HTMLTextAreaElement) {
		const content = view.state.doc.sliceString(this.quoteStart.from + 2, this.quoteEnd.to);
		if (content.length > 0) {
			this.currentValue = content;
			control.value = content;
		}
	}

	async replaceQuote(view: EditorView, value: string) {
		view.dispatch({ 
			changes: { from: this.quoteStart.from + 2, to: this.quoteEnd.to, insert: value }
		});
	}
}
