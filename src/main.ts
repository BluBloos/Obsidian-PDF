/* Things to fix before publishing as a legit Obsidian plugin. */
// TODO(Noah): Remove all cases of user data loss.
/* Things to fix before publishing as a legit Obsidian plugin. */

// TODO(Noah): The worker.js of pdfjs should be bundled with our app over
//     retrieving from a CDN as this places a requirement for our plugin users
//     to have an internet connection.
// TODO(Noah): Fig bug where things are not working if we have opened Obsidian
//     and a "PDF file" is already open.
// TODO(Noah): Figure out how we can sensibly do headers.
// TODO(Noah): When there is major loading going on ... add a loading bar.
//     i.e. change the semantics surrounding plugin speed impact.

/*
How should the PDF updating process work?
- We have access to the file modified time.
- We could store a thing in our app memory -> last time that WE,
the Obsidian-PDF plugin, have processed the PDF.
- We simply need to compare the modified time with the time
that we have recorded to see if they are different. If they are,
do the extract and update the mtime cache.
- We're not going to register any hooks. Simply run this logic
whenever we open a "PDF object".
*/

import
{addIcon, FileView, Plugin, TFile, WorkspaceLeaf, Notice} from 'obsidian';
import * as pdfjs from 'pdfjs-dist';
import {PDFPageProxy} from 'pdfjs-dist/types/src/display/api';

addIcon('extract', '<path d="M16 71.25L16 24.5C16 19.8056 19.8056 16 24.5' +
  '16L71.25 16C75.9444 16 79.75 19.8056 79.75 24.5L79.75 41.5L71.25' +
  '41.5L71.25 24.5L24.5 24.5L24.5 71.25L41.5 71.25L41.5 79.75L24.5' +
  '79.75C19.8056 79.75 16 75.9444 16 71.25ZM42.7452 48.725L48.7547' +
  '42.7325L75.5 69.4778L75.5 54.25L84 54.25L84 84L54.25 84L54.25' +
  '75.5L69.4862 75.5L42.7452 48.725Z" fill="white" fill-opacity="0.5"/>');

/**
 * The ObsidianPDF class contains all logic pertaining to the
 * Obsidian-PDF plugin.
 *
 * In the context of this plugin, a "PDF object" represents a .pdf and .md file
 * pair.
 */
export default class ObsidianPDF extends Plugin {
  pairOpen : boolean = false;
  pdfFile : TFile = null;
  mdFile : TFile = null;

  /**
   * Takes in a markdown string, returning that string in "pretty print"
   * format.
   *
   * @param md input markdown string
   * @return the input markdown string with consecutive space
   * characters removed and wikilinks collapsed.
   */
  prettyPrintMd(md : string) : string {
    let mdPretty : string = '';
    // Go through string to ensure that there are never consecutive
    // space characters.
    for (let i : number = 0; i < md.length; i++) {
      const b = md.charAt(i) == ' ' && mdPretty.endsWith(' ');
      if (!b) {
        mdPretty += md.charAt(i);
      }
    }
    // Collapse wikilinks.
    // @ts-ignore
    mdPretty = mdPretty.replaceAll('[ [', '[[').replaceAll('] ]', ']]');
    return mdPretty;
  }

