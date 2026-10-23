# Do You Know Them

Party trivia about the guest of honour. Eight rounds, one host who is also the
person the game is about, and a handful of friends on their own phones.

The host types in a name at setup, and every question in the game is about that
person. Nothing about anybody in particular lives in the code — the question
bank is written entirely around a `{name}` placeholder and a chosen pronoun set.

---

## How a night works

One **host** types in the guest of honour's name and pronouns, then picks which
of the eight rounds to play, how many questions each runs, and a power-up deck
size. Everyone else is a **player**, joining on their own phone with a
five-character room code.

The host is also the **judge**: they answer first where a round needs it, and
they score what everyone else wrote. That's what lets any host run this for
any friend after typing one name — nobody has to pre-write a correct-answer
key. See `src/roundTypes.js` for exactly how each of the eight rounds scores.

---

## Stack

- **React 19 + Vite** for the app and build.
- **Tailwind CSS 4** for styling.
- **Supabase** (Postgres) for game state — every write goes through a guarded
  database function (`rpc_...`), never a raw insert/update/delete. See
  `supabase-rls-hardening.sql` for the full access-control layer.
- **Node's built-in test runner** (`node --test`) for the test suite.

---

## Running it locally

```bash
npm install
npm run dev
```

Open **http://localhost:5184**.

| Command | What it does |
|---|---|
| `npm run dev` | The app, on port 5184 |
| `npm test` | 140 tests, Node's built-in runner — all passing |
| `npm run build` | Production build |
| `npm run lint` | Clean, bar one long-standing `WaitingScreen.jsx` fast-refresh warning |

You'll need your own Supabase project: copy `.env.local.example` to `.env.local`
and fill in its two values (Settings → API in your Supabase dashboard), then
run `supabase-schema.sql` followed by `supabase-rls-hardening.sql` against it.

---

## Where things live

| File | What it is |
|---|---|
| `supabase-schema.sql` | Database setup. Safe to run more than once |
| `supabase-rls-hardening.sql` | The guarded access-control functions every write goes through |
| `src/subject.js` | Turns the host's name and pronoun choice into filled-in sentences |
| `src/questionBank.js` | Every question that could be asked, written about `{name}` |
| `src/roundTypes.js` | How each round scores |
| `src/powerUps.js` | The power-up card roster |
| `src/db.js` | Every call the app makes to the database |

---

## Live

| | |
|---|---|
| Live site | https://do-you-know-them.vercel.app |
