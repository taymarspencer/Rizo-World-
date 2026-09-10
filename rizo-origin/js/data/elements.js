/* RIZO ORIGIN — element table
   id | NAME | group | flags | flavor
   flags:  .  ordinary      m  landmark (bigger ceremony)      s  secret (uncounted, unhinted)
   Keep flavor short. Never explain the recipe. */
window.RIZO_ELEMENT_TABLE = `

# ─── ELEMENT ────────────────────────────────────────────────────────────────
fire      | FIRE      | element | m | It wants what it wants.
water     | WATER     | element | m | Patient. Undefeated.
earth     | EARTH     | element | m | Everything you will ever stand on.
air       | AIR       | element | m | The one you forget until it stops.
energy    | ENERGY    | element | . | The reason anything bothers.
steam     | STEAM     | element | . | Water in a hurry.
lava      | LAVA      | element | . | Rock with an attitude problem.
mud       | MUD       | element | . | Ruined slightly. Improved slightly.
dust      | DUST      | element | . | The world, sanded down.
wind      | WIND      | element | . | Air that decided to go somewhere.
smoke     | SMOKE     | element | . | The part that got away.
ash       | ASH       | element | . | The receipt.
ice       | ICE       | element | . | Water holding a grudge.
light     | LIGHT     | element | . | It got here first.
stone     | STONE     | element | . | Patient in a different way.
spark     | SPARK     | element | . | One good argument between two rocks.
sand      | SAND      | element | . | Stone that lost.
salt      | SALT      | element | . | What the sea leaves when it goes.
crystal   | CRYSTAL   | element | . | Stone that learned a trick.

# ─── WORLD ──────────────────────────────────────────────────────────────────
sky       | SKY       | world | m | The lid. Nobody has found the hinge.
sun       | SUN       | world | . | Close enough. Far enough.
moon      | MOON      | world | . | Borrowed light, full-time job.
cloud     | CLOUD     | world | . | A rumour about rain.
mist      | MIST      | world | . | The morning, undecided.
rain      | RAIN      | world | . | Delivery.
storm     | STORM     | world | . | Weather with a temper.
lightning | LIGHTNING | world | . | The sky's only punctuation.
thunder   | THUNDER   | world | . | Always late, always loud.
snow      | SNOW      | world | . | Rain that took its time.
rainbow   | RAINBOW   | world | . | Light, caught bragging.
sea       | SEA       | world | . | More water than the word deserves.
wave      | WAVE      | world | . | Water pretending to travel.
tide      | TIDE      | world | . | The moon, pulling on the leash.
beach     | BEACH     | world | . | Where the argument settles.
island    | ISLAND    | world | . | A mountain that kept its mouth shut.
river     | RIVER     | world | . | Water with a plan.
mountain  | MOUNTAIN  | world | . | Slow violence, frozen mid-swing.
waterfall | WATERFALL | world | . | The river losing its nerve.
desert    | DESERT    | world | . | The sun got the last word.
swamp     | SWAMP     | world | . | Nothing here is in a hurry to rot.
volcano   | VOLCANO   | world | . | A mountain that kept a secret badly.
earthquake| EARTHQUAKE| world | . | The ground admitting it was never furniture.
fossil    | FOSSIL    | world | . | Somebody's last posture, kept forever.
coal      | COAL      | world | . | A forest that got buried and stayed angry.
oil       | OIL       | world | . | The swamp waited too long.
diamond   | DIAMOND   | world | . | Pressure, showing off.
shadow    | SHADOW    | world | . | Proof something is in the way.
night     | NIGHT     | world | . | The half nobody scheduled.
cave      | CAVE      | world | . | The first room.
broth     | PRIMORDIAL SOUP | world | m | Something in the water is thinking about it.
confluence| CONFLUENCE| world | s | Two rivers agreeing to stop arguing.

# ─── LIFE ───────────────────────────────────────────────────────────────────
life      | LIFE      | life | m | It started and it has not stopped.
microbe   | MICROBE   | life | . | Small. Winning.
algae     | ALGAE     | life | . | Green, ambitious, everywhere.
fungus    | FUNGUS    | life | . | Eats the ending.
seed      | SEED      | life | . | A plan with a hard shell.
plant     | PLANT     | life | . | Standing still on purpose.
tree      | TREE      | life | . | A plant that committed.
grass     | GRASS     | life | . | Loses constantly. Still here.
flower    | FLOWER    | life | . | An advertisement for insects.
fruit     | FRUIT     | life | . | A bribe, wrapped.
sap       | SAP       | life | . | Sweet, and it did not offer.
root      | ROOT      | life | . | The half nobody thanks.
leaf      | LEAF      | life | . | A machine that runs on afternoons.
oxygen    | OXYGEN    | life | . | Somebody's exhaust. Now your favourite.
forest    | FOREST    | life | . | Trees agreeing to a policy.
mushroom  | MUSHROOM  | life | . | Fruit of the thing under everything.
poison    | POISON    | life | . | A very direct opinion.
death     | DEATH     | life | m | The other half of the deal.
evolution | EVOLUTION | life | . | Death with an opinion.
decay     | DECAY     | life | . | Everything gets asked for it back.
soil      | SOIL      | life | . | Everything that used to be somebody.
weed      | WEED      | life | s | Grew where it wasn't allowed.
grain     | GRAIN     | life | . | Grass we talked into working.
dna       | DNA       | life | s | The note that copies itself.
cactus    | CACTUS    | life | s | A plant that stopped being polite.

# ─── BEAST ──────────────────────────────────────────────────────────────────
animal    | ANIMAL    | beast | m | Life that got bored of standing still.
fish      | FISH      | beast | . | Older than your bones. Less impressed.
shark     | SHARK     | beast | . | A rumour with teeth.
insect    | INSECT    | beast | . | The actual majority.
bee       | BEE       | beast | . | Employed by a flower.
worm      | WORM      | beast | . | Runs the soil. Never mentions it.
snake     | SNAKE     | beast | . | No legs, no need.
lizard    | LIZARD    | beast | . | Sunbathing professionally since forever.
dinosaur  | DINOSAUR  | beast | . | The long chapter you missed.
bird      | BIRD      | beast | . | Dinosaurs, downsized and singing.
egg       | EGG       | beast | . | A seed with a heartbeat.
feather   | FEATHER   | beast | . | Warmth that discovered a loophole.
mammal    | MAMMAL    | beast | . | Survived the cold by cheating.
wolf      | WOLF      | beast | . | The forest, with a schedule.
dog       | DOG       | beast | m | It chose you. Nobody knows why.
cat       | CAT       | beast | . | Domesticated, allegedly.
horse     | HORSE     | beast | . | Legs you can borrow.
pig       | PIG       | beast | . | Smart enough to know.
monkey    | MONKEY    | beast | . | Hands, and plans for them.
rat       | RAT       | beast | s | Moved into your city before you finished it.
mosquito  | MOSQUITO  | beast | s | The most successful business model on earth.
swarm     | SWARM     | beast | . | Many, deciding as one, badly.
honey     | HONEY     | beast | . | Sunlight, chewed.
fur       | FUR       | beast | . | Warmth, before anyone thought to charge for it.
hunger    | HUNGER    | beast | . | The oldest instruction.

# ─── HUMAN ──────────────────────────────────────────────────────────────────
human     | HUMAN     | human | m | The monkey that kept the fire.
voice     | VOICE     | human | . | Air, shaped into a demand.
language  | LANGUAGE  | human | . | Getting an idea into somebody else's head.
name      | NAME      | human | . | The first spell that ever worked.
blood     | BLOOD     | human | . | Iron, taking the long way around.
heart     | HEART     | human | . | A muscle with a publicist.
pain      | PAIN      | human | . | The body, insisting.
family    | FAMILY    | human | . | You did not pick these people.
child     | CHILD     | human | . | Brand new. Already suspicious.
twin      | TWIN      | human | s | Somebody hit copy.
tribe     | TRIBE     | human | . | Everyone who gets a share.
home      | HOME      | human | . | Somewhere expects you back.
sleep     | SLEEP     | human | . | A third of your life, unaccounted for.
hunt      | HUNT      | human | . | Patience with a sharp end.
meat      | MEAT      | human | . | Somebody's whole story, now lunch.
meal      | MEAL      | human | . | Fire's second job.
bread     | BREAD     | human | . | Civilisation, sliced.
corpse    | CORPSE    | human | . | An address, after they move out.
skull     | SKULL     | human | . | Still smiling about something.

# ─── MIND ───────────────────────────────────────────────────────────────────
thought   | THOUGHT   | mind | m | Something happened in there.
idea      | IDEA      | mind | . | Two thoughts that touched.
question  | QUESTION  | mind | . | The most dangerous thing you can hand a child.
memory    | MEMORY    | mind | . | Edited nightly. You are not told.
dream     | DREAM     | mind | . | The mind, unsupervised.
nightmare | NIGHTMARE | mind | . | Same thing, but it took notes.
fear      | FEAR      | mind | . | Very old software. Still running.
desire    | DESIRE    | mind | . | Hunger that learned adjectives.
ambition  | AMBITION  | mind | . | Wanting, with a calendar.
love      | LOVE      | mind | . | The ones you keep.
anger     | ANGER     | mind | . | Fear, wearing a bigger coat.
sorrow    | SORROW    | mind | . | Love with nowhere to put itself.
hope      | HOPE      | mind | . | Light you have not seen yet.
doubt     | DOUBT     | mind | . | The tax on thinking.
truth     | TRUTH     | mind | . | Doesn't care whether you like it.
lie       | LIE       | mind | . | The truth, but scared.
secret    | SECRET    | mind | . | Truth kept in a dark room.
ego       | EGO       | mind | . | Useful until it gets the keys.
identity  | IDENTITY  | mind | . | Whatever you keep telling people you are.
pride     | PRIDE     | mind | . | Sitting up straight about it.
courage   | COURAGE   | mind | . | Fear, going anyway.
patience  | PATIENCE  | mind | . | Doing nothing, deliberately.
boredom   | BOREDOM   | mind | . | Every good idea starts here, badly.
madness   | MADNESS   | mind | . | Off the leash.
opinion   | OPINION   | mind | . | A thought that stopped checking.
trust     | TRUST     | mind | . | Lending somebody the knife.
math      | MATH      | mind | . | Counting, after it got ambitious.
logic     | LOGIC     | mind | . | Rules for being right on purpose.

# ─── SOCIETY ────────────────────────────────────────────────────────────────
village   | VILLAGE   | society | m | We stopped walking.
city      | CITY      | society | . | Too many people to know, all staying anyway.
crowd     | CROWD     | society | . | A lot of people, thinking less.
law       | LAW       | society | . | Rules written by whoever was scared first.
crime     | CRIME     | society | . | The law invented it on the way out.
punishment| PUNISHMENT| society | . | Pain, with paperwork.
king      | KING      | society | . | Somebody had to hold the loud stick.
crown     | CROWN     | society | . | A hat that makes people kneel.
empire    | EMPIRE    | society | . | A village that could not stop.
war       | WAR       | society | . | An argument with a body count.
soldier   | SOLDIER   | society | . | Somebody's child, holding somebody's decision.
hero      | HERO      | society | . | Usually somebody who got away with it.
peace     | PEACE     | society | . | When everybody runs out of sons.
knowledge | KNOWLEDGE | society | . | Memory that got organised.
science   | SCIENCE   | society | . | Being wrong on purpose until you aren't.
medicine  | MEDICINE  | society | . | The dose is the whole argument.
farm      | FARM      | society | . | We bet everything on next year.
class     | CLASS     | society | . | Some streets cost more.
rebellion | REBELLION | society | . | No.
revolution| REVOLUTION| society | . | No, at scale.
riot      | RIOT      | society | . | A mood with legs.
power     | POWER     | society | . | Being the one who decides.
politics  | POLITICS  | society | . | Power, apologising in advance.
prison    | PRISON    | society | . | A room built out of consequences.
work      | WORK      | society | . | Hours, sold by the hour.

# ─── CRAFT ──────────────────────────────────────────────────────────────────
wood      | WOOD      | craft | m | First thing that was ever ours.
tool      | TOOL      | craft | . | A better hand.
wheel     | WHEEL     | craft | . | Nobody had to invent it twice.
brick     | BRICK     | craft | . | Mud, with ambitions.
house     | HOUSE     | craft | . | Weather, denied.
glass     | GLASS     | craft | . | Sand that agreed to be honest.
mirror    | MIRROR    | craft | . | Most of the trouble started here.
metal     | METAL     | craft | . | Rock that finally listened.
iron      | IRON      | craft | . | Cheap, hard, everywhere. Changed everything.
steel     | STEEL     | craft | . | Iron that went to work.
gold      | GOLD      | craft | . | Useless and therefore priceless.
blade     | BLADE     | craft | . | An edge, with an opinion.
weapon    | WEAPON    | craft | . | Same as a tool. Different intention.
sword     | SWORD     | craft | . | A blade that made it personal.
thread    | THREAD    | craft | . | Everything is held together by this.
cloth     | CLOTH     | craft | . | Warp. Weft. Civilisation.
leather   | LEATHER   | craft | . | Somebody wore it first.
needle    | NEEDLE    | craft | . | Small, sharp, undefeated.
paper     | PAPER     | craft | . | A tree that agreed to shut up and listen.
ink       | INK       | craft | m | Fire's ashes, learning to talk.
pen       | PEN       | craft | . | The quiet end of every empire.
boat      | BOAT      | craft | . | Wood, saying no to drowning.
gunpowder | GUNPOWDER | craft | . | The end of the sword, in a bag.
gun       | GUN       | craft | . | Distance, weaponised.
bomb      | BOMB      | craft | . | An argument nobody survives to win.
dye       | DYE       | craft | . | A flower's last statement.
flour     | FLOUR     | craft | . | Grain, defeated.
bridge    | BRIDGE    | craft | . | A promise you can drive on.
drum      | DRUM      | craft | . | A heartbeat you can hit.

# ─── MACHINE ────────────────────────────────────────────────────────────────
engine    | ENGINE    | machine | m | The first thing that worked while you slept.
machine   | MACHINE   | machine | . | Labour, minus the complaining.
factory   | FACTORY   | machine | . | A building that eats hours.
train     | TRAIN     | machine | . | Suddenly everywhere was closer.
car       | CAR       | machine | . | A room that moves. Mostly parked.
plane     | PLANE     | machine | . | We stole it from the birds and made it loud.
rocket    | ROCKET    | machine | . | A very expensive way to leave.
clock     | CLOCK     | machine | . | We built a fence around the day.
electricity|ELECTRICITY|machine | . | Lightning, domesticated.
lightbulb | LIGHTBULB | machine | . | We cancelled night. Night noticed.
robot     | ROBOT     | machine | . | The golem, with a warranty.
code      | CODE      | machine | . | Language that has to mean exactly one thing.
computer  | COMPUTER  | machine | m | A rock we tricked into thinking.
screen    | SCREEN    | machine | . | The window that looks back.
signal    | SIGNAL    | machine | . | Shouting, without the shout.
radio     | RADIO     | machine | . | Voices out of empty air.
television| TELEVISION| machine | . | We sat around it like a fire.
camera    | CAMERA    | machine | . | Memory with a shutter.
photograph| PHOTOGRAPH| machine | . | Proof it happened. Not proof it was true.
ai        | AI        | machine | m | It read everything and remembered nothing.

# ─── NETWORK ────────────────────────────────────────────────────────────────
internet  | INTERNET  | network | m | Everyone, all at once, forever.
social    | SOCIAL MEDIA | network | . | Everyone you know, plus everyone else.
feed      | FEED      | network | . | It is called that on purpose.
attention | ATTENTION | network | . | The only currency nobody prints.
influencer| INFLUENCER| network | . | A person, monetised.
meme      | MEME      | network | . | An idea that learned to reproduce.
viral     | VIRAL     | network | . | Also on purpose. Also a warning.
troll     | TROLL     | network | . | Loneliness with a keyboard.
doomscroll| DOOMSCROLL| network | . | Hunting for something that hurts correctly.
algorithm | ALGORITHM | network | . | It learned what you can't stop looking at.
echochamber| ECHO CHAMBER | network | . | A room where you are always right.
bot       | BOT       | network | . | Nobody, at scale.
deepfake  | DEEPFAKE  | network | . | The last day of evidence.
notfound  | 404       | network | s | The page you were promised.
comment   | COMMENT   | network | . | Somebody had to say it. It was not necessary.

# ─── MONEY ──────────────────────────────────────────────────────────────────
trade     | TRADE     | money | m | We grew more than we could eat.
coin      | COIN      | money | . | A promise you can bite.
money     | MONEY     | money | m | Everybody agreed this paper mattered.
greed     | GREED     | money | . | Enough, plus one.
debt      | DEBT      | money | . | Money that has not happened yet.
bank      | BANK      | money | . | Built out of stone so you would believe it.
market    | MARKET    | money | . | Everybody guessing, loudly, together.
scarcity  | SCARCITY  | money | . | Wanting more of it than there is.
corporation| CORPORATION | money | . | A person, legally, and never once in practice.
brand     | BRAND     | money | . | A name people trust more than a person.
luxury    | LUXURY    | money | . | Paying extra to be seen paying extra.
poverty   | POVERTY   | money | . | Working, and still losing.
tax       | TAX       | money | . | Rent, on being here.
status    | STATUS    | money | . | Proof you are fine. Expensive proof.

# ─── CULTURE ────────────────────────────────────────────────────────────────
story     | STORY     | culture | m | Fire had two uses.
rhythm    | RHYTHM    | culture | . | Time, but on our terms.
music     | MUSIC     | culture | . | Math you can cry to.
song      | SONG      | culture | . | A story that refuses to be forgotten.
dance     | DANCE     | culture | . | Bodies, agreeing.
art       | ART       | culture | m | Somebody had to put it somewhere.
beauty    | BEAUTY    | culture | . | Truth, dressed for it.
poetry    | POETRY    | culture | . | Saying it the long way to say it faster.
joke      | JOKE      | culture | . | Pain, plus timing.
book      | BOOK      | culture | . | A dead person, still talking.
library   | LIBRARY   | culture | . | We stacked our memory in a room.
symbol    | SYMBOL    | culture | . | A picture that agreed to mean something.
logo      | LOGO      | culture | . | A symbol somebody paid for.
graffiti  | GRAFFITI  | culture | . | Permission was never coming.
mask      | MASK      | culture | . | A face with fewer obligations.
fame      | FAME      | culture | . | Being known by people you will never meet.
creation  | CREATION  | culture | . | Making the thing instead of describing it.
punk      | PUNK      | culture | . | Three chords and an objection.

# ─── STYLE ──────────────────────────────────────────────────────────────────
clothing  | CLOTHING  | style | m | Weather first. Opinions immediately after.
fashion   | FASHION   | style | . | Clothes with an audience.
trend     | TREND     | style | . | Everyone deciding at once, then denying it.
style     | STYLE     | style | . | Doing it wrong, consistently, until it's right.
shirt     | SHIRT     | style | . | The most honest rectangle.
screenprint| SCREEN PRINT | style | . | Push ink through a wall of holes. Repeat.
tee       | GRAPHIC TEE | style | . | A billboard you can sleep in.
shoe      | SHOE      | style | . | Where the whole outfit tells on you.
denim     | DENIM     | style | . | Gets better by getting worse.
black     | BLACK     | style | . | Agrees with everything. Admits nothing.
jewelry   | JEWELRY   | style | . | Wealth, worn where people can see it.
tattoo    | TATTOO    | style | . | Ink that agreed to stay.
drop      | DROP      | style | . | Available for eleven minutes.
soldout   | SOLD OUT  | style | . | Now everybody wants one.
hype      | HYPE      | style | . | Wanting, sold separately.
bootleg   | BOOTLEG   | style | . | Flattery, with a profit margin.

# ─── VICE ───────────────────────────────────────────────────────────────────
alcohol   | ALCOHOL   | vice | m | Rot, but on purpose.
beer      | BEER      | vice | . | Bread that gave up on being bread.
cigarette | CIGARETTE | vice | . | Fire, on a schedule, indoors.
party     | PARTY     | vice | . | Everybody agreeing to be loud together.
addiction | ADDICTION | vice | . | Wanting, on a schedule you did not set.
gambling  | GAMBLING  | vice | . | Hope, with a service fee.
lust      | LUST      | vice | . | Beauty, misread on purpose.
gluttony  | GLUTTONY  | vice | . | Hunger that stopped listening.
envy      | ENVY      | vice | . | Wanting the thing because they have it.
sloth     | SLOTH     | vice | . | A day spent perfectly, on nothing.
wrath     | WRATH     | vice | . | Anger that got a budget.
sin       | SIN       | vice | . | Crime, but cosmic.
temptation| TEMPTATION| vice | . | The door, left slightly open.
corruption| CORRUPTION| vice | . | Rot, in a good suit.
murder    | MURDER    | vice | . | The shortest argument.

# ─── FAITH ──────────────────────────────────────────────────────────────────
ritual    | RITUAL    | faith | m | Do it the same way. Something is watching.
god       | GOD       | faith | m | Somebody had to be in charge of the sky.
prayer    | PRAYER    | faith | . | The first message sent nowhere.
temple    | TEMPLE    | faith | . | We built a room for the invisible.
priest    | PRIEST    | faith | . | Says the line is open. Nobody can check.
soul      | SOUL      | faith | . | The part you can't find in the autopsy.
heaven    | HEAVEN    | faith | . | The good ending, promised in advance.
angel     | ANGEL     | faith | . | Terrifying, in the original.
faith     | FAITH     | faith | . | Doubt that decided anyway.
religion  | RELIGION  | faith | . | Rules, from upstairs.
dogma     | DOGMA     | faith | . | Faith that stopped asking.
luck      | LUCK      | faith | . | The universe, briefly on your side.
judgment  | JUDGMENT  | faith | . | A reckoning, with a ledger.
curse     | CURSE     | faith | . | A prayer sent the wrong way.

# ─── MYTH ───────────────────────────────────────────────────────────────────
legend    | LEGEND    | myth | m | The story, after it stopped being true.
monster   | MONSTER   | myth | . | Fear, given a shape so it can be hunted.
dragon    | DRAGON    | myth | . | Every culture drew it. Nobody agreed to.
ghost     | GHOST     | myth | . | Memory that refused to be filed.
vampire   | VAMPIRE   | myth | s | Old money with a bad diet.
werewolf  | WEREWOLF  | myth | s | The part of you the moon knows about.
witch     | WITCH     | myth | . | Usually just a woman who knew something.
potion    | POTION    | myth | . | Medicine that skipped the paperwork.
spell     | SPELL     | myth | . | Say it right and it happens.
magic     | MAGIC     | myth | . | Anything you can't take apart yet.
unicorn   | UNICORN   | myth | s | Nobody has ever caught one. Suspicious.
mermaid   | MERMAID   | myth | s | Sailors were lonely and the sea is a liar.
golem     | GOLEM     | myth | s | The first robot had a name in its mouth.
phoenix   | PHOENIX   | myth | s | It came back from what was left.
prophecy  | PROPHECY  | myth | . | A guess with a costume.

# ─── ABYSS ──────────────────────────────────────────────────────────────────
hell      | HELL      | abyss | m | Somebody built a prison for the dead.
demon     | DEMON     | abyss | . | It remembers being something else.
devil     | THE DEVIL | abyss | m | The one who took the promotion.
underworld| UNDERWORLD| abyss | . | Downriver, and no ferryman takes cash.
contract  | CONTRACT  | abyss | . | The fine print was always the point.
bargain   | BARGAIN   | abyss | . | You will get exactly what you asked for.
possession| POSSESSION| abyss | . | Somebody else is driving.
damnation | DAMNATION | abyss | . | The door locks from the outside.
plague    | PLAGUE    | abyss | . | Death, working in volume.
famine    | FAMINE    | abyss | . | The year the ground said no.
apocalypse| APOCALYPSE| abyss | . | Everybody's last day, scheduled together.
sinner    | SINNER    | abyss | . | Which is to say: everyone.
redemption| REDEMPTION| abyss | . | The expensive kind of sorry.
torment   | TORMENT   | abyss | . | Pain that learned patience.

# ─── CHAOS ──────────────────────────────────────────────────────────────────
chaos     | CHAOS     | chaos | m | The default setting. Order is the weird part.
ruin      | RUIN      | chaos | . | Everything you built is a future rock.
destruction| DESTRUCTION | chaos | . | Faster than building. Always was.
noise     | NOISE     | chaos | . | Signal, with nobody home.
glitch    | GLITCH    | chaos | . | A seam, showing.
mistake   | MISTAKE   | chaos | . | The most productive thing you'll do today.
accident  | ACCIDENT  | chaos | . | Nobody meant it. It happened anyway.
virus     | VIRUS     | chaos | . | An idea that only wants more of itself.
static    | STATIC    | chaos | . | The universe, clearing its throat.
collapse  | COLLAPSE  | chaos | . | It was fine. Then it was not, all at once.

# ─── COSMOS ─────────────────────────────────────────────────────────────────
time      | TIME      | cosmos | m | It was here before the clock and will outlast it.
star      | STAR      | cosmos | . | There are others. That should have been the headline.
space     | SPACE     | cosmos | . | Mostly this. Everything else is a rounding error.
planet    | PLANET    | cosmos | . | A rock that got lucky.
gravity   | GRAVITY   | cosmos | . | The quietest tyrant.
meteor    | METEOR    | cosmos | . | Mail from very far away.
galaxy    | GALAXY    | cosmos | . | A hundred billion suns, filed under one word.
universe  | UNIVERSE  | cosmos | m | All of it. So far.
blackhole | BLACK HOLE| cosmos | . | A star that stopped taking questions.
singularity| SINGULARITY | cosmos | . | Where the math throws up its hands.
bigbang   | BIG BANG  | cosmos | m | The loudest thing that ever happened, in total silence.
eternity  | ETERNITY  | cosmos | . | Time that stopped bargaining.
void      | VOID      | cosmos | . | The part that never agreed to any of this.
entropy   | ENTROPY   | cosmos | . | Everything is on its way to being dust.
atom      | ATOM      | cosmos | . | We cut it until only numbers were left.
nuclear   | NUCLEAR   | cosmos | . | We found the seam and pulled.
plasma    | PLASMA    | cosmos | . | Most of the universe is in this state. Not you.
origin    | ORIGIN    | cosmos | s | Something had to be first. Nothing volunteered.
loop      | LOOP      | cosmos | s | Again.
nothing   | NOTHING   | cosmos | s | You made nothing. On purpose. Well done.

# ─── RIZO ───────────────────────────────────────────────────────────────────
rizo      | RIZO      | rizo | m | Made it before I knew how. That was the whole point.
rizoember | RIZO EMBER| rizo | . | The one that started it. Still warm.
rizoblue  | RIZO BLUE | rizo | . | Colder. Still on fire.
rizoroot  | RIZO ROOT | rizo | . | It went underground and came back better.
rizoghost | RIZO GHOST| rizo | . | You've seen it. You can't prove it.
rizologo  | RIZO LOGO | rizo | m | You already knew what it looked like.
rizotee   | RIZO TEE  | rizo | . | It exists. You can wear it.
rizodrop  | RIZO DROP | rizo | . | Eleven minutes. Set an alarm.
nofamous  | NO FAMOUS | rizo | m | Known by the right people. Nobody else's business.
sellout   | SELLOUT   | rizo | . | Everybody's price is a rumour until it isn't.
scene     | SCENE     | rizo | . | It stopped being yours the second it worked.
rizoworld | RIZO WORLD| rizo | m | The brand outgrew the shirt.
rizosignal| RIZO SIGNAL | rizo | . | Broadcast by nobody. Received by everybody.
diy       | DIY       | rizo | . | Nobody was coming. So.
sovereign | SOVEREIGN | rizo | . | No throne. Still in charge.
blueprint | BLUEPRINT | rizo | . | Drawn after the building went up.
echo      | ECHO      | rizo | s | It answered itself. That is not supposed to happen.

# ─── RELIC ──────────────────────────────────────────────────────────────────
pittsburgh| PITTSBURGH| relic | s | Three rivers, four hundred bridges, one attitude.
four12    | 412       | relic | s | It's just a number. It's not just a number.
incline   | INCLINE   | relic | s | The hill was there first. We negotiated.
blackgold | BLACK AND GOLD | relic | s | Somebody's colours. You know whose.
basement  | BASEMENT  | relic | s | Where every good idea gets built badly first.
garage    | GARAGE    | relic | s | Half of everything started in one.
mixtape   | MIXTAPE   | relic | s | Somebody spent four hours saying one thing.
sticker   | STICKER   | relic | s | Cheapest way to claim territory.
sharpie   | SHARPIE   | relic | s | Permanent, allegedly.
flyer     | FLYER     | relic | s | Stapled to a pole. Still working.

# ─── META ───────────────────────────────────────────────────────────────────
player    | PLAYER    | meta | s | Hi.
fourthwall| FOURTH WALL | meta | s | You are the one holding it up.
savefile  | SAVE FILE | meta | s | Everything you are, in a browser, on one machine.
you       | YOU       | meta | s | Yeah. You.
rizobuiltrizo | RIZO BUILT RIZO | meta | m | Wait a second.
thematch  | THE MATCH | meta | m | Somebody had to strike the first one.
`;
