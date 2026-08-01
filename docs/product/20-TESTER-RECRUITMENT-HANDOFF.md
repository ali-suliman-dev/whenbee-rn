# 20 — Tester recruitment: handoff to-do

**You own this until Whenbee has production access on Google Play.**

The goal, exactly: **12 people installed and opted in for 14 consecutive days.** Then we file a questionnaire and Google lets us publish. Until that's done the app cannot go live.

Everything you need is below. You don't need to read any other doc.

---

## The links (always post all three, always numbered)

1. Join the group — https://groups.google.com/g/whenbee-testers
2. Opt in — https://play.google.com/apps/testing/com.whenbee.app
3. Install — https://play.google.com/store/apps/details?id=com.whenbee.app

**Why all three:** the group alone counts for nothing. Google counts the Play opt-in, and the opt-in only works if that Google account already joined the group. People who get one link get stuck and silently never count. This is the single most common way testers are lost.

---

## Before you post anything (30 min)

- [ ] Open link 2 on a real Android phone, signed out / incognito. Confirm it loads and shows "Become a tester". If it 404s, stop and tell Ali — the build isn't published to the track.
- [ ] Open link 1 signed out. Confirm you can see the group and join without approval.
- [ ] Ask Ali for the current tester count in Play Console (Testing → Closed testing). That's your starting number.
- [ ] Make a tracking sheet, one row per tester:
      `handle · where they came from · Google account email · opted-in date · day-14 date · last nudge · feedback quote · still in? Y/N`
- [ ] Two numbers you check every 2 days: **current opted-in count** and **earliest day-14 date among the first 12**.

---

## Target: 20 testers, not 12

Expect 30–40% to drop out. 12 is the floor with zero slack. Stop recruiting at 20.

---

## Day-by-day

### Day 0
- [ ] Before posting in a sub: **opt into 2 other people's apps from that sub**, then say so in your post. These communities run on reciprocity; a drive-by ask gets ignored.
- [ ] Post to **r/AndroidClosedTesting** (copy below)
- [ ] Post to **r/AndroidAppTesters**
- [ ] Reply to 5 other tester-request threads with the reply template

### Day +1
- [ ] Post to **r/alphaandbetausers** — very high volume, post in the morning or you sink
- [ ] Post to **r/SideProject** and **r/indiehackers**
- [ ] DM everyone you know with an Android phone (warm DM template). These are the highest-retention testers by far.

### Day +2
- [ ] Top-up subs: r/AndroidAppTesting, r/betatests, r/ClosedTestingHelp
- [ ] Follow-up comment on every thread you replied to on Day 0 — screenshot + one real bug you found in *their* app. **This is what actually earns testers back.**

### Day +3 — gate
- [ ] Under 15 opt-ins? Tell Ali. Don't improvise a paid solution.

### Day +3 → +17 — retention (this is where cycles get lost)
- [ ] Day 1 message to every tester: what the app is, and one ask — "start one timer on something you're actually doing today"
- [ ] Nudge on **day 4, day 8, day 12**. Short. Three touches total, no more — more reads as nagging.
- [ ] Ask each one for **one sentence** of feedback. We need real quotes for the questionnaire.
- [ ] Check the tester count in Play Console every 2–3 days. Drops below 14 → pull from your buffer list same day.

### Day +15
- [ ] Hand Ali: total testers, how many stayed, ≥3 real feedback quotes, and what was hard about recruiting. He files the questionnaire.

---

## Hard rules — breaking these can get the developer account suspended

- **Never buy testers.** No Fiverr gigs, no emulator farms, no bulk-created Google accounts. Google fingerprints devices. Penalty goes up to account suspension, and the account can't be recovered.
- **Never say "ADHD"** in any public post. We declared to Google that Whenbee is not a health app; a public "ADHD app" post contradicts that declaration. Say **"time blindness"**, "always 20 minutes off", "bad at estimating".
- **Don't post in r/productivity, r/GetMotivated or r/LifeProTips.** Self-promo is banned, AutoMod removes it in minutes and it can cost the account.
- **Check every sub's sidebar before posting.** Some require a screenshot proving you tested someone else first.
- Reply to every comment on your own thread. The subs rank on it and people notice.

