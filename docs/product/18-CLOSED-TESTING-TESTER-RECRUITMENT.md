# 18 — Closed Testing: getting 12 testers × 14 days → production access

Researched 2026-07-29 (live: Play support docs, r/alphaandbetausers, subreddit index, swap platforms, vendor guides).
Goal: clear the Google Play personal-account gate so Whenbee can go to **production**.

---

## 1. The rule, exactly

Source: Play Console Help, "Production access requirements for personal developer accounts".

- Personal accounts created **after 2023-11-13** must run a **closed test** before production.
- **≥ 12 testers opted in**, and they must stay opted in **14 consecutive days**. Not cumulative — opt out on day 9 and the clock restarts for that tester.
- Google counts **opted-in testers**, but the production-access questionnaire asks about **engagement and feedback**, and reviewers reject applications where testers clearly never used the app.
- After 14 days you submit a 3-part questionnaire: (a) how recruiting went + what testers said, (b) target audience / value prop / expected first-year installs, (c) what you changed because of testing + why you're ready.
- Review ≤ 7 days typically. Rejection = run another 14-day cycle. Multiple devs report 3–4 cycles (6–8 weeks lost).

**Safety margin: recruit 20, not 12.** Expect 30–40% drift (uninstalls, account changes, people who ghost). 12 is a floor with no slack.

### Hard don'ts (account-suspension class)
- No emulators, no bulk-created Google accounts, no "installs" gigs. Google fingerprints devices and flags freshly-minted accounts. Penalty ranges from rejection to **developer-account suspension** — the $25 is non-refundable and the account can be lost.
- Fiverr "12 testers $15" gigs mostly deliver email addresses, not humans. Highest rejection risk of any method surveyed.
- Don't pay per-install. Paying a legit *managed tester panel* is a grey area; free swap communities are lower risk and cost nothing but time.

---

## 2. Play Console setup (do this first — day 0)

Track mechanics (Play Console Help, "Set up an open, closed, or internal test"):

- Closed track tester lists: up to **200 lists**, **2,000 emails each**, **50 lists per track**. You can also point a track at a **Google Group** (`name@googlegroups.com`) — only group members can join.
- **Use a Google Group, not a hand-typed email list.** With a group, a new tester joins the group themselves and instantly qualifies; with a raw list you must edit + re-save the track each time someone new shows up, and every edit is a manual round-trip.
- The **opt-in link only appears once the release is "Published"** to the closed track. Get the build approved *before* you start recruiting — a dead link on recruiting day burns your best responses.

**Day-0 checklist**
1. `eas build` → AAB, upload to **Closed testing → new track** (name it `beta-14day`).
2. Create Google Group `whenbee-testers@googlegroups.com`, posting off, **join = anyone can join** (no approval queue — approval friction kills opt-ins).
3. Point the closed track at that group. Countries: all (or at least SE/US/UK/DE/IN — swap communities are heavily India/SE-Asia).
4. Submit, wait for review (~24h). Confirm the **opt-in URL** loads on a phone in an incognito profile.
5. Write the tester one-pager (§5) and the tracking sheet (§6).
6. Only then start §4 outreach. **Day 1 = the day tester #12 has opted in**, not the day you posted.

Local skill available: `gplay-testers-orchestration` (manages tracks/tester lists via Play Console edit sessions) and `gplay-submission-checks`.

---

## 3. Channel map (verified live 2026-07-29)

Ranked by *quality of the resulting questionnaire answers*, not speed.

### Tier A — real target users (best feedback, slowest)
Whenbee's audience: people who chronically under-estimate how long things take. Do **not** use the word ADHD in any public recruiting post — the Play health declaration says the app is not a health app, and a public "ADHD app" post contradicts it (see `play-listing-aso`). Frame as *time blindness / running late / bad at estimating*.

| Where | Notes |
|---|---|
| r/SideProject, r/indiehackers, r/EntrepreneurRideAlong, r/microsaas | Builder subs Ali already works (see `whenbee-reddit-feedback` skill). Post "closed test, need Android testers" — allowed, they're used to it. |
| r/getdisciplined, r/timemanagement, r/selfimprovement, r/nosurf | **Check the sidebar first** — most ban self-promo outright. Path in: comment for a week, then a "I built this, want testers" post only where a flair exists for it. |
| r/productivity, r/GetMotivated, r/LifeProTips | **Banned self-promo.** AutoMod removes within minutes. Skip. |
| Personal network: WhatsApp/Discord friends with Android, ex-colleagues, family | Highest retention, no drift. Realistically 3–6 people. Ask 1-to-1, never in a group blast. |
| Existing Whenbee touchpoints: whenbee.app visitors, feedback-board users, any TestFlight-interest emails | Lowest-friction warm list. Add a "Android beta — 14 days" banner on whenbee.app. |

