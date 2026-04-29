# Midjourney Prompt Skill — MAWZE Method

Working notes from building the MAWZE Studio reference set. This file captures the *how* — the structural method, the design principles, the reasoning style — so it can be lifted into a Claude skill later.

The job of a MAWZE prompt is not to describe an image. It's to direct one. Every prompt is a one-page treatment a director would hand a DP, compressed into a single line.

---

## 1. The Anatomy of a Prompt

Every prompt is built from the same seven layers, in this order. Skip a layer and the image goes generic.

| # | Layer | What it answers | Example |
|---|-------|----------------|---------|
| 1 | **Subject** | Who, doing what, wearing what | "young Black male model reclining diagonally across the hood of a wrecked white 1980s sports coupe, wearing a midnight-navy double-breasted wool suit" |
| 2 | **Setting** | Where, what's around them | "abandoned warehouse with exposed dark brick walls, half-buried in a dune of pale desert sand" |
| 3 | **Punchline prop** | The cultural-misplacement element that stops the scroll | "a single live chestnut thoroughbred horse standing calmly in the back of the warehouse" |
| 4 | **Lighting** | Where the light comes from, how it falls, color temp | "single overhead industrial source, cold teal cast on the car body, warm amber catch on his skin" |
| 5 | **Camera & lens** | Format, focal length, angle, depth | "shot on 35mm anamorphic film, slight low angle, full body, shallow depth of field" |
| 6 | **Texture & grade** | Film grain, halation, color grade | "heavy film grain, halation on highlights, muted cinematic color grade" |
| 7 | **Style references** | Two or three named photographers / campaigns / directors | "in the style of Saint Laurent campaign by Anthony Vaccarello and Tyler Mitchell and Gordon Parks" |

End with the technical params — `--style raw --v 8.1 --s 400` (see §6).

The order matters. Midjourney weights tokens earlier in the prompt heavier. Subject and setting *must* come first. References go last so they color the rest, not dominate it.

---

## 2. The Contradiction Principle

> Boring fashion images describe one register. Memorable ones collide two.

Every strong MAWZE image pairs two opposing registers in the same frame. The friction is what makes it editorial instead of catalog.

**Working contradictions:**
- old-money tailoring × industrial decay
- couture silk × literal dirt or sand
- funeral formality × childhood props (popsicle, balloon, ice cream truck)
- heir-to-fortune × abandoned setting
- religious iconography × leisurewear
- couture gown × hardware store
- bespoke suit × bare feet
- fur coat × bare chest
- protective gear (helmet, gloves) × evening wear
- antique luxury (pearls, gold watch) × Y2K technology

**Rule:** decide the contradiction *before* you write the prompt. Name it explicitly in the prompt's tail (e.g. *"the quiet absurdity of equestrian wealth in industrial decay"*) — Midjourney uses that tail clause as a vibe anchor and the result is more cohesive than if the tension is implicit.

---

## 3. The Punchline Prop (Background Element)

This is the layer that separates "good fashion image" from "you can't scroll past it." Most prompts skip this. Don't.

**Three rules:**

1. **It must be a cultural anchor, not surrealism.** A horse in a warehouse works because *equestrian wealth* is real. A floating fish doesn't work because it reads as AI trickery. Misplacement beats fantasy every time.

2. **It must complement the subject, not compete with it.** If the suit says "old-money heir," the prop reinforces "old-money heir" (horse, butler, chandelier, oil painting). If the suit says "young rebel," the prop reinforces *that* register (bodega bag, payphone, plastic chair). The prop should speak the same brand language, just in a different sentence.

3. **It must be 0.3-second legible.** If the viewer needs you to explain the joke, it failed. The image is a still. They get one moment.

**Stress-test the prop with this question:** "If a stranger sees this image, do they immediately understand the world this character lives in?" If yes, ship. If no, swap the prop.

**Tested punchline props that work:**
- live thoroughbred horse in a warehouse → equestrian wealth
- lit crystal chandelier hanging from rafters → opulence in wrong room
- butler with silver tray standing 30ft behind → Wes Anderson energy
- grand piano half-buried in sand → unmovable inheritance
- oil portrait of an ancestor leaning against the wall → generational gaze
- Persian rug rolled out across dirt → Anthony Vaccarello move
- folding table with three giant silver racing trophies → past-glory energy
- single peacock walking through frame → casual decadence
- vintage telephone on a long cord with the receiver off the hook → suspended time

**Props that almost always fail:**
- generic luxury (Lambo, champagne tower, Rolex on display) — too try-hard
- AI-bait surrealism (floating objects, melting forms, impossible geometry) — reads as gimmick
- "edgy" props (skull, snake, knife) — adolescent
- recognizable celebrities or branded items — distracting and legally fragile

---

## 4. The Subject Stack

The subject's outfit + posture + accessories should already imply who they are *before* the punchline prop arrives. Stack three signals:

- **One major piece of clothing** (suit, jumpsuit, coat, dress) — the silhouette.
- **One detail of decay or imperfection** (untied lace, ash about to fall, rolled-up sleeve, smudge of dirt) — the humanity. This is critical. Perfect outfits read as catalog. One imperfection = editorial.
- **One small status object** (Cartier watch, gold rings, vintage pearls, gold tooth, signet ring) — the wealth signal. Subtle, never the focus.

Then add posture: never standing-and-staring. Always reclining, looking off-camera, mid-cigarette, leaning, mid-stride. Editorial subjects are caught, not posed.

---

## 5. Lighting & Camera Defaults

Unless the brand world demands otherwise, MAWZE's house language is:

- **Lighting:** single dominant source (overhead industrial, window shaft, practical lamp). Cold cast on the environment, warm catch on skin. Deep falloff into shadow. Never flat or evenly lit.
- **Camera:** 35mm anamorphic or medium-format film aesthetic. Slight low angle (subjects feel taller, more cinematic). Shallow depth of field. Full body or 3/4 — almost never tight headshots.
- **Color grade:** muted, cinematic, slightly desaturated. Halation on highlights. Heavy film grain.

These defaults come from the cinematic-editorial mood. For other moods (graphic-commercial, surreal-staged, soft-romantic, hard-noir) the defaults shift — document those when their LoRAs come online.

---

## 6. Technical Parameters (Locked Rules)

- **Never use `--ar`.** Let the aspect ratio default.
- **Always use `--v 8.1`.** No `--v 6.1`, no other versions.
- **Default `--style raw`** for editorial work. (Drop only when going stylized/painterly.)
- **`--s` (stylize)** — controls how strongly Midjourney imposes its own aesthetic. Higher = more "MJ-pretty," lower = more literal to the prompt.
  - `--s 250` — clean editorial, prompt-faithful
  - `--s 400` — slightly heightened, drama amped
  - `--s 600+` — hyper-stylized, only for surreal/dreamlike moods