---

## Copy — paste as-is

### Main post (r/AndroidClosedTesting, r/AndroidAppTesters, r/alphaandbetausers — one sub at a time, a day apart)

**Title:** Need 12 testers for a timer app that learns how badly you guess time (I'll test yours back, with real feedback not just an install)

Solo dev, first Android release, stuck on the 12 testers for 14 days gate like everyone else here.

The app is Whenbee. You guess how long a task will take, hit start, and it times it. After a handful of logs it works out how far off you personally run in each area of your life, and starts showing you an honest number instead of the one you'd have guessed. There's a home screen widget and a live notification while a timer runs, so you can see it counting without opening anything.

No account, no signup, no email. It opens straight into the app and everything stays on your phone. Free, no ads.

How to join:

1. Join the group: https://groups.google.com/g/whenbee-testers
2. Opt in: https://play.google.com/apps/testing/com.whenbee.app
3. Install: https://play.google.com/store/apps/details?id=com.whenbee.app
4. Keep it installed 14 days

If you want to actually use it, time one real task today and one tomorrow, that's enough to see the thing it's built for. If you'd rather just park it, that's fine too, the install is what Google counts.

Drop your links and I'll opt into yours today. I'll come back with a screenshot and something specific I found, not "nice app good job". Widget and notification behaviour is what I most want eyes on, especially anything below Android 14.

---

### Reply on someone else's tester-request thread

**Opt into their app before posting this.**

Joined your group and opted in, will keep it installed for the two weeks. I'll tell you where it loses me rather than just leaving it sitting there.

Mine's Whenbee, an Android timer for people who guess "10 minutes" and lose 40. You guess how long a task takes, hit start, and after about five logs it stops trusting your guess and shows you what that task actually costs you. No account, no login, no signup screen, it opens straight into the app and works offline.

1. Join the group: https://groups.google.com/g/whenbee-testers
2. Opt in: https://play.google.com/apps/testing/com.whenbee.app
3. Install: https://play.google.com/store/apps/details?id=com.whenbee.app

If you install it, run one timer on something you're actually doing today, that's the only bit that matters. I'll post a screenshot and whatever I find in yours in a couple of days.

---

### Follow-up comment (2 days later, on every thread you replied to)

Tested it properly today. [one specific thing that works — name the screen or flow]

One thing I hit: [one concrete bug or friction, and the screen it happened on]. [Attach screenshot.]

Still installed, will keep it the full two weeks.

---

### Warm DM (people you actually know)

Hey, I'm about to publish the app I've been building. Google requires 12 people to have it installed for 14 straight days before they'll let me go live. Would you install it and just leave it there? Using it is a bonus, keeping it installed is the actual requirement.

Two minutes:
1. https://groups.google.com/g/whenbee-testers
2. https://play.google.com/apps/testing/com.whenbee.app then press "Become a tester"

I'll ping you once on day 14 and that's it.

---

## Where to post, in order

| Day | Sub | Note |
|---|---|---|
| D0 | r/AndroidClosedTesting | Dedicated, low noise, reciprocity culture |
| D0 | r/AndroidAppTesters | "12 testers for 14 days (free)" in the sidebar |
| D+1 | r/alphaandbetausers | Huge volume — post in the morning, reply to others first |
| D+1 | r/SideProject, r/indiehackers | Same main post, builder framing |
| D+2 | r/AndroidAppTesting, r/betatests, r/ClosedTestingHelp | Top-up |
| — | r/productivity, r/GetMotivated, r/LifeProTips | **Don't.** Self-promo banned |

Also worth doing: swap apps (SwapTest — swaptest.net, Testers Community) and a banner on whenbee.app.

---

## Ask Ali, don't decide yourself

- Under 15 opt-ins by day 3
- Tester count drops below 14 mid-window
- The opt-in link stops working
- Anyone offers paid testers
- A sub removes the post or a mod warns you

Strategy background: `18-CLOSED-TESTING-TESTER-RECRUITMENT.md`. More copy variants: `19-CLOSED-TESTING-REDDIT-POSTS.md`.
