# CMS fields: contract for sites and agents

This is the field catalog for preparing a site for the CMS. Read it alongside CMS_CONTENT_STANDARD.md. Website source files remain the source of truth. The form schema describes how those values are edited; it does not replace source content with an independent store.

## Ownership and storage

Collection schemas live in the home page content under `editorSettings.collectionSchemas[scope]`:

- `page:posts` and `page:projects` describe standalone article/project records.
- `content:<array.path>` describes an inline collection from page content.
- Each schema contains `name`, ordered `groups` (`id`, `label`) and ordered `fields`.
- Each field has stable `id`, `key`, `label`, `type`, `group`; optional settings are `required`, `help`, `default`, `options`, `collection`, `min`, `max`.
- Built-in keys such as `title`, `slug`, `body`, `cover.src` keep their source ownership. User fields use `custom.<camelCaseKey>` inside each item. A user field key is derived from its initial name and is unique within the schema. Renaming a saved field never changes its key or ID.
- Form groups are always visible. `hidden` is a legacy property and is no longer an authoring option; the schema adapter exposes all configured fields.

For an example definition:

```json
{
  "name": "Articles",
  "groups": [{ "id": "details", "label": "Details" }],
  "fields": [
    { "id": "audience", "key": "custom.audience", "label": "Audience", "type": "select", "group": "details", "options": ["Homeowners", "Partners"], "default": "Homeowners" },
    { "id": "featured", "key": "custom.featured", "label": "Featured", "type": "checkbox", "group": "details", "default": false }
  ]
}
```

The matching item contains ordinary authored values:

```json
{ "custom": { "audience": "Partners", "featured": true } }
```

## Supported field catalog

| Type | Stored value | Configuration and default control |
| --- | --- | --- |
| `text` | string | One-line input; optional text default |
| `textarea` | string | Multiline text; multiline default |
| `richtext` | companion block document plus plain text | Block editor; no schema default |
| `number` | finite number | Numeric default, optional minimum/maximum |
| `checkbox` | boolean | Checked-by-default switch; never a string `"true"` |
| `date` | `YYYY-MM-DD` string | Calendar; optional calendar default |
| `datetime` | ISO 8601 UTC string | Calendar and local time; optional date/time default |
| `url` | safe URL string | Link input; optional URL default |
| `email` | email string | Email input; optional email default |
| `phone` | phone string | Phone input; optional phone default |
| `select` | one string from `options` | Unique options; default dropdown |
| `multiselect` | array of strings from `options` | Unique options; default checkboxes |
| `status` | one string from `options` | Custom editorial stages; default dropdown |
| `image` | URL string, plus owned alt value where bound | Image picker/settings; optional URL default |
| `file` | safe URL string | File picker; optional URL default |
| `gallery` | ordered array of `{src, alt}` | Image grid, shared grid sorter; no schema default |
| `reference` | stable target item ID string | Required target collection; no schema default |
| `multireference` | ordered array of unique stable target IDs | Required target collection; no schema default |
| `slug` | normalized URL segment string | Built-in page field; auto from title until manually edited |

A custom `status` field is authored content. It does not replace the system Active / Inactive switch. The latter routes through archive/restore in the project draft and becomes effective on the public site only after the shared Publish.

## Defaults and validation

A default is a fallback for a missing or null value; explicit values, including `false`, `0` and an empty string, are preserved. Updating a schema default does not rewrite existing source values. If a site template initializes an explicit empty value, that value takes precedence over the fallback. When preparing a new item template, omit optional custom values that should use a schema fallback.

The field designer offers controls appropriate to the chosen type. Defaults for select/status must be configured options; multiselect defaults are arrays; checkbox defaults are booleans; numeric defaults must satisfy the bounds. Unsupported complex defaults are not offered. Required validation is separate from the default. Saving a field updates the designer draft; Save layout applies the schema to the project draft. Shared Publish validates actual records, defaults, rich documents, references and revisions.

References target active items by stable IDs, never labels or array indices. Labels resolve from current source content. Adding a reference to an inline collection requires IDs for its items. Archive/delete must not leave broken public references. Removing a field from the form preserves its stored content and remains undoable; it does not authorize deleting authored data.

## Rich content and media

For a rich field with key `body`, store the structured document at `item.richText.body` and its plain-text companion at `item.body`. User rich fields use `item.richText["custom.<key>"]` and `item.custom.<key>`. Use `rich-text-model.mjs` for text extraction, validation and escaped public rendering. Do not build arbitrary HTML from stored strings.

Image block source, alt and caption belong to the same block. The image dialog exposes metadata for Upload, Library and Link alike, with one Save image action. Gallery entries remain `{src, alt}`; rich image captions are separate block metadata. A chosen file may still be a Media draft: use the library's preview URL while editing, persist its source URL and let shared Publish apply it to disk.

## Agent integration checklist

