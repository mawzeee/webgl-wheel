# MAWZE — Build Plan

> Locked May 3, 2026. Engineering-first sequence to ship the SaaS.
> Companion to `MAWZE_STRATEGY.md` (the *what* and *why*) and
> `MIDJOURNEY_PROMPT_SKILL.md` (the prompt method / taste discipline).
>
> This doc is the *how* and the *when*. Hand to any agent to pick up the build cold.

---

## The locked decision

**Build the product first. Marketing site second.**

The WebGL slider in this repo is the marketing wrapper. It's polished and beautiful, but polishing one transition before the SaaS exists is procrastination dressed as work. The site can wait until there's a paying-customer flow to drive traffic to.

All work below assumes:
- Solo founder (Karim) building it
- Claude as collaborator (skills, code, copy)
- Replicate for inference + LoRA training
- Supabase + Vercel for the SaaS app
- ~$2k of compute spend across all phases

---

## The milestone — what "the product works" means

> You sit down at 2pm. Drop a product image. Type three lines about it.
> By 3pm you have **8-12 finished images** in your inbox that look like
> a real campaign — coherent visual world, brand-shippable, not AI slop.

That's the bar. If your own eye flinches at the result, the product doesn't work yet. If you'd post it for your own brand, the product works.

**No UI is required to hit this milestone.** CLI + Claude Code skill + Replicate web is enough to prove it. The SaaS app is built *after* the milestone is hit, not before.

---

## Week 1 — Manual pipeline validation

**Goal:** prove the whole pipeline works end-to-end before writing a single line of SaaS code. Use existing public Flux LoRAs as scaffolding so we don't need to train ours yet.

