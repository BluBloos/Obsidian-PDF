/* Things to fix before publishing as a legit Obsidian plugin. */
// TODO(Noah): If the PDF file has changed since last, rerun the extract algo. Remove the overwrite (should never 
// overwrite the data of users).
// TODO(Noah): Remove things from the bundle if you can -> esbuild exclude stuff.
// TODO(Noah): Add eslint to our build process to have it give us suggestions for how to improve.
// TODO(Noah): Get rid of debug print statements.
/* Things to fix before publishing as a legit Obsidian plugin. */

// TODO(Noah): The worker.js of pdfjs should be bundled with our app over retrieving from a CDN.
// -> this places a requirement for our plugin users to have an internet connection.
// TODO(Noah): Fig bug where things are not working if we have opened Obsidian and a "PDF file" is already open.
// TODO(Noah): Figure out how we can sensibly do headers.
// TODO(Noah): When there is major loading going on ... add a loading bar.

import { addIcon, FileView, Plugin, TFile, Workspace, WorkspaceLeaf } from 'obsidian';
//import pdf2md from '@opendocsg/pdf2md'
import * as pdfjs from "pdfjs-dist";
//import * as worker from "pdfjs-dist/build/pdf.worker.entry.js";
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

addIcon('extract', '<path d="M16 71.25L16 24.5C16 19.8056 19.8056 16 24.5 16L71.25 16C75.9444 16 79.75 19.8056 79.75 24.5L79.75 41.5L71.25 41.5L71.25 24.5L24.5 24.5L24.5 71.25L41.5 71.25L41.5 79.75L24.5 79.75C19.8056 79.75 16 75.9444 16 71.25ZM42.7452 48.725L48.7547 42.7325L75.5 69.4778L75.5 54.25L84 54.25L84 84L54.25 84L54.25 75.5L69.4862 75.5L42.7452 48.725Z" fill="white" fill-opacity="0.5"/>')

export default class ObsidianPDF extends Plugin {

    pairOpen : boolean = false;
    pdfFile : TFile = null;
    mdFile : TFile = null;

    isPairOpen() : boolean {
        return this.pairOpen;
    }

    prettyPrintMd(md : string) {
        let mdPretty : string = "";
        // Go through string to ensure that there are never consecutive space characters.
        for (let i : number = 0; i < md.length; i++) {
            let b = md.charAt(i) == ' ' && mdPretty.endsWith(" ");
            if (!b) {
                mdPretty += md.charAt(i);
            }           
        }
        // Collapse wikilinks. 
        // @ts-ignore
        mdPretty = mdPretty.replaceAll("[ [", "[[").replaceAll("] ]", "]]")
        return mdPretty;
    }

