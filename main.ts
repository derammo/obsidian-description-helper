import { CommandDispatcher, CommandViewPlugin, createCommandRemovalPostProcessor } from 'derobst/command';
import { DEFAULT_SETTINGS, Host, Settings } from 'main/Plugin';
import { Notice, TFile } from 'obsidian';
import { DerAmmoKnownTagsAPI, getDerAmmoKnownTagsAPI } from 'obsidian-knowntags';

import { Configuration, ImagesResponseDataInner, OpenAIApi } from "openai";

// various commands and extensions
import * as CharacterRandomDescription from "commands/character_random_description/Command";
import * as ImagePromptFromTags from "commands/image_prompt_from_tags/Command";
import * as ImageSet from "commands/image_set/Command";
import { ObsidianPluginBase } from 'derobst/main';
import { createGeneratedImagesDecorationsStateField } from "image_generation/StateField";
import { SettingTab } from 'main/SettingTab';

// openai support

// XXX remove and only take from config
const openaiConfiguration = new Configuration({
	apiKey: "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" // process.env.OPENAI_API_KEY,
});

export const openai = new OpenAIApi(openaiConfiguration);

export default class DescriptionHelperPlugin extends ObsidianPluginBase<Settings> implements Host {
	info: DerAmmoKnownTagsAPI;
	commands: CommandDispatcher<Host> = new CommandDispatcher<Host>();
	settingsDirty: boolean;
	settings: Settings;

	get metadataCache() {
		return this.app.metadataCache;
	}

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addSettingTab(new SettingTab(this.app, this, this));

		getDerAmmoKnownTagsAPI(5000).then((info) => {
			this.info = info;

			this.buildCommands();
			this.registerViewPlugin(createCommandViewPlugin(this));
			this.registerEditorExtension(createGeneratedImagesDecorationsStateField(this));
			this.registerMarkdownPostProcessor(createCommandRemovalPostProcessor(this.commands));
		});
	}

	onunload() {
		// no code
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	generateImages(prompt: string): Promise<{ generationId: string; urls: string[]; }> {
		return openai.createImage({
			prompt: prompt,
			// XXX config
			n: 4,
			// XXX config
			size: "256x256",
			response_format: "url"
		})
			.then((response) => {
				let generationId: string | undefined = undefined;
				const urls: string[] = [];
				response.data.data.forEach((image: ImagesResponseDataInner) => {
					if (image.url === undefined) {
						return;
					}
					urls.push(image.url);
					const match = (image.url ?? "").match(/st=([0-9-T%AZ]+)(?:&|$)/);
					if (match !== null) {
						if (generationId === undefined) {
							// unescape URL
							generationId = decodeURIComponent(match[1]);
						} else {
							if (generationId !== decodeURIComponent(match[1])) {
								console.log(`ERROR: mismatched generation id '${generationId}' vs '${decodeURIComponent(match[1])}'`);
							}
						}
					}
				});
				return { generationId: generationId ?? "", urls: urls };
			});
	}

	async createFileFromBuffer(path: string, buffer: Buffer): Promise<TFile> {
		const existing = app.vault.getAbstractFileByPath(path);
		if (existing !== null) {
			await app.vault.delete(existing);
		}
		return app.vault.createBinary(path, buffer);
	}

	loadFile(path: string): Promise<TFile> {
		const maybe = app.vault.getAbstractFileByPath(path);
		if (maybe === null) {
			return Promise.reject(`File not found: '${path}'`);
		}
		if (!(maybe instanceof TFile)) {
			return Promise.reject(`Path does not identify a file: '${path}'`);
		}
		return Promise.resolve(maybe as TFile);
	}

	private buildCommands() {
		this.commands.registerCommand(ImagePromptFromTags.Command);
		this.commands.registerCommand(CharacterRandomDescription.Command);
		this.commands.registerCommand(ImageSet.Command);
	}
}

function createCommandViewPlugin(host: Host) {
	// create a unique class to identify the view plugin, which has access to this Obsidian plugin through capture
	return class extends
		CommandViewPlugin<Host> {
		getPlugin(): Host {
			return host;
		}
	};
}
