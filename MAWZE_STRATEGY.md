# MAWZE Studio — Strategy & Build Plan

> Cinematic AI image generation for DTC brands.
> Claude is the art director. The brand has a world. The output is consistent.

---

## 1. The Thesis

**One-liner:** Brand cinema. On demand.

**What it is:** A B2C SaaS that lets a solo founder / small DTC brand upload a product photo + describe a vibe, and get back marketing imagery that looks like it came from a real campaign — not generic AI slop.

**Why it's different from everything else:**
- Flair.ai is product-photo focused (table-tops, ecom shots).
- Photoroom is background-removal + composite.
- Mokker is "put your product in a scene."
- Artlist Studio ($260M ARR, biggest fish) has a proprietary `Original 1.0` model trained on their stock footage catalog, plus a re-skin of Flux 2 / Nano Banana / Seedream. Four built-in styles (Cinematic, Professional, Indie, Commercial).

**MAWZE's wedge:** the *direction layer*. We don't sell raw model access. We sell a system where:
1. The brand fills out a "Brand World" once (palette, mood, references, products).
2. Claude analyzes that brand and writes a **LoRA recipe** — which of our trained LoRAs to stack and at what strength, plus a scaffolded prompt and negative prompt.
3. Every generation for that brand applies the same recipe → consistent brand cinema.

We are not competing on model quality. Artlist will always have more compute. We compete on **taste + direction + consistency per brand**.

---

## 2. Competitive Landscape

| Competitor | Model | Positioning | ARR | Weakness we exploit |
|-----------|-------|-------------|-----|---------------------|
| Artlist Studio | Original 1.0 (own) + Flux 2 + Nano Banana + Seedream | All-in-one creative suite for video teams | ~$260M | Built for video pros. Generic style menu. No per-brand world. |
| Flair.ai | Flux + IP-Adapter | Product photography | ~$10M est. | Table-top only. No campaign / lifestyle imagery. |
| Photoroom | Proprietary | Background editing | ~$50M | Editing tool, not a generator. |
| Mokker | Stable Diffusion | Product in scene | ~$2M est. | Shallow scene library, no brand persistence. |
| Magnific | Upscaler | Resolution / detail | ~$15M | Not a generator at all. Adjacent. |

**Gap MAWZE fills:** the solopreneur DTC brand owner who wants their feed to look like a Calvin Klein / Aesop / Glossier campaign and has no photographer, no studio, no agency. Today that person uses Midjourney + prompts they copy from Twitter. The output is incoherent across posts. MAWZE makes it coherent.

---

## 3. Technical Architecture

### Stack
- **Frontend:** Vite + React + Tailwind. Already started in this repo.
- **Auth + DB:** Supabase (Postgres + Auth + Storage).
- **Inference:** Replicate API (LoRA training + Flux Dev / Flux 2 / Flux Kontext inference). Fallback: fal.ai for speed.
- **Backend logic:** Vercel serverless functions (Node).
- **Payments:** Stripe.
- **Email:** Resend.
- **Analytics:** PostHog.
- **Art direction:** Claude API (Sonnet 4.6 for routing, Opus 4.7 for big brand-strategy generations).

### The LoRA Library

Five **mood LoRAs** + three **modifier LoRAs**. Each ~$25 to train on Replicate's Flux LoRA Trainer. Total one-time cost: ~$200–300.

**Mood LoRAs** (one is dominant per brand):
1. **cinematic-editorial** — Calvin Klein, Ssense, Mubi. Cool grade, wide lenses, film grain.
2. **surreal-staged** — Tim Walker, Pierpaolo Ferrari. Theatrical, color-blocked, dreamlike.
3. **graphic-commercial** — Aesop, Apple. Clean, geometric, controlled light.
4. **soft-romantic** — Glossier, Petra Collins. Warm, hazy, intimate.
5. **hard-noir** — Saint Laurent, Helmut Newton. High contrast, severe, black/white.

**Modifier LoRAs** (stacked on top):
- **warm-grade** — bumps amber/yellow in midtones.
- **film-grain-heavy** — adds 35mm/16mm texture.
- **wide-angle-cinema** — pushes 24–35mm distortion + cinemascope crop.

Claude outputs a recipe like:
```json
{
  "loras": {
    "cinematic-editorial": 0.5,
    "soft-romantic": 0.7,
    "warm-grade": 0.6
  },
  "prompt_prefix": "shot on 35mm, golden hour, shallow depth of field",
  "negative": "stock photo, harsh flash, blurry, plastic skin",
  "palette_hex": ["#E8DFD2", "#A07C5B", "#2A1F18"]
}
```

