import { SyntaxNode } from "derobst/command";
import { ParsedCommandWithParameters } from "derobst/command";
import { HEADER_NODE_PREFIX, QUOTE_NODE_PREFIX, QUOTE_REGEX } from "derobst/internals";
import { ViewPluginContext } from "derobst/view";
import { editorInfoField } from "obsidian";
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

	protected gatherDescriptionSection(descriptors: Set<string>, context: ViewPluginContext<Host>): boolean {
		const descriptionHeader: SyntaxNode | null = this.findDescriptionHeader(context);
		if (descriptionHeader !== null) {
			this.gatherDescriptorsFromTags(descriptors, descriptionHeader, context);
			this.ingestDescriptionSection(descriptors, descriptionHeader, context);
			return true;
		}
		return false;
	}

	private gatherDescriptorsFromTags(descriptors: Set<string>, descriptionHeader: SyntaxNode, context: ViewPluginContext<Host>): boolean {
		if (this.commandNode === undefined) {
			return false;
		}
		const currentFile = context.state.field(editorInfoField).file;
		if (currentFile === null) {
			return false;
		}
		const meta = context.plugin.metadataCache.getFileCache(currentFile);
		// if (meta !== null) {
		// 	getAllTags(context.plugin.metadataCache.getFileCache(currentFile)!)?.forEach((value: string) => {
		//		// this also includes tags from frontmatter
		// 	});
		// }
		if (meta === null) {
			return false;
		}
		if (meta.tags === undefined) {
			return false;
		}
		const sectionStart = descriptionHeader.to;
		const sectionEnd = this.commandNode.from;
		for (const tag of meta.tags) {
			if (tag.position.start.offset >= sectionEnd) {
				continue;
			} 
			if (tag.position.end.offset < sectionStart) {
				continue;
			} 
			// look up out own meta info about it
			const info = context.plugin.info.getMetadata(tag.tag.slice(1), this.frontMatterSection);
			if (info?.prompt !== undefined) {
				if (info.prompt !== null && info.prompt.length > 0) {
					// explicitly null or empty prompt means ignore this
					descriptors.add(info.prompt);
				}
			} else {
				const slash = tag.tag.indexOf("/");
				if (slash >= 0) {
					// just use the subpath, as long as the top level tag is registered
					const prompt = tag.tag.slice(slash + 1);
					descriptors.add(prompt);
				}
			}
		}
		return ((meta?.tags?.length ?? 0) > 0);
	}

	private findDescriptionHeader(context: ViewPluginContext<Host>): SyntaxNode | null {
		if (this.commandNode === undefined) {
			return null;
		}
		let scan: SyntaxNode | null = this.commandNode;
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
			}
			ingest = ingest.nextSibling;
			if (ingest !== null && ingest.type.name.startsWith(HEADER_NODE_PREFIX) && ingest.type.name.localeCompare(startHeader) <= 0) {
				// end of section
				break;
			}
		}
	}

	private calculateDescriptionHeaderName(_context: ViewPluginContext<Host>): string {
		// XXX default from plugin settings
		let name: string = "Description";
		if (this.parameters.header) {
			name = this.parameters.header.toString();
		}
		return name;
	}
}