### Tier B — swap communities (fast, real devices, mediocre feedback)
These are developers testing each other's apps. Real humans, real phones → Google-safe. Feedback is shallow but you get *some*, and reciprocity is enforced socially.

Live subreddits (verified this session):
- **r/alphaandbetausers** — very active (new post every ~2 min), 13-yr-old sub, allows Android closed-test asks. High noise: most posts get 0 comments, so post at the target audience's morning and reply to others first.
- **r/AndroidAppTesters** — 13-yr sub, explicitly "12 testers for 14 days (free)".
- **r/AndroidClosedTesting**, **r/AndroidClosedTesters** — dedicated, 2 yrs.
- **r/AndroidAppTesting**, **r/betatests**, **r/ClosedTestingHelp**, **r/12TesterTeam**, **r/RealAppTesters**, **r/ShareAnyApp**.
- Vendor-owned subs (they exist to funnel to a paid app): r/TestersCommunity, r/Android12Testers, r/peerplay, r/My12AppTestersAndroid, r/Closedtestproapp.

Swap apps / sites (credit or reciprocity based, free tier real):
- **SwapTest** (swaptest.net) — mutual swap, free.
- **Testers Community** app (`com.testerscommunity`) — credit system, claims 50k devs; paid tier ~€14/app for 15–25 testers.
- **PeerPlay**, **Closed Test Pro**, **AppXchange** (`com.appxchange.testers`) — same shape.

Discord/Telegram: several "closed testing swap" servers exist; quality varies wildly. Only worth it if the server has a reputation/verification system. Treat as a supplement, not the backbone.

### Tier C — paid panels (fast, expensive, questionnaire-weak)
onTest, PrimeTestLab, TesterBee, RealAppTesters, closedtesthelp: $15–30, "hours not weeks", real-device claims. They're low-risk *relative to Fiverr*, but you still have to write the feedback section of the questionnaire yourself, and paid testers give you nothing about whether Whenbee works. **Use only as a top-up if you're at 9/12 on day 3.**

---

## 4. The 14-day execution plan

### Pre-week (D-3 → D-1)
- D-3: build + upload + submit closed track. Create Google Group.
- D-2: track approved → grab opt-in link → verify on a real device.
- D-2: write the 4 post variants (§5) and the tester one-pager. Set up the tracking sheet (§6).
- D-1: **warm asks only.** DM 10–15 people you actually know with an Android phone. Target: 5 committed before you post publicly. Public posts convert far better when the track already has activity.

### Recruiting window (D0 → D+3) — target 20 opt-ins
- **D0 morning:** post to r/alphaandbetausers + r/AndroidAppTesters + r/AndroidClosedTesting. Before posting in each, **test 2 other people's apps** and comment that you did — reciprocity is the whole currency in these subs.
- **D0 afternoon:** SwapTest + Testers Community app; put Whenbee in the queue, start earning credits by testing others.
- **D+1:** r/SideProject + r/indiehackers post (different angle: "I built X, need Android testers, will give feedback on yours").
- **D+1:** whenbee.app banner + any email list.
- **D+2:** the productivity/time-management subs where the sidebar allows it.
- **D+3 gate:** if < 15 opt-ins, buy one paid panel top-up (≤ $30) to get to 20. Do it now, not on day 10 — the clock is per-tester.

**The 14-day clock effectively starts when tester #12 is in.** Everyone recruited after that is buffer, not a restart.

### Retention window (D+3 → D+17) — the part everyone loses on
Drift, not recruiting, is what kills cycles. Whenbee has an advantage here: it's a *timer* app people can use for real work.

