# ADR-0010: The update prompt across tabs

- **Status**: Accepted. The user chose Option B in session on 2026-10-20, asked for it to be built (TSK-37) and approved the ADR as written the same day (TSK-36)
- **Date**: 2026-10-20
- **Resolves**: A defect found while fixing the first-visit Reload (TSK-35): accepting an update in one tab reloads every other tab of the same browser by itself, and with it any edit in progress there
- **Relates to**: REQ-EVT-07 (the requirement the defect breaks); ADR-0007, decision 4 (update policy), which this amends; ADR-0009 (the browser tests that show it)

## Context

REQ-EVT-07 promises that a new version is "applied only when the user accepts, so that an automatic reload never discards edits in progress". The prompt was built and tested for one tab. A browser gives all the tabs of an origin one service worker, so what one tab does to the worker reaches the rest.

**Measured, 2026-10-20.** Two pages of one browser context, both started under the worker, on the two builds of `e2e/update.spec.ts`: Outer diameter changed to 123 in tab B with live regeneration off; second release deployed; both tabs showed "A new version is available."; Reload pressed in tab A. Tab B reloaded by itself within 3 s and its field was back at 100. Its user had accepted nothing. The two-tab tests added with this ADR reproduce it: on `47d2839` (the first-visit fix) the other tab was reloaded (`Expected: 0, Received: 1` loads) and, in the second test, its banner was gone.

**Cause**, read from `vite-plugin-pwa` 2.0.0 and `workbox-window` 7.4.1:

- In every tab that sees a waiting version, the plugin adds a `controlling` listener (`showSkipWaitingPrompt`, `dist/client/build/register.js`). It reloads the page when `isUpdate` is true, that is, when a worker already controlled the page at registration. It calls the `onNeedReload` option if there is one and `window.location.reload` if not. `updateServiceWorker(reloadPage)` ignores its argument (since 0.13.2), so it cannot switch this off.
- Accepting in tab A sends SKIP_WAITING. The new worker activates and claims every client (`clientsClaim: true`, `pwa.config.ts`), so every tab receives `controllerchange`, and every tab with that listener reloads.
- Any tab that saw the version waiting is exposed: one that was open when the update was found, or one opened while it waited. An installed app window beside a browser tab is enough.

**Facts that bound the options:**

- After one tab has applied the version no worker waits any more. A Reload pressed in another tab sends SKIP_WAITING to nothing and no `controllerchange` follows, so that Reload has to reload the page itself.
- A tab that is not reloaded keeps its old JavaScript under the new worker. On activation Workbox deletes the precache entries that the new manifest does not list (`PrecacheController.activate`), and a deploy replaces the hashed files on the host (assumption, not measured). The one lazy chunk today is the viewer (`ModelViewer` in `App.tsx`): it is requested when the workspace first renders, in the compact and in the wide layout, so a running tab holds it already. Each lazy chunk added later makes a stale tab more fragile. A stale tab also keeps calling the API the way its old code does, as any open tab does after a deploy, with or without a worker.
- `workbox-window` stops listening for new workers once it has treated one as external (an update found more than a minute after the tab registered; `_onUpdateFound`), so a long-lived tab can miss an announcement altogether.
- The app keeps no model of unsaved edits, so it cannot tell a tab with something to lose from one without.

## Options Considered

### Option A: Reload only the tab that accepted

Hand the plugin an `onNeedReload` that does nothing. The tab that accepted reloads through the `controllerchange` listener that `applyUpdate` already adds (TSK-35). Reload reloads the page directly when no version waits.

- *Effect*: no tab is reloaded for a decision it did not take. A tab that still shows the banner can use it. A tab whose user chose Later, or that missed the announcement, stays on the old code without a word.

### Option B: As A, and say so to the tabs left behind

As A, and the hook listens for `controllerchange`: when a page that already ran under a worker gets another one without its user accepting, the banner comes back (same text, same buttons). The first worker taking over a page that had none (a first visit) is not news and does not trigger it.

- *Effect*: as A, and every stale tab is told. It costs one effect and its tests more than A. A tab that chose Later is asked again, once, when another tab applies the version; the answer is still the user's.

### Option C: Keep today's behavior and record it as the decision

Every tab follows the one that accepts.

- *Effect*: nothing to build. REQ-EVT-07 is false whenever two tabs are open, and what it discards is the user's edit. Choosing it means rewording the requirement ("applied in the tab where the user accepts and in every other tab at once"), which is a product decision, not a code one.

### Option D: Reload the other tabs only when they hold no edit

- *Rejected*: it needs the model of unsaved edits that the app does not have. A wrong "nothing to lose" loses the user's work.

## Decision

**Option B**, chosen by the user in session on 2026-10-20.

1. `usePwaUpdate` passes the plugin an `onNeedReload` that does nothing. The tab that accepts still reloads once control changes.
2. It keeps the page's registration (`onRegisteredSW`). Reload reloads at once when no version waits, and otherwise asks for the version and reloads on the next change of control, as it does today.
3. While mounted it listens for `controllerchange`, and shows the banner again (`setNeedRefresh(true)`) when a page that was under a worker gets another one.
4. Not chosen: A would drop step 3 and its tests; C would leave REQ-EVT-07 false whenever two tabs are open, or reword it.

## Consequences

- *Positive*: REQ-EVT-07 holds with any number of tabs. Reload does what it says in every tab. A tab on old code under a new worker is announced.
- *Trade-off*: a tab that is not reloaded runs old code under the new worker until its user reloads. Today nothing visible breaks (the viewer is already loaded). A lazy chunk added later turns it into a load failure in that tab, which the banner explains and Reload fixes.
- *Trade-off*: two plugin options are relied on (`onNeedReload` and `onRegisteredSW`, both in `RegisterSWOptions`). A plugin bump that stops honouring either fails the two-tab spec, not the users.
- *Trade-off*: the banner can come back after Later, once, when another tab applies the version.
- *Unchanged*: one tab, returning or on a first visit; the offline-ready notice; Later, which leaves the version to take over when the app is next opened.

## Verification

Measured on 2026-10-20 (TSK-37), tests first:

- `usePwaUpdate.test.tsx` gained six tests: the plugin is handed a reload that does nothing; Reload waits for the change of control while a version still waits and reloads at once when none does; the version is offered again when another tab puts it in charge, and not for the first worker of a first visit; the listener goes when the page does. Four failed before the change, for the reasons above; the other two guard it. Six one-line breaks of the hook each fail the test meant for them.
- `e2e/update.spec.ts` gained three tests with two tabs of one browser: accepting in one leaves the other, and the edit in it, alone; the other can then reload itself onto the new version; a tab that chose Later is offered the version again. The first two failed before the change (the other tab reloaded by itself, its edit lost and its banner gone) and the third before its own step. The first-visit test also asserts that no new version is offered before one exists. Without the direct reload, the second test fails with the worker's state in its message.
- Vitest 225 of 225, `tsc`, oxlint, `typecheck:e2e`, `npm run build` and `verify:pwa` clean; `npm run test:e2e` 31 of 31.
- `docs/09-traceability.md` (REQ-EVT-07) and `docs/10-runbook.md`, sections 6 and 7, say what a second tab does.
