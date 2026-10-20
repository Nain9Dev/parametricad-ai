# Requirements Traceability Matrix

This matrix maps system requirements to their implementing domain models, use cases, and verification suites.

| Requirement ID | Specification | Implemented In | Verified By |
|---|---|---|---|
| REQ-UBI-01 | Content addressing via SHA-256 | `domain/models/specs.py` (`canonical_key`) | `tests/unit/test_specs.py`, `tests/property/test_geometry_invariants.py` |
| REQ-UBI-02 | Domain layer isolation | `domain/geometry/`, `domain/models/` | `backend/pyproject.toml` (mypy strict), `tests/unit/test_mesh_analysis.py` |
| REQ-UBI-03 | Component catalog endpoint | `application/catalog.py`, `api/routes/catalog.py` | `tests/integration/test_api.py` (`test_catalog_returns_all_components`) |
| REQ-UBI-04 | Web client response headers | `frontend/vercel.json` | Manual: served bundle loads with zero CSP violations; `curl -sI` on the deployment |
| REQ-UBI-05 | Reserved local development ports | `frontend/vite.config.ts` (`strictPort`), `app/config.py` | `tests/unit/test_config.py` (`TestCorsDefaults`), `tests/integration/test_api.py` (`TestCors`) |
| REQ-EVT-01 | Solid build & tessellation from spec | `application/use_cases/generate_from_spec.py` | `tests/integration/test_cadquery_kernel.py`, `tests/unit/test_generation_service.py` |
| REQ-EVT-02 | Parameter extraction from prompt | `application/use_cases/generate_from_prompt.py` | `tests/unit/test_rule_based_extractor.py` |
| REQ-EVT-03 | Content-addressed artifact caching | `application/services/model_generation_service.py` | `tests/unit/test_generation_service.py` (`TestContentAddressing`) |
| REQ-EVT-04 | Catalog retry with backoff | `frontend/src/lib/hooks/useCatalog.ts` | Manual: an unreachable API produces exactly four attempts, then one error |
| REQ-STA-01 | Offline rule-based extraction fallback | `infrastructure/llm/rule_based_extractor.py` | `tests/unit/test_rule_based_extractor.py`, `tests/integration/test_api.py` |
| REQ-STA-02 | Rejection of non-manifold/invalid meshes | `application/services/model_generation_service.py` | `tests/unit/test_generation_service.py` (`TestQualityGateRejection`) |
| REQ-STA-03 | Cold-start disclosure | `frontend/src/lib/hooks/useCatalog.ts`, `frontend/src/App.tsx` | Manual: the notice replaces a silent skeleton after 3.5 s |
| REQ-UNW-01 | Fabricability validation rejection | `domain/models/specs.py` | `tests/unit/test_specs.py` (`TestPipeRules`, `TestElbowRules`, etc.) |
| REQ-UNW-02 | Concurrency limit timeout handling | `application/services/model_generation_service.py` | `tests/unit/test_generation_service.py` (`TestConcurrencyLimit`) |
| REQ-UNW-03 | Unrecognized prompt rejection | `infrastructure/llm/rule_based_extractor.py` | `tests/integration/test_api.py` (`test_unparseable_prompt_fails_cleanly`) |
| REQ-OPT-01 | Multi-format exports (STEP, STL, DXF) | `infrastructure/mesh/trimesh_exporter.py` | `tests/integration/test_cadquery_kernel.py` (`TestExporters`) |
| REQ-UBI-12 | Compact workspace (viewer pinned, tabbed panel, side by side in short landscape) | `frontend/src/App.tsx`, `frontend/src/index.css` (`.workspace`), `components/layout/WorkspaceTabs.tsx`, `components/viewer/ViewerToolbarCompact.tsx`, `components/ui/BottomSheet.tsx` | `src/test/workspaceLayout.test.ts`, `WorkspaceTabs.test.tsx`, `useMediaQuery.test.ts`, `BottomSheet.test.tsx`, `ViewerToolbarCompact.test.tsx`, `HeaderMenu.test.tsx`; manual: viewport matrix of 2026-10-19 (`specs/001-installable-mobile-app/tasks.md`, Handoff) |
| REQ-UBI-13 | Touch targets, safe areas, pinch-zoom kept | `frontend/index.html` (viewport tag), `frontend/src/index.css`, `pointer-coarse:` variants in `components/ui/*`, `ViewerControls.tsx` | `src/test/touchTargets.test.tsx`, `src/test/indexHtml.test.ts`; manual: DOM audit at 375 x 812 reports zero targets under 44 px |
| REQ-UBI-14 | Ecosystem bar never covers the header; hidden on narrow or short screens and when installed | `frontend/src/index.css` (`--ecosystem-bar-height`, `.app-shell`), `frontend/index.html` (`tokens.css` media condition) | `src/test/ecosystemBar.test.ts`, `src/test/indexHtml.test.ts`; manual: header uncovered at 1 280 and 768 px, bar hidden at 375 and 812 x 375 |
| REQ-UBI-10 | Web app manifest, icons and install tags | `frontend/public/manifest.webmanifest`, `frontend/public/icons/`, `frontend/index.html`, `frontend/scripts/generate-pwa-icons.py` | `src/test/manifest.test.ts`, `src/test/indexHtml.test.ts`; manual: Chrome offers Install app on the phone (TSK-33) |
| REQ-UBI-11 | Service worker precaches the shell and the presets, no runtime caching | `frontend/pwa.config.ts`, `frontend/vite.config.ts`, `frontend/scripts/verify-pwa-build.mjs` | `src/test/pwaConfig.test.ts`, `npm run verify:pwa` (CI); manual: offline start against the preview build, 2026-10-19 |
| REQ-UBI-15 | Showcase cards equal their bundled models | `frontend/src/lib/presets.ts` | `src/lib/presets.test.ts` |
| REQ-EVT-06 | Install control, and the Add to Home Screen explanation on iOS | `components/layout/InstallButton.tsx`, `lib/hooks/useInstallPrompt.ts`, `components/layout/AppHeader.tsx` | `useInstallPrompt.test.tsx`, `InstallButton.test.tsx`, `AppHeader.test.tsx`; manual: a real install prompt on the phone (TSK-33) |
| REQ-EVT-07 | A new version is announced and applied only when the user accepts | `lib/hooks/usePwaUpdate.ts`, `components/layout/PwaStatus.tsx`, `pwa.config.ts` (`registerType: 'prompt'`) | `usePwaUpdate.test.tsx`, `PwaStatus.test.tsx`, `pwaConfig.test.ts`; manual: banner and Reload against the preview build, 2026-10-19 |
| REQ-STA-04 | Offline indicator; the app and the four presets stay usable | `lib/hooks/useOnlineStatus.ts`, `components/layout/OfflineBadge.tsx`, `components/layout/AppHeader.tsx` | `useOnlineStatus.test.tsx`, `OfflineBadge.test.tsx`, `AppHeader.test.tsx`; manual: all four presets open with the server stopped, 2026-10-19 |
| REQ-UNW-04 | A bundled preset answers only an exact match; otherwise the model is kept and the failure reported | `lib/apiClient.ts`, `lib/bundledPresets.ts`, `components/viewer/ViewerNotice.tsx` | `apiClient.fallback.test.ts`, `bundledPresets.test.ts`, `ViewerNotice.test.tsx`; manual: flange at 150 mm with the API stopped, 2026-10-19 |
| REQ-UNW-05 | A failure the service described is never replaced by a preset | `lib/apiClient.ts` | `apiClient.fallback.test.ts` |
| REQ-DEP-06 | `sw.js` and the manifest are served with `no-cache` | `frontend/vercel.json` | `src/test/vercelConfig.test.ts`; manual: `curl -sI` on the deployment |
