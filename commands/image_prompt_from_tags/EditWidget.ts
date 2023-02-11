import { CommandWidgetBase, EditorView, ParsedCommand, SyntaxNode } from "derobst/command";
import { ImageReference } from "image_generation/ImageReference";
import { ImageSet } from "image_generation/ImageSet";
import { Host } from "main/Plugin";

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

		// promptParts.push("medium shot");
		// promptParts.push("mid-shot");
		// promptParts.push("head & shoulders shot");
		// promptParts.push("face");
		// promptParts.push("portrait");
		// promptParts.push("long shot");
		// promptParts.push("wide shot");
		// promptParts.push("full shot");
		// promptParts.push("field journal line art");

		// REVISIT: these could be a style preset
		promptParts.push("colored pencil");
		promptParts.push("realistic");
		promptParts.push("surrounded by white background");

		let prefix = this.host.settings.imagePromptPrefix ?? ""
		if (prefix.match(/^ +$/)) {
			// empty string chooses default, so all spaces can be used to specify "no prefix"
			prefix = "";
		} else {
			if (prefix.length < 1) {
				prefix = "medieval ";
			} else {
				prefix = `${prefix} `;
			}
		}
		this.generated = `${prefix}${promptParts.join(", ")}`;

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

		this.host.registerDomContextMenuTarget(control, this.command);
		return control;
	}

	// XXX on download, use meta-png or similar library to add prompt used as metadata to the PNG?

	buildButton(view: EditorView): HTMLElement {
		const control = document.createElement("button");
		const prompt = (this.currentValue.length > 0) ? this.currentValue : this.generated;

		control.innerText = "AI draw";
		control.style.marginLeft = "0.5em";

		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.host.incrementRunningRequestCount();
			this.host.generateImages(prompt)
				.then((images: ImageSet) => {
					ImageReference.displayImages(this.host, view, this.command.commandNode, images);
				})
				.then(() => {
					// XXX optionally, create an obsidian vault file /DALL-E/${generationId}.md containing the prompt info and links to the images
					this.command.handleUsed(view);
				})
				.finally(() => {
					this.host.decrementRunningRequestCount();
				});
		});
		this.host.registerDomContextMenuTarget(control, this.command);
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

