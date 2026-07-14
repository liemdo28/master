/**
 * PREVIEW/VERIFY ONLY — sample article fixtures used by run.ts to exercise
 * bakudan-publisher.ts / raw-sushi-publisher.ts against DISPOSABLE isolated
 * copies of the two real sites (never the real repos). Not part of the
 * production build (this whole directory lives outside anything imported by
 * server/src/index.ts, and src/seo/** is excluded from tsconfig.json anyway).
 */

export const BAKUDAN_TITLE = 'Community Ramen Night at Bakudan Ramen: Full Guide';
export const BAKUDAN_META_DESCRIPTION =
  "Discover Bakudan Ramen's Community Ramen Night — a monthly gathering with build-your-own tonkotsu bowls, tastings, and local vendors in San Antonio.";

// One real internal link, one real internal link to a page that exists,
// and one DELIBERATELY broken link (to a slug that does not exist in the
// isolated copy) so the "verify links" step has something honest to report
// as failing, per the task's request not to rubber-stamp this check.
export const BAKUDAN_SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${BAKUDAN_TITLE}</title>
    <meta name="description" content="${BAKUDAN_META_DESCRIPTION}">
    <link rel="stylesheet" href="css/styles.css">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Community Ramen Night at Bakudan Ramen",
      "description": "${BAKUDAN_META_DESCRIPTION}",
      "author": { "@type": "Organization", "name": "Bakudan Ramen" },
      "publisher": { "@type": "Organization", "name": "Bakudan Ramen" },
      "datePublished": "2026-07-13"
    }
    </script>
</head>
<body>
    <main id="main-content">
    <article class="blog-post">
        <header class="blog-post-header">
            <div class="section-tag">Community</div>
            <h1>Community Ramen Night at Bakudan Ramen</h1>
            <p class="subtitle">What to expect at our monthly gathering for ramen lovers</p>
            <div class="blog-post-meta">Reading time: 3 minutes</div>
        </header>
        <div class="blog-post-content">
            <p>Once a month, Bakudan Ramen opens its doors early for Community Ramen Night — a relaxed evening built around one simple idea: ramen tastes better shared. Guests get first access to build-your-own tonkotsu bowls, a rotating tasting flight of broths, and tables from local vendors who supply the ingredients we use every day.</p>

            <h2>Build-Your-Own Tonkotsu Bar</h2>
            <p>Instead of ordering off the regular <a href="menu.html">menu</a>, guests start with our slow-simmered tonkotsu base and choose their own toppings: chashu, ajitama egg, menma, corn, garlic oil, and scallion. It's a hands-on way to learn what actually goes into the bowl you'd normally order without thinking twice.</p>

            <h2>Meet the Vendors</h2>
            <p>We invite two or three local suppliers each month — noodle makers, produce farms, and the butcher who provides our pork bones. It's a chance to see the supply chain behind the broth, and to ask questions directly.</p>

            <h2>Plan Your Visit</h2>
            <p>Community Ramen Night rotates between our three <a href="locations.html">San Antonio locations</a>. Check the schedule before you come, and consider placing a standing order in advance through our <a href="order.html">online ordering page</a> if you're bringing a larger group.</p>

            <p>For the full history of how Bakudan Ramen got started, read more on our <a href="about.html">About</a> page, or see our <a href="events-calendar.html">events calendar</a> for the next date (a link kept intentionally pointing at a not-yet-created page, to give the link-verification step in this evidence report something real to catch).</p>
        </div>
    </article>
    </main>
</body>
</html>
`;

export const RAWSUSHI_TITLE = 'Omakase Night at Raw Sushi Bar: What to Know';
export const RAWSUSHI_META_DESCRIPTION =
  "Curious about Omakase Night at Raw Sushi Bar in Stockton? Here's what's included, how reservations work, and why chef's-choice sushi is worth trying.";

// Written through as-is because it already starts with "---" (real
// public/content/posts/README.md frontmatter schema). One real internal
// link, one real internal link, one intentionally broken link (same
// rationale as the Bakudan fixture above).
export const RAWSUSHI_SAMPLE_MD = `---
title: "${RAWSUSHI_TITLE}"
slug: omakase-night-raw-sushi-bar
date: 2026-07-13
excerpt: "What to expect from Omakase Night at Raw Sushi Bar in Stockton — chef's-choice courses, reservations, and pricing."
meta_description: "${RAWSUSHI_META_DESCRIPTION}"
image: ""
primary_keyword: omakase night stockton
secondary_keywords: [omakase sushi stockton, chefs choice sushi]
post_type: menu_highlight
target_audience: "Regulars and first-time guests curious about chef's-choice dining."
published: false
---

Omakase — literally "I'll leave it up to you" — is the most direct way to experience what Raw Sushi Bar's kitchen can do. Instead of ordering off the [regular menu](/menu.html), you hand the evening over to the chef, who builds a multi-course sequence around whatever is freshest that day.

### How It Works

Omakase Night runs as a seated, multi-course sequence: a handful of nigiri pairings, a couple of specialty rolls not on the regular menu, and a chef's-choice sashimi plate to open. Portion and course count vary slightly week to week depending on what came in fresh.

### Reservations

Because omakase is prepared to order and in limited seats, we recommend booking ahead rather than walking in. You can see current hours and locations on our [homepage](/index.html), and Stockton-specific details on the [Stockton page](/stockton.html).

### Is It Worth It?

If you already know your favorite rolls and want more of the same, the regular menu is still the better fit. But if you want to see what the kitchen does when it isn't following a printed order, omakase is the most direct way to find out. Ask your server about that night's [chef availability schedule](/chef-schedule.html) when you arrive (a link kept intentionally pointing at a not-yet-created page, to give the link-verification step in this evidence report something real to catch).

Walk-ins are welcome when seats are open, but reservations are the more reliable path on weekends.
`;