This recipe is **stored per brand** in Supabase. Every generation applies it. That's the consistency loop.

### Inference flow
1. User uploads product image.
2. User types vibe ("a girl smoking on a fire escape, NYC, summer dusk").
3. Server pulls brand's recipe.
4. Server calls Flux 2 multi-reference inference on Replicate with: product image as IP-Adapter ref, recipe LoRAs stacked, scaffolded prompt.
5. Returns 4 variants.
6. User picks one → it goes to brand's library.

Each generation costs ~$0.04–0.08 in inference. Critical for margin math below.

---

## 4. Brand World (the persistent state per user)

When a user signs up, they fill out a wizard:
- 5–10 reference images (their pinterest moodboard).
- Brand color palette (hex codes).
- Product photos (uploaded once, reused everywhere).
- 3 adjectives ("intimate, defiant, slow").
- Optional: 1–2 paragraphs describing their brand voice.

Claude (Opus 4.7) reads all of that → generates the recipe + writes a 200-word "Brand World" doc that the user can read and tweak. That doc becomes the single source of truth and is appended to every generation prompt.

This is the moat. Anyone can run Flux. Almost nobody can do brand strategy → LoRA recipe → consistent output. We can.

---

## 5. Pricing

| Tier | Price | Generations / mo | Brand Worlds | LoRA training | Target user |
|------|-------|------------------|--------------|---------------|-------------|
| Starter | $29 | 100 | 1 | shared | solo DTC brand |
| Creator | $79 | 400 | 3 | shared | small studio |
| Studio | $199 | 1,500 | 10 | 1 custom | agency |
| Agency | $399 | unlimited (fair use) | unlimited | 3 custom | small agency |

**Margin sanity check at $79 tier:**
- Revenue: $79
- Inference: 400 × $0.06 = $24
- Infra (Supabase + Vercel + Resend): ~$2 amortized
- Stripe fee: ~$2.50
- **Gross margin: ~63%**

Acceptable for a SaaS but not great. Improves at higher tiers via batching + caching repeat brand-style elements.

---

## 6. Finance Primer (for reference)

- **MRR** = monthly recurring revenue. Sum of all active subs in a month.
- **ARR** = MRR × 12. Used for fundraising headlines, not bank account.
- **Gross margin** = (revenue − direct cost of delivering it) / revenue. For us: revenue minus inference + Stripe.
- **Net margin** = (revenue − all costs incl. salary, marketing, infra) / revenue.
- **Net profit** = what's left after everything. The thing that goes in your pocket.

Concrete table at 1,000 paying users, blended ARPU $60:
- MRR: $60,000 → ARR: $720,000.
- Inference + infra + Stripe: ~$22,000.
- Marketing (CAC reinvestment): ~$15,000.
- Tools / API / Claude bill: ~$3,000.
- Founder salary (you): $5,000.
- **Net profit: ~$15,000/mo.**

Real businesses run at 15–30% net margin. SaaS can run higher (40%+) once distribution is solved.

---

## 7. Honest Probability Bands

If we work on this seriously for 12 months:
- **30%** — sustainable indie SaaS, $20–60k MRR. Solid lifestyle business.
- **30%** — plateau at $1–5k MRR. Real but frustrating. You'd need to choose: push harder or wind down.
- **20%** — lose motivation before product-market fit. Most likely failure mode.
- **15%** — real category boutique, $5–15M ARR. Acquired by Artlist / Adobe / Canva in year 3–4.
- **5%** — outlier. Real category-defining product. Series A territory.

**The real risks aren't technical** (Claude + Replicate solve 90% of the build). They are:
- **Founder psychology** — solo founder, ambitious vision, hard to stay disciplined for 12 months without external pressure.
- **Distribution** — design + direction skill ≠ distribution skill. You'll need to learn cold outbound, content, or paid acquisition. None are fun.

---

## 8. Bootstrap Path ($0 budget)

Phase 0 — **Free validation (2 weeks)**:
- Cold-DM 30 fashion/beauty CDs / DTC founders on Instagram.
- Show them a deck + 10 hand-crafted MAWZE-style images of their products (manually generated using Midjourney + your taste).
- Ask: "would you pay $79/mo for this on demand?"
- Goal: 5 verbal yeses.

