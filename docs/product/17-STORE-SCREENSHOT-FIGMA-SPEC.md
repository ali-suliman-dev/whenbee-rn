# 17 — Store screenshot spec (Figma build)

Build spec for the 8 Google Play phone screenshots. Every colour is a real token from
`src/theme/tokens.ts`; every headline is keyword-aligned with
[`16-PLAY-STORE-LISTING-COPY.md`](16-PLAY-STORE-LISTING-COPY.md).

**Hard rule carried over from the listing:** never name ADHD anywhere in the creative. It would
contradict the "no health features" declaration in Play Console. "Time blindness" is the approved
phrase. No guilt or shame framing — that's a product invariant, not a style preference.

---

## 1. Canvas and Play requirements

| Thing | Value |
|---|---|
| Canvas | **1080 × 1920 px** (exactly 9:16) |
| Format | PNG or JPEG, **24-bit, no alpha** |
| Max file size | 8 MB each |
| Dimension limits | each side 320–3840 px |
| Aspect limits | between 16:9 and 9:16 — 1080×1920 sits exactly on the edge |
| Count | 2 minimum, **8 maximum**. Ship all 8 |
| Also required | Feature graphic **1024 × 500**, app icon **512 × 512** (32-bit PNG, no alpha) |

Design at 1x (1080×1920). Do not design at 2x — Play does not want retina variants, and 1080 wide
is already above the density needed on any phone listing.

---

## 2. Grid

8 px base unit. Everything below is a multiple of 4.

| Token | Value |
|---|---|
| Side margin | **88 px** (content width 904) |
| Top padding (layout A) | 128 px |
| Label → headline gap | 20 px |
| Headline → device gap | 104 px |
| Bottom safe margin | ≥ 80 px |

---

## 3. Type scale

Font: **Plus Jakarta Sans** (`src/assets/fonts/PlusJakartaSans-ExtraBold.ttf`). Inter is the
fallback if a weight is missing. Nothing else.

| Element | Size | Weight | Line height | Tracking | Case |
|---|---|---|---|---|---|
| Label (eyebrow) | 30 px | 700 (Bold) | 36 px | **+12%** (3.6 px) | UPPERCASE |
| Headline | **92 px** | 800 (ExtraBold) | 96 px (1.04) | **−2%** (−1.84 px) | Sentence |
| Sub-line (optional, rare) | 34 px | 500 (Medium) | 46 px | 0 | Sentence |

Headline is **max 2 lines**. Line breaks are deliberate — set them manually, never let the box wrap.
If a headline needs 3 lines it's too long; cut a word.

### Mixed emphasis (do not skip this)

Every headline gets **exactly one** word or number in amber `#EEAE4D`; the rest is ink. A flat
single-colour headline is the amateur tell. Per slide:

| Slide | Headline | Amber word |
|---|---|---|
| 1 | You said 20. It's really **35.** | `35.` |
| 2 | See the day you'll **actually** have. | `actually` |
| 3 | Guess it. Time it. Learn your **pace.** | `pace.` |
| 4 | Deep work takes **1.7×** longer. | `1.7×` |
| 5 | Watch your guesses **catch up.** | `catch up.` |
| 6 | Know **when** to start. | `when` |
| 7 | Still running. Still **honest.** | `honest.` |
| 8 | Made for people who **lose track of time.** | `lose track of time.` |

---

## 4. Colour

Straight from `src/theme/tokens.ts`. Do not eyeball new values.

| Role | Light slides | Dark (inverted) slides |
|---|---|---|
| Background | `#F4F2FC` | `#14151D` |
| Headline / ink | `#20233A` | `#F4F1EA` |
| Label | `#EEAE4D` (amber) | `#EEAE4D` |
| Emphasis word | `#EEAE4D` | `#EEAE4D` |
| Muted / sub-line | `#5C5F73` | `#ADA9B5` |
| Indigo (accents only) | `#6B5BE6` | `#8275F0` |

**Background wash** (keeps it from reading as flat default):
- Light slides: ellipse **1200 × 900**, centred at `x −180, y −220` (off the top-left corner),
  fill `#EEAE4D` at **18%** opacity, layer blur **200**.
- Dark slides: same ellipse geometry, fill `#6B5BE6` at **20%**, blur 200, positioned off the
  top-**right** instead so the deck alternates.

Never pure white, never a hard gradient band.

---

## 5. Device frame

Source captures are **1080 × 2410** (9:20.1) — taller than the canvas ratio, so never stretch them.

