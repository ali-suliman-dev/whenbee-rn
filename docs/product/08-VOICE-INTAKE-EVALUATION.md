# Voice Intake — Idea Evaluation

**Date:** 2026-06-19
**Status:** Pre-launch evaluation. Decision doc, not a build spec.
**Question:** Should Whenbee add voice input (speak a task instead of typing it), make it paid, and how much can we charge?

---

## TL;DR / Recommendation

**PROCEED — but reframe what's free and what's paid.**

| | Verdict |
|---|---|
| Is voice input wanted? | **Yes, strongly and rising.** Reddit 2025–26 is full of "no one has nailed voice-first capture — it's always bolted on." Real, unmet demand. |
| Can we charge for *raw* "speak instead of type"? | **No.** It's table-stakes — free via Siri / Apple dictation / Todoist Ramble / TickTick. Paywalling a microphone reads as a bait-and-switch and draws complaints. |
| Can we charge for voice *intelligence*? | **Yes.** People pay $79–$180/yr for "ramble → structured output" (AudioPen, Wispr Flow, Voicenotes). That's the proven willingness-to-pay band. |
| What's the Whenbee-shaped paid hook? | **"Honest Voice":** ramble a task → it extracts the task, suggests its category, and pre-fills *your personal honest estimate* from the calibration model. Voice wrapped in our moat, not a generic dictation box. |
| Marginal cost to run it? | **$0.** Apple's on-device Speech framework is free at any scale. The whole flow (STT + parse + estimate) runs on-device, so the on-device-only core-loop invariant is intact. **No cloud LLM** — see §4/§5. |
| How to price? | **Fold into Pro (locked Model B), not a separate SKU.** Voice is a *reason to upgrade*, not its own line item. |

**One-line strategy:** Make voice *capture* free (table-stakes, friction-killer, accessibility + ADHD win). Make voice *understanding* — speak-and-it-knows-your-honest-time — the Pro lever.

---

## 1. Terminology fix (important)

"Voice intake" = **speech-to-text (STT / ASR)**: you speak, the app transcribes. That is the feature requested.

**TTS** (text-to-speech) is the opposite — the *app speaks to you*. TTS is not needed for intake; it's only relevant for a future "speak my weekly insights back to me" feature. The doc mostly concerns STT; TTS is noted only where a speak-back feature is plausible.

---

## 2. Is the demand real? (Customer + Reddit research)

**Yes — high confidence.** 2025–26 Reddit threads show a clear, rising, under-served need. The recurring complaint *is the opportunity*: "voice is an afterthought everywhere; nobody shipped true voice-first capture."

### Top pain themes (frequency × intensity)

1. **The "fleeting thought" problem (HIGH).** Ideas vanish before you can type. *"Important stuff pops into my head… by the time I sit down to write it, it's gone."* The holy grail named verbatim: *"one tap to speak and it's done."*
2. **Typing is a friction/energy tax; speaking frees flow (HIGH).** *"I type 30–35 WPM. With Wispr I'm effectively at 102 WPM."*
3. **Voice-first is unsolved (HIGH — the market gap).** *"most feel like voice is an afterthought."* *"Such an obvious use case for AI. Amazing the big players haven't done it."*
4. **Hands-busy capture — driving / walking / running / cooking (HIGH).** *"super useful when you can't use a keyboard, like when you're driving."*
5. **ADHD / executive function (HIGH, most emotional).** *"I have ADHD, and it gives me back hours of my day."* *"Best money I've ever spend."*

### Who wants it most (segments)
1. **ADHD / executive-function / "think-out-loud" ramblers** — loudest, most loyal, willing to pay, use words like "game changer."
2. **Hands-busy movers** — drivers, runners, commuters, cooks. Voice has no substitute here.
3. **RSI / wrist-strain** users.
4. **Texting-anxious / spelling-self-conscious** users (overlaps ADHD).
5. **Accessibility / motor-impaired** — also an App Store featuring angle.

---

## 3. Can we charge for it? (Competitor + market research)

**The distinction that decides everything:**

- **Raw dictation (speak → text in a field)** = **table-stakes / free.** Siri, Apple keyboard mic, Todoist Ramble (free), Apple Reminders all do it for $0. Charging for this alone invites "paywalled a commodity" backlash. *Confidence: HIGH.*
- **Voice + AI transformation (ramble → cleaned/structured output)** = **proven paid category.** *Confidence: HIGH.*

### What voice-first apps actually charge