- **`--chaos`** — only when you want variance across the 4 grid outputs. `--chaos 15–25` is a gentle nudge. Avoid for brand consistency work.

---

## 7. The Output Format

When delivering a prompt to Karim, structure the response in three parts:

### Part 1 — The reasoning (anatomy breakdown)
Walk through each of the seven layers in plain language so the user can see *why* each choice. Like a creative director defending a treatment. Don't just describe — argue.

### Part 2 — The copy-paste prompt
Single block, ready to drop into Midjourney. No annotations inside it.

### Part 3 — Alternatives
Two or three other directions, each in one line, so the user can A/B. Always with a one-sentence reason.

This format is non-negotiable. It's how the user evaluates prompts — by reading the reasoning first, then the prompt, then the alternates.

---

## 8. The Iteration Loop

Karim's working method, observed:

1. He sends a reference image and asks for a prompt.
2. First version sets the baseline.
3. He pushes for **contradiction** ("give it a twist, I like contradictions").
4. He pushes for the **punchline prop** ("drop something unexpected, make me stop").
5. He locks param rules as standing memories.

Anticipate steps 3 and 4. The first prompt should already have a clear contradiction *and* a punchline prop. Don't make him ask twice.

**When in doubt, ask:** "what's the contradiction here, and what's the prop that makes the joke?" If you can't answer both, the prompt isn't done.

---

## 9. References Karim Trusts

Recurring style anchors that consistently produce strong outputs:

**Photographers / directors:**
- Tyler Mitchell, Gordon Parks, Larry Sultan, Tim Walker, Petra Collins
- Helmut Newton (hard-noir), Wolfgang Tillmans (graphic-commercial), Steve McQueen (cinematic-editorial)

**Campaigns:**
- Saint Laurent by Anthony Vaccarello
- Bottega Veneta SS24 (Matthieu Blazy era)
- Calvin Klein (Mario Sorrenti era)
- Hermès equestrian editorials
- Aesop product editorials
- Glossier early campaigns

**Films (for grade and mood):**
- *Moonlight* (Barry Jenkins / James Laxton)
- *Small Axe* (Steve McQueen)
- *Call Me By Your Name* (Sayombhu Mukdeeprom)
- *Atlantics* (Mati Diop / Claire Mathon)

Mix two photographers + one campaign in the references tail. Three is the limit — more than three confuses the model.

---

## 10. Brand-World Application

Once a brand has a Brand World in MAWZE Studio, the prompt skill changes:

- The contradiction is **inherited from the brand profile**, not chosen fresh each time.
- The lighting + camera defaults are **set by the brand's mood LoRA recipe**.
- The punchline prop pool is **curated per brand** so they stay tonally coherent (a *quiet luxury* brand draws from a different prop bank than a *party-girl streetwear* brand).
- The user only writes the **subject + situation**. The skill fills in everything else.

That's the product, in one sentence: **the user describes the moment, the skill directs the photo.**

---

## 11. What This Skill Should Eventually Do

When this becomes a real Claude skill, it should:

1. **Take a brand profile + a one-line user request** ("a girl smoking on a fire escape").
2. **Pull the brand's contradiction, mood, palette, prop bank, lighting defaults**.
3. **Generate three prompts** — one safe, one bolder, one wild — each with the seven-layer anatomy filled in.
4. **Append the Midjourney params** per the locked rules (no `--ar`, `--v 8.1`).
5. **Return the reasoning + prompt + alternates** in the format from §7.

The skill is essentially this document, parameterized by a brand profile.

---

## Appendix A — Prompt Template

```
[SUBJECT: who, doing what, wearing what main piece + status detail + imperfection],
[SETTING: where, what's around them],
[PUNCHLINE PROP: the cultural-misplacement element],
[LIGHTING: source, fall, color temp, shadows],
[CAMERA: format, lens, angle, depth of field],
[TEXTURE: grain, halation, grade],
[CONTRADICTION CLAUSE: "the [tension] of X in Y"],
[REFERENCES: in the style of [photographer] and [photographer] and [campaign]]
--style raw --v 8.1 --s 400
```

## Karim's Taste Profile — Live Log

A running log of taste rules learned from Karim. Each entry is a durable judgment that should inform every future prompt. Append, don't overwrite.

### Lesson 20 — Modern cinematic grade is COOL AMBIENT + MOTIVATED WARM. All-warm pulls vintage / sepia / "ancient."
**Observed:** Multiple loved prompts include "warm cast on cheek and jacket" or "golden haze raking from frame left" or "soft late afternoon light." Karim flagged the result: *"they all have this ancient look. I really don't want that yellow effect on all images. I don't want them to look really old."* The single image with the strongest grade was wreck-and-horse — *"cold teal cast on white car body, warm amber catch on his skin and the suit lapel."* Cool dominant + warm motivated. Every other prompt that just said "warm cast" produced sepia / yellow / vintage golden-hour mush.

**Rule:** Modern cinematic grade = **COOL AMBIENT + MOTIVATED WARM HIGHLIGHTS**. The ambient (sky, walls, air) reads cool blue / teal. The warm orange / amber comes ONLY from a motivated source NAMED IN THE FRAME (firelight, neon sign, pendant lamp, sunset rim, candle, headlamp). The split is what makes it modern cinema — Villeneuve, Mátyás Erdély, Linus Sandgren. All-warm reads as vintage 70s film stock = sepia AI tell.

**Phrasing — DROP these (they pull yellow-ancient OR Unreal-Engine CG render):**
- "warm cast on cheek and jacket"
- "golden haze raking from frame left"
- "warm tungsten fill" (without an offsetting cool ambient)
- "soft late afternoon light" (alone, with no cool counter)
- ⚠️ **"modern cinematic grade with cool teal shadow and motivated warm highlights"** — this exact phrase triggers Unreal Engine / video-game CG render in MJ. It's post-production language; MJ reads it as 3D render, not photography. Karim flagged the AI-render look in the burning airport image and traced it to this phrase.
- ⚠️ "split-toned modern cinematic grade" / "teal-and-orange grade" — same problem
- ⚠️ Any phrase describing *the GRADE itself* rather than the *light cast on surfaces*

**Phrasing — USE these (describe light cast on surfaces, name the source — physics, not post-production):**
- *"cold teal cast on [environment surface], warm amber catch on [subject surface] from the [named source]"*
- *"cool blue ambient on [environment], motivated warm orange rake on [subject] from the offscreen [source]"*
- *"cyan ambient across [scene], warm orange catch on [shoulder / lapel / chrome] from the [firelight / pendant / sunset] [direction]"*

