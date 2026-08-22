# V64 UI Component System

## Structural shell

The Defense mode is organized as one shell:

1. persistent HUD/state
2. battlefield
3. command controls
4. Rizo roster
5. contextual sheet/modal layer

The battlefield remains the largest intentional region in every tested viewport. Short portrait compresses support UI; landscape converts the sides into command wings; tablets use larger field framing without stretching world coordinates.

## Responsive modes

- standard portrait
- short portrait
- landscape
- tablet/large

The system relies on custom properties, `clamp()`, `min()`, `max()`, aspect ratio, grid/flex contracts, and safe-area insets instead of one patch per phone.

## Tokens

The active stylesheet defines shared contracts for:

- spacing and touch size
- corner radius and border weight
- hard-cartoon UI shadow and soft world shadow
- semantic colors
- type roles and approved minimums
- named z-index layers
- safe-area padding

Semantic use:

- green: ready/valid/confirmed
- yellow: coins/upgrades/anticipation
- pink/red: danger/destructive action
- blue: selection/information/targeting
- cream/neutral: standard surfaces

## Shared components

- command button shell, including Pause and Start Wave
- HUD status cards
- roster/Rizo card with selected, unavailable, affordable, and drag states
- field/tower/powers/intel sheet shell
- danger action shell
- lobby/world card
- modal action row
- state message strip

## Overlay rules

Only one blocking Defense surface may own interaction at a time. Opening abilities closes field menu/intel/tower selection as needed. Sheets disable background input, contain their own scrolling, restore focus, and respect safe areas. The automated suite verifies conflict prevention and viewport containment.

## Typography and touch

- recurring Defense copy floor tested at 10.5 CSS px
- ordinary labels and descriptions generally render at 12–14 px
- tactical counters use compact mono styling
- recurring controls are checked for usable hit size; icon art may be smaller than the hit rectangle
- no critical state relies on color alone
- reduced-motion and high-contrast hooks remain supported by existing settings/media queries
