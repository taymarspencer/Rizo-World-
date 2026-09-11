/* RIZO ORIGIN — landmark, anomaly and identity plates.
   These are the pictures a player is most likely to remember. They deliberately
   use larger compositions than the inventory glyphs while staying inside the
   same two-ink screen-print language. */
(() => {
'use strict';
const I='currentColor', A='var(--art-accent)', W='var(--art-paper)';
const P=(d,f=I,op=1)=>`<path d="${d}" fill="${f}" opacity="${op}"/>`;
const L=(d,w=1,c=I,op=1)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const C=(x,y,r,f=I,op=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" opacity="${op}"/>`;
const E=(x,y,rx,ry,f='none',s=I,w=1,op=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${w}" opacity="${op}"/>`;
const G=(body,t)=>`<g transform="${t}">${body}</g>`;
const T=(txt,x,y,size=10,c=I,anchor='middle')=>`<text x="${x}" y="${y}" fill="${c}" font-size="${size}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-weight="800" text-anchor="${anchor}" letter-spacing="1">${txt}</text>`;
const hatch=(x,y,n=5,dx=4)=>Array.from({length:n},(_,i)=>L(`M${x+i*dx} ${y}l-5 7`,.7,I,.55)).join('');
const star=(x,y,s=1,c=A)=>G(P('M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z',c),`translate(${x} ${y}) scale(${s})`);
const mark=(x=9,y=5,s=1.45,c=A)=>{
  const M=window.RIZO_MARK;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><path d="${M.body}" fill-rule="evenodd"/><path d="${M.eyeL}"/><path d="${M.eyeR}"/><path d="${M.mouth}"/></g>`;
};
const plate={};

/* LIFE / BEAST / HUMAN */
plate.weed=P('M31 58V31',I)+P('M31 34C18 30 9 20 10 10c12 2 19 9 21 20C32 18 39 7 50 5c1 12-5 22-17 29 12-3 20 2 24 9-10 3-17 1-24-6-4 11-12 15-22 14 1-10 8-16 20-18Z',A)+L('M31 31L16 17m16 13 13-15M31 38 16 44m17-6 14 7',1.1,W)+hatch(20,53,4);
plate.dna=L('M18 6C48 18 48 46 18 58M46 6C16 18 16 46 46 58',2,A)+L('M20 12h24M16 21h32M15 31h34M16 41h32M20 51h24',1.1,I)+C(18,6,2,I)+C(46,58,2,I)+L('M7 14l7-5m36 46 7-5',.8,A);
plate.cactus=P('M25 58V20q0-10 7-10t7 10v12l5-3V19h7v18q0 7-12 7v14Z',A)+P('M25 31l-5-4V17h-7v16q0 9 12 10Z',I)+L('M31 17v35M38 36h8M18 25v11',1,W)+L('M12 58h40M21 9l-2-5m24 6 2-5M52 31l6-2',.8,I);
plate.animal=P('M8 44q4-17 19-19 8-11 19-5 10 6 8 23-3 13-16 17H20Q6 58 8 44Z',A)+P('M25 25l-7-12 12 7m14 0 9-10-2 16Z',I)+C(26,35,2,W)+C(44,33,2,W)+L('M27 45q7 5 14 0M18 52l-4 7m33-7 4 7',1.1,I);
plate.dog=P('M12 46C14 32 20 26 28 24L19 11L34 18L45 10L48 26C56 33 57 43 53 49C49 57 39 59 30 58C19 58 12 54 12 46Z',A)+P('M17 17L7 13L14 32ZM48 13L58 7L54 32Z',I)+C(28,33,2,W)+C(45,31,2,W)+P('M34 39L40 38L38 43Z',I)+L('M25 48Q34 54 43 47',1.1,I)+L('M17 58H50',.8,I);
plate.rat=P('M9 45C10 34 16 28 26 25C31 14 36 17 41 19C49 23 52 32 52 39C58 41 62 47 60 54C52 58 42 58 34 55C23 57 14 53 9 45Z',I)+C(41,19,7,A)+C(21,24,5,A)+C(45,33,1.6,W)+L('M52 39Q62 43 60 53M52 37L60 35M52 43L60 45',.8,A)+P('M12 51L7 58H18Z',A);
plate.mosquito=L('M31 12v35M31 19 15 9M31 21 49 8M29 30 9 25M33 31 55 25M30 45 20 57M33 44 45 58',1.5,I)+P('M28 10q3-7 6 0l-1 19h-4Z',A)+E(20,24,11,6,'none',A,1.3)+E(43,23,12,6,'none',A,1.3)+L('M33 47l4 9',1,A)+C(31,32,3,I);
plate.twin=P('M8 53V31q0-10 10-10t10 10v22Z',I)+P('M36 53V31q0-10 10-10t10 10v22Z',A)+C(18,14,7,I)+C(46,14,7,A)+L('M28 22l8 0M31 18v9M13 38h10m18 0h10',1,W)+L('M5 58h54',.8,I);

/* SOCIETY / CRAFT / MACHINE */
plate.village=P('M5 54h54v5H5Z',I)+P('M8 35 19 24l11 11v19H8Zm28-7 10-10 12 10v26H36Z',A)+P('M18 13 26 5l7 9-7 8Z',I)+P('M13 42h8v12h-8Zm29-5h8v8h-8Z',W)+L('M7 30l12-11 13 11m2-6 12-11 14 12',1.2,I)+L('M23 54V39h5v15',1,W);
plate.wood=P('M8 15q23-9 48 2l-4 34q-19 8-43 1Z',A)+E(34,34,17,12,'none',I,2)+E(34,34,9,6,'none',I,1.3)+L('M10 23l12 2m27-6 5 5M12 45l12-3m23 7 6-5',1,I)+C(34,34,2,I)+hatch(13,55,8,5);
plate.ink=P('M28 7h9l2 8 9 10-5 29H18l-4-29 11-10Z',I)+P('M18 33q13-7 27 0l-2 18H20Z',A)+P('M28 7l-2 9h13l-2-9Z',W)+L('M22 25h20M24 42q8 3 16 0',1,W)+P('M48 47q8 7 0 12-8-5 0-12Z',A);
plate.engine=P('M8 27h9l5-9h23l5 8h8v24h-9l-3 7H20l-4-7H8Z',I)+C(33,37,10,W)+C(33,37,6,A)+P('M22 18l3-8h16l3 8Z',A)+L('M5 34h8m38-1h9M17 52l-5 6m37-6 6 5',1.1,A)+L('M26 37h14M33 30v14',1,I);
plate.computer=P('M7 10h50v34H7Z',I)+P('M11 14h42v26H11Z',W)+P('M14 17h36v20H14Z',A,.22)+L('M19 23l5 5-5 5m9 0h12',1.4,I)+P('M27 44h10l3 8h8v5H16v-5h8Z',I)+L('M12 58h41',.8,A);
plate.ai=P('M12 14h40v36H12Z',A)+C(24,28,3,W)+C(40,28,3,W)+L('M21 39q11 7 22 0',1.4,W)+L('M7 21h5m40 0h6M7 42h5m40 0h6M20 9v5m12-8v8m12-5v5M22 50v7m10-7v9m10-9v7',1,I)+P('M28 19h8v4h-8Z',I);

/* MONEY / CULTURE / STYLE / VICE */
plate.trade=P('M5 21h37l-7-7 4-4 15 14-15 14-4-4 7-7H5ZM59 44H22l7 7-4 4L10 41l15-14 4 4-7 7h37Z',A)+L('M10 24h33M54 41H21',1,I)+C(15,14,2,I)+C(49,52,2,I);
plate.story=P('M7 15q13-7 25 2 12-9 25-2v37q-14-5-25 4-12-9-25-4Z',W)+L('M32 18v38M11 21q10-4 17 1m-17 7q9-3 17 1m-17 7q9-3 17 1m8-17q9-4 17-1m-17 8q9-3 17-1m-17 8q9-3 17-1',.9,I)+star(49,14,.6,A)+L('M7 11l6-5M55 8l3 6',.8,A);
plate.art=P('M11 50C15 30 21 17 33 11C45 13 53 20 54 30C55 38 50 43 46 43C41 44 39 40 34 38C29 40 27 47 24 53C20 60 13 58 11 50Z',A)+C(25,23,4,W)+C(37,18,3,W)+C(45,29,3,W)+C(28,38,3,W)+P('M12 50L22 44L31 52L25 59L7 57Z',I)+L('M8 13L16 17M50 9L45 16M52 48L59 52',1,I);
plate.clothing=P('M22 10 31 15 41 10 56 22 49 32 43 27 42 57H20l-1-30-6 6L7 22Z',I)+P('M25 11q7 9 14 0l-2 11H27Z',A)+L('M19 28h23M23 39h16M24 47h14',1,W)+L('M9 55l7-5m32 4 7 4',.8,A);
plate.alcohol=P('M19 8h26l-2 14q-2 12-8 17v13h10v6H19v-6h10V39q-9-7-10-17Z',W)+P('M21 20h20q-1 11-10 16-8-5-10-16Z',A)+L('M19 8h26M28 42h7',1.2,I)+L('M11 12l5 5m32-5 5-5M50 45l8 2',.8,A);

/* ABYSS / CHAOS */
plate.hell=P('M8 58V37Q8 13 32 6q24 9 24 31v21Z',I)+P('M15 58V38q0-17 17-24 17 7 17 24v20Z',A)+P('M24 57V39q0-8 8-12 8 4 8 12v18Z',W)+L('M18 17l-6-9M46 17l7-10M12 30 6 27m46-28-6 28',1.2,A)+P('M27 43l5-6 5 6-2 14h-6Z',I);
plate.chaos=P('M31 3 38 19 55 9 48 28 62 34 45 39 53 58 35 47 28 62 23 45 5 55 14 37 2 27 20 24Z',A)+L('M8 8l48 48M55 6 9 58M4 33h56M32 5v54',1.1,I,.55)+C(32,33,6,W)+C(32,33,2,I)+L('M12 14l8 3m24-4 8-3M9 48l9-4m30 3 8 5',.8,I);

/* COSMOS */
plate.time=E(32,32,23,26,W,I,1.4)+C(32,32,3,A)+L('M32 11v21l13 8',2,A)+L('M16 13l4 6m28-5-5 6M9 33h7m32 0h7M18 52l4-7m22 7-4-7',1,I)+L('M8 8l5 3M52 7l5 3',.7,A);
plate.bigbang=P('M32 2 36 22 49 7 43 25 61 18 47 31 63 39 44 38 52 57 36 44 31 63 26 44 10 57 18 38 1 40 16 30 2 20 21 25Z',A)+C(32,32,7,W)+C(32,32,2,I)+L('M32 32 10 11M32 32 55 10M32 32 58 49M32 32 8 54',1.2,I)+star(12,31,.5,I)+star(50,33,.45,I);
plate.origin=E(32,32,25,25,'none',A,1.2)+E(32,32,16,16,'none',I,.8)+E(32,32,7,7,A,'none',0)+C(32,32,2,W)+L('M32 2v11m0 38v11M2 32h11m38 0h11M10 10l8 8m28 28 8 8M54 10l-8 8M18 46l-8 8',.8,I)+T('0',32,36,8,W);
plate.loop=L('M15 19q17-17 34 0l-6-1 2-6 10 10-12 6 2-6q-13-12-26 0-16 16 2 25 5 10 16 10 23 0 29-9',2,A)+L('M49 46q-17 17-34 0l6 1-2 6L9 43l12-6-2 6q13 12 26 0',1.2,I)+C(32,32,3,W);

/* NETWORK */
plate.notfound=P('M8 10h48v44H8Z',W)+L('M12 18h40M12 47h40',1,A)+T('404',32,37,16,A)+L('M16 12l4 4m28-4-4 4M16 52l5-5m27 5-5-5',.8,I);

/* RIZO */
plate.rizologo=mark(8,3,1.5,A)+E(32,33,26,27,'none',I,.8,.45)+L('M8 53l8-5m39-35-8 5M7 20l5 2m40 30 6 2',.9,I);
plate.nofamous=star(32,29,2.8,A)+L('M10 52 54 8',4,I)+L('M8 54 52 10',1,A)+P('M10 13h12l-5-5m5 5-5 5M42 50h12l-5-5m5 5-5 5',I);
plate.rizoworld=E(32,33,25,20,'none',I,1.2)+L('M8 33h48M32 13q-12 20 0 40M32 13q12 20 0 40',.8,A)+mark(20,20,.75,A)+L('M12 18l-5-7M53 17l5-6M10 50l-5 7m47-8 6 6',.8,I);
plate.echo=mark(5,10,.85,A)+G(mark(5,10,.85,I),'translate(27 0) scale(.72)')+G(mark(5,10,.85,A),'translate(40 8) scale(.45)')+L('M23 28q8-8 16 0m-13 8q6-5 12 0',1.1,I)+L('M8 56h47',.7,A);

/* RELIC */
plate.pittsburgh=P('M5 52h54v7H5Z',I)+P('M8 39q10-20 24 0 12-21 25 0v13H8Z',A)+L('M8 39h49M13 39v13m38-13v13M17 36q7-11 15 0m5 0q7-12 14 0',1,W)+P('M19 22h7v8h-7Zm20-4h7v12h-7Z',I)+L('M4 30l9-5M53 26l7 5',.8,I);
plate.four12=T('412',32,39,20,A)+L('M8 12l9 6M48 10l8 6M8 51l9-5m31 8 8-6',1,I)+P('M5 23h8v18H5Zm46 0h8v18h-8Z',I)+L('M16 48h31',.8,A);
plate.incline=P('M7 50 48 10l8 8-41 41Z',A)+P('M19 38h23l7 13H8Z',I)+P('M23 41h7v6h-7Zm11 0h7v6h-7Z',W)+L('M5 55 55 7M13 55h45',1.1,I)+C(17,53,3,A)+C(43,53,3,A);
plate.blackgold=P('M7 12h50v40H7Z',I)+P('M11 16h42v32H11Z',A)+P('M11 16 53 48H42L11 26ZM53 16 11 48H23l30-23Z',W)+L('M8 56h48',.8,A);
plate.basement=P('M9 21h46v37H9Z',I)+P('M15 28h34v30H15Z',W)+P('M26 37h13v21H26Z',A)+L('M5 21 32 7l27 14M15 45h11m13 0h10',1.1,A)+L('M19 33l4 4m24-4-4 4',.8,I);
plate.garage=P('M6 26 32 9l27 17v32H6Z',I)+P('M12 31h40v27H12Z',W)+L('M14 36h36M14 43h36M14 50h36',1,A)+P('M22 19h20l5 7H17Z',A)+C(21,54,2,I)+C(43,54,2,I);
plate.mixtape=P('M7 15h50v34H7Z',W)+P('M11 19h42v11H11Z',I)+E(21,40,7,7,'none',A,2)+E(43,40,7,7,'none',A,2)+L('M28 40h8M16 22h25',1,I)+L('M10 53l44 4',.8,A);
plate.sticker=P('M12 8h39l4 35-13 13H12Z',W)+P('M42 56V42h13Z',A)+mark(14,13,1.02,A)+L('M8 12l5-4m40 2 5 6M8 48l5 6',.8,I);
plate.sharpie=P('M14 47 42 8l9 7-28 39Z',I)+P('M42 8l7-5 8 7-6 5Z',A)+P('M14 47 6 59l17-5Z',A)+L('M20 42 47 7',1,W)+L('M11 20l8-4m27 36 9-4',.8,A);
plate.flyer=P('M11 7 52 12 48 57 7 51Z',W)+P('M17 16h28v11H17Z',A)+L('M17 33h25M15 39h29M14 45h20',1,I)+star(42,47,.7,A)+L('M7 10l6-5m38 5 6 5M8 55l6 5',.8,I);

/* META */
plate.player=P('M13 8h38l7 40-14 9-10-9-8 9-14-9Z',W)+P('M19 22h26v16H19Z',I)+C(26,30,3,A)+C(38,30,3,A)+L('M20 42q12 7 24 0',1.2,A)+L('M8 18l5 3m38-3 6-4',.8,I);
plate.fourthwall=P('M8 9h48v46H8Z',I)+P('M13 14h16v36H13Zm23 0h15v36H36Z',W)+L('M32 7v50',3,A)+P('M27 27l5-5 5 5-5 5Z',A)+L('M4 21l8 3m40-3 8-3M5 47l8-3m39 2 8 4',.8,A);
plate.savefile=P('M10 6h40l8 8v44H10Z',W)+P('M17 8h25v16H17Z',I)+P('M21 11h14v10H21Z',A)+P('M18 35h32v20H18Z',A)+L('M23 40h22m-22 6h17',1,W)+L('M8 16 4 12m48 44 6 4',.8,I);
plate.you=E(32,29,15,18,W,I,1.2)+P('M18 54q14-13 28 0Z',I)+C(27,27,2,A)+C(38,27,2,A)+L('M26 38q6 4 12 0',1.1,A)+L('M32 4v6M7 29h8m34 0h8M14 10l6 7m30-7-6 7',.9,A)+T('YOU',32,62,6,A);
plate.rizobuiltrizo=mark(3,8,.95,A)+G(mark(3,8,.95,I),'translate(29 0)')+L('M19 17q13-10 25 0l-5-1 2-5 8 8-10 5 1-5q-8-6-17 0M45 49q-13 10-25 0l5 1-2 5-8-8 10-5-1 5q8 6 17 0',1.1,A)+C(32,33,2,W);
plate.thematch=P('M28 57h8V22h-8Z',W)+P('M32 4C44 15 44 24 33 29 20 25 20 15 32 4Z',A)+P('M32 12q6 8 1 13-7-3-1-13Z',W)+L('M28 31h8M26 58h12',1,I)+L('M11 15l8 5M51 14l-8 6M14 45l8-3m28 4-8-4',.9,A)+mark(23,5,.28,I);

Object.assign(window.RIZO_PLATES ||= {}, plate);
})();
