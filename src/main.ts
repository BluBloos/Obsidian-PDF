// TODO(Noah): Fig bug where things are not working if we have opened Obsidian and a "PDF file" is already open.

import { addIcon, FileView, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
//import pdf2md from '@opendocsg/pdf2md'
import * as pdfjs from "pdfjs-dist";
import * as worker from "pdfjs-dist/build/pdf.worker.entry.js";

addIcon('extract', '<path d="M16 71.25L16 24.5C16 19.8056 19.8056 16 24.5 16L71.25 16C75.9444 16 79.75 19.8056 79.75 24.5L79.75 41.5L71.25 41.5L71.25 24.5L24.5 24.5L24.5 71.25L41.5 71.25L41.5 79.75L24.5 79.75C19.8056 79.75 16 75.9444 16 71.25ZM42.7452 48.725L48.7547 42.7325L75.5 69.4778L75.5 54.25L84 54.25L84 84L54.25 84L54.25 75.5L69.4862 75.5L42.7452 48.725Z" fill="white" fill-opacity="0.5"/>')

export default class ObsidianPDF extends Plugin {

    pairOpen : boolean = false;
    pdfFile : TFile = null;
    mdFile : TFile = null;

    isPairOpen() : boolean {
        return this.pairOpen;
    }

    async onload() {
        
        this.pairOpen = false;
        this.pdfFile = null;
        this.mdFile = null;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;

        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf : WorkspaceLeaf) => {
            console.log("active-leaf-change event triggered with leaf type = ", leaf.getViewState().type);
            if (this.isPairOpen()) {
                let foundMdLeaf = (this.mdFile == null) ? true : false;
                let foundPdfLeaf =(this.pdfFile == null) ? true : false;
                // Check all leaves to see if our files still exist.
                this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
                    if (leaf.getViewState().type === "pdf" || leaf.getViewState().type === "markdown") {
                        if ((leaf.view as FileView).file == this.mdFile) {
                            foundMdLeaf = true;
                        } else if ((leaf.view as FileView).file == this.pdfFile) {
                            foundPdfLeaf = true;
                        }
                    }
                });
                let ok = foundMdLeaf && foundPdfLeaf;
                // If either of our leaves are no longer present, we must "close" the PDF file.
                if (!ok) {
                    this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
                        if (leaf.getViewState().type === "pdf" || leaf.getViewState().type === "markdown") {
                            if ((leaf.view as FileView).file == this.mdFile) {
                                leaf.detach();
                            } else if ((leaf.view as FileView).file == this.pdfFile) {
                                leaf.detach();
                            }
                        }
                    });
                }
                if (!ok) {
                    this.pdfFile = null;
                    this.mdFile = null;
                    this.pairOpen = false;
                }
            } else {
                if (leaf.getViewState().type == "pdf") {
                    this.pairOpen = true;
                    // We automatically know that we need to open the companion .md
                    const mdFilePath = (leaf.view as FileView).file.name.replace(".pdf", ".md");
                    let newLeaf = true;
                    this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
                        if (leaf.getViewState().type == "markdown") {
                            newLeaf = false;
                        }
                    });
                    this.app.workspace.openLinkText(mdFilePath, '', newLeaf).then(()=> {  
                        this.pdfFile = (leaf.view as FileView).file;
                        this.mdFile = (this.app.workspace.activeLeaf.view as FileView).file;
                        console.log("this.pdfFile:", this.pdfFile);
                        console.log("this.mdFile:", this.mdFile);
                    });
                } else if (leaf.getViewState().type == "markdown") {
                    // Does this markdown file link with a .PDF ?
                    const pdfFilePath = (leaf.view as FileView).file.name.replace(".md", ".pdf");
                    let pdfFile = this.app.metadataCache.getFirstLinkpathDest(pdfFilePath, "");
                    if (pdfFile != null) {
                        this.pairOpen = true;
                        let newLeaf = true;
                        this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
                            if (leaf.getViewState().type == "pdf") {
                                newLeaf = false;
                            }
                        });
                        // Open it up!
                        this.app.workspace.openLinkText(pdfFilePath, '', newLeaf).then(()=> {
                            this.pdfFile = (this.app.workspace.activeLeaf.view as FileView).file;
                            this.mdFile = (leaf.view as FileView).file;
                            console.log("this.pdfFile:", this.pdfFile);
                            console.log("this.mdFile:", this.mdFile);
                        });
                    }
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