| App | Price | What it proves |
|---|---|---|
| **AudioPen** | $99/yr | 1,000+ paying users + $73K in 2 months — pure voice→structured-text. People pay. |
| **Wispr Flow** | ~$180/yr ($15/mo) | ~$10M ARR, 70% 12-mo retention, ~$2B valuation talks. Sticky paid voice. |
| **Voicenotes** | ~$100/yr (+ lifetime) | Voice→structured is the whole product. |
| **Superwhisper** | ~$9/mo (lifetime $849) | Big Mac dictation player. |
| **Otter.ai** | Free 300 min / Pro $8.33/mo | Gated by **minutes**, not by "voice on/off." |
| **Braintoss / Just Press Record** | $3.49–$6.99 **one-time** | The cheap end = *plain recording, no AI*. The premium tracks the AI, not the mic. |

### How mainstream task apps treat voice

| App | Voice | Free or paid |
|---|---|---|
| Todoist | Ramble voice-to-task + NLP | NLP **free**; Ramble in AI suite (Pro $60/yr) |
| TickTick | AI voice input + transcription | Premium $35.99/yr |
| Apple Reminders / Things 3 | Siri add | **Free** |
| Sunsama | "Suunny" AI voice | Power Pro $50–65/mo |

**Verdict (HIGH confidence):** voice *capture* = table-stakes; AI voice *intelligence* = paywall-able. Whenbee's intake must visibly do more than a free OS dictation button — and it can, because it owns the honest-estimate model.

### Willingness-to-pay nuances (read these before pricing)
- ADHD segment pays *and evangelizes* — but is **subscription-fatigued** and punishes paywalling a feature they were given. Several Wispr defectors cite **privacy** and **subscription** as reasons to switch to one-time/local tools.
- Top complaint that sends users hunting for alternatives: *"free tier is too limited."*
- Todoist's Ramble got tangled in price-hike backlash — *users react badly when voice is dangled then paywalled/removed.*

---

## 4. Tech & cost: free vs paid (STT/TTS landscape)

**The on-device-only core-loop invariant is a gift here, not a constraint.** Apple's native Speech framework runs locally, free, forever — and privacy-local processing is one of the top reasons Reddit users *abandon* cloud voice tools (Wispr screenshots/cloud-audio complaints). Our invariant is a *marketing weapon*.

### STT comparison (typical task utterance ≈ 5 seconds)

| Option | On-device? | $/min | $/5s utterance | RN/Expo fit | Notes |
|---|---|---|---|---|---|
| **Apple `SpeechAnalyzer` (iOS 26+)** | ✅ | **$0** | **$0** | `expo-speech-transcriber` | Whisper-class accuracy, ~2× faster, no 60s cap, no rate limit. |
| **Apple `SFSpeechRecognizer` (iOS 13–25)** | ✅ (`requiresOnDeviceRecognition=true`) | **$0** | **$0** | `expo-speech-recognition` | 60s/req + 1000 req/device/hr — irrelevant for 5s tasks. Force on-device or it may hit Apple servers. |
| **iOS keyboard dictation (mic key)** | ✅ | **$0** | **$0** | zero code | Free fallback, no permission/UI. |
| **whisper.cpp (`whisper.rn`)** | ✅ | **$0** | **$0** | mature but heavy (~75MB model) | Fallback only; battery/cold-start cost. |
| `@react-native-voice/voice` | partial | $0 | $0 | **deprecated** | Avoid. |
| OpenAI `gpt-4o-mini-transcribe` | ❌ | $0.003 | ~$0.00025 | API + key proxy | Breaks invariant. |
| OpenAI `gpt-4o-transcribe` | ❌ | $0.006 | ~$0.0005 | API | Best accuracy; 1-min billing min hurts short clips. |
| Deepgram Nova-3 | ❌ | ~$0.0077 | ~$0.00064 | API | Low latency. |
| Groq Whisper v3 Turbo | ❌ | ~$0.00067 | ~$0.00006 | API | Cheapest cloud, fast. |
| Google STT v2 | ❌ | $0.004–0.016 | ~$0.0013 | API | Priciest. |

> **Trap:** cloud STT usually bills a **1-minute minimum** per request. A real 5s clip can bill as a full minute — making cloud dramatically more expensive than the per-second math suggests. Another reason on-device wins for short task capture.

**TTS (only if we ever add speak-back):** `expo-speech` = on-device, free. OpenAI TTS $15/1M chars; ElevenLabs $103–206/1M (most realistic, priciest).

### Recommended stack
**Apple on-device Speech via `expo-speech-transcriber`** (SpeechAnalyzer on iOS 26+, SFSpeechRecognizer fallback below). Dev-build only (already our constraint). Declare `NSSpeechRecognitionUsageDescription` + `NSMicrophoneUsageDescription`. `whisper.rn` as a guaranteed-offline fallback only. **No cloud STT, and no cloud LLM, in the core loop.**