- **Day 1 message** to every tester: one-pager + one concrete ask ("start one timer on something you're actually doing today").
- **Day 4, Day 8, Day 12 nudges.** Short, no guilt (project invariant). "Still on? Anything broken?" Three touches total; more reads as nagging.
- Ask each tester for **one sentence of feedback** — you need real quotes for the questionnaire. Offer to reciprocate on their app; that's what actually gets replies.
- **Do not ship a build with a version bump that breaks the install** mid-window. Any update to the closed track is fine; a package-name or signing change is not.
- Watch **Play Console → Testing → Closed testing → tester count** every 2–3 days. If it drops below 14, pull from the buffer list immediately.

### Application (D+15, after 14 full consecutive days)
File production access. Questionnaire answers you should already have, from the tracking sheet:
- **Recruiting:** where you found testers, what was hard (be honest — "swap communities gave device coverage, personal network gave depth").
- **Engagement:** number of active testers, sessions, what they used most.
- **Feedback + changes:** ≥ 3 real quotes and ≥ 2 concrete changes you shipped because of them. This is the section reviewers actually read. If you change nothing, you look like you ran a formality.
- **App info:** target audience, value prop, first-year install estimate (be conservative and specific, not "1M").
- Cross-check `docs/product/12-PLAY-STORE-LAUNCH-BLOCKERS.md` and `13-PLAY-CONSOLE-ANSWERS.md` before filing — the P0s must already be clear.

---

## 5. Copy templates

**Swap-sub post (r/alphaandbetausers, r/AndroidAppTesters):**
> **[Android closed test] Need testers for Whenbee — a timer that learns how badly you guess time. Happy to test yours back.**
>
> You guess how long a task takes, hit start, and after a few logs it shows what that guess actually costs you in real minutes. No streaks, no guilt, works offline.
>
> Opt-in: <group link> → <play opt-in link>
> Keep it installed 14 days, open it a few times, tell me anything that breaks.
> I've already tested 3 apps from this sub today — drop yours and I'll opt in.

**Builder-sub post (r/SideProject):**
> Spent [N] months on an Android app for people who are always 20 minutes off on every estimate. It times a task, compares it to your guess, and after ~5 logs starts showing you an honest number instead of your optimistic one. Google needs 12 people to keep it installed 14 days before I can publish — if you've got an Android phone and want to swap feedback, link's here. I'll give you real feedback on yours, not a "looks great".

**Warm DM:**
> Hey — I'm about to publish the app I've been building. Google requires 12 people to have it installed for 14 straight days first. Would you install it and just leave it there? Using it is a bonus, keeping it installed is the actual requirement. Takes 2 minutes: <link>. I'll ping you once on day 14 and that's it.

**Tester one-pager (send after opt-in):**
- What it is, in one line.
- The one thing to try: start a timer on a real task, stop it, log it.
- What you want back: one sentence — anything confusing, anything broken.
- The deal: keep it installed until [date]. You can uninstall after.
- How to reach you.

---

## 6. Tracking sheet (build it before D0)

One row per tester: `name/handle · channel · Google-account email · opted-in date · day-14 date · last nudge · feedback quote · still in? (Y/N)`.
Two derived numbers you check every 2 days: **current opted-in count** and **earliest day-14 date among your first 12**.

---

## 7. Risk register

| Risk | Mitigation |
|---|---|
| Testers drift below 12 mid-window | Recruit 20; keep a warm buffer list; check count every 2–3 days |
| Rejected for "no real engagement" | Get ≥3 quotes + ship ≥2 changes during the window; log the changes in the release notes |
| Fake/paid testers flagged | No Fiverr, no emulator farms, no bulk accounts. Swap communities + personal network only |
| Opt-in link dead on posting day | Verify on a real device in incognito before any post |
| Health-claim contradiction | Never say ADHD in recruiting posts (contradicts the Play health declaration) |
| Wasted cycle from an unrelated policy block | Clear `12-PLAY-STORE-LAUNCH-BLOCKERS.md` P0s before D0 |

---

## Sources
- [Play Console: production access requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Play Console: set up open/closed/internal tests](https://support.google.com/googleplay/android-developer/answer/9845334)
- [r/alphaandbetausers](https://old.reddit.com/r/alphaandbetausers/) · [subreddit index for closed-testing swaps](https://old.reddit.com/subreddits/search?q=closed+testing+android+testers)
- [SwapTest](https://swaptest.net/) · [Testers Community guide](https://www.testerscommunity.com/google-play-closed-testing) · [onTest: 7 methods compared](https://ontest.app/blog/how-to-get-12-testers-for-google-play-closed-testing)
