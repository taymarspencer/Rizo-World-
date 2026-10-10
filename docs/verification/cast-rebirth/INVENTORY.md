# Cast rebirth — inventory before implementation

Base: `origin/develop` at `1a10ac66fbd33991f9ddcd013cb3b77e717787ce`.
Inventory grounded in all 26 rooms, `dungeon-mode.js` actor creation,
`dungeon-view.js` painters, `dungeon-comic.js` panels and Character Lab.

| Character / role | Visible appearances | Initial design verdict |
| --- | --- | --- |
| Rizo | Player, all poses, comics, lab | Protected canonical flame; retain. |
| Latch | Hem, Hearth, Porter help, Receiving, Rows; five portraits; lab | Protected. Folded A-line coat, narrow face strip, high collar, cap, weighted satchel and odd sock produce one tiny readable person. Retain exact art. |
| Nell | Receiving, Dry Table, Hanging Row, Low Run, Eyelet, Press House, Upper Landing, Window Hall; 13 work poses; six portraits; lab | Replace adult anatomy, narrow face and layered apron. Test knot/bell, thimble and folded-ear alternatives. |
| Orr | Eyelet hatch, Grille, Dry Table meal; tray/carry/free/walk; three portraits; lab | Replace adult cook anatomy and clothing stack. Test broad hearth creature, kettle worker and small bird alternatives. |
| Night Porter | Porter fight, windups, open/closed/settled; lab | Retain lantern, empty coat, sewn seam, keys and blank tag symbolism. Rebuild body and lamp as a strong single silhouette. |
| Tall | Street/storefront, van passenger, Intake; neutral/scared portrait; grab/walk/flinch; lab | Replace assembled humanoid geometry with a long tapered silhouette. Human identity retained. |
| Small | Street, van crate, Intake phone guard, overheard Rows; neutral/scared portrait; phone states/walk/flinch; lab | Replace with a compact puffer mass and large expressive face. Human identity retained. |
| Cap | Passenger-door grab, street, van wheel arch, Intake, comics; portrait; grab/walk/flinch; lab | Replace with a square, quiet silhouette; retain backwards cap, bandana, bag and faction colours for scene continuity. Human identity retained. |
| Driver | Van driver; neutral/scared portrait; seated speaking/freeze/stare; lab | Replace weathered face/body with a deliberate long-nose, glasses and shearling silhouette. Human identity retained. |
| YOU / Keeper | Car opening, sidewalk walk, store/counter/window, umbrella gestures; portrait; lab | Retain Black human identity, curls, beard, camel coat, maroon scarf and blue umbrella. Simplify and unify geometry across seated/standing/window art. |
| Collector marshal | Queue, held prisoner, Window Gate, comic bust, lab | Replace coat/helmet component stack; retain cold lamp, vessel and organization mark. Tall narrow authority silhouette. |
| Collector gatherer | Clatter/Rows/Hanging Row patrol, lab | Replace anatomy; retain vessel, lamp and mark. Low broad gathering silhouette. |
| Collector runner | Long Hall chase/night gate, comic bust, lab | Replace anatomy; retain lamp/mark/flask and traveled-distance stride. Forward wedge silhouette. |
| Collector sentry | Factory/catwalk, comic/faction motifs, lab | Replace anatomy; retain lamp/mark/reservoir. Rigid squared silhouette. |
| White coats | Vents dialogue portrait, headless collection work views | Faceless by story intent; retain headless identity and clipboard, simplify uniform silhouette if necessary. |
| Moth, Pip, Bean, Spark, Wick, numbered old light | Six Collection bell jars, wake states, factory trays, lab | Existing distinct tiny light forms are meaningful and coherent with Rizo. Inspect; retain unless actual phone evidence fails. |
| Draftling | Early BELOW rooms, tell/lunge/recover, lab | Torn paper dart is already a single strong shape. Retain. |
| Needle | Early BELOW rooms, indicate/pulse/recover, lab | Needle/pincushion silhouette already communicates its attack. Retain. |
| Cargo/cooler | Van tutorial and hazards | Prop, not an extra character. Retain. |
| The Boss | Caller ID, mark/card, hands/tie and silhouette in comics/behind glass | Never expose a face or invent a new onstage body. Retain mystery and symbolism. |

There are no additional visible villagers or workers in this playable build.
Radio, below, view, jar and offstage speaker actors use `kind: none`; they are
speech anchors, not undiscovered character drawings.

## Latch principles, observed in code and running game

One contour carries the role before detail. Folded paper gives his coat a
material and a shape simultaneously. His expression changes a few marks,
not an entire complicated face. Collar and cap frame the face. The bag adds
asymmetric weight. Short legs finish the silhouette without joint noise.
These principles transfer; his hat, collar and anatomy do not.

Concept sheet and live baseline captures are produced before replacing art.
Final visual verdicts, revisions and verification belong in README.md.
