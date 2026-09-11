/* RIZO ORIGIN — forbidden plates. Drawn at 64 units: ink, cut paper, one pigment.
   The canonical mark is quoted intact; its surroundings change, never its face. */
(() => {
'use strict';
const I='currentColor', A='var(--art-accent)', W='var(--art-paper)';
const p=(d,fill='none',sw=1.15,stroke=I)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const c=(x,y,r,f='none',s=I,w=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${s}" stroke-width="${w}"/>`;
const e=(x,y,rx,ry,f='none',s=I)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${s}" stroke-width="1"/>`;
const g=(s,t)=>`<g transform="${t}">${s}</g>`;
const mark=(x=8,y=3,s=1.5,color=I)=>`<g transform="translate(${x} ${y}) scale(${s})" fill="${color}">${Object.entries(window.RIZO_MARK).map(([k,d])=>`<path d="${d}"${k==='body'?' fill-rule="evenodd"':''}/>`).join('')}</g>`;
const eye=(x=32,y=30,s=1)=>g(p('M-15 0Q0-13 15 0Q0 12-15 0Z',W)+c(0,0,5,I)+c(1,-1,1,W,'none'),`translate(${x} ${y}) scale(${s})`);
const star=(x,y,s=1)=>g(p('M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2Z',A,.7),`translate(${x} ${y}) scale(${s})`);
const hatch=(x,y,n=5)=>Array.from({length:n},(_,i)=>p(`M${x+i*3} ${y}l-5 7`,'none',.65)).join('');
const sparks=p('M12 13l-3-3m42 7 4-2M9 43l-4 1m43 8 3 4','none',.8);
const candle=(x,y,s=1)=>g(p('M-3 0 3 0 4 17-4 17Z',W)+p('M0-3C-8-7 1-13 0-16 8-7 4-4 0-3Z',A)+p('M0-2v4M-3 6l3 2 3-2','none',.75),`translate(${x} ${y}) scale(${s})`);
const book=p('M7 17Q19 12 31 20Q44 12 57 17L54 49Q42 45 31 52Q20 45 10 49Z',W)+p('M31 20v32M11 22q10-4 16 1m-15 5q9-3 15 1m-14 5q8-3 14 1m-13 5q6-2 13 1','none',.75);
const P={};
P.faith=p('M20 52 23 35 31 17 32 39 36 19 40 35 45 50 34 56Z',W,1.5)+p('M32 39 31 52m-7-17 2 15m13-15-2 16','none',.8)+p('M10 15 15 19m34-5-5 5M31 4v7M17 6l4 6m23-5-4 6','none',1)+star(32,11,.5);
P.magic=p('M12 48 46 14 50 18 17 53Z',I)+p('M42 17 47 22',W,2,W)+eye(28,26,.8)+star(46,9,.7)+star(13,14,.55)+star(51,42,.75)+p('M8 34q-2-21 18-24m13 42q14-5 15-18','none',.7)+sparks;
P.devil=p('M11 58V23Q12 6 32 5Q51 6 53 23V58Z',A)+p('M17 57V25Q17 12 32 12Q47 12 47 25V57Z',I)+p('M24 54 25 35 21 23 21 16 28 27 35 27 43 15 41 25 38 36 42 54Z',W,.75)+p('M26 32 30 34m5 0 4-3',I,1.8)+p('M29 40 34 42 37 39m-8 6 7-1','none',.7)+p('M4 57 22 48 44 50 59 60 4 60Z',W)+p('M19 55h14m5 0h6M10 28v22m45-20v21','none',.75)+c(38,57,2,A)+hatch(19,8,7);
P.rizo=p('M12 48Q4 30 14 14m37 2q11 20-3 35','none',.85)+p('M14 57 49 55M17 59h20','none',1.2)+mark(7,1,1.55,A)+p('M7 22 5 17m49-7 3-3M5 42l4-2M53 55l5 2','none',.85);
P.universe=e(32,32,25,24)+e(32,32,25,8)+g(e(32,32,25,8),'rotate(60 32 32)')+g(e(32,32,25,8),'rotate(-60 32 32)')+c(32,32,8,A)+c(32,32,3,I)+star(16,15,.6)+star(49,43,.5)+p('M28 4h8M29 60h6','none',.8);
P.nothing=p('M13 11h-5v11m43-11h5v11M8 43v10h6m36 0h6V43','none',.7)+e(32,33,14,18,'none',A)+p('M46 15 18 51','none',1.7)+p('M25 57h14','none',.6);
Object.assign(window.RIZO_PLATES ||= {},P);
// Faith: devotional objects, marginalia and the uneasy mathematics of belief.
P.ritual=e(32,44,25,10)+e(32,44,18,6,'none',A)+p('M14 42 46 42 32 52Z','none',.7)+candle(18,23,.85)+candle(46,23,.85)+candle(32,15,1)+p('M7 56h18m17 0h13','none',.75);
P.god=c(32,28,21,'none',A)+eye(32,27,1.15)+p('M32 3v6m-17 2-4-5m39 0-5 6M4 27h7m42 0h7M12 46l6-5m29 0 6 5M23 52l-2 6m11-8v11m10-9 2 6','none',1.1)+p('M17 19 32 10 47 19','none',.7)+hatch(24,38,6);
P.prayer=p('M7 51q9-18 17-18l8 8 8-9 15 18-18 7-12-1Z',W)+p('M22 35 30 15 33 38 37 17 41 34M12 50l13 2m17-2 9-3','none',1)+p('M29 9q-7-5-1-7m8 8q9-3 4-8','none',.7)+c(32,6,1,A);
P.temple=p('M5 24 31 7 59 24Z',I)+p('M11 25h42v4H11Zm3 5h6v21h-6Zm15 0h6v21h-6Zm15 0h6v21h-6ZM8 52h48v5H8Z',W)+p('M20 19 32 12 44 19','none',.7,W)+hatch(11,54,14);
P.priest=e(32,11,12,4,'none',A)+p('M24 17q8-7 16 0l-2 13 11 22-34 1 10-23Z',I)+p('M25 32 32 41 39 32 36 50H27Z',W)+p('M30 21h1m5 0h1M29 27q4 3 7 0','none',.8,W)+c(32,45,2,A);
P.soul=p('M32 6C50 22 42 26 43 38Q42 51 31 58 34 43 21 37 10 23 32 6Z',A)+p('M30 17Q15 30 30 36Q41 44 32 53M32 19q13 8 3 16','none',.8)+c(30,28,3,W)+p('M8 27h5m35 3h7M18 10l3 4','none',.65);
P.heaven=p('M5 49q-2-10 8-10 0-10 10-9 6-12 16-2 12-3 13 9 10 0 7 12Z',W)+p('M21 38V18q11-15 23 0v19','none',2)+p('M26 34V20q6-8 12 0v14m-6-19v25M22 43h21m-26 5h31m-35 5h40','none',.9)+star(32,7,.7);
P.angel=c(32,30,12,A)+eye(32,30,.6)+p('M20 27Q3 9 6 5L25 19 32 6 38 20 59 5Q60 19 44 28L59 26Q53 43 42 41L47 57 33 44 20 58 22 42Q8 46 4 27Z','none',1.4)+p('M8 11l14 14M10 18l10 10m35-16L43 26m11-6-10 10M9 32l12 4m32-3-10 4M28 46l4-5 5 6','none',.75)+e(32,5,8,3);
P.religion=book+star(43,30,.8)+p('M37 41h12m-12 3h10','none',.7)+p('M17 7 21 12m23-5-4 5M32 4v7','none',.9,A);
P.dogma=p('M15 9h34l-2 46H12Z',W)+p('M15 15h34M16 48h31','none',1.4)+p('M20 20h22m-22 5h22m-22 5h17m-17 5h22m-22 5h22','none',.9)+p('M25 9V5h11v4',I)+p('M8 24 55 41M8 28l45 16','none',2,A)+c(32,29,7,'none',A);
P.luck=p('M18 9 15 37Q17 52 31 53Q47 53 50 37L46 9 37 11 40 35Q39 44 31 44Q23 43 24 35L27 11Z',I)+p('M21 15 19 31m24-16 3 18M19 39l3 4m20-3-3 4','none',1,W)+star(32,26,.7)+c(31,56,1,A);
P.judgment=p('M32 9v44m-13 3h26M12 21 51 17M14 21 6 38h17Zm34-3L40 35h17Z','none',1.4)+p('M6 39q9 12 17 0m17-3q9 12 17 0',A)+eye(32,10,.5)+hatch(26,52,5);
P.curse=p('M15 12 46 10 50 50 18 55Z',W)+p('M20 18 41 44M44 17 22 46','none',2,A)+eye(32,29,.6)+p('M15 4l4 5m34 6 6-2M9 42l5-2m39 16 4 5','none',1)+p('M21 50h19M20 13l5-1','none',.7);
// Myth: creatures stay illustrated; instruments retain their material weight.
P.legend=book+g(p('M38 44V31l5-12 7 8-5 2 8 9-9-3-2 9Z',I),'translate(-1 0)')+p('M12 8q12-7 18 5m5-4 12-4','none',.7)+star(52,8,.5);
P.monster=p('M8 48 13 26 10 15 23 20 30 9 37 19 52 12 48 29 57 49 44 54 18 55Z',I)+p('M17 30 26 34 18 36m20-2 10-5-2 8M18 44l5-3 5 5 5-5 4 5 7-5 3 5','none',1.6,W)+p('M13 50 17 43m32 6-3-8','none',.8,A);
P.dragon=p('M8 49Q30 60 43 41L39 35 50 32 57 24 47 19 52 10 40 16 34 11 35 23 24 29 12 17 17 35 8 31 14 42 5 44Z',I)+p('M20 35 24 30 31 32 31 24m7 4 9-5 4 1M16 48q14 5 20-8M36 36l3 4','none',.9,W)+c(45,22,1,A)+p('M49 33q6 3 12-1l-8 7',A)+hatch(19,42,4);
P.ghost=p('M14 53 17 26Q18 9 33 10Q49 12 48 30L55 53 43 48 38 57 31 48 22 55 23 47Z',W)+p('M20 29Q21 17 28 16m18 15 3 15','none',.7)+e(27,29,2,5,I)+e(38,28,2,5,I)+p('M27 42q6-5 11-1','none',1.1)+p('M8 39l5-1m-3 5 3-1m39-24 6-1','none',.65,A);
P.vampire=p('M7 54 20 28 15 23 8 19 25 19 32 27 42 18 57 18 44 27 55 55 32 49Z',I)+p('M24 9 41 10 39 29 31 38 24 28Z',W)+p('M24 10 32 20 41 10',I)+p('M27 25h3m5 0h3M28 31l2 4 2-4 3 4 2-4','none',.9)+c(49,8,4,A)+p('M32 41v10','none',.75,W);
P.werewolf=c(44,17,12,A)+p('M8 50 17 32 18 17 27 26 37 25 44 14 42 34 55 41 43 46 41 57 18 55 22 47Z',I)+p('M29 33 34 35 37 31m3 9 9 1M22 42l5 3-4 4m10 0 3 5','none',1,W)+p('M10 58h39','none',.7);
P.witch=p('M13 26 27 5 40 22 53 29Q32 36 8 29Z',I)+p('M22 24 37 22','none',2,A)+p('M23 32 38 33 36 39 42 42 34 45 30 50 20 51 26 43Z',W)+p('M17 57 50 41m-9 4 15 3-5 8-14-8','none',1.3)+c(32,36,1,I)+p('M14 34 17 44','none',.75);
P.potion=p('M25 7h14v8l-3 1 1 11q16 13 13 22-2 9-18 9-17 0-18-9-2-9 14-22l1-11-4-1Z',W)+p('M17 42q9-4 16 0t14 0q5 13-15 12-20 0-15-12',A)+p('M26 11h12M27 20v5M20 34l-3 6','none',.9)+star(33,44,.75)+c(24,35,1)+c(37,31,2);
P.spell=p('M9 50q3-9 10-6l5-27q3-9 10-7l21 3q-10-1-10 9L40 49q-2 7-10 6L9 53Z',W)+p('M9 50q8 6 10-6m13-34q-6 4-1 8h20M24 49l13 2','none',.85)+star(33,31,1)+p('M25 23l4-2m10 22-4 1','none',.7,A);
P.unicorn=p('M12 54 16 30 28 21 36 18 40 26 54 36 46 42 35 36 29 55Z',W)+p('M34 21 46 4 41 26Z',A)+p('M29 22 26 12 35 20M15 32 9 29 13 39 7 43 13 49 10 54 20 54 24 35',I)+p('M17 49 20 34m-7 10 5-10M42 31l3 1','none',.8)+star(53,17,.5);
P.mermaid=p('M28 10q9-5 13 4l-3 10 5 11-11 11q-8 10-19 5L6 60 5 47 16 42q13 4 14-5l-9-7 6-7Z',A)+p('M25 22q-9 9-10 1Q15 8 27 6q15-3 16 14l-6 7 1-15-8 3Z',I)+p('M26 27 37 30m-8 5 9 1M22 44l-2 5m6-7 1 6m4-10 2 5M9 50l4-2','none',.8)+c(31,19,.8,I)+p('M46 49q7-5 13-1M38 55q9-5 18-1','none',.8);
P.golem=p('M21 10 43 11 45 26 52 29 54 46 44 45 43 56 34 56 31 47 27 56 17 55 18 44 10 45 12 28 20 25Z',A)+p('M21 10 26 6h14l3 5M18 32l2 12m24-13-1 12M22 27l8 6 11-7M25 18h4m6 0h4M27 24h10M29 36l4 2-3 6','none',1.25)+p('M24 12h16','none',.7)+hatch(23,48,3);
P.phoenix=p('M32 53Q3 36 7 9L25 29 25 13 33 25 42 10 41 29 58 9Q59 33 39 45L43 60 32 52 23 61Z',A)+p('M11 19 25 36m-12-8 14 12m29-19-16 16m13-5-16 10M30 30 35 25 38 30 34 32 33 49','none',1.1)+p('M24 56h-8m30 0h5','none',.7);
P.prophecy=e(32,26,20,19,W)+p('M18 44 15 54h35l-5-10Z',I)+eye(32,25,.75)+p('M16 25q1-12 11-13m17 22 3-5','none',.75)+star(33,10,.4)+p('M22 50h20','none',.85,W);

Object.assign(window.RIZO_PLATES ||= {}, P);
})();
