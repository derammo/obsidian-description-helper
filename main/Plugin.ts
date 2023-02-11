import { MinimalCommandHost } from "derobst/interfaces";
import { DerAmmoKnownTagsAPI } from "obsidian-derammo-knowntags-api";
import { MetadataCache, TFile } from "obsidian";
import { Readable } from "stream";
import { ImageSet } from "image_generation/ImageSet";
import { CreateImageRequestSizeEnum, OpenAIApi } from 'openai';
import { SettingTab } from "./SettingTab";

export interface Settings {
	descriptionSectionHeader: string;
	imageRequestSize: CreateImageRequestSizeEnum;
    imagePromptPrefix: string;
    imagePresentationWidth: number;
    chosenImagePresentationWidth: number;
    defaultHide: boolean;
    defaultDim: boolean;
    openaiApiKey: string;
}

// REVISIT Why is this necessary?  if we dont do this, the API ends up serializing the keys like _256x256 instead of 256x256
export function getImageRequestSize(settings: Settings): CreateImageRequestSizeEnum | undefined {
    switch (settings.imageRequestSize) {
        case CreateImageRequestSizeEnum._256x256:
            return "256x256";
        case CreateImageRequestSizeEnum._512x512:
            return "512x512";
        case CreateImageRequestSizeEnum._1024x1024:
            return "1024x1024";
        default:
            return undefined;
    }        
}    

export const DEFAULT_SETTINGS: Settings = {
    descriptionSectionHeader: "",
    imageRequestSize: "256x256",
    imagePromptPrefix: "",
    imagePresentationWidth: 208,
    chosenImagePresentationWidth: 512,
    defaultHide: true,
    defaultDim: true,
    openaiApiKey: ""
};

// stable services our Obsidian plugin provides to its components
export interface Host extends MinimalCommandHost<Host> {
    // data specific to this plugin
    settings: Settings;
    info: DerAmmoKnownTagsAPI;

    // access to shared connection to openai
    openai: OpenAIApi;
	openaiReload(settingTab: SettingTab): void;

    // functionality specific to this plugin
	generateImages(prompt: string): Promise<ImageSet>; 
	generateWiderImage(image: Readable | Buffer, mask: Readable | Buffer, width: number, height: number, prompt: string): Promise<ImageSet>;
	createFileFromBuffer(arg0: string, buffer: Buffer): Promise<TFile>;
	loadFile(path: string): Promise<TFile>;
    readArrayBuffer(file: TFile): Promise<ArrayBuffer>;
    incrementRunningRequestCount(): number;
    decrementRunningRequestCount(): number;

    // pass through to Obsidian API
    metadataCache: MetadataCache;
}