### Structuring (raw transcript → task + category + estimate) — ON-DEVICE ONLY
STT only returns a raw string (`"reply to henderson emails it always drags on"`). Turning that into fields is a separate step. **Do it fully on-device — no LLM:**
- **Task name:** the transcript itself (lightly cleaned), or the leading clause.
- **Date/time:** an on-device date parser (chrono-style) over the string.
- **Category:** an on-device keyword→category map / tiny classifier.
- **Honest estimate:** comes straight from the **existing pure calibration engine** — already on-device, already free.

A **cloud LLM** would parse messy rambling slightly better, but it ships task content to a server → **violates the on-device-only invariant**, and privacy-local is precisely why users abandon cloud voice tools. **Rejected.** If multi-clause rambling ever needs more than on-device parsing can give, that is a future *explicit opt-in*, off by default, clearly outside the core loop — not a default.

---

## 5. Unit economics

### Marginal cost per voice entry

| Path | STT cost | Structuring cost | Total /entry | Invariant-safe? |
|---|---|---|---|---|
| **A. On-device STT + on-device parse (date/category/engine) — RECOMMENDED** | $0 | $0 | **$0** | ✅ Yes |
| B. On-device STT + cloud LLM structuring (gpt-4o-mini) | $0 | ~$0.00005 | ~$0.00005 | ❌ **violates invariant — rejected** |
| C. Cloud STT + cloud LLM | ~$0.003 | ~$0.00005 | ~$0.003 | ❌ breaks invariant |

Costs for B/C are shown only to prove cloud isn't even *cheaper* enough to tempt us — it isn't, and it breaks the invariant. **Path A is the answer: $0 marginal, fully private.**

### Heavy user (30 voice entries/day = 900/mo)

| Path | Monthly cost / heavy user |
|---|---|
| **A. On-device only (recommended)** | **$0.00** |
| B. + cloud LLM (rejected) | ~$0.045 |
| C. Cloud STT (rejected) | ~$2.70 ← eats most of a $3.17/mo sub |

**Takeaway:** Path A. On-device STT + on-device parsing + the existing engine = **$0 marginal cost, 100% private, invariant intact**. There is no economic reason to touch the cloud, and a strong product reason not to.

### Illustrative revenue (not a forecast — pre-launch)
Benchmarks: productivity NA trial-to-paid **7.1% median** (top quartile >15%); productivity prices cluster at/above **$38.42/yr** median; **hard paywalls convert ~5× freemium**; **17–32 day trials convert ~42.5%** vs 25.5% for short trials; **weekly plans** out-convert monthly.

- 1,000 active users × 7% Pro conversion × $39.99/yr ≈ **$2,800/yr gross** → ~$2,380 net after 15% small-business App Store fee.
- Voice marginal cost across the whole base (Path B, only voice users pay it) ≈ **<$50/yr**.
- Voice's real value is as a **conversion lever** lifting that 7% — not as its own revenue line.

---

## 6. Game-changing angles (10x thinking)

Voice is the *delivery mechanism*; the moat is the *honest estimate*. The combination is what no competitor can copy.

### 🔥 Do now (the core hook)
- **"Honest Voice":** speak *"reply to the Henderson emails"* → app extracts the task, picks its category, and shows **your personal honest estimate** (calibration model) pre-filled. This is AudioPen's "ramble → structured" *fused with* Whenbee's only-we-have-it asset.
- **Open decision — is this free or Pro? See §8.** Tension: the honest estimate is the *free* wedge per locked Model B ("calibration free"). If a *typed* task already shows the honest estimate for free, then voice giving the same is a free *input method*, not new paid value. The genuinely paid-worthy delta of voice is the convenience/intelligence layer (hands-free Siri/widget capture, multi-task ramble split), not the estimate itself.

### 👍 Do next
- **One-tap, no-navigation capture** — widget / Lock Screen / Siri Shortcut. Directly answers the #1 Reddit demand ("thought disappears in 3 seconds"). Capture *must* survive without opening the app. **Note on coverage:** the in-app mic is fully covered by Apple Speech; true hands-free capture is *not* the speech API's job — it rides on **Siri App Intents** (Siri transcribes, also free) + the scaffolded-but-unbuilt **`WhenbeePresence` widget/Live Activity module**. So phase it: in-app voice first, hands-free capture as a fast-follow with the widget work.
- **Multi-task ramble split:** *"I need to do X, then Y, also Z"* → three tasks, each auto-estimated.

### 🤔 Explore (future / post-D7≥25%)
- **Voice retro:** at task end, *"how'd that go?"* → spoken reflection feeds calibration (no typing on the back end either).
- **Spoken weekly insight (TTS speak-back):** *"This week you under-budgeted deep work by 40%."* Pairs with the Patterns tab; `expo-speech` keeps it free + on-device.
- **Accessibility positioning** (motor/RSI/dyslexia) — both a real good and an App Store featuring lever.