  /**
   * Given a leaf that was just navigated to by the user, consider if it
   * might belong to a "PDF object". If it does, open that "PDF object".
   *
   * @param leaf The leaf that the user just navigated to.
   */
  async freshOpenMdPdf(leaf: WorkspaceLeaf) : Promise<void> {
    if (leaf.getViewState().type == 'pdf') {
      this.pairOpen = true;
      // We automatically know that we need to open the companion .md
      const mdFilePath =
        (leaf.view as FileView).file.name.replace('.pdf', '.md');
      let newLeaf = true;
      this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
        if (leaf.getViewState().type == 'markdown') {
          newLeaf = false;
        }
      });
      await this.app.workspace.openLinkText(mdFilePath, '', newLeaf);
      this.pdfFile = (leaf.view as FileView).file;
      this.mdFile =
        this.app.workspace.getActiveViewOfType(FileView).file;
      // Check to see if file requies updating.
      const file = this.app.vault.getAbstractFileByPath(mdFilePath);
      if (file instanceof TFile) {
        const mdFileStr : string = await this.app.vault.read(file);
        const reMatches = mdFileStr.match(/modifiedDate: \d+/);
        if (reMatches == null) {
          new Notice('WARNING from Obsidian-PDF: The yaml frontmatter of ' +
            'your .md is corrupted. Please fix by adding the modifiedDate' +
            ' key with a number value in UTC time.');
        } else {
          const mdTime = Number(reMatches[0].substring(14).toString());
          if ((leaf.view as FileView).file.stat.mtime !== mdTime) {
            this.extract();
          }
        }
      }
    } else if (leaf.getViewState().type == 'markdown') {
      // Does this markdown file link with a .PDF ?
      const pdfFilePath =
        (leaf.view as FileView).file.name.replace('.md', '.pdf');
      const pdfFile =
        this.app.metadataCache.getFirstLinkpathDest(pdfFilePath, '');
      if (pdfFile != null) {
        this.pairOpen = true;
        let newLeaf = true;
        this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
          if (leaf.getViewState().type == 'pdf') {
            newLeaf = false;
          }
        });
        // Open it up!
        await this.app.workspace.openLinkText(pdfFilePath, '', newLeaf);
        this.pdfFile = this.app.workspace.getActiveViewOfType(FileView).file;
        this.mdFile = (leaf.view as FileView).file;
      }
    }
  }

  /**
   * Closes the currently open "PDF object".
   */
  closePDF() : void {
    this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
      if (leaf.getViewState().type === 'pdf' ||
        leaf.getViewState().type === 'markdown') {
        if ((leaf.view as FileView).file == this.mdFile) {
          leaf.detach();
        } else if ((leaf.view as FileView).file == this.pdfFile) {
          leaf.detach();
        }
      }
    });
  }

  /**
   * Unload Obsidian-PDF state.
   */
  async unload() : Promise<void> {
    this.app.workspace.off('active-leaf-change', (leaf : WorkspaceLeaf) => {
      this.closePDF();
      this.pairOpen = false;
      this.pdfFile = null;
      this.mdFile = null;
    });
  }

  /**
   * Hook into Obsidian callbacks to support runtime behaviour of Obsidian-PDF.
   */
  async onload() : Promise<void> {
    this.pairOpen = false;
    this.pdfFile = null;
    this.mdFile = null;
    pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.15.349/pdf.worker.js';

    this.registerEvent(this.app.workspace.on(
        'active-leaf-change', (leaf : WorkspaceLeaf) => {
          if (this.pairOpen) {
            let foundMdLeaf = (this.mdFile == null) ? true : false;
            let foundPdfLeaf = (this.pdfFile == null) ? true : false;
            // Check all leaves to see if our files still exist.
            this.app.workspace.iterateAllLeaves((leaf : WorkspaceLeaf) => {
              if (leaf.getViewState().type === 'pdf' ||
              leaf.getViewState().type === 'markdown') {
                if ((leaf.view as FileView).file == this.mdFile) {
                  foundMdLeaf = true;
                } else if ((leaf.view as FileView).file == this.pdfFile) {
                  foundPdfLeaf = true;
                }
              }
            });
            const ok = foundMdLeaf && foundPdfLeaf;
            // If either of our leaves are no longer present,
            // we must "close" the PDF file.
            if (!ok) {
              this.closePDF();
            }
            if (!ok) {
              this.pdfFile = null;
              this.mdFile = null;
              this.pairOpen = false;
              if (leaf.getViewState().type === 'pdf' ||
              leaf.getViewState().type === 'markdown') {
              // Need to reinvoke a leaf change arbitrarily.
                this.freshOpenMdPdf(leaf);
              }
            }
          } else {
            this.freshOpenMdPdf(leaf);
          }
        }),
    );
  }

  // TODO(Noah): Can we do some Git magic to replace just those places in the
  // document that pertain to the PDF, and leave whatever annotations that you
  // written it?
  /**
   * Provided that a "PDF object" is currently open, parse the PDF binary
   * for text and convert to markdown. Update the corresponding .md with
   * the new markdown.
   *
   * If a .md is corrupted (i.e. it is missing the special "# PDF Metadata"
   * header), the user data will be overwritten entirely with the updated
   * PDF to markdown content.
   */
  async extract() : Promise<void> {
    if (this.pairOpen) {
      const pdfFile = this.pdfFile;
      if (pdfFile === null) return;
      if (pdfFile.extension !== 'pdf') return;
      const arrayBuffer = await this.app.vault.readBinary(pdfFile);
      const buffer = Buffer.from(arrayBuffer);
      const doc = await pdfjs.getDocument(buffer).promise;
      let resultMD = `---\nmodifiedDate: ${pdfFile.stat.mtime}\n---\n`;
      for (let i : number = 1; i <= doc.numPages; i++) {
        resultMD += `\n# Page ${i}\n`; // Page divider.
        const page : PDFPageProxy = await doc.getPage(i);
        // process page
        const textContent = await page.getTextContent();
        textContent.items.forEach((item) => {
          // @ts-ignore
          if (item.str != undefined) {
            // @ts-ignore
            resultMD += item.str + ' ';
          }
        });
        // TODO(Noah): Add the marked content consideration.
      }
      const prettyMD = this.prettyPrintMd(resultMD);
      const mdFilePath = pdfFile.name.replace('.pdf', '.md');
      const mdFile = this.app.vault.getAbstractFileByPath(mdFilePath);
      if (mdFile instanceof TFile) {
        const existingContent = await this.app.vault.read(mdFile);
        if (!existingContent.includes('# PDF Metadata')) {
          new Notice('WARNING from Obsidian-PDF: Your .md is corrupted.' +
            ' Please fix by adding \"# PDF Metadata\" and including' +
            ' your user data afterwards.');
        } else {
          const _existingContent = existingContent.split('# PDF Metadata');
          const userContent =
            (_existingContent.length > 1) ? _existingContent[1] : '';
          await this.app.vault.modify(
              mdFile, prettyMD + '\n# PDF Metadata' + userContent);
        }
      } else {
        await this.app.vault.create(
            mdFilePath, prettyMD + '\n# PDF Metadata\n');
      }
    }
  }
};
