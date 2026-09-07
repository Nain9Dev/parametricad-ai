# Blockers & External Dependencies

This document registers external dependencies, blocking risks, and required credentials.

## Current Blockers

None currently blocking automated local testing or compilation.

## External Dependencies Required

1. **Groq API Key (Optional)**:
   - *Env var*: `PARAMETRICAD_GROQ_API_KEY`
   - *Impact*: When omitted, the engine automatically falls back to `RuleBasedParameterExtractor`, operating completely offline without external network dependencies.
2. **CAD System Graphics Stack (Linux Docker / CI)**:
   - *Packages*: `libgl1`, `libglx-mesa0`, `libegl1`, `libxrender1`, `libxext6`, `libsm6`, `libice6`.
   - *Status*: Configured in `backend/Dockerfile` and `.github/workflows/ci.yml`.