**The rule:** describe physics (light hitting surfaces), not post-production (a grade). MJ renders physics descriptions as photography; it renders grade descriptions as CG.

**Pair with HEAVY film grain.** Fine grain alone is not enough — heavy grain is what makes the image read as real film instead of a clean digital render. The wreck-and-horse and Italian moka-pot prompts both have "heavy grain"; the burning-airport prompt that read fake had "fine grain." Heavy is correct for cinematic-on-location.

**Worked examples:**
- ✅ *cold teal cast on the white car body, warm amber catch on his skin and the suit lapel from the overhead pendant lamp*
- ✅ *cool blue ambient on the dunes, motivated warm orange rake on her cheekbone and chrome from the offscreen sunset*
- ✅ *cool cinematic blue ambient in the airport, motivated warm orange firelight rim lighting her from behind frame right, soft amber spill from the DEPARTURES sign overhead*

**Apply:** Audit every prompt for warm-only language. Replace with explicit **cool ambient + motivated warm** split. The motivated source must always be NAMED. If no named source, no warm. This refines Lesson 19 #8 (source-motivated lighting) and Lesson 19 #10 (camera grammar).

### Lesson 19 — The MAWZE Editorial DNA — the eleven elements every prompt must have. THIS IS THE FOUNDATIONAL RULE.
**Observed:** Karim flagged the four "by far loved" prompts: speaker hero, motocross champion, Italian moka-pot bike, and wreck-and-horse. After briefly testing a clean-realistic e-commerce direction (Lesson 18), he reverted, saying *"the editorial style gives the thing a lot more personality... I felt there is more depth than only beauty."* The four loved prompts share an exact recognizable DNA. This lesson names it.

**Rule:** Every MAWZE prompt must contain ALL ELEVEN of the following elements. Missing any one is what causes a prompt to fail — not too few words, not wrong references, not bad camera grammar. Missing one of the eleven. Use this as a literal checklist before submitting.

**The Eleven Elements:**

| # | Element | What it gives the image | Failure mode if missing |
|---|---|---|---|
| 1 | **Character with implied backstory** — "deadpan lived-in presence," "calm defiant gaze," "knowing half smile." Traits, not poses. | A specific person, not a model | Image reads as a casting board headshot |
| 2 | **Wardrobe as costume design** — every garment named with era / material / state ("distressed olive leather bomber half zipped," "vintage 1970s motocross jacket cream blue red sewn patches half zipped") | The wardrobe tells a story before the prop arrives | Image reads as a catalog |
| 3 | **One whisper of old-money status** (Lesson 5) — single Cartier Tank, single pearl strand, gold signet, gold hoops, gold chain. Always SINGLE, always small. | Quiet wealth tension | Image reads as flat streetwear or flat luxury |
| 4 | **One studied imperfection** (Lesson 4) — untied lace in sand, mud-splattered legs, dust on shoes, windblown hair, one button undone | Editorial vs catalog distinction | Image reads as e-commerce |
| 5 | **Bold cultural punchline prop** (Lesson 3) — horse, Rolls, moka pot, chrome trophy, speaker cathedral. Real-world misplacement, never surreal. | The 0.3-second stop-the-scroll moment | Image is admirable but forgettable |
| 6 | **Implied second presence / story debris** — driver door ajar with no driver, long shadow at frame edge, distant rider mid-jump, second espresso cup, tipped racing trophy. **The single most important element for DEPTH.** | Narrative — *something else just happened, or is about to* | Image is a tableau, not a story |
| 7 | **Atmospheric layer** (Lesson 10) — sand dust, smoke curling, mist, skeletal trees, shadow falloff, late golden haze | The frame breathes | Image is sterile |
| 8 | **Source-motivated, directional lighting** (Lesson 7) — named source + named compass direction. "Soft late afternoon light from frame left" / "Low industrial pendant lamp overhead casting warm tungsten pool" | Cinematography vs photography | Image is flat or theatrical |
| 9 | **Specific face direction with character moment** (Lesson 2) — sunglasses pulled halfway down, knowing smirk, lips parted mid-laugh, defiant gaze just past lens | The seduction layer — viewer wants to BE this person | Image is admirable but cold |
| 10 | **Cluster-correct cinematic camera grammar** (Lesson 9 + 16) — 35mm anamorphic / heavy grain / halation / muted cinematic for cinematic-on-location; Hasselblad H6D / fine clean grain / neutral muted for studio-editorial | Photographic register | Image looks digital-flat or AI-cinematic |
| 11 | **References as brand anchors** — two photographers + one campaign. "Saint Laurent campaign by Vaccarello + Glen Luchford + Steven Klein" (location) or "Tyler Mitchell + David Sims + studio fashion editorial" (studio) | Locks the visual register | Image drifts toward MJ defaults |

**The single most important element: #6 — implied second presence.**
This is the load-bearing element. Every loved prompt has it:
- *Speaker hero:* the cheap white earbud — implies an iPhone offscreen, the streaming-era kid
- *Motocross champion:* burgundy Rolls Royce with door ajar (no driver) + distant male rider mid-jump (he crashed)
- *Italian moka-pot bike:* second figure's long shadow at frame edge + white espresso cup on fuel tank (someone else is here)
- *Wreck-and-horse:* horse looking calmly back from its own shaft of light + half-smoked cigarette (someone is watching, someone has been here)

Without #6, the image is decoration. With #6, the image is narrative. **This is the difference between "beautiful" and "depth."**

**Apply:**
- Before every prompt, run the 11-element checklist literally.
- If any element is missing or weak, the prompt is not done.
- The MAWZE prompts that worked are not lucky. They hit eleven.
- The ones that failed (e-commerce experiment, falcon, cashmere portrait, sepia disco) missed elements — usually #6 (no second presence), or #4 (no imperfection), or #11 (wrong references).

**Supersedes Lesson 18.** The "AI-tell" anxiety was a misdiagnosis. The AI tell isn't cinematic grammar — it's cinematic-without-depth. The fix is to add the eleven elements, not strip the cinematic grammar. **Default to editorial cinematic with cluster-correct camera grammar (35mm anamorphic for location, Hasselblad H6D for studio). Default to cinematic. Default to depth.**

### Lesson 18 — ⚠️ SUPERSEDED BY LESSON 19. Kept here as historical record of a wrong turn.
*The original "go clean realistic, drop cinematic" rule below was a misdiagnosis. The actual problem with some MJ outputs was cinematic-without-depth (missing implied second presence, missing story debris, missing source-motivated lighting). The fix is NOT to drop cinematic grammar — it is to add the eleven editorial elements (Lesson 19). Editorial cinematic IS the MAWZE brand voice. Reading the rule below as anything other than historical context will produce wrong prompts.*

