--# Living Terrain — Website Build Brief (for Claude Code)

Paste this whole file to Claude Code as the spec. Everything needed to build the
site is here: brand, pages, full copy, product data, supplement facts, class copy,
and the image manifest. Images live in the `assets/` folder next to this file.

---

## 0. What to build

A visual, nature-forward **marketing website** for **Living Terrain**, a line of
clinician-crafted botanical extracts (medicinal mushrooms + herbs) made by a
Physician Assistant, plus a **classes** program.

- Domain: **LivingTerrain.org**
- Feel: calm, natural, apothecary — parchment, forest green, bronze, botanical line art.
- Must be **image-rich and responsive** (mobile → desktop), accessible (keyboard focus,
  reduced-motion respected, alt text on every image).
- Suggested stack: static **HTML/CSS/JS** or **Next.js** (deploys clean to Vercel).
  No backend needed yet — it's brochure + product education + class info.

### Pages
1. **Home** (`index.html`) — hero, brand creed, why-us pillars, product preview, founder teaser, classes teaser, FDA disclaimer.
2. **Extracts** (`products.html`) — grid of all 5 products + a "how they're made" card + heritage story.
3. **The Blends** (`guide.html`) — the product-education page: full detail per blend (description, ingredients, what it supports, how to use, **Supplement Facts panel**). This is the page where a customer learns everything.
4. **Classes** (`classes.html`) — the 5 class offerings + instructor bio.
5. **About** (`about.html`) — brand story, values, Serena's full bio.

Shared sticky header (logo + nav: Home / Extracts / The Blends / Classes / About) and a
footer that repeats the FDA disclaimer site-wide.

---

## 1. Brand identity

**Logo:** rooted tree inside a circle (canopy above a horizon line, mirrored roots below),
gold/bronze line art. A clean SVG version is provided at `assets/logo.svg` — it uses
`currentColor` so you can tint it bronze on parchment or parchment on green. The real
packaging shows this same emblem in gold.

**Wordmark:** `LIVING TERRAIN` in a classical serif, uppercase, wide letter-spacing,
stacked on two lines on packaging.

**Tagline / sub-brand:** "Clinician-Crafted Botanical Extracts"
**Brand lines:** "Rooted in nature. Backed by science. Made by a PA."
**Creed band:** "Six steps. Six months. Maximum extraction. Maximum goodness."

