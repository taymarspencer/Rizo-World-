# Phase 6 UI Component System

Defense continues to use the centralized semantic tokens in the consolidated stylesheet:
- typography: display, body, mono + named size roles
- spacing: `--def-space-*`
- radii: `--def-radius-*`
- borders/shadows: one hard UI border/shadow family and one ground shadow
- semantic state: green valid/ready, yellow currency/anticipation, pink/red danger, blue information/selection, cream neutral
- layers: world, world UI, HUD, sheet, modal, toast, critical

Phase 6 adds a single persistent state treatment (`.defense-phase-indicator`) and a single contextual sheet/scrim contract. Start/pause remains one shared run-control shell with state-specific icon/accent. Short portrait does not shrink essential typography to solve crowding; it removes quiet map metadata and switches the run control to icon-first presentation.
