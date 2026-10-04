# Taymar's GitHub and release workflow

Repository: `taymarspencer/Rizo-World-`. Start normal work from **`develop`**.

| Branch | What it means |
| --- | --- |
| `main` | The version intentionally approved for production. It still holds the older v86 candidate; this pass does not release anything. |
| `develop` | The complete integrated next version. Created directly from verified `a5b10db4ae19426e09967025baf543237bebe7c1`, preserving every ancestor. |
| `feature/...` or `fix/...` | One isolated change started from the latest `develop`, reviewed back into `develop`. |
| Old model/phase branches | Preserved history. Some contain separate work. Do not use them as the default starting point or merge them blindly. |

## Starting normal work

Tell the model:

> Work in taymarspencer/Rizo-World-. Fetch first, verify the latest remote develop HEAD, and preserve newer work. Read README.md, ARCHITECTURE.md and the relevant docs. Start a feature/... or fix/... branch from that HEAD, make the requested change, run the relevant checks, push it and prepare a PR into develop. Report the starting and final commits. Do not merge into main, force push, reset history or deploy.

For a small change with one model working, you can explicitly authorize a normal fast-forward push to `develop`. With several models or a risky experiment, use separate branches. A PR is a review page; opening one does not release the change.

## When a model finishes good work

Its feature branch and PR should target **`develop`**. Review the actual change, test results and remaining risks, then merge into `develop` when ready. Leave another model's newer commits in place. If the remote moved, integrate and retest before pushing. A test result belongs to a particular commit, not a branch name forever.

Stop treating a model's name as the permanent development branch. `claude/rizo-codebase-audit-yuqlns` remains at the public-foundation checkpoint for traceability; future integration belongs on `develop`.

The `Rizo World release candidate` GitHub Actions workflow runs the current contracts, build and ten browser suites on pushes to `develop`/`main` and PRs targeting either. A green run keeps a static-site artifact named for its exact SHA, plus QA evidence for seven days. It never merges or deploys. Check the run for your proposed commit; old green runs on historical branches are not evidence for today's candidate.

## When I want to release

1. Finish the intended work in `develop` and review its current commit.
2. Use the **draft `develop` → `main` release PR** as the release checklist. Keep it draft while any launch gate remains open.
3. Build the production artifact and run the current suites. See [release verification](../verification/RELEASE-ENGINEERING-VERIFICATION.md) and [deployment preparation](DEPLOYMENT-PREPARATION.md).
4. Check real iPhone/Android play, saves, PWA updates, production compression and the host/origin decisions. Local green tests do not complete those checks.
5. When you deliberately approve release, merge that reviewed commit into `main`, preferably with a merge commit so this integrated history stays visible. Record/tag that exact release SHA, build from it and deploy its artifact in the separate hosting step.

Do not enable automatic merge on the release PR. New commits on `develop` change the proposed release and need fresh review. The current draft is preparation, not approval to merge or deploy.

## If something goes wrong

Ask the model to fetch, read the commit history and compare the failing SHA with the last verified SHA. Put a repair on `fix/...` and review it into `develop`. A separate temporary checkout of the known-good commit lets you inspect it without changing today's history.

Do not repair a code problem by clearing players' saves. Do not deploy an older save reader casually: a rollback before state version 22 cannot fully understand current Dungeon receipts/story marks. Keep the old origin available for save export when moving domains.

## Seven rules to remember

1. **Start from the latest remote `develop`; always fetch and report its SHA first.**
2. **Preserve newer work.** A remembered checkpoint is a reference, not permission to overwrite today's branch.
3. **Use `feature/...` or `fix/...` for parallel work and experiments; bring good work back into `develop`.**
4. **`main` changes only when you intentionally approve a reviewed release.** Deployment and DNS are separate actions.
5. **Require real test results for the proposed commit, plus physical-device and production checks before launch.**
6. **Never authorize force pushes, blind resets, history rewrites or branch deletion without proof of containment.**
7. **Protect saves, accepted Dungeon/Defense art and story authority.** Old PRs are evidence to inspect, not a queue to mass-merge.

Branch names and documentation alone do not enforce these rules. The audited branches were unprotected; required checks and restrictions can be configured separately. [The history audit](HISTORY-AND-RELEASE-AUDIT.md) explains what remains on every old branch.
