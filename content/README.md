# Editing site content

The files in this folder are the editable source for the content added in this update. Edit a file, rebuild, preview, then publish. No application code changes are needed.

| File | Controls |
|---|---|
| `categories.json` | Trip types: titles, menu order and columns, landing-page intro text, assigned advisors (in display order), related links, search keywords, published/unpublished status |
| `agents.json` | Per-advisor notes (for example the client's spelling of a name). Profile text and photos come from the Storebox team pages |
| `hotels.json` | Luxury hotel and resort listings: overview, location, approved photos, amenities, offers with expiry dates, FAQs, specialist, status |
| `partners.json` | Partner logos on `/partners` (featured wall and directory) and the homepage logo rail, in display order, with optional website links |
| `text-corrections.json` | Site-wide copy fixes (service statement, availability wording, spelling, capitalization) and advisor specialty labels |

## Workflow

1. Edit a JSON file. Keep the existing structure; only use facts the client has supplied or verified.
2. Build: `node _tools/build.mjs`. It updates every affected page, the header menu, search index (`assets/search-index.json`), advisor directory data, and `sitemap.xml`, then writes `_tools/reports/build-report.md` with anything that still needs client input.
3. Preview: `node _tools/serve.mjs` and open http://localhost:4173. Add `--drafts` to preview unpublished hotels at `/_drafts/hotels/<slug>`. Analytics are disabled in preview.
4. Check: `node _tools/check-site.mjs` (links, canonicals, sitemap, drafts) and `node _tools/hydration-check.mjs` (loads every page in headless Chrome; add `--mobile` or `--reduced`).

## Common tasks

- **Add, rename, reorder or hide a trip type**: edit its entry in `categories`, and its position in `navigation.columns`. Set `"status": "draft"` to unpublish; its page, menu link, search entry and sitemap entry are removed on the next build. `"page": "new"` creates a landing page at `/<slug>`; `"page": "/existing-url"` uses an existing page and adds an advisor section to it.
- **Assign advisors to a trip type**: list advisor slugs (as in `/team/<slug>`) in that category's `agents`, in the order to display them. These assignments also drive the "Trip type or specialty" filter on `/team` and advisor results in search.
- **Publish a hotel**: fill in `overview`, `location`, and at least one photo with `src`, `alt`, `credit` and `"approved": true`, then set `"status": "published"`. The build refuses to publish entries with missing required fields and reports what is missing. Offers need `validUntil` (YYYY-MM-DD); expired offers are hidden automatically. Published hotels are added to the site menu (Featured Travel → Featured Resorts), the Luxury Travel page, search and the sitemap.
- **Partners**: reorder or remove entries in `featured` / `directory`; add an entry with `name`, `logo`, `alt` (and `description` + `enquiryLink` for the directory). Set `website` only to a URL the client has confirmed; the logo then opens it in a new tab.
- **Blog posts and Travel Journal articles** are managed in Storebox. To refresh the local copy and the search index after publishing there, run `node _tools/sync-from-production.mjs` followed by `node _tools/build.mjs`.

## Publishing

This folder is a copy of the Storebox-hosted site. Two options:

- **Storebox (current host)**: apply the same changes in the Storebox admin. Generated page content is standard `customPage` HTML (copy the section `content` from `data/<page>.js`), the Trip Types menu is the header navigation, and `assets/st-site.css` / `assets/st-site.js` need a site-wide custom code slot. Confirm with Storebox that custom head/body code is supported.
- **Static hosting**: deploy everything except `_tools/`, `_drafts/`, `content/` and `.git/`. The host must serve clean URLs (`/team` → `team.html`, `/` → `index.htm`) and keep the existing 301 redirects (for example `/why-use-a-travel-agent` → `/blogs/why-use-a-travel-agent`). Inquiry forms post to the Storebox CRM API, which must allow the new origin.