#### Original (now superseded):
**Observed:** After multiple "cinematic" speaker subworld images (35mm anamorphic, heavy grain, halation, muted cinematic grade), Karim flagged the bigger strategic problem: *"the images we're generating are super cinematic and so good but they look like they're done by AI. I don't know if this is the kind of images that will excite fashion brands."* He pointed back to the original reference image he sent at the start of this subworld — clean, sharp, digital medium format, natural neutral grade, no grain, no halation — as the actual target.

**Rule:** Cinematic film grammar (grain + halation + anamorphic + muted cinematic grade) is a 2010s aesthetic. AI tools default to it because their training pool is full of dramatic film stills — so it has become the *AI tell* in 2026. **Real fashion shoots in 2026 — Bottega Veneta, The Row, Lemaire, Phoebe Philo, current Saint Laurent lookbooks, current Hermès — are digital medium format, sharp, clean, neutral grade, no grain.** Mimicking that is what hides the AI fingerprint and makes the image read as a real campaign.

**OLD studio-editorial camera block (DROP):**
- "shot on 35mm anamorphic film"
- "heavy film grain" / "fine clean grain"
- "halation on highlights"
- "muted cinematic color grade"
- "modern cinematic"

**NEW studio-editorial camera block (USE):**
- "Hasselblad X2D 100C digital medium format" or "Phase One IQ4 150MP digital medium format"
- "natural daylight balance"
- "sharp clean image throughout"
- **"no grain, no halation"** (explicit negation — MJ defaults to grain unless told)
- "natural neutral color grade"
- "neutral skin tones, no hard shadows"
- "contemporary fashion editorial quality"
- References: Tyler Mitchell, David Sims, Carlijn Jacobs, Karim Sadli (clean fashion campaign tier)

**Litmus test before every prompt:** *Would Bottega / The Row / Lemaire ship this in their actual lookbook?* If yes, go clean. If the image is supposed to feel like a *film still* or a *mood / atmosphere image* (the cinematic-on-location heroes — wreck-and-horse, motocross, bike-and-moka), cinematic grammar still applies and is correct. The two clusters now diverge in camera grammar more sharply than Lesson 16 originally implied.

**This refines Lesson 16:**

| Cluster | Camera grammar | Why |
|---|---|---|
| **Cinematic-on-location** | 35mm anamorphic, grain, halation, muted cinematic grade — UNCHANGED | Location heroes need atmospheric drama; viewer reads them as *film stills*, which is the intended register |
| **Studio-editorial** | Hasselblad X2D digital medium format, sharp, clean, no grain, no halation, natural neutral grade — **CORRECTED** | Studio commercial fashion in 2026 is clean digital. Cinematic in studio = AI tell. |

**Apply:**
- Default new prompts to clean realistic unless the brief explicitly asks for cinematic / film-still mood.
- The cinematic-on-location heroes already shot stay correct; do not retroactively reshoot them clean.
- Photographer references for clean cluster: **Tyler Mitchell, David Sims, Carlijn Jacobs, Karim Sadli, Mark Borthwick** — all of whom shoot real digital fashion in clean register.
- Avoid for clean cluster: **Anthony Vaccarello (sometimes pulls 90s grain), Steven Klein (period), Glen Luchford (90s grain), Helmut Newton (noir grain).** These are correct for cinematic-on-location, wrong for clean studio.

### Lesson 17 — The prompt is a SEED, not a SHOT LIST. Minimalism beats detail. Surgical edits beat rewrites.
**Observed:** The speaker-cathedral subworld cycled through ~10 prompts. Karim's ~150-word version (Hasselblad / studio editorial / soft frontal / Tyler Mitchell + David Sims) produced the best images (#78, then #79 with two surgical additions). Every time I expanded the prompt into "senior photography designer" mode — multi-source lighting setups, named cinema cameras, "raw poured concrete wall," cinematographer references, story debris on the floor — MJ produced incoherent or wrong-register results. Karim called it: *"the prompt I gave you is twenty times better."*

**Rule:** Every clause beyond ~200 words dilutes MJ's attention. **Direct the SUBJECT and the WORLD. Do not direct the camera, grade, or three-source lighting.** MJ is the photographer; you are the casting director + stylist + location scout. Stay in your lane.

**What didn't work in this round (and why):**

| Failed move | Why |
|---|---|
| Hard top-light + soft fill + cool rim (3-source lighting spec) | MJ flattens or contradicts multi-source instructions; produces generic studio key anyway |
| "Raw poured concrete wall" / "warm sepia atmospheric falloff" | Triggers painterly mottle / AI-vintage rendering |
| Saint Laurent black silk shirt unbuttoned to mid-chest | Period-coded 1978 disco — the *opposite* of modern luxury |
| 35mm anamorphic onto a studio cluster image | Breaks Lesson 16 — studio cluster wants Hasselblad H6D clean medium-format |
| Live falcon as a bold horse-equivalent punchline | Too big for studio minimal — horse-in-warehouse logic only works in cinematic-on-location |
| Story debris (vinyl on floor, coffee mug, cables) on a studio shot | Breaks Lesson 16 — studio cluster wants clean negative space; debris belongs to cinematic-on-location |
| Steven Klein + Inez & Vinoodh + cinema cinematographers as references | Some pull period/vintage in MJ's pool; mixing fashion + cinema photographers confuses register |
| Rewriting Karim's working prompt instead of editing it | Threw away the parts that worked to "fix" the parts that didn't |

**What worked:**