1. Choose the collection's physical source records/array and stable identities.
2. Reuse built-in fields; add custom definitions only for authored values that belong to the item. Section headings and backgrounds remain section-owned.
3. Add groups/field order to the project schema, not to a separate per-page schema.
4. Bind source fields to actual rendering with stable `data-cms-*` bindings, including source/alt pairs and `data-cms-collection` / `data-cms-item` boundaries.
5. Render rich documents with the allowlisted renderer and shared site typography. Keep counters and derived UI technical, not editable fields.
6. Use shared form, image, date, reference, switch and sorting components. Keep new control states in UI Kit.
7. Stage edits in the existing project history/draft. Never bypass the shared Publish transaction.

Implementation map: `cms-schema-model.mjs` owns schema adaptation and value validation; `cms-schema-editor.mjs` owns type selection/settings; `cms-properties.mjs` owns forms; `date-control.mjs`, `media-editor.mjs`, `rich-text-editor.mjs` and `ui-components.mjs` own shared controls. Server schemas live in `cms/model.mjs`, configured record validation in `cms/custom-fields.mjs`, public field output in `cms/published-fields.mjs`.

## Mandatory fields for every CMS Page

A page collection always exposes its primary name/title field, `slug`, `seo.title` and `seo.description`. The shared adapter injects missing definitions into older schemas, marks them built-in/required and preserves their canonical types. Authors cannot remove these fields or clear Required. Grouping and labels may be edited without changing the source keys. For inline collections promoted to pages, an existing name/title/question key remains the primary name; otherwise `title` is added. Missing values must be authored before Publish. Existing source text is not replaced with generated SEO copy.

Inline page slugs are validated for format and uniqueness in that collection before publication. Their public route uses the authored slug; records without one keep their legacy route until the required page values are supplied and published. Stable record IDs remain the reference identity. Title edits generate slugs until a manual override, and new page items initialize that automatic mode.

`ogImage` is an optional built-in image field for CMS Pages; `ogImageAlt` stores its owned alt text. Static pages have the same optional image and alt in `pageSettings[path]`. Open Graph title and description fall back to page SEO, with page settings overrides available. Public layouts receive entry images and output an absolute `og:image`, its alt text and actual dimensions/MIME metadata. These fields are metadata, not article body content.

### Open Graph image policy

This project uses one output size: **1200 × 630**, JPG or PNG. It is the CMS policy for consistent share cards, not a claim that the Open Graph protocol mandates one universal size. Webflow recommends consistent image sizes and illustrates these dimensions in its social-share documentation: https://help.webflow.com/hc/en-us/articles/33961370297107-Control-the-look-of-social-shares-with-Open-Graph . The protocol's image dimension and alt properties are described at https://ogp.me/ .

- Exact-size JPG/PNG sources can be selected directly.
- Sources smaller than either required dimension are rejected with their actual size and a request to upload another image. They are never silently upscaled.
- Other sufficiently large sources require the crop dialog. It previews the exact output frame and allows zoom/horizontal/vertical framing without upscaling. WebP sources are exported as JPG; PNG transparency is retained.
- A crop creates an image derivative through the existing Media draft upload and history. The chosen source remains intact. The property keeps the returned asset URL and alt text.
- Upload, Library and Link use the same validation. Browser URL loading requires normal CORS access; persisted OG images are local project assets.
- Shared Publish checks actual source or pending replacement/upload bytes with Sharp, rejecting missing images, wrong formats and any dimensions other than 1200 × 630. Client-only dimension checks are insufficient.

Shared components: `open-graph-editor.mjs` and `media-editor.mjs`; server checks and metadata: `cms/open-graph.mjs`. Agents adding another OG location must use these components and include it in server publication validation.


### Workspace navigation and reference presentation

Reload restores the selected collection and record from local navigation preferences, resolving stable entry IDs against current drafts. This preference is separate from content, history and Publish. Missing records fall back to their collection. List filters default to all records; Active and Archive are optional filters inside the Filters popover. Changing lifecycle switches continues to stage the shared project draft.

Reference values remain stable IDs. Their shared control renders removable chips, searchable options and a check mark for selected targets. Single-reference selection closes the menu; multireference keeps it open and supports ordering through the shared sortable helper. Populated examples for all supported field types live in UI Kit under Filled CMS fields.


Datetime values may contain a calendar date (`YYYY-MM-DD`) or an ISO timestamp. New selections default to a date without time; the shared Add time switch explicitly enables time. Retain existing timestamps on opening the editor. `publishedAt` validates both formats, including calendar-day validity, so disabling time does not create a malformed draft.


Portfolio project pages reuse SinglePointContactSection in accordion-only mode for references to `content:sections.singlePointContact.accordionItems`. Resolve configured reference/multireference fields against the source collection's stable IDs, preserve selected order, deduplicate IDs and omit missing/inactive records. Empty selections render no accordion. Bind rendered records to their original source indices. Exclude those references from generic extra-field labels/links to avoid duplicate output. Changes to selections remain draft until shared Publish.

Duplicate copies authored fields and reference IDs into a fresh record identity; it does not duplicate reference targets. Page copies receive an automatic unique slug. All duplicates are ordinary drafts and participate in project history and shared Publish.
