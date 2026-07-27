# Collaboration Guide — TrustBazaar

For working across multiple developers (and multiple AI IDEs) without stepping on each other.

---

## 1. Ownership zones

| Zone | Owner | Rule |
|---|---|---|
| `backend/` | Backend developer | Frontend dev never edits here directly |
| `frontend/` | Frontend developer | Backend dev never edits here directly |
| `DEV_CONTRACT.md` | Shared, edit-with-notice | Whoever needs a change edits it, then messages the team before anyone codes against it |
| `AI_AGENT_RULES.md` / `README.md` / `COLLABORATION.md` | Shared, rarely changes | Edit only by agreement |

Keeping strict folder ownership means most of your git activity never touches the same file — that alone prevents the majority of merge conflicts, independent of how good anyone's Git skills are.

---

## 2. Branching

- `main` — always in a working, demo-able state. Never push broken code directly here.
- `backend-dev` — backend developer's working branch.
- `frontend-dev` — frontend developer's working branch.
- Additional short-lived branches (e.g. `trust-score-feature`) are fine for a specific chunk of work — branch off your own dev branch, merge back into it when done, don't merge straight to `main`.

## 3. Daily loop

```bash
git add .
git commit -m "short, specific description of what changed"
git push origin <your-branch>
```
Commit and push often — every meaningful chunk of working progress, not just once at the end of a session. Small commits are easy to review and easy to revert; one giant commit at midnight is not.

## 4. Merging into `main`

Do this together, live (call or same room), not solo:

```bash
git checkout main
git pull origin main
git merge backend-dev
git merge frontend-dev
git push origin main
```

Because of the folder split, this should merge cleanly almost every time. If it doesn't, resolve it together on the call, not by one person guessing what the other person meant.

## 5. When you must change something in the other person's territory

1. Don't edit their folder directly.
2. Update `DEV_CONTRACT.md` with the new field/endpoint/table.
3. Message them directly: what changed, why, and what you need from their side.
4. Wait for acknowledgment before building on top of the assumed change.

This applies double when either of you is prompting an AI agent — the agent doesn't know a conversation happened over Slack/WhatsApp unless you paste the update into its context too.

## 6. Communication checkpoints

Agree on fixed sync points rather than ad hoc pings for everything:
- **Start of session:** quick message — what am I working on, what do I need from you.
- **Before merging to `main`:** always sync live, even if it's a 2-minute call.
- **Whenever `DEV_CONTRACT.md` changes:** immediate message, don't wait for the next checkpoint — this one's time-sensitive since both AI agents are relying on it being current.

## 7. If a merge conflict happens anyway

```
<<<<<<< HEAD
your version
=======
their version
>>>>>>> their-branch
```
Read both versions, decide together which lines are correct (or combine them), delete the `<<<<<<<`/`=======`/`>>>>>>>` markers, then:
```bash
git add <file>
git commit -m "resolved conflict: <what you decided and why>"
git push origin main
```
Never resolve a conflict by picking one side blindly without understanding what the other person's version was trying to do.

## 8. Tooling note

