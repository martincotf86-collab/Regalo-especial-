// script.js - Interactivo cinematográfico: árbol, flores, corazón, sonidos y UI.
// Organización: init() orchestrates the sequence. Comments inline for easy edits.

(() => {
  // Config
  const relationshipStart = new Date('2025-04-04T21:49:00'); // UTC or local? treated as local
  const FLOWER_COLOR = '#ffd86b';
  const MAX_FLOWERS = 240; // adjust for density/performance

  // DOM refs
  const intro = document.getElementById('intro');
  const enterBtn = document.getElementById('enterBtn');
  const stage = document.getElementById('stage');
  const skyGradient = document.getElementById('skyGradient');
  const treeGroup = document.getElementById('treeGroup');
  const counterCard = document.getElementById('counterCard');
  const counterEls = {
    months: document.getElementById('months'),
    days: document.getElementById('days'),
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
  };
  const letterCard = document.getElementById('letterCard');
  const letterEl = document.getElementById('letter');
  const editLetterBtn = document.getElementById('editLetter');
  const finalPhrase = document.getElementById('finalPhrase');

  // Canvas elements
  const starCanvas = document.getElementById('starfield');
  const ambientCanvas = document.getElementById('ambientParticles');
  const butterfliesLayer = document.getElementById('butterflies');
  const petalsLayer = document.getElementById('petals');
  const sparklesLayer = document.getElementById('sparkles');

  // audio context and ambient sources
  let audioCtx = null;
  let ambientGain = null;
  let windNode, leavesNode, birdsNode;

  // state
  let flowers = [];
  let treePaths = []; // SVG path elements for branches
  let heartFormed = false;

  // Responsive canvas sizing
  function resizeCanvases() {
    if (!starCanvas || !ambientCanvas) return;
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
    ambientCanvas.width = window.innerWidth;
    ambientCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvases);

  // ----- STARFIELD -----
  function initStarfield() {
    resizeCanvases();
    const ctx = starCanvas.getContext('2d');
    const w = starCanvas.width, h = starCanvas.height;
    const stars = [];
    const count = Math.max(20, Math.round((w*h)/50000)); // density
    for (let i=0;i<count;i++){
      stars.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*1.4 + 0.4,
        a: Math.random()*0.9 + 0.1,
        tw: Math.random()*2 + 1.5
      });
    }
    // subtle twinkle
    function draw(t){
      ctx.clearRect(0,0,w,h);
      for (const s of stars){
        const a = s.a * (0.7 + 0.3 * Math.sin((t/1000) * s.tw + s.x));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // ----- AMBIENT PARTICLES (sparkles/pollen) -----
  function startAmbientParticles() {
    if (!ambientCanvas) return;
    const ctx = ambientCanvas.getContext('2d');
    const w = ambientCanvas.width, h = ambientCanvas.height;
    const particles = [];
    for (let i=0;i<60;i++){
      particles.push({
        x: Math.random()*w,
        y: Math.random()*h,
        r: Math.random()*2 + 0.5,
        vx: (Math.random()-0.5)*0.2,
        vy: -0.05 - Math.random()*0.2,
        alpha: Math.random()*0.7 + 0.2,
        tw: Math.random()*3 + 1
      });
    }
    function loop(t){
      ctx.clearRect(0,0,w,h);
      for (const p of particles){
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = 0.2 + 0.6 * (0.5 + 0.5*Math.sin((t/1000)*p.tw + p.x));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,220,120,${p.alpha})`;
        ctx.arc(p.x, p.y, p.r,0,Math.PI*2);
        ctx.fill();
        if (p.y < -10 || p.x < -10 || p.x > w+10){
          p.x = Math.random()*w;
          p.y = h + 10 + Math.random()*40;
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // ----- WEB AUDIO: ambient synthesis (wind, leaves, birds) -----
  function initAudio() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext unavailable', e);
      return;
    }
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.0; // start silent, fade in
    ambientGain.connect(audioCtx.destination);

    // WIND: filtered noise
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++){
      output[i] = Math.random()*2 - 1;
    }
    windNode = audioCtx.createBufferSource();
    windNode.buffer = noiseBuffer;
    windNode.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 800;
    const windGain = audioCtx.createGain();
    windGain.gain.value = 0.06;
    windNode.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ambientGain);

    // Leaves: gentle brush using noise + lowpass with slow LFO
    const leavesNodeBuff = audioCtx.createBuffer(1, 1 * audioCtx.sampleRate, audioCtx.sampleRate);
    const leavesOut = leavesNodeBuff.getChannelData(0);
    for (let i = 0; i < leavesOut.length; i++) leavesOut[i] = (Math.random()*2-1)*0.4;
    leavesNode = audioCtx.createBufferSource();
    leavesNode.buffer = leavesNodeBuff;
    leavesNode.loop = true;
    const leavesFilter = audioCtx.createBiquadFilter();
    leavesFilter.type = 'lowpass';
    leavesFilter.frequency.value = 1500;
    const leavesGain = audioCtx.createGain();
    leavesGain.gain.value = 0.03;
    leavesNode.connect(leavesFilter);
    leavesFilter.connect(leavesGain);
    leavesGain.connect(ambientGain);

    // Birds: periodic chirps synthesized using oscillators and envelope
    birdsNode = { timers: [] };

    windNode.start();
    leavesNode.start();
  }

  function fadeInAmbient() {
    if (!ambientGain || !audioCtx) return;
    const now = audioCtx.currentTime;
    ambientGain.gain.cancelScheduledValues(now);
    ambientGain.gain.setValueAtTime(0, now);
    ambientGain.gain.linearRampToValueAtTime(1.0, now + 3.0);
    // schedule occasional bird chirps
    scheduleBirds();
  }

  function scheduleBirds(){
    if (!audioCtx) return;
    const interval = () => 4 + Math.random()*8;
    function chirp(){
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      const f = 900 + Math.random()*700;
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8 + Math.random()*0.6);
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      osc.connect(filter); filter.connect(gain); gain.connect(ambientGain);
      osc.start(now);
      osc.stop(now + 1.4 + Math.random()*0.8);
    }
    (function loop(){
      chirp();
      const t = setTimeout(loop, (interval()*1000));
      birdsNode.timers.push(t);
    })();
  }

  // ----- Sky transition (amanecer) -----
  async function dawnSequence() {
    // animate gradient stops
    const top = document.getElementById('gradTop');
    const mid = document.getElementById('gradMid');
    const bottom = document.getElementById('gradBottom');

    // animate over ~9 seconds smoothly
    const duration = 9000;
    const start = performance.now();
    const startVals = {
      top: '#071128',
      mid: '#0b1830',
      bottom: '#05101a'
    };
    const endVals = {
      top: '#ffd9a8',
      mid: '#ffc9a0',
      bottom: '#ffe6cc'
    };

    function lerpColor(a,b,t){
      const pa = hexToRgb(a), pb = hexToRgb(b);
      const r = Math.round(pa.r + (pb.r - pa.r) * t);
      const g = Math.round(pa.g + (pb.g - pa.g) * t);
      const bl = Math.round(pa.b + (pb.b - pa.b) * t);
      return `rgb(${r},${g},${bl})`;
    }

    return new Promise(resolve => {
      function frame(now){
        const t = Math.min(1, (now - start) / duration);
        top.setAttribute('stop-color', lerpColor(startVals.top, endVals.top, easeInOutCubic(t)));
        mid.setAttribute('stop-color', lerpColor(startVals.mid, endVals.mid, easeInOutCubic(t)));
        bottom.setAttribute('stop-color', lerpColor(startVals.bottom, endVals.bottom, easeInOutCubic(t)));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ----- Tree drawing algorithm (recursive branching) -----
  // We'll draw an organic tree with paths; each path grows (stroke-draw) and then spawns children.
  function createBranchPath(points, thickness=8) {
    const ns = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(ns, 'path');
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i=1;i<points.length;i++){
      const p = points[i];
      d += ` L ${p.x} ${p.y}`;
    }
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(60,40,20,0.98)');
    path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');
    path.setAttribute('stroke-width', thickness);
    try {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
    } catch (e) {
      // fallback if not in DOM yet
      path.style.strokeDasharray = '1000';
      path.style.strokeDashoffset = '1000';
    }
    path.style.transition = 'stroke-dashoffset 900ms linear';
    return path;
  }

  // generate branching recursively with randomization
  function generateTreeSkeleton(maxDepth = 6) {
    const branches = [];
    const trunk = {
      start: {x: 0, y: 0},
      end: {x: 0, y: -260},
      thickness: 16,
      depth: 0,
      angle: -90
    };
    function branchFrom(segment, depth){
      const steps = 18;
      const points = [];
      for (let i=0;i<=steps;i++){
        const t = i/steps;
        // curve outward slightly using sin wave and randomness
        const x = segment.start.x + (segment.end.x - segment.start.x) * t + Math.sin(t*Math.PI)* (depth*2 + Math.random()*8) * (Math.random()-0.5);
        const y = segment.start.y + (segment.end.y - segment.start.y) * t;
        points.push({x,y});
      }
      branches.push({points,thickness: Math.max(1, segment.thickness - depth*2), depth: segment.depth});
      if (depth < maxDepth){
        // spawn 1-3 child branches from random points along this branch
        const childCount = 1 + (Math.random() < 0.7 ? 1 : 0);
        for (let c=0;c<childCount;c++){
          const spawnT = 0.35 + Math.random()*0.5;
          const spawnPoint = {
            x: segment.start.x + (segment.end.x - segment.start.x) * spawnT,
            y: segment.start.y + (segment.end.y - segment.start.y) * spawnT
          };
          // child end offset with angle and randomness
          const length = 60 * (1 - depth/maxDepth) * (0.6 + Math.random()*0.8);
          const angle = (-90 + (Math.random()*60 - 30)) + (depth*6 * (Math.random()-0.5));
          const rad = angle * Math.PI/180;
          const end = {
            x: spawnPoint.x + Math.cos(rad) * length,
            y: spawnPoint.y + Math.sin(rad) * length
          };
          branchFrom({start: spawnPoint, end, thickness: Math.max(1, segment.thickness - 2), depth: depth+1}, depth+1);
        }
      }
    }
    branchFrom(trunk, 0);
    return branches;
  }

  // draw and animate tree
  async function drawTree() {
    const skeleton = generateTreeSkeleton(6);
    treePaths = [];
    // draw trunk first (the first branch)
    for (let i=0;i<skeleton.length;i++){
      const node = skeleton[i];
      const path = createBranchPath(node.points, node.thickness);
      treeGroup.appendChild(path);
      treePaths.push(path);
      // animate with stagger based on depth
      const delay = Math.min(1600, node.depth * 350 + i*30);
      await wait(delay);
      path.style.transition = `stroke-dashoffset ${800 + node.depth*300}ms cubic-bezier(.2,.9,.2,1)`;
      path.style.strokeDashoffset = 0;
      // small pause so branches don't appear simultaneously
    }
  }

  // ---- Flowers: spawn on branches progressively -----
  function samplePointsOnPath(path, count) {
    const len = path.getTotalLength();
    const points = [];
    for (let i=0;i<count;i++){
      const t = Math.random() * 0.95; // avoid tips
      const p = path.getPointAtLength(len * t);
      points.push({x:p.x, y:p.y});
    }
    return points;
  }

  function createFlower(x,y,delay=0){
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns,'g');
    g.setAttribute('class','flower');
    g.setAttribute('transform',`translate(${x},${y}) scale(0.0001)`);
    // center circle + petals (simpler for performance)
    const pet = document.createElementNS(ns,'circle');
    pet.setAttribute('r',6);
    pet.setAttribute('fill',FLOWER_COLOR);
    pet.setAttribute('fill-opacity',0.95);
    pet.style.filter = 'drop-shadow(0 6px 8px rgba(0,0,0,0.18))';
    g.appendChild(pet);
    // small inner highlight
    const inner = document.createElementNS(ns,'circle');
    inner.setAttribute('r',3);
    inner.setAttribute('fill','#fff6d6');
    inner.setAttribute('fill-opacity',0.5);
    inner.setAttribute('transform','translate(1,-1)');
    g.appendChild(inner);

    // interaction
    g.addEventListener('pointerdown', (e)=>{
      e.stopPropagation();
      bloomFlowerEffect(g);
    });

    treeGroup.appendChild(g);
    flowers.push({el:g, x, y, locked:false});
    // animate birth
    setTimeout(()=>{
      g.style.transition = 'transform 700ms cubic-bezier(.16,1,.3,1), opacity 500ms';
      g.setAttribute('transform',`translate(${x},${y}) scale(1)`);
      // small gentle float
      animateFloat(g);
    }, delay);
  }

  function animateFloat(el){
    let dir = (Math.random()>0.5)?1:-1;
    const amp = 6 + Math.random()*8;
    const speed = 3000 + Math.random()*3000;
    let start = performance.now();
    function f(t){
      const dt = (t - start);
      const off = Math.sin(dt / speed * Math.PI*2) * amp * dir;
      el.setAttribute('transform', `translate(${el.__x||0},${(el.__y||0)+off}) scale(1)`);
      requestAnimationFrame(f);
    }
    // store base coords
    const tr = el.getAttribute('transform');
    const m = tr.match(/translate\(([-\d.]+),([\-\d.]+)\)/);
    if (m){ el.__x = parseFloat(m[1]); el.__y = parseFloat(m[2]); requestAnimationFrame(f);}    
  }

  function bloomFlowerEffect(g){
    // quick sparkle and hearts
    const ns = 'http://www.w3.org/2000/svg';
    const p = document.createElementNS(ns,'g');
    const rect = g.getBoundingClientRect();
    for (let i=0;i<6;i++){
      const heart = document.createElementNS(ns,'circle');
      heart.setAttribute('r',2 + Math.random()*3);
      heart.setAttribute('fill','#ff9fb1');
      const rx = (Math.random()-0.5)*24;
      const ry = -6 - Math.random()*24;
      heart.setAttribute('transform',`translate(${rx},${ry})`);
      p.appendChild(heart);
      // animate each heart
      heart.animate([
        {transform:`translate(0,0)`, opacity:1},
        {transform:`translate(${rx*2},${ry-30})`, opacity:0}
      ],{duration:700 + Math.random()*400, easing:'ease-out', fill:'forwards'});
    }
    sparklesLayer.appendChild(p);
    setTimeout(()=>p.remove(),1300);
    // flower highlight
    try{ g.animate([{filter:'brightness(1)'},{filter:'brightness(1.8)'}],{duration:380,fill:'forwards'});}catch(e){}
  }

  // create many flowers over time
  async function growFlowers() {
    // sample from larger branches (treePaths) - prefer longer paths
    const pathPool = treePaths.slice().sort((a,b)=>b.getTotalLength()-a.getTotalLength());
    let created = 0;
    let attempts = 0;
    while (created < MAX_FLOWERS && attempts < MAX_FLOWERS*3){
      attempts++;
      const p = pathPool[Math.floor(Math.random()*pathPool.length)];
      if (!p) break;
      const pt = p.getPointAtLength(p.getTotalLength() * (0.15 + Math.random()*0.75));
      // small offset outward to sit on the branch
      const jitterX = (Math.random()-0.5) * 6;
      const jitterY = (Math.random()-0.5) * 6;
      createFlower(pt.x + jitterX, pt.y + jitterY, Math.random()*800);
      created++;
      await wait(40 + Math.random()*120);
    }
  }

  // ----- Heart formation: move flowers toward heart-shape targets -----
  function heartPoints(count, box) {
    // box: {xMin,xMax,yMin,yMax} in SVG coords
    const pts = [];
    for (let i=0;i<count;i++){
      const u = -Math.PI + (2*Math.PI)*(i/count) + (Math.random()-0.5)*(2*Math.PI/count);
      const x = 16*Math.pow(Math.sin(u),3);
      const y = -(13*Math.cos(u) - 5*Math.cos(2*u) - 2*Math.cos(3*u) - Math.cos(4*u));
      pts.push({x,y});
    }
    const xs = pts.map(p=>p.x), ys=pts.map(p=>p.y);
    const minX = Math.min(...xs), maxX=Math.max(...xs);
    const minY = Math.min(...ys), maxY=Math.max(...ys);
    return pts.map((p,i)=>{
      const nx = (p.x - minX) / (maxX - minX);
      const ny = (p.y - minY) / (maxY - minY);
      const rx = box.xMin + nx*(box.xMax - box.xMin);
      const ry = box.yMin + ny*(box.yMax - box.yMin);
      return {x:rx, y:ry};
    });
  }

  async function formHeart() {
    if (heartFormed) return;
    heartFormed = true;
    // compute heart box near upper-middle of tree
    const box = {xMin:-160, xMax:160, yMin:-340, yMax:-100};
    const targets = heartPoints(flowers.length, box);
    // shuffle to avoid perfectness
    shuffleArray(targets);
    flowers.forEach((f, i) => {
      const t = targets[i % targets.length];
      const el = f.el;
      el.style.transition = `transform ${1800 + Math.random()*900}ms cubic-bezier(.16,1,.3,1)`;
      f.locked = true;
      el.setAttribute('transform', `translate(${t.x},${t.y}) scale(1)`);
    });
    await wait(2200);
    counterCard.classList.remove('hidden');
    letterCard.classList.remove('hidden');
    await wait(6000);
    finalPhrase.classList.add('show');
  }

  // ----- Interactions on tree (click) and heart (click) -----
  function attachTreeInteraction() {
    const world = document.querySelector('.world-svg');
    world.addEventListener('pointerdown', (e)=>{
      treePaths.forEach((p,i)=>{
        try{ p.animate([
          {transform:'translateY(0px)'},
          {transform:`translateY(${(Math.random()-0.5)*6}px)`}
        ], {duration:400, iterations:1, easing:'ease-out'});}catch(e){}
      });
    });
  }

  function attachHeartTap() {
    const world = document.querySelector('.world-svg');
    world.addEventListener('dblclick', (e)=>{
      if (!heartFormed) return;
      createPetalRain(80);
    });
  }

  // create petal elements falling
  function createPetal(x=0,y=0, count=1){
    const ns = 'http://www.w3.org/2000/svg';
    for (let i=0;i<count;i++){
      const p = document.createElementNS(ns,'path');
      p.setAttribute('d','M0 0 C2 8 8 8 10 0 C8 -1 2 -1 0 0 Z');
      p.setAttribute('fill','#ffd07a');
      p.setAttribute('transform',`translate(${x + (Math.random()*40-20)},${y + (Math.random()*40-20)}) rotate(${Math.random()*360}) scale(${0.7+Math.random()*0.8})`);
      p.style.opacity = 0.95;
      petalsLayer.appendChild(p);
      const fall = [
        {transform:p.getAttribute('transform'), opacity:1},
        {transform:`translate(${x + (Math.random()*400-200)}, ${800 + Math.random()*200}) rotate(${Math.random()*400}) scale(${0.5})`, opacity:0.2}
      ];
      const dur = 3000 + Math.random()*2500;
      try{ p.animate(fall, {duration:dur, easing:'cubic-bezier(.2,.8,.2,1)', fill:'forwards'});}catch(e){}
      setTimeout(()=>p.remove(), dur + 200);
    }
  }

  function createPetalRain(num=50){
    for (let i=0;i<num;i++){
      setTimeout(()=>createPetal(500, -50, 1), i*30 + Math.random()*300);
    }
  }

  // ----- Counter (months/days/h/m/s) -----
  function updateCounter() {
    const now = new Date();
    let start = new Date(relationshipStart.getTime());
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const adjusted = new Date(start.getTime());
    adjusted.setMonth(start.getMonth() + months);
    if (now < adjusted) { months--; adjusted.setMonth(start.getMonth() + months); }
    const diffMs = now - adjusted;
    let remaining = diffMs;
    const days = Math.floor(remaining / (1000*60*60*24));
    remaining -= days*(1000*60*60*24);
    const hours = Math.floor(remaining / (1000*60*60));
    remaining -= hours*(1000*60*60);
    const minutes = Math.floor(remaining / (1000*60));
    remaining -= minutes*(1000*60);
    const seconds = Math.floor(remaining / 1000);

    counterEls.months.textContent = months;
    counterEls.days.textContent = days;
    counterEls.hours.textContent = hours;
    counterEls.minutes.textContent = minutes;
    counterEls.seconds.textContent = seconds;
  }

  // ----- Letter (typewriter effect) -----
  let letterText = "Flores amarillas para el amor de mi vida...\n\nCada amanecer junto a vos hace que el mundo sea más tierno, más brillante y lleno de promesas. Gracias por ser mi lugar seguro y mi aventura favorita.";
  async function showLetter() {
    letterEl.textContent = '';
    letterCard.classList.remove('hidden');
    await typeWriter(letterEl, letterText, 28);
  }

  editLetterBtn.addEventListener('click', ()=>{
    const v = prompt('Editar carta:', letterText);
    if (v !== null) { letterText = v; showLetter(); }
  });

  // ----- Orchestration -----
  enterBtn.addEventListener('click', async (e) => {
    enterBtn.animate([{transform:'scale(1)'},{transform:'scale(.92)'}],{duration:180,fill:'forwards'});
    await wait(180);
    intro.classList.remove('active');
    intro.style.transition = 'opacity .9s ease';
    intro.style.opacity = 0;
    stage.classList.add('active');
    stage.setAttribute('aria-hidden','false');

    initAudio();
    await wait(700);
    fadeInAmbient();
    startAmbientParticles();
    await wait(1000);
    await dawnSequence();
    await drawTree();
    await growFlowers();
    await wait(900);
    await formHeart();
    await showLetter();
    counterCard.classList.remove('hidden');
    setInterval(updateCounter, 1000);
    updateCounter();

    attachTreeInteraction();
    attachHeartTap();
  }, {once:true});

  // Utility helpers
  function wait(ms){return new Promise(res=>setTimeout(res,ms));}
  function hexToRgb(hex) {
    hex = hex.replace('#','');
    if (hex.length===3) hex = hex.split('').map(h=>h+h).join('');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    return {r,g,b};
  }
  function easeInOutCubic(t){ return t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
  function shuffleArray(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  // typewriter
  async function typeWriter(el, text, cps=40){
    el.textContent = '';
    for (let i=0;i<text.length;i++){
      el.textContent += text[i];
      await wait(1000 / cps + Math.random()*10);
    }
  }

  // minimal startup
  function init(){
    initStarfield();
    resizeCanvases();
  }

  init();

  // Accessibility: allow Enter key on button
  enterBtn.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') enterBtn.click(); });

  document.addEventListener('touchstart', ()=>{}, {passive:true});

  // Expose some functions for debugging from console
  window._scene = {
    formHeart: formHeart,
    createPetalRain,
    createFlower,
    flowers,
    treePaths
  };

})();
