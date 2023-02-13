import { MinimalCommandHost } from "derobst/interfaces";
import { DerAmmoKnownTagsAPI } from "obsidian-knowntags";
import { MetadataCache, TFile } from "obsidian";

export interface Settings {
    defaultHide: boolean;
    defaultDim: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
    defaultHide: true,
    defaultDim: true
};

// stable services our Obsidian plugin provides to its components
export interface Host extends MinimalCommandHost<Host> {
    // data specific to this plugin
    settings: Settings;
    info: DerAmmoKnownTagsAPI;

    // functionality specific to this plugin
	generateImages(prompt: string): Promise<{ generationId: string; urls: string[]; }>; 
	createFileFromBuffer(arg0: string, buffer: Buffer): Promise<TFile>;
	loadFile(path: string): Promise<TFile>;
 
    // pass through to Obsidian API
    metadataCache: MetadataCache;
};
