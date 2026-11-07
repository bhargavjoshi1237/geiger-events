# Blog posts: what stops Google indexing them

Checked 2026-11-07 against Google Search Central (spam policies, people-first content, AI content guidance) and the live blog.

## The blog's technical setup is fine

Checked on `/blog/conditional-logic-in-forms`:

- Returns 200 with no `noindex` meta or `X-Robots-Tag`.
- Has a self-canonical.
- Has `BlogPosting` JSON-LD with `datePublished`, `dateModified`, and a `Person` author with `url`, `jobTitle` and `sameAs`, plus `BreadcrumbList`.
- `robots.txt` allows `/blog`.
- The sitemap lists every published post and the author page.
- Drafts return 404 and stay out of the sitemap.

Nothing technical needs changing before posts go live.

## What gets a post skipped or demoted

Google usually shows "Crawled – currently not indexed" because it judged the page's quality, not because the page failed to render.

| Don't | Why |
|---|---|
| Post many near-identical posts from one template | Scaled content abuse. It is judged on value, not speed; our 54 templated feature pages show 0 in Google |
| Claim a feature that doesn't exist or is broken | Unhelpful and untrustworthy, and AI answers repeat it. Check [feature-claims-reality] and the inventory first |
| Invent stats, tests, customers or quotes | Unsupported first-hand claims. Say "we don't have a figure" instead |
| Backdate, or bump the date without real changes | "Changing the date to seem fresh" is a named warning sign |
| Pad to a word count or stuff keywords and tags | People-first guidance says not to write to a length; keyword stuffing is a spam policy |
| Reuse the same headings, intro or FAQ across posts | Reads as templated; each post needs its own shape |
| Publish a post nothing links to | It gets discovered slowly. Link it from the related help page, feature page or older posts |
| Link to pages that contradict the post | Mixed signals. Fix the old page first or leave the link out |
| Credit "Geiger Team" | No who. Use a real author profile (`bhargav-joshi`) |

## What each post should have

- An answer to the target question in the first two sentences.
- Advice that is useful without our product. The product section comes after it.
- Exact UI labels and real limits from the code.
- External citations only for facts we didn't produce.
- A unique title (about 60 characters or fewer), an excerpt that works as the meta description, a short slug and a few tags that match feature slugs.
- Real screenshots with alt text, and a cover image.

## Publishing

About 2 a week, strongest first, published by a person (never by Claude). After the first two have been live about 2 weeks, check Search Console URL Inspection before scheduling more.