---

## 7. Risks & mitigations

| Risk (from research) | Mitigation |
|---|---|
| **Accuracy** — wrong transcription is slower than typing; accents/noise/non-English fail | On-device Apple model (Whisper-class on iOS 26); always show editable text instantly; never block on a perfect transcript. |
| **Public awkwardness** — won't talk to phone in office/train | Voice is **always optional, never forced**; typing stays first-class. A vocal "I'd rather type" cohort exists. |
| **Latency** — lag nullifies the time saving | On-device is fast; show partial results live. No network round-trip in core. |
| **"Capture ≠ done"** — captured blobs die in an inbox | **Whenbee advantage:** intake flows straight into the planner/timer/estimate, not a dead note pile. Lean into this. |
| **Subscription fatigue / paywall resentment** | Fold into existing Pro (Model B); don't add a voice SKU; never paywall *raw* dictation. Charge (if at all) for the convenience/intelligence accelerant, not the basic flow — see §8. |
| **Privacy** | Turn the invariant into the pitch: "your voice never leaves your phone." Direct contrast to Wispr cloud-audio complaints. |

---

## 8. Decision

**PROCEED** on building it on-device. Settled vs open:

**Settled:**
- **Tech:** Apple on-device Speech (`expo-speech-transcriber`) + on-device parsing + the existing engine. $0 marginal, invariant intact. No cloud.
- **Never:** use cloud STT/LLM in the core loop; force voice over typing (a real "I'd rather type" cohort exists); make users re-listen to their own audio.
- **No separate voice SKU** — whatever is paid folds into the locked Model B Pro tier; price stays in the ~$38–60/yr productivity band, annual-led with a 17–30 day trial.

**DECIDED (founder, 2026-06-19): Option 3 — Hybrid.**
- **FREE:** tap mic → speak task → auto category → *your* honest estimate pre-filled → edit & save. (The wedge; also the accessibility/acquisition magnet.)
- **PRO (folds into Model B):** the accelerant — "Hey Siri" / widget hands-free capture (no app open), multi-task ramble → many tasks, voice retro at task end.

Three framings considered:

| Option | Free | Pro | Trade-off |
|---|---|---|---|
| **1. Voice = free input method** | The whole voice flow incl. pre-filled honest estimate (it's just calibration via mic) | Stays calendar / S12 / share (unchanged Model B) | Cleanest, on-brand ("calibration is free"), strong top-of-funnel + accessibility magnet. Leaves proven voice WTP on the table. |
| **2. Voice intelligence = Pro** | Raw voice→text dictation only | Auto-extract task + category + estimate, multi-task split, hands-free capture | Matches market WTP. Risk: gating something close to the free wedge can feel off; raw-dictation-is-free is the floor anyway. |
| **3. Hybrid (recommended)** | Voice→task with pre-filled estimate (the core magic, free — it IS the wedge) | The *convenience/intelligence accelerant*: hands-free Siri/widget capture, multi-task ramble split, voice retro | Keeps the wedge honest and free; charges for genuine added power. Best fit with Model B + the research. |

**Why hybrid:** raw dictation can't be charged for (Siri does it free), and the honest estimate is your *free* wedge — so gating the basic speak-a-task flow contradicts "calibration is free." But hands-free capture (no app open), multi-task ramble splitting, and voice retro are genuine, defensible *added power* that the proven $79–180/yr voice market pays for. Free flow drives acquisition + accessibility; the accelerant drives upgrades.

**Pre-launch caveat:** category demand + WTP are well-proven; Whenbee's *specific* conversion lift is unmeasured. Cheap to build on-device, high strategic upside, near-zero downside to margin or invariants. Validate the free/Pro line with the first cohort.

---

## Sources
STT/TTS pricing, willingness-to-pay, and Reddit sentiment gathered via live web/firecrawl research on 2026-06-19. Key references: Apple SpeechAnalyzer (MacRumors 2025-06-18; Callstack), `expo-speech-transcriber` & `expo-speech-recognition` (GitHub), OpenAI/Deepgram/Groq/Google STT pricing pages; AudioPen (Starter Story/Indie Hackers), Wispr Flow (TechCrunch 2025-06-24; Latka), Voicenotes, Superwhisper, Otter; Adapty State of In-App Subscriptions 2025 + RevenueCat State of Subscription Apps 2026 (Productivity); Reddit r/ProductivityApps, r/todoist, r/ADHD, r/adhdwomen, r/cursor, r/accessibility, r/bujo, r/Productivitycafe (2020–2026, full URLs in research logs).
