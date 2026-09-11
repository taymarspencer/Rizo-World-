/* RIZO ORIGIN — style, culture and deep-domain plates.
   These are the branches where a generic symbol hurts the fantasy most, so
   they get their own authored two-ink drawings rather than derived glyphs. */
(() => {
'use strict';
const I='currentColor', A='var(--art-accent)', W='var(--art-paper)';
const P=(d,f=I,op=1)=>`<path d="${d}" fill="${f}" opacity="${op}"/>`;
const L=(d,w=1,c=I,op=1)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
const C=(x,y,r,f=I,op=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" opacity="${op}"/>`;
const E=(x,y,rx,ry,f='none',s=I,w=1,op=1)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="${w}" opacity="${op}"/>`;
const G=(body,t)=>`<g transform="${t}">${body}</g>`;
const T=(txt,x,y,size=10,c=I,anchor='middle')=>`<text x="${x}" y="${y}" fill="${c}" font-size="${size}" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-weight="900" text-anchor="${anchor}" letter-spacing="1">${txt}</text>`;
const H=(x,y,n=5,dx=4)=>Array.from({length:n},(_,i)=>L(`M${x+i*dx} ${y}l-5 7`,.7,I,.52)).join('');
const star=(x,y,s=1,c=A)=>G(P('M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z',c),`translate(${x} ${y}) scale(${s})`);
const mark=(x=9,y=6,s=1.42,c=A)=>{ const M=window.RIZO_MARK; return `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}"><path d="${M.body}" fill-rule="evenodd"/><path d="${M.eyeL}"/><path d="${M.eyeR}"/><path d="${M.mouth}"/></g>`; };
const plate={};

/* ── RIZO — every one of these should feel like a mutation of the mark. ── */
plate.rizoember=P('M8 52q10-15 24-15t24 15-11 7H19Z',I)+mark(20,7,.76,A)+P('M28 38q-7 10 4 18 12-8 3-18-2 8-7 10 5-15-3-10Z',A)+L('M12 54h40M18 48l5-3m22 1 5 3',.9,W);
plate.rizoblue=mark(8,4,1.5,A)+P('M8 48q12-8 24 0t24 0v10H8Z',A,.28)+L('M6 50q13-9 26 0t26 0M11 55q10-6 21 0t21 0',1.1,I)+C(53,11,2,A);
plate.rizoroot=mark(11,2,1.32,A)+L('M31 43v7m0 0-12 9m12-9 13 9m-13-7-4 8m4-8 5 8M19 54l-6 5m31-5 7 4',1.7,I)+P('M26 45h12l-2 8h-8Z',A)+H(8,57,4,6);
plate.rizoghost=G(mark(10,2,1.33,I),'translate(0 1)')+P('M18 43q-4 10 2 17l7-6 6 6 6-6 7 6q4-10-1-18Z',A,.35)+L('M16 44q17 10 33-1M11 14l-5 4m47-4 6 4',1,A)+C(8,49,1,A)+C(55,51,1,A);
plate.rizotee=P('M20 9 31 14 42 9l15 12-8 11-7-6v32H20V26l-7 6-8-11Z',I)+P('M24 12q8 8 16 0l-3 11H27Z',A)+G(mark(18,21,.65,A),'')+L('M19 46h24M10 55l7-4m30 4 7 3',.8,W);
plate.rizodrop=P('M9 24 31 12l24 12-4 29-20 8-22-8Z',I)+P('M9 24l22 12 24-12-24-12Z',A)+P('M14 28l17 9v18l-17-6Z',W)+G(mark(26,33,.42,A),'')+L('M31 36v20M20 18l22 12',1,W);
plate.sellout=P('M10 8h44v48H10Z',W)+G(mark(15,12,1.04,A),'')+L('M6 53 58 11',4,I)+L('M8 55 60 13',1,A)+T('SOLD',32,56,7,I)+L('M9 8l6-5m39 4 5 5',.8,A);
plate.scene=P('M5 52q5-16 14-16t14 16H5Zm26 0q5-20 15-20t13 20Z',I)+C(19,28,6,A)+C(46,24,7,A)+mark(22,5,.55,A)+star(9,16,.55,I)+star(56,14,.45,I)+L('M5 58h54',.8,A);
plate.rizosignal=mark(19,15,.75,A)+L('M13 41q19 18 38 0M8 47q24 24 48 0M19 35q13 11 26 0',1.5,I)+C(32,45,2,A)+L('M32 45v12',1.3,A);
plate.diy=P('M9 49 24 34l6 6-15 15Z',A)+P('M24 34 44 14l7 7-20 20Z',I)+P('M42 12q8-9 14 0l-7 6Z',A)+L('M11 18l12 11M8 24l10 8M38 50l14-14M43 55l12-12',1.1,I)+T('DIY',42,60,7,A);
plate.sovereign=P('M8 48 13 16l14 13 6-20 8 20 14-13 2 32Z',A)+P('M13 39h42v15H13Z',I)+C(32,42,5,W)+G(mark(27,36,.3,A),'')+L('M9 56h47M17 20l-4-8m38 9 5-8M32 8V3',1,I);
plate.blueprint=P('M8 7h48v50H8Z',A)+L('M13 14h38M13 22h20m6 0h12M13 48h38M18 12v38m18-38v38',.7,W,.7)+G(mark(21,18,.72,W),'')+L('M13 55l42-42',.9,I,.6)+T('01',47,53,6,W);

/* ── STYLE ─────────────────────────────────────────────────────────────── */
plate.trend=L('M7 51 20 38 30 42 52 16',2,A)+P('M43 15h11v11l-4-4-16 17-5-5 15-15Z',I)+L('M8 57h49M11 52V16',.9,I)+H(15,56,7,6);
plate.style=P('M18 8q14 8 28 0l7 13-9 8-4 29H24l-4-29-9-8Z',I)+P('M25 12q7 9 14 0l-3 14H28Z',A)+L('M22 34q10 6 20 0M24 44q8 5 16 0',1,A)+star(47,12,.5,A);
plate.shirt=P('M20 8 31 14 42 8l16 13-9 11-7-6v32H20V26l-7 6-8-11Z',W)+P('M24 11q8 10 16 0l-3 13H27Z',A)+L('M20 37h22M24 48h14',1,I)+H(11,56,6,7);
plate.screenprint=P('M7 10h50v40H7Z',I)+P('M12 15h40v30H12Z',W)+G(mark(19,15,.75,A),'')+P('M12 46h40l-5 8H17Z',A)+L('M15 55h34M12 18l-5-5m45 5 6-4',.9,I);
plate.tee=P('M19 12 31 16 43 12l13 10-8 10-6-5v30H20V27l-6 5-7-10Z',A)+P('M25 14q7 8 14 0l-2 10H27Z',W)+L('M23 38h18M24 47h16',1,I);
plate.shoe=P('M7 41q12 1 18-15l8 12 16 5q8 2 9 11H8Z',I)+P('M23 31l8 10 20 6-5 5H13Z',A)+L('M27 35h8m-5 5h8m-25 8h37',1,W)+C(17,38,2,W);
plate.denim=P('M17 7h30l-3 51H32l-2-27-3 27H15Z',A)+L('M20 13h23M31 8v21M20 19l8 5m15-5-9 5M18 51l9-2m8 0 9 2',1,I)+P('M22 11h7v6h-7Zm13 0h7v6h-7Z',W);
plate.black=P('M8 8h48v48H8Z',I)+L('M12 14l7-4M48 11l5 4M12 51l8 3m28-2 5-5',1,A)+P('M18 22h28v20H18Z',A,.10)+T('BLACK',32,35,7,W);
plate.jewelry=E(32,29,18,20,'none',A,2)+P('M32 46 24 55l8 7 8-7Z',I)+L('M16 18l-6-7m38 7 6-7M22 12l4 5m16-5-4 5',1,I)+C(32,9,3,A);
plate.tattoo=P('M10 43q15-18 39-23l5 9q-21 4-34 22Z',W)+L('M15 43q14-15 34-18',1.2,I)+P('M26 37l7-12 5 9 10-3-8 8 2 10-9-6-9 5Z',A)+L('M8 55l46-45',1,I);
plate.drop=P('M18 7h28l10 16-24 35L8 23Z',A)+P('M18 7l14 51L8 23Z',I)+C(32,25,5,W)+L('M11 23h44M17 52l7 6m23-7-7 7',.9,W);
plate.soldout=P('M8 10h48v44H8Z',W)+T('SOLD',32,29,10,A)+T('OUT',32,43,10,A)+L('M5 54 59 8',3,I)+L('M7 56 61 10',.8,A);
plate.hype=P('M8 27h16l24-14v38L24 38H8Z',A)+P('M15 38l5 20h10l-6-20Z',I)+L('M51 20l7-6m-5 16h8m-10 9 7 6',1.5,I)+star(39,8,.45,I);
plate.bootleg=G(mark(7,6,1.3,A),'rotate(-7 32 32)')+G(mark(12,8,1.15,I),'rotate(8 32 32)')+T('??',50,56,8,A)+L('M7 10l8-5m36 2 6 6M8 54l7 5',1,I);

/* ── CULTURE ───────────────────────────────────────────────────────────── */
plate.rhythm=L('M8 35h7l4-13 7 27 7-35 7 25 5-12 4 8h7',2,A)+L('M8 52h49',.8,I)+C(11,17,2,I)+C(53,17,2,I);
plate.music=P('M25 11h24v8H31v26q-1 10-11 10-9 0-9-7 0-8 10-10 7 0 8 4V15h32v30q0 10-10 10-9 0-9-7 0-8 10-10 7 0 8 4Z',A)+L('M27 20h22',1,I);
plate.song=P('M9 13h39v32H20L9 55Z',W)+L('M15 22h26M15 29h20M15 36h24',1,I)+P('M43 9h8v28q0 8-8 8-7 0-7-6 0-7 8-8 5 0 7 3Z',A)+L('M51 14l7 4',1,I);
plate.dance=C(23,12,6,A)+C(43,14,5,I)+L('M23 19l7 15-13 12M29 29l14-9m0 0-4 16m4-16 10 14M30 34l7 22m-7-22-11 22',2,I)+L('M7 58h50',.8,A);
plate.beauty=P('M32 6 38 23 56 18 44 32 58 44 38 40 32 59 26 40 6 45 20 32 8 18 26 23Z',A)+E(32,32,13,9,W,I,1)+C(28,30,1.5,I)+C(37,30,1.5,I)+L('M27 36q5 4 10 0',1,I);
plate.poetry=P('M11 8h34l8 9v39H11Z',W)+L('M17 21h27M17 29h21M17 37h25M17 45h16',1,I)+P('M45 8v10h9Z',A)+P('M41 50q8-9 15-3-4 9-15 8Z',A)+L('M42 53l-7 6',1,I);
plate.joke=P('M8 12h48v34H37l-8 11-1-11H8Z',A)+C(22,27,3,W)+C(42,27,3,W)+L('M20 36q12 8 24 0',1.5,W)+L('M11 8l7-5m35 6 6-5',.8,I);
plate.book=P('M7 13q13-7 25 2 12-9 25-2v39q-14-5-25 4-12-9-25-4Z',W)+L('M32 16v40M11 20q10-4 17 0m-17 8q10-3 17 1m8-9q9-4 17-1m-17 9q9-3 17-1',1,I)+star(49,13,.45,A);
plate.library=P('M7 51h50v7H7Z',I)+P('M10 16h8v35h-8Zm11-7h9v42h-9Zm12 12h8v30h-8Zm11-9h10v39H44Z',A)+L('M12 22h4m7-6h5m7 12h4m7-9h6',1,W)+P('M8 8h49v5H8Z',W);
plate.symbol=P('M32 5 39 22 57 23 43 35 48 55 32 44 16 55 21 35 7 23 25 22Z',A)+E(32,32,11,11,W,I,1)+L('M24 32h16M32 24v16',1.2,I)+H(7,56,8,6);
plate.logo=P('M8 12h48v40H8Z',W)+P('M18 20h28v24H18Z',A)+L('M22 39 29 25l7 13 7-12',2,I)+C(49,15,2,I)+L('M7 8l7-5m43 4 4 6',.8,A);
plate.graffiti=P('M8 46C15 26 20 21 26 21C34 30 39 21 40 21C54 26 56 36 56 46C52 56 35 55 24 55C16 55 9 52 8 46Z',A)+L('M12 47Q26 39 51 43M15 37L25 24L33 39L44 21L49 40',2,W)+P('M7 55C20 49 27 57 33 56C43 53 50 54 59 54V60H7Z',I)+C(53,18,2,A);
plate.mask=P('M9 12q23-9 46 0l-3 26q-5 17-20 21-16-4-20-21Z',W)+P('M14 17q18-7 36 0l-2 18q-5 14-16 18-12-4-16-18Z',A,.3)+P('M17 25q7-7 13 0-7 8-13 0Zm17 0q7-7 13 0-7 8-13 0Z',I)+L('M24 42q8 5 16 0',1.2,I);
plate.fame=star(32,27,2.4,A)+L('M11 56 32 42 53 56M15 57h34',2,I)+C(11,14,2,I)+C(53,14,2,I)+L('M9 16l11 7m35-7-11 7',1,I);
plate.punk=P('M18 57 20 26 12 17 23 19 31 4 38 19 51 14 44 29 47 57Z',I)+P('M22 23 31 9 39 23 34 31Z',A)+C(26,39,2,W)+C(39,39,2,W)+L('M27 48h12',2,A)+L('M9 56h47',.8,A);

/* ── VICE ──────────────────────────────────────────────────────────────── */
plate.beer=P('M13 14h31v41H13Z',A)+P('M18 20h21v29H18Z',W)+P('M44 23h8q8 0 8 10v9q0 10-8 10h-8v-6h7q3 0 3-4V33q0-4-3-4h-7Z',I)+P('M12 13q3-9 8 0 6-10 10 0 6-7 10 2 8-4 7 8Z',W)+L('M23 25v19m9-19v19',1,A);
plate.cigarette=P('M7 28h40v9H7Z',W)+P('M47 28h10v9H47Z',A)+L('M13 31h28',1,I)+L('M55 23q7-7 0-13M49 22q5-5 0-10',1.1,I)+P('M4 27h4v11H4Z',I);
plate.party=star(16,18,.8,A)+star(48,15,.6,A)+P('M7 56 18 31l9 25Zm30 0 8-28 12 28Z',I)+L('M12 36l9 10m20-8 11 8',1.2,W)+C(32,18,3,I)+L('M31 5l1 7m-9-3 4 6m14-7-4 7',1,A);
plate.addiction=E(32,32,23,23,'none',A,2)+E(32,32,14,14,'none',I,2)+P('M27 16h10l-2 12 8 6-13 15 3-13-9-6Z',A)+L('M11 12l7 5m28-5-7 5M10 52l8-6m28 6-7-6',1,I);
plate.gambling=P('M8 14h48v36H8Z',W)+P('M13 19h16v26H13Zm22 0h16v26H35Z',I)+C(21,27,3,A)+C(43,36,3,A)+C(21,38,2,A)+C(43,26,2,A)+T('?',32,59,7,A);
plate.lust=P('M32 55C8 39 5 19 20 14q9-2 12 8 4-10 13-8 15 6 10 25-5 9-23 16Z',A)+P('M23 18q8 5 9 17 1-12 9-18-3 14-9 23-1-13-9-22Z',W)+L('M8 10l10 7m38-7-10 7',1,I);
plate.gluttony=P('M9 42q0-20 23-20t23 20q0 16-23 16T9 42Z',A)+P('M15 39h34q-2 12-17 12T15 39Z',W)+L('M21 16v-9m11 9V5m11 11V8',2,I)+C(23,36,2,I)+C(41,36,2,I);
plate.envy=E(32,31,24,16,W,I,1.5)+E(32,31,10,10,A,'none',0)+C(32,31,4,I)+P('M8 31 18 23l-3 8 3 9Z',A)+P('M56 31 46 23l3 8-3 9Z',A)+L('M12 51l9-5m31 5-9-5',1,I);
plate.sloth=P('M10 45q3-19 22-22t22 22v11H10Z',I)+P('M18 35q14-13 28 0v11H18Z',W)+L('M23 38h7m5 0h7M29 46h7',1.4,A)+P('M14 19q6-9 12 0-5 10-12 0Zm24 0q6-9 12 0-5 10-12 0Z',A)+T('Z',50,14,8,A);
plate.wrath=P('M32 4 38 18 52 10 47 27 61 33 45 40 51 58 34 48 25 61 22 43 6 52 15 35 4 27 20 23Z',A)+P('M21 27 29 34 23 42 17 36Zm26 0-8 7 6 8 7-7Z',I)+L('M23 49q9 5 18 0',2,I);
plate.sin=P('M32 6q18 9 21 28-2 17-21 24Q13 52 11 34 14 15 32 6Z',I)+P('M31 12q9 13 1 28-9-13-1-28Z',A)+L('M13 13l39 41M50 10l5 7M9 49l7 6',1.1,A);
plate.temptation=P('M32 10q17 0 21 15-3 20-21 32Q14 45 11 25 15 10 32 10Z',A)+P('M44 16q10-10 14-2-3 7-12 8Z',I)+P('M25 25q7-8 14 0-7 8-14 0Z',W)+P('M29 38q3 4 7 0l-2 9h-4Z',I)+L('M12 9l7 7m33 33 7 7',1,I);
plate.corruption=P('M9 10h46v44H9Z',W)+L('M10 11 54 53M54 11 10 53',2,A)+P('M14 15h15v15H14Zm22 20h14v14H36Z',I)+L('M31 9v47M8 32h48',.8,I,.45)+C(32,32,4,A);
plate.murder=P('M11 54 39 8l10 6-28 45Z',I)+P('M39 8l6-5 10 7-6 5Z',A)+P('M18 45q-9 6-5 14 7 4 12-7Z',A)+C(51,34,3,A)+C(56,45,2,A)+L('M9 15l8 3m33 35 8 5',1,I);

/* ── ABYSS ─────────────────────────────────────────────────────────────── */
plate.demon=P('M12 50q-2-23 20-31 22 8 20 31-5 11-20 9-17 2-20-9Z',I)+P('M18 21 8 7l17 9Zm28-2 10-12-17 10Z',A)+P('M20 31q7-7 12 0-7 8-12 0Zm16 0q7-7 12 0-7 8-12 0Z',W)+L('M24 48q8-6 16 0',1.3,A);
plate.underworld=P('M5 54h54v6H5Z',I)+P('M8 48q5-26 24-36 20 11 24 36Z',A)+P('M16 48q4-17 16-24 12 8 16 24Z',I)+L('M7 15l10 7m30-8 10 7M11 41l9-5m32 5-9-5',1,W)+C(32,40,3,W);
plate.contract=P('M10 7h38l7 8v42H10Z',W)+L('M17 21h30M17 29h24M17 37h28',1,I)+L('M17 49q10-8 19 1t16-2',1.4,A)+P('M47 7v10h9Z',A)+C(41,48,3,A);
plate.bargain=P('M7 22h17l8 10 8-10h17v29H40L32 41l-8 10H7Z',A)+L('M7 22l17 29M57 22 40 51M15 15l8 3m26-3-8 3',1,I)+C(32,32,4,W);
plate.possession=E(32,31,20,24,W,I,1.4)+P('M13 31q19-17 38 0-19 17-38 0Z',A,.55)+C(25,28,2,I)+C(40,28,2,I)+L('M23 43q9-8 18 0',1.5,I)+L('M32 4v9M8 12l9 8m39-8-9 8',1,A);
plate.damnation=P('M10 57q2-31 22-50 21 19 22 50Z',I)+P('M18 57q3-20 14-36 12 16 15 36Z',A)+P('M27 57q1-11 5-20 5 9 6 20Z',W)+L('M8 12l8 4m40-4-8 4',1,A);
plate.plague=P('M18 13h28l4 12-8 10 8 11-6 12H20l-6-12 8-11-8-10Z',I)+C(26,29,3,A)+C(39,29,3,A)+P('M27 39h10l-5 8Z',A)+C(10,13,2,A)+C(55,50,2,A)+C(8,45,1,A)+C(53,12,1,A);
plate.famine=P('M31 5 35 22 48 13 42 28 58 31 42 37 47 55 33 44 23 59 22 41 7 49 15 33 5 25 22 23Z',W)+P('M29 19h6l-2 29h-4Z',A)+L('M12 10l8 7m32-8-8 8',1,I);
plate.apocalypse=P('M5 55h54v5H5Z',I)+P('M8 49 18 29l8 12 10-25 8 22 10-12 4 23Z',A)+L('M5 14 59 48M55 10 9 52',1.3,I)+star(14,16,.6,I)+star(50,14,.45,I)+C(33,7,2,A);
plate.sinner=E(32,27,15,18,W,I,1.2)+P('M15 56q17-15 34 0Z',I)+P('M18 15 9 5m37 10 9-10',A)+C(27,26,2,A)+C(38,26,2,A)+L('M26 38q6-5 12 0',1.2,A);
plate.redemption=P('M32 4 38 22 56 28 40 36 37 58 28 41 8 37 24 29Z',W)+P('M32 12 35 27 48 31 36 35 33 49 29 37 16 34 28 29Z',A)+L('M32 5v52M9 54l10-5m36 4-10-5',1,I);
plate.torment=P('M11 15q21-10 42 0v34q-20 12-42 0Z',I)+L('M18 20 46 44M46 20 18 44',2,A)+P('M21 28q5-7 10 0-5 7-10 0Zm13 0q5-7 10 0-5 7-10 0Z',W)+L('M24 43q8-7 16 0',1.3,W);

/* ── CHAOS ─────────────────────────────────────────────────────────────── */
plate.ruin=P('M6 55h52v5H6Z',I)+P('M11 50V21l13-8 4 15 13-21 12 16v27Z',A)+P('M17 50V32h9v18Zm18 0V27h10v23Z',W)+L('M7 12l48 43M51 9 12 54',1.1,I);
plate.destruction=P('M32 4 38 21 55 12 47 29 61 36 44 40 50 59 33 47 25 61 21 43 5 53 14 36 3 28 20 24Z',A)+L('M9 9l46 46M54 8 8 56',2,I)+C(32,34,5,W);
plate.noise=L('M5 34h5l4-19 6 37 7-30 7 23 7-36 7 43 6-18h5',2,A)+L('M8 56h48',.8,I)+C(10,10,1,I)+C(55,12,1,I);
plate.glitch=P('M8 10h48v43H8Z',W)+P('M12 16h18v8H12Zm26-4h14v9H38ZM9 31h27v7H9Zm35-5h13v8H44ZM21 43h34v7H21Z',A)+L('M6 14h11m25 0h15M7 41h17m17 0h16',1,I);
plate.mistake=P('M10 10h44v44H10Z',W)+L('M15 17 49 49M49 17 15 49',3,A)+T('?',32,38,15,I)+L('M8 7l8 5m40-5-8 5M9 58l8-5',.8,I);
plate.accident=P('M32 5 58 55H6Z',A)+P('M32 15 49 50H15Z',W)+P('M29 25h6l-1 14h-4Zm0 19h6v6h-6Z',I)+L('M7 59h50',1,I);
plate.virus=C(32,32,13,A)+Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,x1=32+Math.cos(a)*13,y1=32+Math.sin(a)*13,x2=32+Math.cos(a)*23,y2=32+Math.sin(a)*23;return L(`M${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,1.5,I)+C(x2.toFixed(1),y2.toFixed(1),2,I)}).join('')+C(27,29,2,W)+C(38,35,2,W);
plate.static=L('M5 12l54 8M5 18l54-4M5 26l54 6M5 35l54-3M5 43l54 8M5 52l54-5',1,A)+L('M12 8v48m15-48v48m18-48v48',.6,I,.4)+P('M23 23h19v18H23Z',I)+C(28,31,2,W)+C(37,31,2,W);
plate.collapse=P('M7 55h50v5H7Z',I)+P('M11 15h42v34L40 43l-8 10-8-11-13 7Z',W)+L('M13 17l15 18 7-15 16 27',2,A)+P('M9 8h46v8H9Z',A)+L('M8 52l48-5',1,I);

Object.assign(window.RIZO_PLATES ||= {}, plate);
})();
