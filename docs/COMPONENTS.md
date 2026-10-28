# Components, defaults and instance overrides

Webflow's former Symbols are now Components. A main component owns the shared structure, styles and exposed properties. An instance keeps its own values only for properties explicitly overridden. Updating a default affects instances that inherit it. Reset removes an override, so the instance follows future defaults again; it does not merely copy today's default. Resetting all properties restores inheritance for the entire instance. An explicit override remains an override even when its value happens to equal the current default.

Sources:
- [Components overview](https://help.webflow.com/hc/en-us/articles/33961303934611-Components-overview)
- [Component properties](https://help.webflow.com/hc/en-us/articles/33961219350547-Component-properties)
- [Property defaults versus instance overrides](https://developers.webflow.com/data/docs/working-with-localization/localize-components)

## Editing here

Select a component in the section or on the canvas. Its filled four-part diamond distinguishes it from a text, image or ordinary link. The inspector opens the instance. Blue property labels indicate overrides; **Reset** restores inheritance for one property and **Reset all properties** restores them all. **Edit main component** opens the defaults, and **Back to instance** returns to the selected instance. Main edits remain in the shared draft and go live after publishing.

The initial connected components are Main button, Glass card and Circle arrow. A Glass card's nested Main button is independently selectable and uses the shared Main button definition. Ordinary links, the logo and telephone text are elements, not independent reusable component definitions.

The current property editor exposes the content and link properties of these components. Structure and CSS remain in their Astro source files; this CMS is not a visual structure/style designer. New reusable Astro components need a stable component identifier and an explicit property definition. Automatically discovering a DOM element does not by itself make that element reusable.

Existing explicit site content is preserved as initial overrides when it differs from the original component default. This avoids replacing all existing button labels on migration. Reset the properties that should follow shared defaults. Matching initial values inherit their default. Desktop/mobile renderings bound to the same component instance ID share the same overrides. Instance identity uses the page and the component's content path or an explicit stable ID.

`content.components` stores shared defaults and `content.componentInstances` stores local overrides and the properties reset to inheritance. The same resolver is used during Astro rendering and draft preview. Component values can refer to existing Const values. Const references appear as inline chips in property fields. Surrounding text stays editable; deleting a chip removes only that reference from the property. Double-clicking a chip opens its shared Const value.

## DOM grouping

The inspector groups actual rendered DOM nodes. Explicit component roots define component boundaries; a nested component owns its own fields. A normal anchor groups its label and link. Image attributes belong to the actual media element; separate nearby text stays a text element. CMS arrays remain collections. Elements and components inside a rendered CMS record appear only inside that record, including their property and main-component editors. Clicking them on the canvas opens the containing collection and record. Explicit `data-cms-item` / `data-cms-collection` boundaries take precedence; otherwise record boundaries are inferred from indexed content bindings and their common DOM containers. Additional guessed fields from JSON are no longer mixed into the element inspector. This removes duplicate logical fields and incorrect image classification caused by names such as `photoAlt`.

DOM positions identify ordinary elements. Component IDs identify reusable instances, independently of their visual grouping. Reordering a CMS record is safe for components with explicit record IDs; content-path-based identifiers that contain array indexes should be replaced with stable record identifiers when introducing new nested reusable components.

## Scope

This implements shared property defaults, per-instance overrides, per-property/all-property reset, nested component boundaries, draft preview and published rendering. Slots, arbitrary component creation, detaching instances, a visual structure editor and Webflow-style class/style editing are not part of this CMS change.

## Nested element navigation

The section lists only root groups. A child component or media element appears inside its nearest parent group, following the rendered DOM hierarchy. A nested button opens from its card; Back returns to that card. Direct canvas selection can still open a nested element immediately. The same hierarchy applies inside CMS records.
