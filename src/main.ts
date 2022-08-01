import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

//const electron = require('electron');
//const fs = require('fs');

/*
The app is organized into a few major modules:
App, the global object that owns everything else. You can access this via this.app 
inside your plugin. 
The App interface provides accessors for the following interfaces.
Vault, the interface that lets you interact with files and folders in the vault.
Workspace, the interface that lets you interact with panes on the screen.
MetadataCache, the interface that contains cached metadata about each markdown file, 
including headings, links, embeds, tags, and blocks. 
*/
export default class ObsidianPDF extends Plugin {

    async onload() {
        // await this.loadSettings();
        // This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', 
            (evt : MouseEvent) => {
                // Called when the user clicks the icon.
                new Notice('This is a notice!');
            }
        );
    }

};