# Project instructions

## Source of truth

The website's source code and physical files are the source of truth. The CMS is a visual interface for editing those files, not an independent content store that silently diverges from the project.

- Read `GEMINI.md`, `.gemini/LEARNINGS.md`, and `docs/CMS_CONTENT_STANDARD.md` for project conventions. These source-of-truth rules override older documentation describing catalog-only media organization or a separate Publish folders phase.
- Media names are real filenames; folders are physical directories under `public/assets`. Media operations are prepared as a persistent draft. Publish applies filename/folder changes to disk with all known project references updated in the same operation. Draft previews may represent planned names and folder membership, but after Publish the physical files and references must match those choices.
- Derive the library's names, paths, folders and file existence from the filesystem. A catalog may store supporting metadata such as alt text, never a conflicting file structure.
- Update absolute URLs, URL-encoded paths, relative references, content JSON, component properties, Const values, CSS, markup, scripts, and active drafts when changing an asset path. Preserve query strings and fragments. Updating only what is visible on the current page is insufficient.
- Do not create symlinks or duplicate files to hide incomplete reference updates. Old builds and external caches are outside the live project's source graph; use explicit deployment redirects if a future hosting integration requires them.
- A used file cannot be deleted while preserving the same visual result. Before deletion, require its references to be removed or explicitly replaced. Block deletion when live source, drafts, relative imports or a known dynamic asset generator still uses the file. Never silently clear image fields or remove arbitrary DOM elements.
- Refuse operations whose computed paths cannot be rewritten reliably. Identify the source that needs an explicit CMS binding. Do not report success with potentially broken references.
- Preflight paths and collisions, serialize media mutations, check for concurrent source changes, preserve recovery copies, and roll back partial operations on failure. Never overwrite unrelated destination files.
- Before Publish, one chronological project history routes Undo/Redo across text, CMS records, component/Const and media draft changes, independently of the selected workspace tab. Discard removes pending changes without modifying published files. Publish creates a new baseline and archives recovery copies of real file/source changes. Resynchronize open editor state and draft revisions after filesystem changes.
- Both content and media use a draft/publish boundary. There is exactly one project Publish action. It applies all content, CMS records, component/Const and media drafts together after checking revisions. Do not add module-specific Publish or Discard controls. File operations become effective only at publication. Remote deployment remains a separate concern.

## Working agreement

Communicate in Ukrainian; CMS interface text should be short English. The user is currently checking behavior manually and has requested that agents not run tests unless they ask for them again. Preserve existing uncommitted work.

## Video binding integrity

Show a real controls-enabled video preview, its current path and load errors; do not represent a connected video with a decorative Video placeholder. Distinguish video, image and poster pickers. When a source URL changes, update its MIME type and call video.load(); do not reload unchanged media on unrelated draft edits. Use explicit CMS bindings on video poster and source elements. Browser playback errors must remain visible, since an MP4 extension alone does not guarantee a supported codec.

## CMS record ownership and media grouping

A section's static headings, descriptions and background media must stay in its section inspector. Never expand an inferred record boundary up the DOM merely because only the first record is currently rendered. Use a field's indexed path, or an explicit data-cms-collection/data-cms-item boundary. Conservative inference may use the smallest unambiguous container and must reject containers containing static fields or multiple record identities. Ambiguous content remains at section level until explicitly bound.

Shared slider/scroll-step views must update their record index, field paths and component instance descriptors together when the active record changes. Selecting a CMS item must select that view's record and prevent scroll/autoplay from silently switching it while editing.

Image source and alt/description belong to one media group, including inside CMS records. Group by the actual media owner and explicit source binding, not by the JSON property's spelling. Repeated visual uses of the same record image may share one source field; retain their relevant alt fields in that media group. Never infer a separate text card named Image for an image attribute. DOM discovery must not deduplicate a shared binding before determining ownership for every rendering.

## One project workspace

The page editor, CMS collections/pages, Media, Const and settings are views of one project draft. They must share pending state, chronological Undo/Redo and the same Publish action. Switching views must never silently switch the meaning of Undo or restrict publication to the current view. Flush open forms before presenting the shared publication summary. Publish validates all pending entries and revisions before applying changes; preserve a complete recovery snapshot and roll the whole project back on a failed step. Module-specific publish endpoints must not bypass the project action.
