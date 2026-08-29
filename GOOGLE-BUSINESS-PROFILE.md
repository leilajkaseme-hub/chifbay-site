# Google Business Profile — where it stands

Instagram and the Journal publish themselves, every day, with no hand on them.
Google does not, and this file says exactly why, so the question does not get
re-opened from scratch every month.

## What runs today

`gbp-draft.yml` runs as soon as `blog-auto` succeeds. It turns the day's
Journal article into a finished Business Profile post — the text, cut to the
150 characters Google shows before "Read more", the Learn more link, and the
photo — checks that the link and the photo really answer 200, and pushes it to
the phone. Posting it is a paste.

It sends nothing when the Journal did not publish. A post recycled from three
days ago is worse than no post, and silence keeps the broken thing visible.

```bash
node scripts/gbp-draft.mjs          # read it in the terminal
node scripts/gbp-draft.mjs --json   # the exact fields a localPosts call takes
```

## Why it is not fully automatic

**The API is gated by application.** Approval takes days to weeks, and
Google's own guidance aims it at agencies, tool vendors, and businesses with
ten or more locations. A single-location owner is told to use the dashboard.
Chifbay is one boat. Apply by all means — it costs nothing and the answer may
be yes — but do not plan around it.

**It refuses service accounts.** Unlike the Drive sync, there is no robot
account that can hold this. It wants OAuth as the profile owner and a stored
refresh token: another long-lived credential to guard, for one post a day.

**A headless browser was the other option, and it is a bad trade.** It breaks
Google's terms using the very account that holds the profile. Of the businesses
ChatGPT names in an answer, 88.8% come from Google Places (measured across
99,538 entities). That profile is the biggest local-search asset Chifbay owns
and the largest single AI-visibility lever it has. It is not worth gambling for
one post a day, which is the weakest of the three channels anyway.

## If you want to apply anyway

Request access at https://developers.google.com/my-business, against the same
Cloud project the Drive sync uses (`decoded-shadow-503522-g1`) so both live
together. It needs a verified profile at least 60 days old, a real business
website, and a stated use case.

Use these facts — all verified, none invented:

- **Business**: CHIF&CO, LDA, NIPC 518603750, Funchal, Madeira, Portugal.
- **Registration**: RNAAT n.º 305/2026, *Operador Marítimo Turístico*, entered
  on the Turismo de Portugal register 2026-03-30.
- **Website**: https://chifbay.com — publishing daily since July 2026, in six
  languages.
- **Use case**: publishing one post a day to our own single Business Profile,
  generated from our own Journal. No client locations, no resale, no third
  party data.

Say plainly that it is one location and one owner. A use case dressed up as an
agency is the kind that gets refused and remembered.

**If it is granted**, the work left is small: an OAuth client, one consent run
to mint a refresh token, that token as a repo secret, and a transport step in
`gbp-draft.yml`. `--json` already emits the request body.

## Worth more than daily posts

Posts expire from the profile after seven days and carry little ranking weight.
If the goal is Google visibility, these beat them and none needs an API:

1. **Photos.** Profiles with more photos get more calls and route requests.
   The library is at 92 and grows from the Drive folder — upload the good ones.
2. **Reviews, and replies to them.** `reviews-auto` already collects them.
3. **Q&A.** Seed the real questions: how many people, does it sail in winter,
   where does it leave from, is it private.
4. **Services and attributes** filled in completely, in Portuguese and English.