| Property | Value |
|---|---|
| Screen width on canvas | **600 px** |
| Screen height | **1339 px** (600 × 2410 ÷ 1080 — keep the exact ratio) |
| Screen corner radius | **44 px** |
| Bezel | rounded rect behind, inset −12 px each side → 624 × 1363, radius **56 px**, fill `#14151D` |
| Shadow | X 0, Y 32, Blur 64, Spread −8, `#20233A` at **18%** (light slides) / `#000000` at 45% (dark slides) |

Place the screenshot as an image fill with **Fill** scaling and the frame at the exact 9:20.1 ratio —
that way nothing crops. If you'd rather show the UI bigger, crop the *source* to the interesting
region first and adjust the frame height to the new ratio; don't squeeze it.

---

## 6. Layouts

Alternate. Never run the same layout twice in a row.

### Layout A — headline top, device bottom (slides 1, 2, 4, 5, 7, 8)

```
y = 128    Label            (30 px, height 36)
y = 184    Headline line 1  (92 px, line box 96)
y = 280    Headline line 2
y = 496    Device top edge  (600 × 1339)
y = 1835   Device bottom edge → 85 px bottom margin
```

Device centred horizontally: x = (1080 − 600) ÷ 2 = **240**.

### Layout B — device top, headline bottom (slides 3, 6 — both `inverted`)

```
y = −120   Device top edge (bleeds off canvas), 600 × 1339
y = 1219   Device bottom edge
y = 1315   Label
y = 1371   Headline line 1
y = 1467   Headline line 2 → 357 px bottom margin
```

The top bleed is what makes B read as a deliberate contrast slide rather than A upside-down.

---

## 7. Slide deck

| # | Layout | Bg | Source capture | Label | Headline |
|---|---|---|---|---|---|
| 1 | A | light | `115112` add-task + hunch | TIME BLINDNESS | You said 20. / It's really 35. |
| 2 | A | light | `120836` today + honest deltas | YOUR REAL DAY | See the day you'll / actually have. |
| 3 | **B** | **dark** | `115925` running timer + ledger | ONE TAP | Guess it. Time it. / Learn your pace. |
| 4 | A | light | `115419` discovery 1.7× | WHAT IT LEARNS | Deep work takes / 1.7× longer. |
| 5 | A | light | `115255` patterns accuracy | IT GETS SHARPER | Watch your guesses / catch up. |
| 6 | **B** | **dark** | `120257` today's plan / start-by | PLAN BACKWARDS | Know when / to start. |
| 7 | A | light | `115847` lock screen presence | ALWAYS ON | Still running. / Still honest. |
| 8 | A | light | `115331` Whenbee companion | NO STREAKS. NO GUILT. | Made for people who / lose track of time. |

Sources live in `~/Downloads/drive-download-20260728T162036Z-1-001/` and are copied, already renamed
`01.png`–`08.png` in deck order, to
`~/Business/income/Apps/Whenbee-store-assets/public/screenshots/android/phone/en/`.

**Ordering logic:** only slides 1–3 are visible before a swipe, so the promise, the day view and the
loop go first. Slide 1 leads on "time blindness" because it's the highest-value keyword in the
listing and it names the pain rather than the feature. Slide 8 is the trust signal and states the
product invariant as a selling point.

---

## 8. Feature graphic — 1024 × 500

Required by Play, and it's the banner at the top of the listing.

- Background: `#14151D` with the indigo wash ellipse (600 × 400, 22%, blur 160) off the right edge.
- App icon at 128 × 128, x = 88, y = 186 (vertically centred).
- App name "Whenbee", Plus Jakarta Sans ExtraBold **72 px**, ink `#F4F1EA`, x = 256, baseline y = 236.
- Tagline "Beat time blindness." Medium **34 px**, `#ADA9B5`, x = 256, baseline y = 292.
- Keep the right third empty — Play crops this asset on some surfaces.

No device frames in the feature graphic. No screenshot content. It's a wordmark banner.

---

## 9. Export and QA

Frames → Export → PNG, 1x. Filenames `01.png` … `08.png` so they sort correctly on upload.

Before uploading, check every one of these:

- [ ] Shrink slide 1 to **160 px wide** and squint. Headline still readable? If not, it's too long or too thin.
- [ ] No two adjacent slides share a layout.
- [ ] Exactly one amber word per headline.
- [ ] Every headline is 2 lines or fewer, with manual breaks.
- [ ] No alpha channel in the exported PNGs (flatten the background).
- [ ] Nothing in the deck says ADHD, and nothing implies the user is failing.
- [ ] Device screenshots aren't stretched — measure one, it should be exactly 600 × 1339.