Phase 1 — **Manual concierge ($0–200)**:
- Take 5 of those 5 yeses.
- Charge $79/mo. Generate their images by hand for a month using ChatGPT Pro + Midjourney + your skill.
- Goal: prove they renew month 2. If they don't renew, the demand isn't real.

Phase 2 — **Train the LoRAs (~$300)**:
- Cluster the 187 inspiration images you exported.
- Train 5 mood LoRAs + 3 modifier LoRAs on Replicate.
- Build the Claude routing prompt.

Phase 3 — **Build BYOK MVP (4 weeks with Claude Code)**:
- "Bring your own key" — user pastes their Replicate API key + Anthropic API key. You don't pay inference.
- Charge $19/mo for the Brand World system + LoRA library access.
- Risk-free for you. No inference costs.

Phase 4 — **Hosted SaaS (when you have ~30 paying BYOK users)**:
- Move to managed inference. Take normal margins.
- Use BYOK revenue as runway for the first month of inference bills.

---

## 9. Investor Strategy

YC is unlikely without a co-founder + traction. Better paths first:
- **Antler** — 0-day pre-seed, $100k for 10%. Designed for solo founders.
- **Day One Ventures** — first-check, fast, founder-friendly.
- **South Park Commons** — better for solo technical-creative founders than YC.

You raise *after* you have:
- 50+ paying users.
- Proof of retention >70% at month 3.
- A clear story for why this becomes 100x bigger with capital.

Until then, bootstrapping is a feature, not a bug. The moment you raise, your timeline shortens to 18 months and you can't pivot freely.

---

## 10. 12-Week Build Timeline (with Claude Code)

| Week | Deliverable |
|------|-------------|
| 1 | Cluster the 187 inspo images into 5 mood buckets. Curate 30 images per bucket. |
| 2 | Train 5 mood LoRAs on Replicate. Test outputs. |
| 3 | Train 3 modifier LoRAs. Test stacking. |
| 4 | Write Claude routing system prompt. Validate recipes against 10 test brands. |
| 5 | Supabase schema (users, brand_worlds, generations, recipes). Auth flow. |
| 6 | Brand World wizard UI (the onboarding that builds a brand profile). |
| 7 | Generation flow + Replicate integration. |
| 8 | Stripe + tier gates + usage metering. |
| 9 | Library / archive UI. Re-roll, variations, download. |
| 10 | Landing page. Waitlist. Early-access invite flow. |
| 11 | Closed beta with the 5 manual concierge users. Iterate on feedback. |
| 12 | Public launch. ProductHunt. Niche newsletter sponsorships ($300 budget). |

---

## 11. Validation Budget ($300 max)

- $200 — LinkedIn ads to creative directors / DTC founders. Goal: 200 waitlist signups.
- $100 — boost a Twitter thread of MAWZE generations. Goal: prove visual virality.

If 200 waitlist + thread doesn't get >2k views, the *visual hook* isn't strong enough. Iterate the visuals before iterating the product.

---

## 12. The 187 Inspiration Images

Located at `/Users/karimsaab/Downloads/Spatial Export Apr 26`.

Cluster into 5 buckets of ~30 images each:
- **cinematic-editorial** — anything that looks like a film still or fashion editorial.
- **surreal-staged** — anything theatrical, set-dressed, color-blocked, conceptually dreamlike.
- **graphic-commercial** — clean Aesop / Apple / minimal product-forward.
- **soft-romantic** — warm, hazy, intimate, Glossier energy.
- **hard-noir** — high contrast, monochrome, severe.

Drop the rest. 30 strong images per bucket trains a better LoRA than 50 mid ones.

---

## 13. What MAWZE the Brand Stays

The site you're building right now (this WebGL slider, the editorial chrome, the 25 frames) — that **stays**. It becomes the *brand front* of MAWZE. The product (Studio) lives at `studio.mawze.com` or `app.mawze.com`. The reel site is the showroom that proves taste. The Studio is the tool that sells it.

This is also the Artlist playbook: artlist.io is the brand. studio.artlist.io is the product. Same model.

---

## 14. Next Concrete Action

This week:
1. Cluster the 187 images. Drop low-tier picks. End with 5 folders × 30 images.
2. Write 30 cold DMs to DTC founders and send them.
3. Pick a domain. (mawze.studio? mawze.com? mawze.io?)

Everything else flows from those three.
