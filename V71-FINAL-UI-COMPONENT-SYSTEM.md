# Rizo Defense v71 — UI Component System

## Structural shell
One Defense shell owns the primary HUD, contextual state, battlefield, command controls, Rizo roster, and contextual surface layer. Portrait, short portrait, landscape, and tablet behavior are driven by a small responsive contract instead of device-by-device overrides.

## Hierarchy
1. Battlefield threat
2. Hearts + active/cleared wave
3. Current phase/action
4. Tower/Rizo selection
5. Optional explanation

Persistent HUD exposes current wave, cleared wave, hearts, cash, and phase without repeating the same state across multiple banners.

## Components
Buttons, HUD chips, roster cards, tower panels, contextual sheets, close actions, selection/locked/danger states, and cinematic moment cards share the consolidated CSS vocabulary. Defense selectors contain no `!important` declarations.

## Layers
Named conceptual levels separate world, world UI, HUD, sheet/modal, toast, and critical status. The overlay manager prevents incompatible contextual surfaces from coexisting and makes background gameplay regions inert while a blocking surface is open.

## Typography and touch
Recurring Defense text is audited against the approved minimum; the browser integration suite found no visible recurring Defense text below 10.5px. Controls and icon hit areas are tested for containment across the required viewport matrix.

## Battlefield language
Towers are foot-anchored with ground shadows/pedestals; range is a soft ground surface; placement pockets/validity adapt per world; route labels remain quiet until deliberately traced. Gameplay outline/halo variables adapt for dark Eclipse and bright Blizzard conditions.

## Cinematic moment component
`#defenseMoment` is a single reusable status host. Semantic variants cover info, valid/clear, money/bank, danger/defeat, boss, and perfect states. Priority rules prevent low-importance events from overwriting terminal or boss moments. It is pointer-transparent and has a reduced-motion presentation.
