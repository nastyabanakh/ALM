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

## Admin design system

Keep the navigation sidebar white and the admin workspace dark. All admin colors must reference the semantic variables in `public/admin/design-tokens.css`; define new literal colors only in that file. Use its typography, spacing, radius and control-size scales instead of local styling values. Keep reusable controls and their states consistent with the live `/admin/ui-kit.html` and `docs/ADMIN_DESIGN_SYSTEM.md`. Preview overlays may share color tokens, but must never load the admin reset or change the website's typography scale.

## UI Kit as design source of truth

The live `/admin/ui-kit.html`, shared UI components and semantic design tokens are the source of truth for admin design. Consult them before implementing UI. Every user-requested design change must update the shared implementation and the UI Kit examples/states in the same change.

Const variables are global to the entire site, including every page and CMS entry. Store definitions only in the project-level `content.consts`; page fields keep references, never page-local copies.

Back and editor breadcrumbs navigate sections, CMS list/item parent levels and element groups inside the Editor tab. They must never open the CMS workspace. Open a collection from its explicit collection card in the block structure (or the CMS navigation tab). Canvas selection stays in the editor. Every element card has a subtle border. Links use a chain-link icon. Canvas hover handles include an icon for every element type. Semantic colors: purple = CMS, green = symbols/components, orange = Const, blue = simple elements.

Use `public/admin/sortable.mjs` for every reorder interaction, following CMS record pointer dragging. Collections/Pages and Const share the grouped list browser. In the inspector, simple element icons are neutral; blue backgrounds identify overridden property labels, with Alt-click reset. Back uses the same quiet style as Cancel. Keep these interactive patterns in the live UI Kit.

## Technical elements excluded from editing

Mark derived/system-owned DOM subtrees with `data-cms-technical="reason"` (for example `slider-counter`, `pagination-status`, or `progress-value`). Use it only for values computed by code, not authored content. Put the marker on the smallest owning wrapper; all descendants are excluded from static/explicit binding discovery, element cards, hover handles and inline editing. Do not attach data-cms-path, data-cms-instance or other editable bindings inside it. Compute counters from the actual item count and active index, including accessible labels; never store their displayed values as independently edited content. Existing data-cms-ignore remains a general exclusion marker; data-cms-technical documents why a derived subtree is excluded.

CMS List/Page is an immutable type badge in the UI. Use compactSearch, loading, targetToggle and folderTree from shared UI components; keep the UI Kit examples current. Target toggles belong to their link group. Group edit actions appear on header hover/focus, with consistent row spacing and aligned counts.

Editor CMS parent navigation: after the last same-record element parent, Back opens that CMS item in the Editor inspector, then the CMS list, then the section. Do not skip to the section or switch workspace tabs. Editor breadcrumbs use the same local routes. CMS list uses database; CMS item uses file-text; both use the CMS purple token. Keep the interactive drilldown example in the UI Kit.

Use public/admin/collection-views.mjs and one renderCollectionView for collection list/item views in both Editor and CMS. The list follows the sortable CMS record rows and includes New item. The item follows the Editor inspector and includes Delete item inside the record. Structural edits use the shared project draft/history/Publish, remap indexed link settings and never attach stale canvas component descriptors to a different record. Preserve an empty collection's field template as editor metadata without retaining deleted text, Const tokens or media references.

Canvas text interaction uses public/admin/canvas-text-edit.js for static and bound fields: a click selects/focuses text without scrolling, Enter begins editing, Escape finishes/commits, Shift+Enter inserts a line break, and double-click begins editing without scrolling. Canvas-origin CMS_FIELD_FOCUS/CMS_HIGHLIGHT_FIELD messages must carry scroll:false. Inspector-origin selection may scroll the canvas. Never convert Const tokens into literal text while entering inline editing; open their Const/field editor instead. Keep the live UI Kit interaction example synchronized.

## CMS data workspace

In the CMS tab, hide the website canvas after opening a collection. Keep collection navigation on the left, an item table with checkbox selection in the middle, and the selected item's editor on the right. Keep both lists visible while editing. The Editor tab retains its canvas and compact CMS drilldown; do not apply the CMS manager layout there. Use cms-manager.mjs and demonstrate the same controls in UI Kit. Bulk Archive/Restore/Delete use shared project drafts/history/Publish. Archiving inline records moves them into archivedCollectionItems, preserving content and owned link settings; restore reinserts and remaps indexed settings. Posts/projects lifecycle actions stage root entryStates with the published revision; only shared Publish may archive source records or delete their files, inside the existing project recovery transaction. Archived entries must be excluded from public routes/content loading. Keep fields autosaved in drafts without adding another Publish action.

CMS collection layouts: `editorSettings.collectionSchemas` is the shared schema source for field groups, order and types. Reflect new CMS control patterns in `public/admin/ui-kit.mjs`. Keep editable values in source entries (`custom.*` for user fields, `richText[<key>]` for block documents); no separate per-page schema. Reference and multireference values are stable target IDs, and target labels are resolved live. Preserve data when removing a field from the form; Publish checks schema values and dangling references. In the CMS tab retain collection and item lists while giving the open item enough width to edit rich articles. Use the allowlisted rich block renderer for public output and never inject untrusted HTML. Continue honoring the user's instruction not to run tests unless they request them again.

When preparing a site or extending collection fields, read `docs/CMS_FIELD_ARCHITECTURE.md` for the supported field catalog, typed defaults, source storage, reference identity and shared control contracts. New field creation begins with icon cards for type selection. Do not restore Hide in form or Generate from title controls; title-based slug updates are automatic until a manual override.

CMS Page forms must always retain their required primary title/name, slug, SEO title and SEO description. Optional Open Graph images in both page settings and CMS pages use the shared 1200×630 crop/validation workflow; read the Open Graph section in `docs/CMS_FIELD_ARCHITECTURE.md` before adding another image field or public metadata output.
