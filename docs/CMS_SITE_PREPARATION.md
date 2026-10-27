# Preparing an Astro site for CMS

Use this checklist when connecting the CMS to another Astro project. The site's page record is the source of editable content. The `consts` object in that record holds values shared across pages and sections. The Admin editor reads the same record and saves changes as a draft before publishing.

## Put these values in Const

Create a Const when **one change should update every use** of a value:

- Main and support phone numbers, including the visible number and its `tel:` link.
- Contact email addresses, including the visible address and its `mailto:` link.
- Street address, service area, opening hours, company/legal name, and social profile URLs when repeated.
- Repeated CTA destinations or other shared links whose destination is maintained centrally.

Keep page titles, section copy, one-off button text, image alt text, and editorial records as ordinary page or CMS fields unless they truly share one value. Never connect two distinct values just because their text happens to look alike. Confirm the canonical value with the site owner before consolidating duplicates.

## Define and connect a variable

Add a stable camelCase key to `content.consts` in the site's page JSON:

```json
{
  "consts": {
    "companyPhone": {
      "label": "Company phone",
      "type": "phone",
      "value": "+1 (206) 555-0192"
    },
    "email": {
      "label": "Email",
      "type": "email",
      "value": "hello@example.com"
    }
  },
  "sections": {
    "headerNav": {
      "phone": "{{const.companyPhone}}",
      "phoneHref": "{{const.companyPhone|tel}}"
    }
  }
}
```

The **entire field value** is the reference. `{{const.key}}` displays the value. `{{const.key|tel}}` formats a phone value as a `tel:` URL; `{{const.key|mailto}}` formats an email value as a `mailto:` URL. These two URL formats are validated against the variable type. Do not place a reference inside other text; create a dedicated field if a sentence needs to be editable independently.

In Astro, read the resolved content as a component prop and mark the visible field with its stable raw-data path:

```astro
<a href={content.sections.headerNav.phoneHref}
   data-cms-path-href="sections.headerNav.phoneHref">
  <span data-cms-path="sections.headerNav.phone">
    {content.sections.headerNav.phone}
  </span>
</a>
```

The page loader resolves references for the published site. The preview resolves the draft without publishing. Admin keeps the raw reference and shows an active variable icon inside the input. Double-click the connected value to edit its shared Const. The preview shows one small variable icon on hover, without persistent labels or frames. Changing the variable updates every connected field in the draft preview. Press Publish to make that value public.

For the current ALM migration, Const is wired into static page fields and page settings. The separate posts and portfolio record editors are scheduled for a later phase; connect those record templates to the same resolver when that phase begins.

## Editor workflow

1. Open **Const** in the left rail. Create a variable with a stable key, readable label, type, and value.
2. In the page editor, use the variable icon inside the right side of a text or link input. The icon becomes prominent on hover. Compatible phone and email links get the correct URL format automatically.
3. A connected input shows the current shared value and an active variable icon. Double-click it, or double-click the value in the preview, to edit globally. The Const editor shows its usage count.
4. Open the variable icon and choose **Unlink** to turn one field back into ordinary page content while keeping its current visible value.
5. Review the usage count and preview before publishing. An unused variable can be deleted; a connected variable cannot be deleted in Admin.

## Current ALM contact data

The header and footer now share `companyPhone` with the site owner's chosen number, `+1 (206) 555-0192`. Both visible numbers and both `tel:` links use this one Const. Email and service area are shared Const values. `address` is prepared as an empty variable because the site does not currently publish a street address.

## Link fields and automatic values

Link controls expose **URL**, **Page**, **Page section**, **Email**, and **Phone**, plus **This tab / New tab**. URL, Email, and Phone values accept a compatible Const through the input icon. Phone and email prefixes are formatted automatically.

Page and Page section are system bindings: choose a page from the registry and, for a section link, choose a rendered section with an `id`. The URL shown as **AUTO** is read-only. It is generated from the page's current route/slug and the section ID, so it is not an editable user Const. Keep section IDs stable when editing a design.

The registry uses the content record UUID for collection pages and the route source file for static pages. A collection slug change updates generated URLs while retaining the binding. Renaming a static route file creates a new route identity and requires reconnecting its links. Removing a target section also requires choosing a replacement.

Link metadata lives in `content.linkSettings`, keyed by source page and field ID, alongside the ordinary fallback href. It records the link type, tab target, target page identity, and section ID. The content resolver generates content hrefs; the page link runtime applies automatic hrefs and tab settings to marked anchors. The preview uses the same registry and draft settings. New-tab links include `noopener noreferrer`.

The Sections strip scrolls horizontally without a visible scrollbar. Scrolling the preview selects the active section, and choosing a tab scrolls the preview to that section.
