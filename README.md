# Obsidian-PDF
Plugin to enable PDF files as first class citizens within an Obsidian vault.

## The How

- PDFs are stored as symbolic links within the vault.
  - This enables another tool more suited to editing PDFs manage the files where and how it pleases.
 
---

- PDFs show in the Obsidian File explorer when browsing the vault.
- The PDF file name is used as the "note" name.
- You can open a PDF file to view it.
- Clicking "edit" invokes iPad for Apple Pencil drawing experience.
- PDFs can contain wikilinks (hand-drawn). Clicking on them will traverse the Obsidian graph like normal.
- PDF to markdown technology is a supported mode of PDF viewing (as a mode, it can mimized if desired). This mode presents the transcribed text to the right of the PDF in a dual pane configuration.
  - In this mode, we are free to add text below the transcibed text. The transcibed text is locked and fully linked with the PDF contents, i.e. it is only editable by editing the PDF itself.
- The existence of the transcibed text enables text-searching for PDFs (or maybe the PDFS are already composed of text by nature of the external drawing tool).
- As you edit PDFs on the iPad, these update in realtime when inside Obsidian on macOS (we suspect this will be accomplished via iCloud sync).

---

- Everything that you would expect to work on iPad works.
  - Wikilinks work.
  - As you browse through files on the iPad, Obsidian on macOS follows.
