import { ParsedCommandWithParameters, SyntaxNode, SyntaxNodeRef } from "derobst/command";
import { HASHTAG_WHOLE_PREFIX, HEADER_NODE_PREFIX, QUOTE_NODE_PREFIX, QUOTE_REGEX } from "derobst/internals";
import { ViewPluginContext } from "derobst/view";
import { Host } from "./Plugin";

// base for commands that gather descriptors (short pieces of prompts) from tags and quotes in 
// description section of the current file
export abstract class DescriptorsCommand extends ParsedCommandWithParameters<Host> {
	constructor(private frontMatterSection: string) {
		super();
	}

	protected createDescriptorsCollection(): Set<string> {
		return new Set<string>();
	}

	protected gatherDescriptionSection(descriptors: Set<string>, context: ViewPluginContext<Host>, commandNodeRef: SyntaxNodeRef): boolean {
		const descriptionHeader: SyntaxNode | null = this.findDescriptionHeader(context, commandNodeRef);
		if (descriptionHeader !== null) {
			// this.gatherDescriptorsFromTags(descriptors, descriptionHeader, context);
			this.ingestDescriptionSection(descriptors, descriptionHeader, context);
			return true;
		}
		return false;
	}

	private findDescriptionHeader(context: ViewPluginContext<Host>, commandNodeRef: SyntaxNodeRef): SyntaxNode | null {
		let scan: SyntaxNode | null = commandNodeRef.node;
		const targetHeaderMatch = new RegExp(`^#+\\s+${this.calculateDescriptionHeaderName(context)}`);

		while (scan !== null) {
			if (scan.type.name.startsWith(HEADER_NODE_PREFIX)) {
				// check for description name and when we find it, inhale that section
				const value = context.state.doc.sliceString(scan.from, scan.to);
				if (value.match(targetHeaderMatch)) {
					return scan;
				}
			}
			scan = scan.prevSibling ?? scan.parent;
		}
		return null;
	}

	private ingestDescriptionSection(descriptors: Set<string>, descriptionHeader: SyntaxNode, context: ViewPluginContext<Host>): void {
		const startHeader = context.state.doc.sliceString(descriptionHeader.from, descriptionHeader.to);

		// scan forward from there to where we started or until we find a heading with equal or lower heading level
		let ingest: SyntaxNode | null = descriptionHeader;
		while (ingest !== null) {
			if (ingest.type.name.startsWith(QUOTE_NODE_PREFIX)) {
				const quote = context.state.doc.sliceString(ingest.from, ingest.to);
				const match = quote.match(QUOTE_REGEX);
				if (match !== null) {
					const descriptor = match[1].trim();
					if (descriptor.length > 0) {
						descriptors.add(descriptor);
					}
				}
			} else if (ingest.type.name.startsWith(HASHTAG_WHOLE_PREFIX)) {
				const hashTag = context.state.doc.sliceString(ingest.from, ingest.to);
				const info = context.plugin.info.getMetadata(hashTag, this.frontMatterSection);
				if (info?.prompt !== undefined) {
					if (info.prompt !== null && info.prompt.length > 0) {
						// explicitly null or empty prompt means ignore this
						descriptors.add(info.prompt);
					}
				} else {
					const slash = hashTag.indexOf("/");
					if (slash >= 0) {
						// just use the subpath
						const prompt = hashTag.slice(slash + 1);
						descriptors.add(prompt);
					}
				}
			}
			ingest = ingest.nextSibling;
			if (ingest !== null && ingest.type.name.startsWith(HEADER_NODE_PREFIX) && ingest.type.name.localeCompare(startHeader) <= 0) {
				// end of section
				break;
			}
		}
	}

	private calculateDescriptionHeaderName(context: ViewPluginContext<Host>): string {
		let name: string = "Description";
		if ((context.plugin.settings.descriptionSectionHeader?.length ?? 0) > 0) {
			name = context.plugin.settings.descriptionSectionHeader;
		}
		if (this.parameters.header) {
			name = this.parameters.header.toString();
		}
		return name;
	}
}