    async freshOpenMdPdf(leaf : WorkspaceLeaf) {
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
            await this.app.workspace.openLinkText(mdFilePath, '', newLeaf);
            this.pdfFile = (leaf.view as FileView).file;
            this.mdFile = this.app.workspace.getActiveViewOfType(FileView).file;
            console.log("this.pdfFile:", this.pdfFile);
            console.log("this.mdFile:", this.mdFile);
            // Check to see if file is corrupted.
            const file = this.app.vault.getAbstractFileByPath(mdFilePath);
            if (file instanceof TFile) {
                let mdFileStr : string = await this.app.vault.read(file);
                if (!mdFileStr.includes("# PDF Metadata")) {
                    this.extract();
                }
            }
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
                await this.app.workspace.openLinkText(pdfFilePath, '', newLeaf);
                this.pdfFile = this.app.workspace.getActiveViewOfType(FileView).file;
                this.mdFile = (leaf.view as FileView).file;
                console.log("this.pdfFile:", this.pdfFile);
                console.log("this.mdFile:", this.mdFile);
            }
        }
    }

    closePDF() {
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

    async unload() {
        this.app.workspace.off('active-leaf-change', (leaf : WorkspaceLeaf) => {
            /* Close PDF. */
            this.closePDF();
            this.pairOpen = false;
            this.pdfFile = null;
            this.mdFile = null;
        });
    }

    async onload() {
        
        this.pairOpen = false;
        this.pdfFile = null;
        this.mdFile = null;
        pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.15.349/pdf.worker.js";

        this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf : WorkspaceLeaf) => {
            console.log("active-leaf-change event triggered with leaf type = ", leaf.getViewState().type);
            if (this.isPairOpen()) {
                let foundMdLeaf = (this.mdFile == null) ? true : false;
                let foundPdfLeaf = (this.pdfFile == null) ? true : false;
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
                    this.closePDF();
                }
                if (!ok) {
                    this.pdfFile = null;
                    this.mdFile = null;
                    this.pairOpen = false;
                    if (leaf.getViewState().type === "pdf" || leaf.getViewState().type === "markdown") {
                        // Need to reinvoke a leaf change arbitrarily.
                        this.freshOpenMdPdf(leaf);
                    }
                }
            } else {
                this.freshOpenMdPdf(leaf);
            }
        }));
    }

    async extract()  {
        if (this.pairOpen) {
            let file = this.pdfFile;
            if(file === null) return;
            if(file.extension !== 'pdf') return;
            let arrayBuffer = await this.app.vault.readBinary(file);
            console.log("typeof arrayBuffer === \"object\"", typeof arrayBuffer === "object");
            console.log("arrayBuffer !== null", arrayBuffer !== null);
            console.log("arrayBuffer.byteLength", arrayBuffer.byteLength !== undefined);
            const buffer = Buffer.from(arrayBuffer);
            let doc = await pdfjs.getDocument(buffer).promise;
            let resultMD = "";
            console.log("doc.numPages", doc.numPages);
            for (let i : number = 1; i <= doc.numPages; i++) {
                resultMD += `\n# Page ${i}\n`; // Page divider.
                let page : PDFPageProxy = await doc.getPage(i);
                // debug time!
                let annotations = page.getAnnotations();
                console.log("annotations", annotations);
                let structTree = await page.getStructTree();
                console.log("structTree", structTree);
                // process page
                let textContent = await page.getTextContent();
                console.log("textContent", textContent); 
                textContent.items.forEach(item => {
                    // @ts-ignore
                    if (item.str != undefined) {
                        // @ts-ignore
                        resultMD += item.str + ' ';
                    }
                });
                // TODO(Noah): Add the marked content consideration.
            }
            const mdFilePath = file.name.replace(".pdf", ".md");
            await this.saveToFile(mdFilePath, this.prettyPrintMd(resultMD));
        }
	}

    async saveToFile(filePath: string, mdString: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			await this.overwriteFile(file, mdString);
		} else {
			await this.app.vault.create(filePath, mdString + "\n# PDF Metadata\n");
		}
	}

    /*
     * TODO(Noah): Can we do some Git magic to replace just those places in the document that
     * pertain to the PDF, and leave whatever annotations that you written it?
     */
	async overwriteFile(file: TFile, note: string) {
		let existingContent = await this.app.vault.read(file);
        if (!existingContent.includes("# PDF Metadata")) {
            existingContent += "\n# PDF Metadata";
        }
        let _existingContent = existingContent.split("# PDF Metadata");
        let userContent = (_existingContent.length > 1) ? _existingContent[1] : "";
		await this.app.vault.modify(file, note + "\n# PDF Metadata" + userContent);
	}
};

// Alas. Things are not as simple as they seem. We must be more careful here.
// I'm thinking that we maybe have a, "pair is open". Idea going on. My own state
// management type thing.
//
//  Of course, we have to consider the user reloading the plugin randomly. 
//  Which means that maybe on load we also make sure to check the open leafs for a pair -> 
//  and adjust the state accordingly -> so that state is ALWAYS valid.