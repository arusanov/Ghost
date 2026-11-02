# Ridgeline

Adventure motorcycle media theme for Ghost, built from the design mockup in
`theme_design/Adventure motorcycle media site/`.

## Setup

1. **Install routing.** `routes.yaml` in this folder is a reference copy — Ghost reads
   routes from `content/settings/routes.yaml`:

   ```bash
   cp ghost/core/content/themes/ridgeline/routes.yaml ghost/core/content/settings/routes.yaml
   docker restart ghost-dev
   ```

   This puts the homepage on `home.hbs` and the paginated post collection on `/articles/`.

2. **Activate.** Ghost Admin → Settings → Design → Change theme → Ridgeline.

3. **Set up navigation.** Settings → Navigation. Add your category tags
   (`/tag/news/`, `/tag/gear/`, …) and put **All Articles → `/articles/`** last —
   the final nav item is styled as the inverted button from the design.

## Structure

| File | Design page |
|---|---|
| `home.hbs` + `partials/home-content.hbs` | `Home.dc.html` |
| `index.hbs` (`/articles/`), `tag.hbs` | `Articles.dc.html` |
| `post.hbs` | `Article.dc.html` |

Categories are ordinary Ghost tags. `partials/category-tabs.hbs` renders the design's tab
row as real links to tag archives, so filtering paginates and is indexable — the mockup's
client-side filtering is deliberately not reproduced.

Posts without a feature image fall back to the hatched `PHOTO — …` placeholder from the
design (`partials/card-media.hbs`), so the layout never collapses.

## Development

No build step. Edit `assets/css/screen.css` and the `.hbs` files directly; Ghost serves
them as-is via the `{{asset}}` helper. Adding *new* files requires a Ghost restart —
editing existing ones does not.

Validate before shipping:

```bash
pnpm exec node --test ghost/core/content/themes/ridgeline/tests/funnel.test.cjs
pnpm dlx gscan@latest ghost/core/content/themes/ridgeline
```

## Theme settings

Design → Ridgeline exposes: hero source (featured vs latest post), homepage category
columns on/off, newsletter heading/subheading overrides, and drop caps on posts.

## Analytics funnel

When a Google Analytics ID is configured, consented article views emit `article_view`.
A visible tab with 45 seconds elapsed and half of the article reached emits
`qualified_read` once per page. Native newsletter forms emit `newsletter_start`,
`newsletter_email_sent` or `newsletter_error`. A confirmed, authenticated new member
with a newsletter subscription emits `newsletter_subscribe`; sending a magic-link
email alone is not a subscription. Portal tracks entry and confirmed return only.

Tagged links use `utm_source`, `utm_medium`, `utm_campaign`, plus optional `utm_id`
and `utm_content`. Values are slug tokens (letters, digits, `_`, `.`, `~`, `-`, up to
100 characters). Consented browser storage retains the latest tagged campaign for
30 days and freezes it at signup for a same-browser confirmation within 24 hours.
Events include corresponding `acq_*` parameters; register event-scoped GA dimensions
for reporting. Do not use personal information in campaign tags. No member identifiers
are sent by this tracker. Withdrawing analytics consent clears its stored records.
