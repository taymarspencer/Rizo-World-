/* RIZO ORIGIN — achievements.
   kind: 'own'   need:[ids]        every id discovered
         'count' n:number          n counted elements discovered
         'groups' n:number         n domains opened
         'domain'                  any single domain finished
         'secrets' n:number        n secret discoveries
         'flag'  flag:'name'       raised by the engine
         'stat'  stat:'x' n:number a statistic reaches n
         'complete'                every counted element found
   hidden: true → name and description stay redacted until earned. */
window.RIZO_ACHIEVEMENTS = [
  { id:'firstcontact', name:'FIRST CONTACT',      desc:'Make something that was not there before.', kind:'count', n:5 },
  { id:'notenough',    name:'FOUR IS NOT ENOUGH', desc:'Get to twenty discoveries.',                kind:'count', n:20 },
  { id:'somewhere',    name:'GETTING SOMEWHERE',  desc:'Get to fifty discoveries.',                 kind:'count', n:50 },
  { id:'collector',    name:'COLLECTOR',          desc:'Get to a hundred and twenty.',              kind:'count', n:120 },
  { id:'archivist',    name:'ARCHIVIST',          desc:'Get to two hundred and fifty.',             kind:'count', n:250 },
  { id:'cartographer', name:'CARTOGRAPHER',       desc:'Open fifteen domains.',                     kind:'groups', n:15 },
  { id:'curator',      name:'CURATOR',            desc:'Finish a whole domain.',                    kind:'domain' },
  { id:'stoneage',     name:'STONE AGE',          desc:'Tool, blade, wheel, house.', kind:'own', need:['tool','blade','wheel','house'] },
  { id:'dressed',      name:'DRESSED',            desc:'Clothing, shirt, shoe, denim.', kind:'own', need:['clothing','shirt','shoe','denim'] },

  { id:'sparkoflife',  name:'SOMETHING IN THE WATER', desc:'Start it.',        kind:'own', need:['life'] },
  { id:'itwalks',      name:'IT MOVED ON ITS OWN',    desc:'Make the first animal.', kind:'own', need:['animal'] },
  { id:'keptthefire',  name:'THE MONKEY KEPT THE FIRE', desc:'Make us.',       kind:'own', need:['human'] },
  { id:'inthere',      name:'THERE IS AN INSIDE NOW',  desc:'Make a thought.', kind:'own', need:['thought'] },
  { id:'stoppedwalking',name:'WE STOPPED WALKING',    desc:'Build the first village.', kind:'own', need:['village'] },
  { id:'whileyousleep',name:'IT WORKS WHILE YOU SLEEP', desc:'Build the engine.', kind:'own', need:['engine'] },
  { id:'allatonce',    name:'EVERYONE, ALL AT ONCE',  desc:'Build the internet. Sorry.', kind:'own', need:['internet'] },
  { id:'secondfire',   name:'THE SECOND USE OF FIRE', desc:'Tell the first story.', kind:'own', need:['story'] },
  { id:'watching',     name:'SOMETHING IS WATCHING',  desc:'Put somebody in charge of the sky.', kind:'own', need:['god'] },

  { id:'selfcombo',    name:'IT TOUCHED ITSELF',   desc:'Combine something with itself and get away with it.', kind:'flag', flag:'selfcombo' },
  { id:'stubborn',     name:'IT WILL WORK THIS TIME', desc:'Try the same doomed pair six times.', kind:'flag', flag:'stubborn', hidden:true },
  { id:'nohelp',       name:'NOBODY HELPED',       desc:'Reach a hundred and fifty discoveries without a single hint.', kind:'flag', flag:'nohelp', hidden:true },
  { id:'grinder',      name:'ONE MORE',            desc:'Six hundred attempts. Look at you.', kind:'stat', stat:'attempts', n:600, hidden:true },

  { id:'downstairs',   name:'DOWNSTAIRS',          desc:'Find out where they put the dead.', kind:'own', need:['hell'], hidden:true },
  { id:'promotion',    name:'HE TOOK THE PROMOTION', desc:'Find the one in charge down there.', kind:'own', need:['devil'], hidden:true },
  { id:'seven',        name:'THE SEVEN',           desc:'Collect the full set. All of them.', kind:'own', need:['pride','greed','lust','envy','gluttony','wrath','sloth'], hidden:true },
  { id:'horsemen',     name:'FOUR HORSEMEN',       desc:'War. Famine. Plague. Death.', kind:'own', need:['war','famine','plague','death'], hidden:true },
  { id:'thevoid',      name:'IT STARES BACK',      desc:'Make nothing, on purpose.', kind:'own', need:['nothing'], hidden:true },
  { id:'ghostmachine', name:'HI',                  desc:'Find the one holding the phone.', kind:'own', need:['player'], hidden:true },

  { id:'madeit',       name:'MADE IT BEFORE I KNEW HOW', desc:'Find RIZO.', kind:'own', need:['rizo'] },
  { id:'themark',      name:'YOU ALREADY KNEW',    desc:'Find the mark.', kind:'own', need:['rizologo'] },
  { id:'fourfaces',    name:'FOUR FACES',          desc:'Ember. Blue. Root. Ghost.', kind:'own', need:['rizoember','rizoblue','rizoroot','rizoghost'], hidden:true },
  { id:'nofamous',     name:'NO FAMOUS',           desc:'Refuse the obvious thing.', kind:'own', need:['nofamous'], hidden:true },
  { id:'earlyrizo',    name:'AHEAD OF SCHEDULE',   desc:'Find RIZO before two hundred discoveries.', kind:'flag', flag:'earlyrizo', hidden:true },
  { id:'whomadewho',   name:'WHO MADE WHO?',       desc:'Close the loop.', kind:'own', need:['rizobuiltrizo'], hidden:true },
  { id:'strike',       name:'STRIKE',              desc:'Light the first one.', kind:'own', need:['thematch'], hidden:true },

  { id:'threerivers',  name:'THREE RIVERS',        desc:'Find the city that was not on the map.', kind:'own', need:['pittsburgh'], hidden:true },
  { id:'areacode',     name:'AREA CODE',           desc:'It is just a number.', kind:'own', need:['four12'], hidden:true },
  { id:'deepcut',      name:'DEEP CUT',            desc:'Find ten things that were not supposed to be findable.', kind:'secrets', n:10, hidden:true },
  { id:'anomalist',    name:'ANOMALIST',           desc:'Find twenty of them.', kind:'secrets', n:20, hidden:true },
  { id:'everything',   name:'EVERYTHING',          desc:'All of it. Every single one.', kind:'complete', hidden:true }
];