| Day | Task | Output |
|---|---|---|
| 1 | Spin up `~/.claude/skills/mawze-director/` — write the system prompt for the AD. Claude drafts; Karim taste-tests. | Working skill in Claude Code |
| 2 | Test the skill on 5 fake briefs (a candle, a sneaker, a tote, a wine, a chair). Read every treatment as if your harshest art-director friend wrote it. Iterate the prompt. | 5 credible treatments |
| 3-4 | Pick the best treatment. Manually feed each shot's JSON into Replicate's Flux 2 + IP-Adapter, with one public mood LoRA stacked. Generate 8-12 shots for ONE complete shoot. | 8-12 finished images, one shoot |
| 5-6 | Look at the result. Honestly. Where's the gap? Style consistency? Product fidelity? Composition? Talent direction? Document each gap. | A list of what's broken |
| 7 | Decide: is the gap *fixable with custom LoRAs* (style consistency) or *systemic* (the model itself isn't there yet)? | Go/no-go on building MAWZE |

**Day-7 verdicts:**
- ✅ "This works, the gap is fixable" → Week 2 trains LoRAs to close the gap.
- ❌ "This isn't there yet" → 7 days and ~$30 of inference spent, not 6 weeks and $20k of dev time. Re-evaluate.

**Cost ceiling:** ~$50 in Replicate inference. ~30 hours of focused work.

---

## Week 2-3 — Train the missing pieces

Whatever broke in week 1 dictates what to train. Most likely findings:

| Gap | Fix |
|---|---|
| Style register isn't tight enough | Train `cinematic-editorial` first. ~$25 / 30 min on Replicate. |
| Product details get re-imagined by the model | Boost IP-Adapter weight; switch to Flux Kontext for product-anchored shots. |
| Across-shot consistency drifts | Lock seed-base strategy in the Director skill; lock palette before generation. |
| Talent looks generic / "AI face" | Train a portrait-discipline LoRA OR add a curated face-detail LoRA from the public library. |
| Lighting is flat | Add `low-key-lighting` LoRA to the library; teach the AD when to stack it. |

**Initial 3 LoRAs to train (priority order):**
1. `cinematic-editorial` — Calvin Klein / Ssense / Mubi register
2. `soft-romantic` — Glossier / Petra Collins
3. `hard-noir` — Saint Laurent / Helmut Newton

**Per LoRA:**
- 25-40 hand-picked images. Curate from one register only. Apply the taste discipline from `MIDJOURNEY_PROMPT_SKILL.md`.
- Florence-2 captions, then *manually edit* — strip subjects, keep style.
- Train on Replicate's `ostris/flux-dev-lora-trainer`. Default-ish: rank 16, lr 1e-4, 1000 steps.
- Validate by generating 6 test images at varying weights (0.3 / 0.5 / 0.7) on neutral subjects.

**Cost:** ~$75 / 3 LoRAs. ~9 hours of curation + validation work.

---

## Week 4-6 — The thin SaaS

**Goal:** a single-page app that runs the pipeline for someone who isn't Karim. Ugly is fine. Stripe paywall is fine. Polish comes later.

**Stack:**
- Next.js (app router) + TypeScript
- Supabase: auth (magic link, no password) + Postgres (users, shoots, generations) + Storage (uploads + outputs)
- Replicate API for inference + LoRA stacking
- Claude API (Opus 4.7) for the Director skill — same system prompt as the Claude Code skill, ported
- Stripe: pay-per-shoot $29 + monthly subscription
- Vercel for hosting

**Build order:**
| Week | Deliverable |
|---|---|
| 4 | Next.js scaffold. Supabase auth. Stripe in test mode. Basic dashboard. Email magic link works end-to-end. |
| 5 | The brief screen (S3) → calls Claude API → returns JSON treatment. The treatment screen (S4) renders editable English notes from the JSON. |
| 6 | The generation pipeline (S5). Server function: receives JSON treatment → fans out to Replicate → 8-12 parallel Flux 2 calls with LoRA stack + IP-Adapter. Streams progress back to client. Lookbook screen (S6) with ZIP download. |

**Skip in this phase (defer to phase 2):**
- Custom brand LoRA training (Studio tier)
- Past-shoots library / browse history
- Brand DNA persistence across shoots
- Pretty UI / animation
- Marketing site integration

**The watermark decision:** every Trial / Starter shoot exports with a tasteful `MAWZE · COLD OPEN` stamp at the bottom-right of each image — same typography as the WebGL site's BR rail. Removable on Creator+. The watermark is a *credit*, not a logo.

**Cost ceiling:** ~$50/mo infrastructure, ~$200 of test-mode inference, ~80 hours of build.

---

## Week 7-8 — Invite-only beta

**Goal:** twenty real DTC brands run a shoot, give 5-min recorded feedback, one of them tweets it unprompted.

**The 20 design partners — five archetypes to seed:**
1. A small fashion label (Cold Open's home register)
2. A skincare/beauty brand (lifestyle hero)
3. A food/beverage brand (atmospheric mood)
4. An object/lifestyle brand (Aesop register)
5. A tech/SaaS founder (proves it works for non-physical "products")

Get four of each. Their lookbooks become public case studies.

**Karim's role:** onboard each personally over a 30-min Zoom. Watch them use the product. Note every confusion. The first 20 shoots are free in exchange for feedback + permission to publish their lookbook.

**Win condition:** Day 56 — at least 8 of the 20 say "I'd pay $99/mo for this." At least 1 has tweeted/posted their lookbook organically.

---

## Week 9-10 — Polish + close the loop

Address the gaps the beta surfaced. Most common predictions:

- **Onboarding friction** → cut steps from S2/S3
- **Treatment editing is clunky** → richer in-place editing
- **Generation feels like a black box** → progress streaming + estimated time
- **Output downloads are awkward** → polished ZIP + PDF lookbook export

**Custom Brand LoRA training flow** (Studio tier add-on, $99 one-time): brand uploads 15-25 images → Replicate trains → LoRA gets stacked on every future generation for that brand. Ship in this window if beta demand justifies it.

---

## Week 11 — Public launch

**Pre-launch (week 10):**
- Migrate Stripe to live mode
- Set up support email / Intercom (free tier)
- Recruit a hunter for Product Hunt launch
- Pre-write the Twitter launch thread
- Lock the Codrops feature date for the WebGL site (the marketing site comes back online here as the press front door)

**Launch day:**
- Product Hunt launch (Tuesday 12:01 AM PT)
- Twitter/Threads thread from Karim: build journey + WebGL demo + 3 design-partner lookbooks + founder offer ($29 first shoot)
- Email blast to the Tally list (~200-500 names by now): "We're live, 50% off code for the next 72 hours"
- Founder offer: first 100 paying users get the Custom LoRA add-on free for life

**Press cycle (over launch week):**
- Codrops case study published
- It's Nice That feature
- Sidebar.io front page
- Glossy + Modern Retail outreach (DTC brand press)
- A guest post on a designer-Substack

**The PR hook:** *"A solo founder built an AI that replaces your $5,000 photoshoot. The first imprint won Awwwards SOTM."*

**Win condition:** $5,000 MRR by end of week 12.

---

## The 12-month money map

| Phase | End | Users | MRR | Notable |
|---|---|---|---|---|
| Validation | Week 1 | 0 | $0 | Pipeline proven manually |
| LoRA training | Week 3 | 0 | $0 | 3 LoRAs ready |
| SaaS build | Week 6 | 0 | $0 | Thin app shippable |
| Beta | Week 8 | 20 (free) | $0 | Real users on real shoots |
| Polish | Week 10 | 25 | $1,000 | First paying converts |
| **Launch** | **Week 11** | **50** | **$2,500** | **Press cycle live** |
| Press echo | Month 4 | 200 | $12,000 | Sustained inbound |
| Imprint 02 drops | Month 6 | 450 | $27,000 | Press cycle 2 |
| Imprint 03 drops | Month 9 | 750 | $48,000 | Compound effect kicks in |
| **Year 1 target** | **Month 12** | **1,000+** | **$60,000+** | **$720K ARR** |

That's $720K ARR in 12 months from a solo build with ~$1,500 of compute spend.

---

## Out of scope (explicit, do not build)

- ❌ The WebGL marketing site polish — it's already 80% done; freeze it. Ships at week 11.
- ❌ A built waitlist on the SaaS site — Tally form is the lean replacement until launch
- ❌ Custom brand LoRAs in the v1 SaaS (week 4-6) — defer to week 9-10
- ❌ Multi-seat / team workspaces — month 6+
- ❌ Video shoots — month 5+
- ❌ API access for agencies — month 6+
- ❌ Mobile app — never (mobile web only)
- ❌ A blog / content marketing program — Karim's Twitter is the channel; no blog needed
- ❌ A "method" page on the marketing site — concept lives in the slate overlay; no separate page

---

## What to do tonight

One step.

```
mkdir -p ~/.claude/skills/mawze-director
```

Then:

1. Claude writes the first draft of `~/.claude/skills/mawze-director/SKILL.md` (~200 lines: system prompt that instructs Claude to behave as a senior creative director + JSON output schema for a 12-shot treatment + shoot grammar locked from `MAWZE_STRATEGY.md`).
2. Karim taste-tests against one fake brief tomorrow.
3. Two days from now → feed JSON to Replicate manually.
4. Five days from now → the day-7 go/no-go on building MAWZE.

The work lives in `~/.claude/skills/`, completely separate from this repo. Won't touch the WebGL codebase at all.

---

## Companion docs

- `MAWZE_STRATEGY.md` — the locked thesis (positioning, moat, LoRA architecture, pricing, finance math)
- `MIDJOURNEY_PROMPT_SKILL.md` — the prompt method, ~22 accumulated taste rules; this is the *taste reference* the Director skill should inherit
- `~/.claude/skills/mawze-director/SKILL.md` — the Director skill (to be written tonight)
