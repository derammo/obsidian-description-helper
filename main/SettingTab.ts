import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Host } from './Plugin';

import { CreateImageRequestSizeEnum } from 'openai';
import { safeStorage } from 'electron';

export class SettingTab extends PluginSettingTab {
	constructor(app: App, plugin: Plugin, private host: Host) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Settings for Description Helper Plugin' });

		new Setting(containerEl)
			.setName('Default Hide')
			.setDesc('If set, recognized inline commands are hidden when not being edited.  Can be overridden by "hide" or "nohide" keywords in command string.')
			.addToggle(value => value
				.setValue(this.host.settings.defaultHide)
				.onChange(async (value) => {
					this.host.settings.defaultHide = value;
					await this.host.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Default Dim')
			.setDesc('If set, recognized and unhidden inline commands are shown dim when not being edited.  Can be overridden by "dim" or "nodim" keywords in command string.')
			.addToggle(value => value
				.setValue(this.host.settings.defaultDim)
				.onChange(async (value) => {
					this.host.settings.defaultDim = value;
					await this.host.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Description Section Header")
			.setDesc("The header text for the document section that will contain all tags and quotes used as descriptors.  Can be overridden by 'header=...' in command strings.")
			.addText(text => text
				.setPlaceholder("Description")
				.setValue(this.host.settings.descriptionSectionHeader)
				.onChange(async (value) => {
					this.host.settings.descriptionSectionHeader = value;
					await this.host.saveSettings();
				}));
					
		new Setting(containerEl)
			.setName("AI Image Request Size")
			.setDesc("Larger sizes take longer and cost more money.")
			.addDropdown(dropdown => dropdown
				.addOptions(CreateImageRequestSizeEnum)
				.setValue(this.host.settings.imageRequestSize)
				.onChange(async (value) => {
					this.host.settings.imageRequestSize = value as CreateImageRequestSizeEnum;
					await this.host.saveSettings();
				}));

		new Setting(containerEl)
			.setName("AI Image Prompt Prefix")
			.setDesc("Some text to place at the beginning of the prompt for every AI image generation, ahead of all the descriptors.")
			.addText(text => text
				.setPlaceholder("medieval")
				.setValue(this.host.settings.imagePromptPrefix)
				.onChange(async (value) => {
					this.host.settings.imagePromptPrefix = value;
					await this.host.saveSettings();
				}));				

		new Setting(containerEl)
			.setName("AI Image Presentation Size")
			.setDesc("The width in pixels at which generated images will be embedded.  This size is written into the markdown and can be changed there after the fact.")
			.addSlider((slider) =>
				slider
					.setLimits(64, 1024, 16)
					.setValue(this.host.settings.imagePresentationWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.host.settings.imagePresentationWidth = value;
						await this.host.saveSettings();
					}));				

		new Setting(containerEl)
			.setName("AI Chosen Image Presentation Size")
			.setDesc("The width in pixels at which chosen images will be embedded.  This size is written into the markdown and can be changed there after the fact.")
			.addSlider((slider) =>
				slider
					.setLimits(64, 1024, 16)
					.setValue(this.host.settings.chosenImagePresentationWidth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.host.settings.chosenImagePresentationWidth = value;
						await this.host.saveSettings();
					}));				

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("The API key for your OpenAI account.  If you don't have one, you can get one at https://openai.com/")
			.addText(text => text
				.setPlaceholder("sk-...")
				.setValue(this.decryptApiKey())
				.onChange(async (value) => {
					if (safeStorage !== undefined && safeStorage.isEncryptionAvailable()) {
						const buffer = safeStorage.encryptString(value);
						this.host.settings.openaiApiKey = buffer.toString("base64");
					} else {
						this.host.settings.openaiApiKey = value;
					}
					this.host.openaiReload(this);					
					await this.host.saveSettings();
			}));
	}
		
	decryptApiKey(): string {
		if (safeStorage !== undefined && safeStorage.isEncryptionAvailable()) {
			if (this.host.settings.openaiApiKey === undefined || this.host.settings.openaiApiKey.length < 1) {
				return "";
			}
			const buffer = Buffer.from(this.host.settings.openaiApiKey, "base64");
			return safeStorage.decryptString(buffer);
		} else {
			return this.host.settings.openaiApiKey;
		}
	}
}
