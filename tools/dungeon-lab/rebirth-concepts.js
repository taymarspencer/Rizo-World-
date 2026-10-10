/* Internal silhouette exploration. Never loaded by the game or production build. */
(() => {
  "use strict";
  const A = RizoDungeonArt, P = A.P, root = document.querySelector("#concepts");
  const path = (c, d, fill, w = 1.1) => A.cut(c, d, fill, w);
  const eye = (c, x, y, sleepy = false) => {
    if (sleepy) A.line(c, x-1.5, y, x+1.5, y, P.ink, 1.1, 1, 0);
    else { A.oval(c,x,y,1.25,1.8,P.ink); A.oval(c,x+.35,y-.5,.35,.45,P.paper[3]); }
  };
  const feet = c => {A.oval(c,-5,-1.5,3.6,1.8,P.wood[0],true,.8);A.oval(c,6,-1.5,3.6,1.8,P.wood[0],true,.8);};
  function nellKnot(c) {
    feet(c);
    path(c,"M-6-27Q-11-26-12-19L-16-7Q-7-3 0-7Q7-4 14-9L10-23Q7-28 3-27Z",P.a.maroon);
    path(c,"M-12-18L-6-23L-5-7L-14-7Z",P.a.maroonLight,0);
    path(c,"M-6-24Q0-20 8-25L5-18L-1-15Z",P.paper[2]);
    path(c,"M-5-14L4-15L6-8L-4-7Z",P.service[2],.8);
    A.line(c,-1,-13,1,-9,P.paper[2],1.1,0,0);A.line(c,-2,-10,2,-12,P.paper[2],1.1,0,0);
    path(c,"M-9-22Q-16-21-15-15L-10-12L-6-17Z",P.service[1]);
    path(c,"M7-23Q15-24 15-17L12-13L6-16Z",P.service[2]);
    A.oval(c,12,-15,2.2,2,P.skin[2],true,.8);
    path(c,"M-8-33Q-7-41 2-39Q10-38 10-30L8-26Q2-21-5-26L-10-29Z",P.skin[2]);
    path(c,"M-8-31L-5-29L-5-26Q-9-27-10-29Z",P.skin[1],0);
    path(c,"M-10-31Q-14-35-10-39Q-9-43-5-41Q0-46 4-41Q10-43 11-35L7-34L5-38Q0-35-5-36L-6-30Z",P.paper[2]);
    path(c,"M5-40Q12-47 14-42Q15-38 7-37Q5-34 3-37Z",P.a.maroon);
    path(c,"M7-38Q14-38 15-32L10-32L6-37Z",P.a.maroonLight);
    A.oval(c,6,-38,1.6,1.5,P.a.maroon,true,.8);
    eye(c,-2.5,-30);eye(c,5,-30.5);
    A.line(c,-4,-33,-1,-34,P.wood[1],1,0,0);A.line(c,3.5,-34,6.5,-33.5,P.wood[1],1,0,0);
    path(c,"M0-26Q3-23 6-27",null,1);
    path(c,"M1-29L2-27L3-29Z",P.skin[1],0);
    A.oval(c,-5.5,-27,1.6,.6,P.a.maroonLight);A.oval(c,7,-27.5,1.5,.6,P.a.maroonLight);
  }
  function nellThimble(c) {
    feet(c);path(c,"M-5-24L6-24L9-7L-10-7Z",P.service[2]);
    path(c,"M-8-25Q-18-23-14-15L-8-13Z",P.paper[2]);path(c,"M8-25Q16-21 13-14L7-13Z",P.paper[1]);
    path(c,"M-7-38L5-43L12-35L10-25L2-22L-8-27Z",P.paper[2]);
    path(c,"M-8-38Q-7-45 2-46Q11-46 12-36L9-33L-7-34Z",P.metal[2]);
    A.line(c,-5,-40,8,-42,P.metal[3],1.5,0,0);eye(c,-3,-30);eye(c,5,-31);
    path(c,"M-1-27Q3-24 6-27",null,1);path(c,"M-4-17H5V-10H-4Z",P.a.maroon);
    A.oval(c,-12,-15,2,2,P.skin[2],true);A.oval(c,11,-14,2,2,P.skin[2],true);
  }
  function nellEar(c) {
    feet(c);path(c,"M-9-24Q-16-17-12-7H11Q15-18 8-25Z",P.service[2]);
    path(c,"M-7-43L-10-54Q-5-56-2-44L4-51L11-44L5-39Z",P.paper[2]);
    path(c,"M-10-37Q-10-44 0-43Q12-43 12-34Q10-24 1-24Q-10-26-10-37Z",P.paper[2]);
    eye(c,-4,-34);eye(c,5,-34);A.oval(c,1,-30,2,1.2,P.a.maroon);path(c,"M-1-27Q2-25 5-28",null,1);
    path(c,"M-7-21L8-22L10-8H-10Z",P.paper[1]);path(c,"M-5-17H4V-11H-5Z",P.a.maroon);
    A.oval(c,12,-17,3,3,P.paper[2],true);
  }
  function orrHearth(c) {
    A.oval(c,-10,-2,5.5,2,P.wood[0],true,.9);A.oval(c,11,-2,5.5,2,P.wood[0],true,.9);
    path(c,"M-12-26Q-18-18-15-8Q0-1 15-8Q20-21 12-26Z",P.a.rust);
    path(c,"M-13-22Q-9-28-2-25L2-10L-8-7L-15-9Z",P.wood[3],0);
    path(c,"M-14-18Q0-14 15-19L14-9Q0-5-14-9Z",P.a.postal);
    A.oval(c,-15,-16,3,3,P.paper[1],true);A.oval(c,15,-16,3.5,3,P.paper[2],true);
    path(c,"M-17-29Q-17-38-8-39L10-39Q18-37 18-29L14-23Q0-17-14-23Z",P.skin[1]);
    path(c,"M-16-28Q-13-22-6-23Q-1-21 0-26Q4-21 11-23L16-28L15-24Q0-17-14-23Z",P.paper[1],.8);
    path(c,"M-11-37Q-10-43 3-42L12-39L14-36Z",P.a.postal);
    path(c,"M7-40Q13-44 16-40L15-30L11-29L10-37Z",P.paper[2]);
    A.line(c,11,-36,15,-35,P.a.red,1.4,0,0);
    eye(c,-8,-30,true);eye(c,8,-30,true);
    A.line(c,-11,-33,-6,-34,P.wood[0],1.5,0,0);A.line(c,6,-34,11,-33,P.wood[0],1.5,0,0);
    A.oval(c,0,-28,4,2,P.skin[2],true,.7);A.oval(c,-1.5,-28,.7,.6,P.wood[0]);A.oval(c,1.5,-28,.7,.6,P.wood[0]);
    path(c,"M-5-23Q1-20 7-24",null,1.2);
    path(c,"M-5-13L5-13L4-8H-5Z",P.paper[2],.8);A.line(c,-3,-11,3,-11,P.a.red,1,0,0);
  }
  function orrKettle(c) {
    feet(c);path(c,"M-9-24Q-15-18-11-6L9-6Q14-18 7-25Z",P.service[2]);
    path(c,"M-11-27Q-15-40-4-42Q10-43 13-33L10-25L-5-23Z",P.metal[2]);
    path(c,"M-12-35L-17-40L-19-32L-12-29Z",P.metal[1]);
    path(c,"M-10-40Q0-47 11-40L12-38H-11Z",P.metal[1]);A.oval(c,1,-45,3,1.5,P.wood[1],true);
    eye(c,-4,-31);eye(c,5,-31);path(c,"M-2-27Q2-24 7-28",null,1.1);
    path(c,"M-7-20H6L8-7H-9Z",P.paper[2]);path(c,"M9-20Q22-24 20-13L11-12",null,3);
  }
  function orrBird(c) {
    A.line(c,-4,-7,-5,-1,P.wood[0],2,0,0);A.line(c,5,-7,6,-1,P.wood[0],2,0,0);
    path(c,"M-9-30Q-15-13-8-6Q3-2 11-9L10-30Z",P.a.postal);
    path(c,"M-10-32Q-12-44-1-45Q13-44 13-32L9-25L-6-25Z",P.paper[2]);
    path(c,"M8-34L20-29L9-25Z",P.a.mustard);eye(c,2,-34);eye(c,-5,-34);
    path(c,"M-12-39Q-9-45 4-44L12-40L10-38Z",P.a.rust);
    path(c,"M-10-19Q-20-29-15-30L-6-24Z",P.a.postalLight);
    path(c,"M-7-19L8-19L9-8L-9-8Z",P.paper[1]);
  }
  const groups = [
    ["Nell · the mender", [["A · knot & bell",nellKnot,"SELECTED: soft maroon bell, swept wool fringe, one asymmetric knot. Trustworthy face; capable compact mitts.",true],["B · thimble worker",nellThimble,"Rejected: clear tool motif, but the face feels like equipment and the body feels rigid."],["C · folded ear",nellEar,"Rejected: inviting, but too much bunny identity and height for the mender's role."]]],
    ["Orr · the cook", [["A · hearth creature",orrHearth,"SELECTED: broad muzzle, heavy lids, low round body. A grumpy little hearth dweller; no humanoid apron skeleton.",true],["B · kettle worker",orrKettle,"Rejected: distinct, but object-headed construction fights Orr's warmth and the Porter's lamp symbolism."],["C · pantry bird",orrBird,"Rejected: charming silhouette; narrow face and coat are less distinct beside Latch."]]]
  ];
  const makeCanvas=(fn,scale,silhouette=false)=>{
    const el=document.createElement("canvas");el.width=192*2;el.height=100*2;el.style.width="192px";el.style.height="100px";
    const c=el.getContext("2d");c.scale(2,2);c.translate(96,80);c.scale(scale,scale);fn(c);
    if(silhouette){c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation="source-in";c.fillStyle=P.paper[2];c.fillRect(0,0,el.width,el.height);}return el;
  };
  const ref=document.createElement("div");ref.className="reference";
  ref.append(makeCanvas(c=>A.latch(c,0,0,{t:0}),284/320));const note=document.createElement("p");note.textContent="Latch reference · unchanged 42 world units";ref.append(note);root.append(ref);
  for(const [title,entries]of groups){const h=document.createElement("h2");h.textContent=title;root.append(h);const row=document.createElement("div");row.className="row";root.append(row);
    for(const [name,draw,note,selected]of entries){const card=document.createElement("div");card.className="card"+(selected?" selected":"");const h=document.createElement("h3");h.textContent=name;card.append(h);for(const [scale,sil,label]of [[284/320,false,"Native phone scale"],[284/320,true,"Native silhouette"],[1.65,false,"Construction only · ×1.65"]]){card.append(makeCanvas(draw,scale,sil));const s=document.createElement("small");s.textContent=label;card.append(s);}const p=document.createElement("p");p.textContent=note;card.append(p);row.append(card);}
  }
  document.documentElement.dataset.conceptsReady="true";
})();
