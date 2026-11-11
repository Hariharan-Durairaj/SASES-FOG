# How to edit Emergency Information

Work only inside the agreed OneDrive app folder. Changes normally appear after the next 15-minute sync. Use the GitHub Actions **Run workflow** button when an urgent test must run immediately.

| In OneDrive | On the app |
|---|---|
| Create a folder at the root | Creates a main home-screen tile |
| Create a folder within a folder | Creates a secondary tile |
| Add a `.docx` file | Creates a content page named after the file |
| Put exactly one document in a folder with no subfolders | The folder tile opens that document directly |
| Start a name with `01 `, `02 `, and so on | Controls order; the number is hidden |
| Add `cover.jpg` or `cover.png` | Uses that image on the folder tile |
| Add other JPG or PNG files to a folder | Shows them as a gallery below the folder content |
| Paste an image into Word | Shows it in the document at a phone-friendly size |
| Start a name with `_` | Keeps that item out of the published app |

## Word formatting

Use Word's built-in **Heading 1**, **Heading 2**, and **Heading 3** styles. The app keeps headings, lists, tables, links, bold, italic, underline, strikethrough, highlighting, text colour, and embedded images. Exact fonts and font sizes are intentionally replaced by the app's accessible phone layout.

## Before publishing

1. Use short, plain titles.
2. Check phone numbers, locations, warnings, and links.
3. Keep images below 10 MB where practical.
4. Close the Word document before expecting a sync; Word temporary files beginning `~$` are ignored.
5. Open the live app while online and confirm the update banner appears, then test the important page in airplane mode.

For an urgent correction that is not appearing, contact the site administrator and provide the OneDrive path and file name.
