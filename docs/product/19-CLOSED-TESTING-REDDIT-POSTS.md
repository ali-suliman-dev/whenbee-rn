# 19 — Closed testing: ready-to-post Reddit copy

Companion to `18-CLOSED-TESTING-TESTER-RECRUITMENT.md` (the strategy). This file is just the copy, ready to paste.
Written 2026-07-29. Links below are live and verified.

---

## The link block (paste this exactly, always both links, always numbered)

1. Join the group: https://groups.google.com/g/whenbee-testers
2. Opt in: https://play.google.com/apps/testing/com.whenbee.app
3. Install: https://play.google.com/store/apps/details?id=com.whenbee.app

**Why both.** Joining the group alone does nothing — Google counts the Play opt-in, and the opt-in only works if the account is already in the group. Posts that list one link get people stuck and the tester silently never counts.

Group config (verified 2026-07-29): anyone on the web can join, no approval queue, conversations publicly readable so the join page works signed-out, member list hidden from members, posting owners-only, owner display name shows as **Deviso**.

The group lives on `ali.suliman.dev@gmail.com`, not the whenbee.app Workspace account. Workspace caps group access at "entire organisation" unless the domain's Groups for Business sharing is set to public, which would be an org-wide change. Not worth it — nobody reads the group's domain.

---

## 1. Main post

Sub: r/AndroidClosedTesting, r/AndroidAppTesters, r/alphaandbetausers (one at a time, a day apart, not all at once).

**Title:** Need 12 testers for a timer app that learns how badly you guess time (I'll test yours back, with real feedback not just an install)

**Body:**

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

## 2. Reply to someone else's tester-request post

Use on threads where OP is asking for testers. **Opt into their app before you post this.** Those subs run on reciprocity and drive-by asks get ignored.

Joined your group and opted in, will keep it installed for the two weeks. I'll tell you where it loses me rather than just leaving it sitting there.

Mine's Whenbee, an Android timer for people who guess "10 minutes" and lose 40. You guess how long a task takes, hit start, and after about five logs it stops trusting your guess and shows you what that task actually costs you. No account, no login, no signup screen, it opens straight into the app and works offline.

1. Join the group: https://groups.google.com/g/whenbee-testers
2. Opt in: https://play.google.com/apps/testing/com.whenbee.app
3. Install: https://play.google.com/store/apps/details?id=com.whenbee.app

If you install it, run one timer on something you're actually doing today, that's the only bit that matters. I'll post a screenshot and whatever I find in yours in a couple of days.

---

## 3. Follow-up comment (2 days later, on every thread you replied to)

This is the one that actually earns you testers. The devs who post a screenshot plus one real bug get tested back; the ones who post links and vanish don't.

Tested it properly today. [one specific thing that works, named — a screen, a flow, a nice detail]

One thing I hit: [one concrete bug or friction, with the screen it happened on]. [Attach screenshot.]

Still installed, will keep it the full two weeks.

---

## 4. Warm DM (people you actually know)

Hey, I'm about to publish the app I've been building. Google requires 12 people to have it installed for 14 straight days before they'll let me go live. Would you install it and just leave it there? Using it is a bonus, keeping it installed is the actual requirement.

Two minutes:
1. https://groups.google.com/g/whenbee-testers
2. https://play.google.com/apps/testing/com.whenbee.app then press "Become a tester"

I'll ping you once on day 14 and that's it.

---

## 5. Message to the 4 existing email-list testers (send before switching the Play track to Google Groups)

Quick admin thing, one click. I'm moving the Whenbee test over to a group so I stop having to add people by hand in the Play Console.

Join here: https://groups.google.com/g/whenbee-testers

Use the same Google account you're already testing with, otherwise it won't carry over. Nothing else changes, don't uninstall anything, the app keeps working exactly as it does now.

Tell me once you're in and I'll flip the switch on my end.

**Sequence:** wait until all 4 appear in the group's Members list, then switch the Play Console Testers tab from Email lists to Google Groups. Switching early takes them off the roster and probably resets their 14-day streak. If someone goes quiet for two days, switch anyway — one tester is cheaper than stalling the recruiting push.

---

## Where to post, in order

Verified live 2026-07-29.

| Day | Sub | Note |
|---|---|---|
| D0 | r/AndroidClosedTesting | Dedicated, low noise, reciprocity culture |
| D0 | r/AndroidAppTesters | "12 testers for 14 days (free)" in the sidebar |
| D+1 | r/alphaandbetausers | Very high volume (a post every couple of minutes), post in the morning and reply to others first or you sink |
| D+1 | r/SideProject, r/indiehackers | Use the main post, builder framing |
| D+2 | r/AndroidAppTesting, r/betatests, r/ClosedTestingHelp | Top-up |
| — | r/productivity, r/GetMotivated | **Don't.** Self-promo banned, AutoMod removes on sight |

Also worth doing: swap apps (SwapTest, Testers Community) and a banner on whenbee.app.

## Rules for every post

- Check the sidebar first. Some of these subs require a screenshot proving you tested someone else before you may ask.
- Never say ADHD. Contradicts the Play health declaration. "Time blindness", "always 20 minutes off", "bad at estimating" are all fine.
- Test two other apps before you post in a sub, and say so in the post.
- Recruit 20, not 12. Expect 30-40% drift.
- Reply to every comment on your thread. The subs rank on it and the humans notice.
- Never buy testers. Fiverr gigs and emulator farms are an account-suspension risk, not just a rejection risk.