**Palette (hex, taken from the physical labels):**
```
Parchment (bg)      #f4eee0
Parchment deep      #ece3d1 / #e2d7c0
Forest green        #2f3d2c   (primary; Daily Longevity band)
Forest deep         #25301f
Sage                #6f7a5c
Bronze / gold       #9a763b (accent), #7d5f2c (darker)
Ink (body text)     #33342c
```
**Per-product accent colors (match each label's colored band):**
```
Daily Longevity  green  #35472f
Brain Power      plum   #493a53
Night Calm       slate  #3a4859
Acute Stress     clay   #8f5836
Headache Relief  teal   #3a5c59
```

**Type (Google Fonts):**
- Display / headings / wordmark: **Cormorant Garamond** (600/700)
- Body: **EB Garamond**
- Labels / eyebrows / buttons (uppercase, spaced): **Jost**

**Voice:** warm, grounded, plain-spoken, "understand what you're taking." Never hype.
Use structure/function language only ("supports," "helps"), never disease-treatment claims.

---

## 2. THE FDA DISCLAIMER  (required — this is the text from the handwritten note with the cross)

Use a dagger (†) as the reference mark. Every product claim / ingredient callout that
carries a superscript on the label should point to this. Place it in the **site-wide
footer** AND near the products on the Extracts and The Blends pages:

> **†** These statements have not been evaluated by the Food and Drug Administration.
> This product is not intended to diagnose, treat, cure, or prevent any disease.

---

## 3. Products (5 extracts) — full copy

All are **2 fl oz (60 mL)** liquid dietary supplements, dropper bottles. Each product page
section = colored accent band + eyebrow + name + subtitle + description + ingredient pills
(the front-label icons) + "Supports" list + usage line + Supplement Facts panel + dagger note.

### Daily Longevity  — accent green #35472f
- Eyebrow: **Everyday Resilience**
- Subtitle: *Botanical Extract for Everyday Resilience*
- Front-label ingredients (icons): **Turkey Tail · Reishi · Elderberry · Lemon Balm**
- Description: A foundational daily blend formulated with functional mushrooms and traditional
  botanicals to support overall vitality, stress adaptation, and healthy inflammatory balance.
  Built for long-term use, it combines synergistic ingredients rich in beta-glucans,
  polyphenols, and adaptogenic compounds to support the body's natural repair and resilience systems.
- Supports: Healthy immune function · Balanced stress response · Cellular recovery pathways · Everyday vitality and endurance
- Usage: Best taken daily as part of a long-term wellness ritual.

### Brain Power  — accent plum #493a53
- Eyebrow: **Neurocognitive Support**
- Subtitle: *Neurocognitive Support Botanical Extract*
- Front-label ingredients: **Reishi · Ashwagandha · Lion's Mane**
- Description: A functional blend designed to support cognitive clarity, focus, and long-term
  brain health. Brain Power combines nootropic mushrooms and traditional botanicals that support
  neuroplasticity, circulation, and adaptive cognitive function.
- Supports: Focus and mental clarity · Memory and recall · Neuroplasticity and cognitive adaptation · Mental stamina under stress
- Usage: Designed for daytime use and sustained cognitive performance.

### Night Calm  — accent slate #3a4859
- Eyebrow: **Rest & Restoration**
- Subtitle: *Evening Botanical Extract for Rest & Restoration*
- Front-label ingredients: **Passionflower · Reishi · Lemon Balm**
- Description: A calming evening blend designed to support relaxation, nervous-system
  downregulation, and healthy sleep architecture. Night Calm combines soothing nervine herbs with
  functional mushrooms to promote an easy transition into rest — without heaviness or next-day fog.
- Supports: Relaxation and stress release · Healthy sleep onset · Nervous system balance · Overnight restoration
- Usage: Ideal taken in the evening as part of a wind-down ritual.

### Acute Stress  — accent clay #8f5836
- Eyebrow: **Rapid Adaptation**
- Subtitle: *Rapid Adaptation Botanical Extract*
- Front-label ingredients: **Mimosa · Reishi · Oyster Mushroom**
- Description: A fast-acting botanical blend designed for moments of acute emotional or physical
  stress. Acute Stress supports the body's immediate adaptation response and helps restore baseline
  balance after high-demand situations.
- Supports: Acute stress response regulation · Emotional equilibrium · Physiologic recovery after stress · Adrenal and nervous system support
- Usage: Use as needed during or after stressful events.

### Headache Relief  — accent teal #3a5c59
- Eyebrow: **Neurologic Balance**
- Subtitle: *Neurologic Balance Botanical Extract*
- Front-label ingredients: **Feverfew · Lemon Balm · Reishi · Turkey Tail**
- Description: A targeted botanical blend designed to support head tension, vascular balance, and
  neurological comfort. This formula combines calming nervines and anti-inflammatory botanicals
  traditionally used to support headache frequency and intensity over time.
- Supports: Head and neck tension relief · Neurologic calm and balance · Inflammatory modulation · Stress-related headache patterns
- Usage: Best used as needed or as part of a preventative routine.

---

## 4. Supplement Facts  ⚠️ NEEDS SERENA'S CONFIRMATION BEFORE PUBLISHING

I transcribed all 5 photographed panels. **The captions on the photos don't match the
front-label ingredients**, and one product's panel appears to be missing. Do **not** publish
these as-is on a live label — confirm the mapping with Serena first. Below are the four
DISTINCT panels found, then the likely-correct product they belong to.

All panels: **Serving Size 1 mL · Servings Per Container 60 · Proprietary Blend 1 mL ·
† Daily Value not established.**

**Panel A** (photo-captioned "Brain power" AND "Headache relief" AND one uncaptioned — same panel 3×)
- Active: Dried Reishi Extract · Dried Chamomile Extract · Dried Passion Flower Extract
- Other: Homegrown Reishi, Chamomile, Passionflower, Elderberry, Pomegranate, Sassafras, Organic Alcohol, Vegetable Glycerine
- → Ingredients (passionflower + reishi) best match **NIGHT CALM**.

**Panel B** (photo-captioned "Night calm")
- Active: Dried Reishi Extract · Fresh Turkey Tail Extract
- Other: Homegrown Reishi, Turkey Tail, Elderberry, Lemon Balm, Pomegranate, Rose Hip, Mimosa, Chamomile, Sassafras, Organic Alcohol, Vegetable Glycerine
- → Turkey Tail + Reishi + Elderberry + Lemon Balm best match **DAILY LONGEVITY**.

**Panel C** (photo-captioned "Acute stress" — looks correct)
- Active: Dried Reishi Extract · Fresh Oyster Mushroom Extract · Fresh Mimosa Extract · Milky Oat Tops Extract · Chamomile Extract
- Other: Reishi, Oyster Mushroom, Mimosa, Chamomile, Milky Oat Tops, Organic Alcohol, Vegetable Glycerine
- → Matches **ACUTE STRESS**. ✅

**Panel D** (photo-captioned "Daily longevity")
- Active: Dried Turkey Tail Extract · Fresh Turkey Tail Extract · Dried Lemon Balm Extract · Feverfew Extract
- Other: Homegrown Reishi, Turkey Tail, Lemon Balm, Feverfew, Elderberry, Pomegranate, Rose Hip, Sassafras, Organic Alcohol, Vegetable Glycerine
- → Feverfew + Lemon Balm + Turkey Tail + Reishi best match **HEADACHE RELIEF**.

**Best-guess mapping to build with (mark each "Draft — verify"):**
| Product | Use panel |
|---|---|
| Daily Longevity | Panel B |
| Acute Stress | Panel C |
| Headache Relief | Panel D |
| Night Calm | Panel A |
| **Brain Power** | **MISSING** — no panel lists Lion's Mane/Ashwagandha. Leave a "coming soon" note. |

**Two things for Serena to double-check on the labels themselves:**
- **Sassafras** appears in several "Other Ingredients" lists. Sassafras/safrole is FDA-restricted
  as a food additive; confirm it's a safrole-free form and cleared for a retail supplement.
- Front-label icons vs. Supplement Facts should list the **same** ingredients (e.g., Brain Power's
  panel must include Lion's Mane & Ashwagandha to match its front icons).

Render each panel as **clean HTML/CSS** styled like a real Supplement Facts box (bold header,
heavy black rules, small caps) — do NOT embed the blurry WhatsApp screenshots.

---

## 5. Classes (5) + instructor

Card grid; each card = number + title + blurb + format tag. Then an instructor section.

**01 · Understanding Medicinal Mushrooms**
Whether you're curious about brain health, immunity, stress, athletic performance, cancer support,
or longevity, you'll leave understanding which mushrooms may be appropriate for different goals —
and how to avoid wasting money on ineffective products.

**02 · Build Your Own Apothecary**
Walking into a supplement store can be overwhelming. This class teaches you how to thoughtfully
build an evidence-informed home apothecary using herbs, medicinal mushrooms, vitamins, minerals,
teas, tinctures, and simple natural remedies. Create a home wellness toolkit you'll use for years
to come — leave with a practical, budget-friendly roadmap filled with remedies you understand and
trust instead of cabinets full of products you never use.
*(Topics: essential household herbs; mushrooms for immunity/stress/sleep/cognition/recovery;
vitamins & minerals worth taking; safe supplement combinations & interactions; natural approaches
for seasonal illness, digestion, headaches, anxiety, sleep, wound care, immune health; reading
labels & spotting quality manufacturers; personalized family protocols; when to seek medical care.)*

**03 · Gut Health & the Microbiome**
Learn how gut health influences immunity, inflammation, mood, hormones, and overall wellness.
Covers the microbiome, digestion, probiotics, prebiotics, medicinal mushrooms for gut support, and
nutrition strategies for a resilient digestive system — plus safe, effective supplement approaches
and how to build a personalized routine without overwhelm. Understand your gut as the foundation of
your health and leave with clear, usable tools for digestion, energy, mood, and long-term resilience.

**04 · Improving Focus & Memory Naturally**
A practical look at supporting attention, recall, and mental stamina through nootropic mushrooms,
adaptogenic herbs, sleep, and lifestyle — and how to tell evidence-informed approaches from hype.
*(Note: no source blurb was provided for this one — copy above is a placeholder in Serena's voice;
replace with her wording when ready.)*

**05 · Waldorf for Adults: Creative Rhythm & Restorative Art Practice**
A biweekly experiential class bringing the foundational arts of Waldorf education into an adult
setting as gentle art therapy and nervous-system regulation within an integrative wellness
framework. Join for one class or the 10-session series — each class is unique while building on
practices. Work with lyre music to attune attention, anthroposophical watercolor to explore mood
and inner landscape, form drawing to organize perception, and eurythmy-inspired movement to
reconnect breath, gesture, and spatial awareness. Process over product; a relaxed, non-performance
space. Taught by Serena, who attended Waldorf school and is a Waldorf parent.
Format: Biweekly · one class or the 10-session series.

**Instructor bio — Serena Ling, PA-C**
Serena Ling, PA-C is a board-certified Physician Assistant with a unique background that bridges
conventional medicine and traditional healing practices. Her clinical experience includes oncology,
surgery, family medicine, emergency medicine, and clinical research, alongside years of study in
herbalism, Tibetan medicine, nutrition, and medicinal mushrooms. She is the founder of Living
Terrain, where she formulates clinician-created botanical extracts using carefully sourced
mushrooms, synergistic herbs, and evidence-informed extraction methods. Her passion is translating
both scientific research and traditional wisdom into practical tools that empower people to improve
their health safely and confidently. Her classes are engaging, approachable, and grounded in both
modern medical evidence and centuries of traditional herbal knowledge.

---

## 6. About page copy

- **Hero line:** "Rooted in Nature, Backed by Science."
- **Founder:** use the Serena bio above (long form). Lead photo: `serena-bw.jpg`.
- **Values** (icon row): Evidence-Based · Food-Based Ingredients · Synergistic Formulations ·
  Fully Extracted (six-step, six-month process) · Safe for Most People† · No Artificial Additives ·
  Great Taste · Made in Small Batches.
- **Creed band:** "Six steps. Six months. Maximum extraction. Maximum goodness."
- **Garden section:** photo `serena-basket.jpg` + short note that botanicals are grown/gathered fresh.
- Heritage note (optional): the line began as hand-labeled, spore-to-bottle blends before becoming
  the clinician-crafted line today. Photo: `heritage-bottles.jpg`.

---

## 7. Image manifest  (files in `assets/`)

| File | What it is | Use where |
|---|---|---|
| `logo.svg` | Rooted-tree emblem (gold line art, uses currentColor) | Header, footer, hero, favicon |
| `hero-meadow.jpg` | Coastal meadow at first light | Home hero background |
| `tex-pebbles.jpg` | Multicolor beach pebbles | Optional texture/section background |
| `draw-shiitake.jpg` | Pencil botanical study (Shiitake / *Lentinula edodes*) | Classes teaser / botanical accent |
| `serena-bw.jpg` | B&W portrait of Serena | About founder lead photo |
| `serena-stethoscope.jpg` | Serena w/ stethoscope (color) | Classes instructor / About |
| `serena-basket.jpg` | Serena holding herb basket (color) | Home founder teaser / About garden |
| `heritage-bottles.jpg` | Early hand-labeled bottles | Heritage / origin story |
| `prod-daily-longevity.jpg` | Daily Longevity label (green) | Daily Longevity everywhere |
| `prod-brain-power.jpg` | Brain Power label (plum) | Brain Power everywhere |
| `prod-night-calm.jpg` | Night Calm label (slate) | Night Calm everywhere |
| `prod-acute-stress.jpg` | Acute Stress label (clay) | Acute Stress everywhere |
| `prod-headache-relief.jpg` | Headache Relief label (teal) | Headache Relief everywhere |
| `prod-dropper.jpg` | Dropper bottle w/ tree logo | Product hero / alt shot |
| `prod-box.jpg` | Packaged box w/ tree logo + mountains | "How it's made" card, packaging shots |

*(The product label photos are close crops; consider re-shooting on plain backgrounds for a cleaner
grid, but they work as-is.)*

---

## 8. Botanical illustration prompt (for generating more ingredient drawings)

The labels use vintage engraving-style botanical line art. To generate matching illustrations
(reishi, lion's mane, oyster mushroom, turkey tail, elderberry, lemon balm, passionflower,
feverfew, ashwagandha, mimosa, milky oat tops), use a prompt like:

> "Vintage botanical engraving illustration of [INGREDIENT], detailed pen-and-ink hatching,
> single subject centered on plain cream paper, monochrome sepia/charcoal linework, apothecary
> field-guide style, no color fill, no text, high detail, 1:1."

Keep every ingredient in one consistent style so the label icons and site match.

---

## 9. Build checklist
- [ ] Sticky header, mobile hamburger nav, active-page state
- [ ] Home: hero (meadow bg + emblem + tagline + CTAs), creed band, pillars, product preview grid, founder teaser, classes teaser, dagger disclaimer
- [ ] Extracts: 5 product cards + "how it's made" card + heritage story
- [ ] The Blends: full detail per blend + HTML Supplement Facts panels (draft mapping from §4) + Brain Power "coming soon"
- [ ] Classes: 5 cards + instructor bio
- [ ] About: founder, values, creed, garden
- [ ] Footer w/ FDA disclaimer on every page
- [ ] Responsive, keyboard focus, alt text, prefers-reduced-motion
- [ ] Fonts: Cormorant Garamond + EB Garamond + Jost
- [ ] Deploy target: Vercel
