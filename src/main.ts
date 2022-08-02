import { addIcon, Plugin, TFile } from 'obsidian';
//import pdf2md from '@opendocsg/pdf2md'
import * as pdfjs from "pdfjs-dist";
import * as worker from "pdfjs-dist/build/pdf.worker.entry.js";

addIcon('extract', '<path d="M16 71.25L16 24.5C16 19.8056 19.8056 16 24.5 16L71.25 16C75.9444 16 79.75 19.8056 79.75 24.5L79.75 41.5L71.25 41.5L71.25 24.5L24.5 24.5L24.5 71.25L41.5 71.25L41.5 79.75L24.5 79.75C19.8056 79.75 16 75.9444 16 71.25ZM42.7452 48.725L48.7547 42.7325L75.5 69.4778L75.5 54.25L84 54.25L84 84L54.25 84L54.25 75.5L69.4862 75.5L42.7452 48.725Z" fill="white" fill-opacity="0.5"/>')

/* The app is organized into a few major modules:
- App, the global object that owns everything else. You can access this via this.app 
inside your plugin. The App interface provides accessors for the following interfaces:
    - Vault, the interface that lets you interact with files and folders in the vault.
    - Workspace, the interface that lets you interact with panes on the screen.
    - MetadataCache, the interface that contains cached metadata about each markdown file, including headings, 
    links, embeds, tags, and blocks. 
*/
// We are going to want to use the Workspace and Vault facilities. 
// Vault -> for creating the markdown files for each .pdf in the vault.
// Workspace -> for giving a two-pane experience when looking at .pdf viles in the vault.
export default class ObsidianPDF extends Plugin {

    // TODO: On opening of a .md file ->
    // want to find the corresponding .pdf and open that in a dual pane.

    /* 
        - If you need to open a new file or navigate a view, use {@link getLeaf}.
        - looks like there is a on 'file-open' event.
        - for new file creation: this.app.vault.on('create', ...
    */

    /*
     * returns true if the file belongs to a .PDF/.md file pair.
     */
    belongsToPair(file : TFile) : boolean {
        if (file != null) {
            if (file.extension === 'pdf') return true;
            if (file.extension === 'md') {
                // Need to do some more work.
                // Search through the vault to determine if their is a corresponding .pdf file.
                // TODO: Make this faster by leveraging some form of indexing.
                
                return false; // this is currently a mock implementation.
            }
        }
        return false;
    }

    async onload() {
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
		this.addRibbonIcon('extract', 'PDF to Markdown', 
            (evt : MouseEvent) => {
                this.extract();
            }
        );

        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
            console.log("active-leaf-change event triggered");
            console.log("leaf type = ", leaf.getViewState().type);
        }));

        this.registerEvent(this.app.workspace.on('file-open', (file) => {
            console.log('file-open event triggered');
            var isFileClose = false;
            if (this.app.workspace.activeLeaf != null) {
                if (this.app.workspace.activeLeaf.getViewState().type == "empty") isFileClose = true;
            }
            /*if (isFileClose) {
                // Does the file belong to a pair?
                if (this.belongsToPair(file)) {
                    // Close the two pdf and markdown leafs.
                }
            } else {
            }*/
            if (file != null && !isFileClose) {
                if (file.extension === 'pdf') {
                    // We automatically know that we need to open the companion .md
                    const mdFilePath = file.name.replace(".pdf", ".md");
                    let newLeaf = true;
                    this.app.workspace.iterateAllLeaves((leaf) => {
                        console.log(leaf.getViewState().type);
                        // If we find any existing markdown views, no need to create
                        // a new leaf.
                        if (leaf.getViewState().type == "markdown") {
                            newLeaf = false;
                        }
                    });
                    this.app.workspace.openLinkText(mdFilePath, '' /* source path */, newLeaf);
                    console.log("opening", mdFilePath);
                }
            }
        }));
    }

    async extract()  {
		let file = this.app.workspace.getActiveFile();
		if(file === null) return;
		if(file.extension !== 'pdf') return;
        let arrayBuffer = await this.app.vault.readBinary(file);
        console.log("typeof arrayBuffer === \"object\"", typeof arrayBuffer === "object");
        console.log("arrayBuffer !== null", arrayBuffer !== null);
        console.log("arrayBuffer.byteLength", arrayBuffer.byteLength !== undefined);
        const buffer = Buffer.from(arrayBuffer);
        /* PDF.js uses promises and .getDocument() returns a PDFDocumentLoadingTask instance that has 
            a promise property */
		let doc = await pdfjs.getDocument(buffer).promise;
		// pdf2md stuff -> see: https://github.com/opendocsg/pdf2md/blob/master/lib/pdf2md.js
        {
            /*let result = await pdf2md.parse(doc);
            const {fonts, pages} = result;
            const transformations = pdf2md.makeTransformations(fonts.map);
            const parseResult = pdf2md.transform(pages, transformations);*/
            // var resultMD = await pdf2md(buffer); 
            var resultMD = "Here is some text that is meant to represent the PDF text.";
            /*parseResult.pages
                // @ts-ignore
                .map(page => page.items.join('\n')) // typescript is ignored on this line.
                .join('---\n\n'); */
        }
        const mdFilePath = file.name.replace(".pdf", ".md");
        await this.saveToFile(mdFilePath, resultMD);
        await this.app.workspace.openLinkText(mdFilePath, '' /* source path */, true /* is new leaf */);
	}

    async saveToFile(filePath: string, mdString: string) {
		const fileExists = await this.app.vault.adapter.exists(filePath);
		if (fileExists) {
			await this.overwriteFile(filePath, mdString);
		} else {
			await this.app.vault.create(filePath, mdString + "\n# PDF Metadata\n");
		}
	}

    /*
     * TODO(Noah): Can we do some Git magic to replace just those places in the document that
     * pertain to the PDF, and leave whatever annotations that you written it?
     */
	async overwriteFile(filePath: string, note: string) {
		let existingContent = await this.app.vault.adapter.read(filePath);
        let _existingContent = existingContent.split("# PDF Metadata");
        let userContent = (_existingContent.length > 1) ? _existingContent[1] : "";
		await this.app.vault.adapter.write(filePath, note + "\n# PDF Metadata" + userContent);
	}
};

// Alas. Things are not as simple as they seem. We must be more careful here.
// I'm thinking that we maybe have a, "pair is open". Idea going on. My own state
// management type thing.
//
//  Of course, we have to consider the user reloading the plugin randomly. 
//  Which means that maybe on load we also make sure to check the open leafs for a pair -> 
//  and adjust the state accordingly -> so that state is ALWAYS valid.