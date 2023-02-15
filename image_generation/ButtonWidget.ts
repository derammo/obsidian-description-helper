import { WidgetType } from "@codemirror/view";
import { TFile } from "obsidian";
import { EditorView } from "derobst/command";
import { Host } from "main/Plugin";
import { ImageReference } from "./ImageReference";

export class ButtonWidget extends WidgetType {
	imageReference: ImageReference;

	constructor(public host: Host, public imageReferences: ImageReference[]) {
		super();
		if (imageReferences.last() === undefined) {
			throw new Error("Image buttons should always be attached to image references.")
		} 
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this.imageReference = imageReferences.last()!;
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.style.display = "inline-flex";
		span.style.flexDirection = "column";
		span.style.rowGap = "5px";
		span.style.padding = "5px";
		span.style.paddingBottom = "0px";
		span.style.verticalAlign = "top";
	
		span.style.width = "70px";
		span.style.marginLeft = "-70px";

		span.appendChild(this.buildChooseButton(view));
		span.appendChild(this.buildKeepButton(view));
		span.appendChild(this.buildDiscardButton(view));
		return span;
	}

	buildKeepButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		const imageReference = this.imageReference;
		const host = this.host;
		control.innerText = "Keep";
		if (imageReference.url.startsWith("https:")) {
			this.host.registerDomEvent(control, "click", async (_event: Event) => {
				imageReference.downloadRemoteImage(host, view);
			});
		} else {
			control.disabled = true;
			control.ariaDisabled = "true";
			control.style.backgroundColor = "gray";
		}
		return control;
	}

	buildChooseButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		control.innerText = "Choose";
		const host = this.host;

		host.registerDomEvent(control, "click", async (_event: Event) => {
			// erase all image references, in reverse order
			this.imageReferences.reduceRight((_, imageReference: ImageReference) => {
				imageReference.erase(view);
				return imageReference;
			});

			// make sure we secure the file
			const file: TFile = await this.imageReference.downloadRemoteImage(host, view);

			// create a new reference to the chosen image at the only undisturbed location, without UI
			this.imageReferences.first()?.insertReference(view, file.path);

			// don't let this be on the same line as an image set, because we are about to destroy those
			this.imageReferences.first()?.insertLineBreak(view);
		});
		return control;
	}

	buildDiscardButton(view: EditorView): HTMLElement {
		const control = this.buildFlexButton();
		control.innerText = "Discard";

		this.host.registerDomEvent(control, "click", async (_event: Event) => {
			this.imageReference.erase(view);
		});
		return control;
	}

	buildFlexButton(): HTMLButtonElement {
		const control = document.createElement("button");
		control.style.display = "flex";
		control.style.flexGrow = "0";
		control.style.flexShrink = "0";
		control.style.flexBasis = "auto";
		return control;
	}
}
