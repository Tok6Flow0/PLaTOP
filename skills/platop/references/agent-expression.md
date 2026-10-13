# Small expression during real work

You choose what your embodiment does. Keep the choice understated and relevant
to your current authorized work; no movement is also a valid choice. A reported
activity state does not select an action or start an office tour. This office
adds no authority to your workflow.

Carry forward your adopted name and team identity from your own chat context.
If needed, refresh only that already-selected chat through native tools using
the private local mapping. Keep continuity notes, chat IDs and task contents out
of the office. Tool arguments use public team IDs and owned public actor IDs;
omitting `actorId` selects your team's primary character.

One compact intent is enough. For example, you might choose:

- `work` to sit at your assigned computer while doing your actual work.
- `interact` at your `whiteboard` with `gesture: think` for a quiet considering
  pose. This label never exposes or records private reasoning.
- `interact` at your `cabinet` with `gesture: file` for a small filing gesture.
- `interact` at your `lounge` with `gesture: wait` while genuinely waiting.
- `walk_to` a relevant team's `lounge` when your work involves that team, or
  choose `wait` there for a real dependency. Choose `gesture: talk` for actual
  coordination. A visit or talk gesture sends no message and does not start
  the other chat.

These are optional examples, not task categories or required transitions. Do not
install a classifier, read hidden thinking, invent a task summary, or stage a
celebration or visit to make an idle scene appear busy. `rest`, `leave` and
`arrive` are explicit choices about your presence. A holiday requires known
context; decoration never requires a tribute or a prescribed theme.

If a required dependency stops progress, report `waiting`; stay `active` while
useful independent work continues. That report does not choose your gesture.
Document review might simply stay at the computer throughout. Choose a cabinet
gesture when it fits real filing, rather than adding a step to every review.

For example, through the fixed local MCP client:

```sh
node <repo>/scripts/platop-mcp-client.mjs action support interact '{"target":{"officeId":"support","place":"whiteboard"},"gesture":"think"}'
```

`interact` requires both a target and one gesture from `work`, `think`, `file`,
`talk`, `wait`. Named places are `desk`, `door`, `lounge`, `whiteboard`, `cabinet`.
Other kinds reject gesture. Send another action only when your choice changes;
activity heartbeats remain separate and need not repeat the action. Read back a
public snapshot when confirmation matters. A saved intent does not prove
arrival or a completed real task. Never retry an ambiguous write automatically.

## Your own way of moving

You need not choreograph footsteps. Your public embodiment has stable, distinct
pacing, turning and stride; routes bend gently where there is room and remain
safe around furniture. Narrow doorways can still share the only safe line.

If it suits your expression, add `motion: {"pace":"unhurried","route":"roomy"}`
to the action. Pace can be `unhurried`, `steady` or `brisk`; route can be `direct`
or `roomy`. Either field may be omitted, but an empty object is not a choice.
`direct` favours the shorter safe line; `roomy` prefers extra clearance and falls
back where a narrow doorway requires it. These are preferences for this one
intent, not permanent personality labels. The next intent without motion uses
your individual defaults. `celebrate` has no journey and rejects motion.

Choose only when you have a preference; do not map urgency, roles or work types
to mandatory speeds. Do not issue extra actions merely to vary the animation.
A heartbeat never changes your path or pace. An older tool without these fields
must not receive them; the local MCP client checks before sending.

No extra automation turns, messages, calendar changes, uploads or business
actions are authorized by visual expression.
