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
cd ghost/core/content/themes/ridgeline && npx gscan .
```

## Theme settings

Design → Ridgeline exposes: hero source (featured vs latest post), homepage category
columns on/off, newsletter heading/subheading overrides, and drop caps on posts.