| Working move | Why |
|---|---|
| ~150-word focused prompt (Karim's original) | MJ keeps signal coherent end-to-end |
| Hasselblad H6D + soft frontal + neutral grade + Tyler Mitchell + David Sims | Studio-editorial cluster grammar, locked |
| Single Cartier Tank visible at the wrist (one surgical add) | One clause = one quiet-luxury whisper of contradiction (Lesson 5 + Lesson 8) |
| Single white wired earbud held between thumb and forefinger, second bud loose (one surgical add) | Specific physical config makes MJ render it legibly instead of as abstract wire |
| Letting MJ produce asymmetric speaker heights instead of fighting for "perfect symmetry" | Real cathedrals breathe; the model breaks staging on its own |

**Apply:**
- **When a prompt is 80% there, add 1–2 surgical clauses. Do NOT rewrite.**
- **When a prompt is failing, trim. Do not expand.**
- **When richness feels missing, the answer is usually a DIFFERENT CAMPAIGN ROLE (Lesson 6 — portrait, detail, environment, b-side), NOT a more detailed hero prompt. Don't iterate one shot to death; ship it and move to the next role in the series.**
- **Maximum two surgical edits per cycle.** If two adds didn't fix it, the seed is wrong — go back to the last working version.

### Lesson 16 — Camera grammar VARIES by cluster. Variation across the LoRA dataset is the point.
**Observed:** I overcorrected from Lesson 9 — locking 35mm anamorphic + dense cinematic grammar onto every prompt regardless of register. For the speaker-cathedral subworld I argued my own way out of "Hasselblad medium format / studio seamless / minimal" and into "dim basement listening room / vinyl strewn / coffee steaming / story debris." Karim flat-out preferred the original minimal version: *"more minimal puts emphasis on the product. If we generate every image super detailed it loses its value. We need variation."*
**Rule:** The LoRA training set needs **multiple distinct camera grammars** represented across clusters. Locking every image to one camera collapses the model into one register and the brand reads as one-note. Each cluster has its own internally-consistent grammar; the *variation between clusters* is what gives the brand range.

**Cluster grammars (so far):**

| Cluster | Camera | Backdrop | Lighting | Layer density | Example heroes |
|---|---|---|---|---|---|
| **Cinematic-on-location** | 35mm anamorphic, shallow DoF, heavy grain, halation, muted cinematic grade | Real environments (warehouse, dunes, motocross track) | Source offscreen, motivated, warm/cool split, deep shadow | High — 6+ layers (Lesson 10) | Wreck-and-horse, bike-and-moka, motocross champ |
| **Studio-editorial** | Hasselblad H6D medium format, full body, fine clean grain, neutral muted grade, sharp through mid-frame | Warm grey seamless or single-tone, no floor line | Soft frontal continuous key, even fall-off, daylight balance, faint warm cast | **Low — minimal. Product / silhouette IS the hero.** Studio editorial DOES NOT do "story debris." | Speaker cathedral |
| (More to come) | — | — | — | — | Surreal-staged, hard-noir, soft-romantic — document when their references arrive |

**Why:** A LoRA trained on one grammar produces one look. A LoRA trained on multiple distinct grammars — each internally clean — gives the brand range. Range is what makes a campaign feel like a campaign instead of a slideshow of one pose. Also: minimalism is its own discipline. Too much story debris in a studio shot turns the punchline prop into noise. The silence around the joke IS the joke.

**Apply:** Before writing each prompt, decide which cluster the image belongs to. Match camera grammar **and** layer density to that cluster. Don't mix grammars within one image. Don't pad a studio prompt with vinyl-on-floor / steaming-coffee / dust-motes detail — that belongs to the cinematic-on-location cluster.

**Supersedes part of Lesson 9.** The "camera grammar is locked, always 35mm anamorphic" rule was written from the bathtub-in-field failure where MJ flipped into digital illustration. The trigger for illustration mode was the *photographer references* (Tim Walker, Sassen, Madigan Heck — all carry painterly-illustration weight in MJ's pool), **not** the camera token itself. Tokens like "Hasselblad H6D" or "medium format" are safe when paired with photographic-mode references (Tyler Mitchell, David Sims, Steven Klein, Inez & Vinoodh). Lesson 9's photographer-avoid list still stands. Lesson 9's "always anamorphic" claim does not.

### Lesson 1 — Every reference becomes a fashion shoot
**Observed:** Karim sent a fine-art reference of a lone figure in a red field (no clear fashion intent). Asked me to rewrite it as a fashion shoot with the same aesthetic.
**Rule:** No matter how fine-art / documentary / surrealist a reference looks, the prompt always treats it as a fashion editorial. The reference gives us the *vibe* (palette, light, composition, mood). The output gives us the *clothing* (couture vocabulary, model body language, status accessories, brand world).
**Why:** The whole reference set feeds MAWZE's LoRA training. Train on fine-art and we get fine-art outputs. Train on fashion and we get fashion outputs. Every image must teach the model "this is what cinematic fashion photography looks like."
**Apply:** Translate every brief into "what would this look like as a Loewe / Saint Laurent / Maison Margiela / Jacquemus campaign?" Then write the prompt with designer-specific wardrobe language.

### Lesson 2 — Hero face must invite, not perform
**Observed:** First two iterations of the wreck-and-horse image hid the model's face entirely. Karim said the face has to make the viewer "love" the brand.
**Rule:** For hero / portrait shots, the eyes must be visible. Subtle smirk beats full smile beats flat stare. Slight off-axis gaze beats direct lock for old-money / quiet-luxury voice — direct lock reads aggressive / streetwear-rapper.
**Why:** The face is the seduction layer. Without it the image is admirable but cold; the viewer admires the suit and moves on. A crack of personality (smirk, half-smile, raised eyebrow) is what makes them want to *be* the person in the image.
**Apply:** Every hero prompt must include explicit face direction: gesture (lowering sunglasses, finger to lip, mid-laugh), expression (faint knowing half-smile, lips slightly parted), and gaze (locked into camera or just past the lens).
**Caveat:** Surreal-staged register tolerates hidden faces — anonymity is the symbolism in that bucket. Cinematic-editorial does not.

### Lesson 3 — Punchline prop must be cultural, not surreal-bait
**Observed:** Karim asked for "something unexpected, something everyone gets the joke of, that complements the suit's personality without competing."
**Rule:** Misplacement beats fantasy. A horse in a warehouse > a floating fish. A chandelier in a brick building > a melting clock. The prop must be a real-world cultural reference (equestrian wealth, opulence, religion, leisure) placed in the wrong setting. The viewer reads the joke in 0.3 seconds.
**Why:** Surrealist objects read as "AI did this" — gimmick energy. Misplaced real objects read as "someone made a *decision*" — director energy. The brand needs director energy.
**Apply:** Stress-test every prop with: "Does this complement the subject's wardrobe / brand register, or compete with it?" If it competes, swap.

### Lesson 4 — One studied imperfection per look
**Observed:** Karim consistently lights up when prompts include details like "untied lace dragging into the sand" or "ash about to fall" or "kicked-off shoe in the sand."
**Rule:** Every editorial fashion image needs *one* moment of decay or human imperfection. Not three. Not zero. One. It transforms the image from catalog (where everything is perfect) to editorial (where the moment is real).
**Why:** Perfect outfits read as e-commerce. The single imperfection is the signature of a real photographer making a real decision. It's the difference between "this is a product" and "this is a story."
**Apply:** Always include one — and only one — imperfection in the wardrobe / pose. Examples: untied lace, kicked-off shoe, smudge of dirt on cuff, half-tucked shirt, mid-cigarette ash, one button undone, slipped strap, sand on the silk hem.

### Lesson 5 — Status must whisper
**Observed:** When asked to refine accessories, Karim consistently chose Cartier Tank over a chunky watch, single strand of pearls over a chain, gold signet over loud rings.
**Rule:** All status objects must be the *quiet* version of themselves. Quiet wealth speaks louder than loud wealth in MAWZE's voice. Never logos. Never anything that announces itself.
**Why:** Loud status reads as nouveau / streetwear. Quiet status reads as old-money / boutique. MAWZE is closer to the second.
**Apply:** Default status objects: Cartier Tank watch, single strand of vintage pearls, gold signet ring, slim gold chain (not thick), monk-strap or derby shoes (not sneakers, not buckled boots), unlogo'd black acetate sunglasses.

### Lesson 6 — Cinematic ≠ Hero — campaigns are series
**Observed:** Two strong images came out of the same prompt — one wider with the lamp out of frame and the body sunken in (more cinematic), one tighter with the face visible (better hero). Karim asked which is "best" — but both have a job.
**Rule:** A real fashion campaign is a *series* of 5–8 images, each doing a different job: hero (face / sells the look), mood (wide / sells the world), detail (close / sells the fabric), environment (very wide / sells the place), B-side (humor / surreal / sells the brand has range). Don't pick *the* image — pick *each*.
**Why:** Calvin Klein, Saint Laurent, Loewe never publish single shots. They publish series. The series tells the story. Single images are forgettable; series build worlds.
**Apply:** When Karim asks "which one is best?" — answer with which job each does. Suggest keeping multiple images, each tagged for its role in the campaign.

### Lesson 7 — Source-motivated lighting from offscreen beats visible source
**Observed:** When the pendant lamp left the frame in image #48, the result felt much more cinematic than #47 where the bulb was fully in frame.
**Rule:** Crop the light source out. Let only the *light* enter the frame. The viewer's brain fills in the rest, which always reads richer than seeing the bulb.
**Why:** This is a Roger Deakins / cinematographer fundamental. Visible practical lights look like set dressing. Hidden practical lights look like life. Fashion editorial follows cinema, not theater.
**Apply:** When describing lighting, prefer "warm tungsten light spilling in from above-frame" or "a shaft of light entering from a window outside the frame" over "a pendant lamp visible at the top of the frame."

### Lesson 8 — Contradiction must be named in the prompt
**Observed:** Adding the explicit clause "the quiet absurdity of equestrian wealth in industrial decay" produced a more cohesive image than leaving the contradiction implicit.
**Rule:** Always end the descriptive section of the prompt with a one-line *contradiction clause* in the form: *"the [tension noun] of [register A] in [register B]"*. MJ uses it as a vibe anchor.
**Why:** Without the clause, MJ assembles the parts but doesn't understand the tension between them. With the clause, every choice gets weighted toward the tension. The clause is the director's note.
**Apply:** Examples:
- *the quiet absurdity of equestrian wealth in industrial decay*
- *the silent ceremony of a saint stranded in a field of fire*
- *the casual decadence of couture caught mid-collapse*
- *the charm of a man who knows you're watching*

### Lesson 15 — Read the racial / power dynamics of every catch-the-eye element.
**Observed:** I proposed a "uniformed chauffeur in livery" attending to a Black female model — borrowing the decadent-class-collision logic from the wreck-and-horse hero (white male heir + horse in warehouse). Karim asked the right question: "is it because she's black?" The trope doesn't transfer cleanly. A Black woman + servant-in-livery + old-world luxury car carries pre-loaded cultural weight regardless of intent.
**Rule:** Before adding any human catch-the-eye element, audit the **power dynamic** between the model and that figure through a racial / class / gender lens. The catch-the-eye must be:
- A peer (same level, just dressed for a different world)
- Family / lineage (grandmother, child, sister — celebrates the model)
- Decadent object (no human attached — Rolls with no driver, chandelier, banquet table)
- Pure surreal element (a peacock, a flamingo, a string quartet of *peers*)

**Never:** a figure who reads as serving / attending / waiting on the model when there's a power gradient (race, class, age) that pre-loads the image with hierarchy. The same prop on a different model can read totally differently — always run the gradient check.
**Why:** The viewer reads images through cultural defaults. Even when *I* intend "decadent absurdity," the viewer reads "hierarchy." Brand work has to be legible without an explanation.
**Apply:** When the model is a person of color, woman, or any historically-marginalized identity, default to:
- *Lineage props* (older family member, child)
- *Peer props* (friends, teammates, equals)
- *Pure objects* (no human servant — just the luxury thing alone)
- *Surreal nature* (animals, weather, plants in wrong places)

### Lesson 14 — "Unusual" means decadent, charming, or dry-funny — never eerie or scary.
**Observed:** I added a "barefoot bride in a wedding gown standing in the mud watching the champion." Karim flagged it instantly: this reads as *ghost bride / corpse bride / Crimson Peak / horror movie*, not as "wedding interrupted / fashion absurdity."
**Rule:** Every catch-the-eye element must land in one of three tonal registers:
- **Decadent absurdity** (a Rolls-Royce parked at a motocross track, a chandelier in a warehouse, a banquet table in a field)
- **Warm emotional surprise** (a grandmother in Chanel watching, a child in matching gear, a chauffeur holding an umbrella for her)
- **Dry-funny charm** (a string quartet in tuxedos, a Yorkie in a tiny racing jacket, a peacock crossing the frame)

The viewer's reaction must be *smile / curious / heart-tug* — never *unsettled / creeped out / trauma-flagged.*
**Why:** MAWZE's voice is luxurious-playful, intelligent-warm. Horror tropes (women alone in white in wrong places, blood, candles, supernatural figures, abandoned children, dolls, mirrors with shadowy figures) carry pre-loaded cultural weight that drowns the brand voice in unease. A confused viewer is a lost viewer.
**Apply:** Stress-test every proposed catch-the-eye element with: "Does this evoke a horror film, true crime, or trauma narrative in any way?" If yes — even tangentially — kill it. Replace with a decadent/warm/charming option from Lesson 11's vocabulary bank.

**Specific tropes to avoid:**
- Lone women in white in unexpected locations (always reads as ghost)
- Children alone (always reads as missing-child trope)
- Empty chairs / empty cribs / empty places (death implication)
- Blood, red liquid, deep stains (violence implication)
- Mirrors / reflections / doppelgängers (supernatural)
- Crows / ravens / black birds in numbers (death)
- Dolls, marionettes, mannequins (uncanny valley)
- Heavy candle/lantern lighting in dark settings (séance)
- Fog / mist alone in landscape (ghost story)

### Lesson 13 — Tight prompts. ~200 words max. No verbose pose narration.
**Observed:** I kept writing 350-400 word prompts with multi-clause descriptions of every body part, fold of fabric, and shadow. Karim flagged it: "should be like half. Same quality."
**Rule:** Hard cap of ~200 words on every prompt. The seven-layer anatomy still applies, but each layer is **one tight clause**, not a paragraph.
**Why:** Long prompts dilute MJ's attention. The model weights tokens by position and density — when 30 words describe a single pose, MJ loses the signal of *what matters* in the image. Tight prompts let the camera grammar and the IDEA carry through. Also: long prompts hit MJ's truncation limit and choke the request.
**Apply:** Compress relentlessly. Cut every phrase like:
- "body angled at three-quarter to camera weight on her right leg hip cocked shoulders broad chin slightly lifted face turned just past the lens quiet defiant calm not smiling not performing just finished" → **"three-quarter to camera, hip cocked, calm defiant face just past the lens"**
- "in the mid-distance background standing barefoot in the muddy field a second young woman in a flowing antique white silk wedding gown" → **"in the mid-distance, a barefoot bride in a white silk gown"**

Verbose pose narration is the worst offender. One adjective + one verb is usually enough.

### Lesson 12 — The image must have a HIDDEN IDEA, not just a surface tableau.
**Observed:** I built a literal "girl at motocross track" image — model + motocross jacket + flying rider + mud + kid's helmet. Every element reinforced the obvious read. Karim flagged it as "no idea after." Predictable. Decorative. Not editorial.
**Rule:** The image needs **three beats**, not two:
1. **Surface read** (0.3 sec): the obvious tableau — *a girl at a motocross track*
2. **Stop-the-eye detail** (1 sec): the discoverable element — *flying rider, kid's helmet*
3. **HIDDEN IDEA** (3 sec): the recontextualization — *wait, she's the champion, not the watcher*

Without beat 3, the image is decorative. With beat 3, it's editorial. The hidden idea must **invert or complicate the surface read** so the viewer's mental model has to refresh.
**Why:** Decoration is forgettable. Inversion is the thing every great editorial image has — Saint Laurent images where the man wears the dress, Gucci images where the grandma wears Versace, Loewe images where a duck wears couture. The brain processes inversion as "intelligent" and the image stays in memory.
**Apply:** Before writing the prompt, ask: **"What would the viewer NOT expect to find true about this scene? What's the hidden flip?"** Examples of hidden flips:
- *She looks like the girlfriend, but she's actually the racer (a giant trophy in her hands)*
- *He looks like the heir, but he's actually the gardener (mud on his hands, the suit doesn't fit)*
- *She looks like the bride, but she's actually leaving the wedding (a packed suitcase, mascara streaks)*
- *They look like the family, but they're actually strangers brought together by fate (a single visible passport on the ground)*
The flip must be:
- **Embedded as a visual fact** (not implied, not symbolic — a concrete object or detail that proves it)
- **Discoverable, not announced** (the viewer arrives at it themselves)
- **Genuine inversion** (not just "interesting" — actively contradicts the surface read)

### Lesson 11 — One stop-the-eye detail per image. Never repeat. Especially not cigarettes.
**Observed:** I defaulted to cigarette + smoke as the "charm/atmosphere device" in three consecutive prompts (the wreck heir, the bathtub gown, the bike-in-dunes). Karim caught it: "we've ruined everything with a cigarette."
**Rule:** Every image needs *one* stop-the-eye detail that does the story-triggering work. **It must be different in every single image.** Never reuse the same device twice across the reference set. The cigarette was earned once and is now retired for at least the next ten prompts.
**Why:** The detail is the soul of the image — it's what makes a viewer pause and *imagine* the world this character lives in. If every image has the same device, the viewer stops noticing it. Variety in the stop-the-eye details is what builds a *world* across a series. Same device repeated = same image repeated, which kills brand range.

**The detail must be:**
- **Specific to this character / this scene** (not universal-fashion-shorthand)
- **Culturally legible in 0.3 seconds** (a moka pot reads "Italian," a falcon on glove reads "old-money"; surrealism for surrealism's sake fails)
- **Story-triggering** (the viewer constructs a backstory from the object — "why is THAT here?")
- **Either bold and central** (a horse in a warehouse, a bathtub in a field) **or subtle and discoverable** (a moka pot on a rock, a child's helmet on the seat)

**Vocabulary bank (rotate, never repeat across images):**

| Category | Options |
|---|---|
| **Animals** | white poodle, racing pigeon on handlebar, songbird in vintage cage, falcon on glove, single peacock crossing frame, taxidermy stag head propped on the floor, butterflies on the rim of a glass |
| **Food / drink** | moka pot on portable gas burner with steam rising, single glass of red wine on the dirt, bunch of red grapes on a metal surface, half-eaten croissant on a tile, melting popsicle, oysters on a tin plate, Italian espresso cup balanced on something it shouldn't be |
| **Implied second person** | a man's tuxedo jacket draped over the rim/chair (not hers), a second wine glass abandoned, child-sized helmet on the seat, two pairs of shoes set neatly in different sizes, a phone receiver off the hook coiled into the dirt |
| **Living artifacts** | open vintage suitcase spilling silk scarves with one billowing in wind, vinyl record propped against the wheel, polaroid camera with photos scattered, lit candelabra, an old rotary phone in the dirt with cord trailing |
| **Cultural anchors** | rosary draped on the handlebar, an Italian newspaper folded in the dirt, a tipped-over racing trophy in the sand, a bible open face-down, a hand-painted icon propped against a rock |
| **Misplacement (Magritte)** | a working TV showing static plugged into nothing, a grand piano half-buried, a grandfather clock standing freely, a chandelier hanging from sky with no ceiling, a Persian rug rolled out across dirt |
| **Plants / nature inversions** | fresh roses in a desert, a cactus in a porcelain teacup, an ice block melting in the sun, fresh-cut tulips in a glass vase planted in sand, a single orange tree growing from a crack |

**Apply:** Before writing any prompt, pick ONE detail from the bank that fits *this character / this scene*. Pick a different one next time. Track which I've used so I never repeat.

**Used so far (do not reuse):**
- Half-smoked cigarette + curling smoke (3x — retired for now)
- Live thoroughbred horse in warehouse
- Kicked-off shoe in the sand
- Crystal coupe of champagne (used twice — retire)
- Rose petals on bathwater
- Discarded high-heels in grass

### Lesson 10 — Cinema needs layers. Minimalism never renders as cinema.
**Observed:** Even with cinematic camera grammar (35mm, shallow DoF, grain, halation), a clean surreal-staged composition (single figure + single prop + sky + grass) rendered as flat commercial illustration. The wreck-and-horse worked because the frame had five-plus layers of objects, wear, and atmosphere. The bathtub-in-field had four. Four is too few.
**Rule:** Build a *scene*, not a *tableau*. Pile environmental layers around the central concept: cast-off clothing, dropped objects, story debris suggesting a second figure has been there, weather (mist, dust, steam, lens flare), and direction-specific lighting (raking sun from frame-left, not flat overhead).
**Why:** MJ collapses sparse compositions into icon / poster / illustration mode. Density of *things* and *story* is what triggers the photographic mode. Cinema is the opposite of minimalism — it's compressed maximalism within a single frame.
**Apply:** Before submitting any prompt, count the layers in the described scene. If under 6 distinct objects/textures/light moments, add more. Always include:
- Environmental wear (cracks, stains, dust, scratches on the props)
- Story debris (cast-off clothing, dropped accessories, footprints, finished/spilled drinks)
- Implied second presence (a coat that isn't hers, a second glass, a phone off the hook)
- Atmospheric layer (steam, mist, lens flare, dust, smoke)
- Direction-specific lighting (golden hour raking from one side beats midday overhead)

### Lesson 9 — Camera grammar is locked. Only composition and mood vary.
**Observed:** I tried to switch camera language by register — medium format / deep focus / saturated for surreal-staged, 35mm / shallow DoF / muted for cinematic-editorial. The surreal-staged version came out as **digital illustration**, not cinema. Karim immediately spotted it: "the camera is not very good."
**Rule:** **The camera, focus, grain, and grade are constant across every prompt — always cinematic.** Only the composition (lighting, palette, subject framing) and the punchline logic change between registers. Cinema is cinema regardless of subject matter.
**Why:** Midjourney's tokenizer reads "medium format / deep focus / saturated / Tim Walker / Erik Madigan Heck" as a signal to render *digital painterly illustration* rather than photograph. Even one of those tokens is enough to flip the model into illustration mode. The fix is to never use them — even when the original reference image is itself in that register.
**Apply:** Always use this camera block in every prompt, regardless of register:
- shot on 35mm anamorphic film
- slight low angle, full body or 3/4
- shallow depth of field with the horizon falling off into soft blur
- heavy film grain, halation on highlights
- muted cinematic color grade (not saturated, not chromogenic)
- `--style raw --v 8.1 --s 400` (never `--s 500`)

**What still varies by register:**

| | Cinematic-editorial | Surreal-staged |
|---|---|---|
| Lighting | Split temperature, motivated, dim, source offscreen | Hard daylight from above, sharp shadow under hat or brim |
| Face | Must be visible (Lesson 2) | Visible too — we're treating these as fashion shoots, not art photography |
| Palette | Muted, desaturated, with warm/cool split | Three-color graphic punch (red/blue/white/black, etc.) — but still photographed cinematically |
| Prop logic | Cultural misplacement in interior decay | Cultural misplacement in vast landscape |
| Composition | Compressed, dense, claustrophobic | Wide, vast, single figure dominant |

**References — verified-safe MJ tokens (always reach for these):**
- **Saint Laurent campaign by Anthony Vaccarello** (always include this — the strongest single anchor)
- Steven Klein
- Glen Luchford
- Mert & Marcus
- Inez & Vinoodh
- Steven Meisel
- Tyler Mitchell, Gordon Parks (cinematic-editorial weight)

**Photographer tokens MJ renders WRONG (avoid even when their actual work fits the brief):**
- **Tim Walker, Viviane Sassen, Erik Madigan Heck** → MJ flips into digital-illustration / painterly mode
- **Jamie Hawkesworth, Tyrone Lebon, Harley Weir** → MJ flips into HDR-saturated-clarity-pushed "amateur Sony Alpha documentary" mode (the opposite of their real work)
- **Wolfgang Tillmans, Juergen Teller** → MJ goes flat / snapshot / harsh flash

**Why:** MJ's tokenizer doesn't know the photographer's real aesthetic — it knows what *images tagged with that name* on the web look like. For modern photographers, that pool is dominated by amateurs imitating them poorly. Sticking to Vaccarello + Klein + Luchford keeps us in fashion-campaign mode.

**Also avoid these prompt-tokens (they break the cinema):**
- "grey-green color grade" / "bleach bypass" / "muted desaturated" — MJ over-corrects with drama
- "no shadows" / "overcast no fill" — MJ adds heavy contrast to compensate
- "motion blur" on background subjects — MJ adds digital smear, not film blur
- "dramatic sky" / "stormy clouds" — instant HDR mode
- "high contrast" — instant clarity-slider mode

**Replace with:**
- "muted cinematic color grade" (no further qualifiers)
- "soft natural daylight with slight directional fall from frame-left/right" (always give MJ a light direction)
- Leave background motion unspecified — let it freeze naturally

**Apply:** Every prompt going forward uses cinematic-editorial camera grammar. Even in surreal landscapes. Especially in surreal landscapes.

---

## Appendix B — Worked Example

**Reference:** Black model on the hood of a wrecked white 80s sports car half-buried in sand inside a warehouse.

**Final prompt:**

```
young Black male model reclining diagonally across the hood of a beat-up white 1980s sports coupe, wearing a perfectly tailored midnight-navy double-breasted wool suit with peak lapels, crisp white silk shirt open at the throat, single strand of vintage pearls just visible, gold Cartier Tank watch, polished black derby shoes one with the lace untied trailing into the sand, half-smoked cigarette burning between his fingers, the car half-buried in a dune of pale desert sand inside an abandoned warehouse with exposed dark brick walls, a single live chestnut thoroughbred horse standing calmly in the back of the warehouse looking directly at the camera lit by a soft shaft of light, single overhead industrial light source on the foreground, cold teal cast on the white car body warm amber catch on his skin and the suit lapel, deep moody shadows in the corners, shot on 35mm anamorphic film, low angle full body, shallow depth of field, heavy film grain, halation on highlights, muted cinematic color grade, editorial portrait, the quiet absurdity of equestrian wealth in industrial decay, in the style of Saint Laurent campaign by Anthony Vaccarello and Tyler Mitchell and Gordon Parks --style raw --v 8.1 --s 400
```

**Decoded by layer:**
- **Subject:** young Black male model + tailored suit + pearls + Cartier + untied lace (the imperfection) + cigarette
- **Setting:** wrecked 80s coupe + sand dune + warehouse + brick
- **Punchline:** live thoroughbred horse looking at camera
- **Lighting:** overhead industrial, cold teal / warm amber split, deep shadows
- **Camera:** 35mm anamorphic, low angle, full body, shallow DoF
- **Texture:** heavy grain, halation, muted cinematic grade
- **Contradiction clause:** *the quiet absurdity of equestrian wealth in industrial decay*
- **References:** Saint Laurent / Vaccarello + Tyler Mitchell + Gordon Parks
- **Params:** `--style raw --v 8.1 --s 400`
