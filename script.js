/* BetCassino Neon — Mines & Roleta com partículas e som
   - Saldo em localStorage (key: bet_saldo)
   - Login demo: admin / 123
   - Som via WebAudio (sintético)
   - Partículas em canvas para explosão e confete
*/

/* ===== STORAGE & STATE ===== */
const STORAGE = { BALANCE: 'bet_saldo', BG: 'bet_bg', USER: 'bet_user' };
let state = {
  user: null,
  balance: parseFloat(localStorage.getItem(STORAGE.BALANCE) || '1000'),
  mines: { running:false, bet:0, bombs:4, grid:[], revealed:0, mult:1.0 },
  roleta: {}
};

/* ===== HELPERS ===== */
const $ = id => document.getElementById(id);
const format = n => Number(n).toFixed(2);
function saveBalance(){ localStorage.setItem(STORAGE.BALANCE, String(state.balance)); updateBalances(); }
function updateBalances(){
  const b = format(state.balance);
  if($('balance')) $('balance').innerText = b;
  if($('balanceMines')) $('balanceMines').innerText = b;
  if($('balanceRoleta')) $('balanceRoleta').innerText = b;
}

/* ===== WebAudio (sintético, leve) ===== */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

function playTone(freq=440, time=0.08, type='sine', vol=0.06){
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + time);
}

function clickSound(){ playTone(720,0.05,'sine',0.04) }
function explosionSound(){ playTone(110,0.28,'sawtooth',0.18); setTimeout(()=>playTone(220,0.12,'sine',0.08),120) }
function winSound(){ playTone(880,0.06,'triangle',0.08); setTimeout(()=>playTone(660,0.12,'sine',0.06),90) }
function spinTick(){ playTone(520,0.02,'square',0.04) }

/* ===== Background particle ambient ===== */
const bgCanvas = $('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
let bgParticles = [];
function resizeBg(){ bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
window.addEventListener('resize', resizeBg);
resizeBg();

function initBgParticles(n=40){
  bgParticles = [];
  for(let i=0;i<n;i++){
    bgParticles.push({
      x: Math.random()*bgCanvas.width,
      y: Math.random()*bgCanvas.height,
      r: Math.random()*1.8+0.6,
      vx: (Math.random()-0.5)*0.3,
      vy: (Math.random()-0.5)*0.2,
      hue: Math.random()*360
    });
  }
}
initBgParticles();

function drawBg(){
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  for(const p of bgParticles){
    p.x += p.vx; p.y += p.vy;
    if(p.x< -20) p.x = bgCanvas.width+20;
    if(p.x> bgCanvas.width+20) p.x = -20;
    if(p.y< -20) p.y = bgCanvas.height+20;
    if(p.y> bgCanvas.height+20) p.y = -20;
    bgCtx.beginPath();
    const g = bgCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*10);
    g.addColorStop(0, `hsla(${p.hue},80%,62%,0.08)`);
    g.addColorStop(1, `hsla(${p.hue},70%,40%,0)`);
    bgCtx.fillStyle = g;
    bgCtx.arc(p.x,p.y,p.r*6,0,Math.PI*2);
    bgCtx.fill();
  }
  requestAnimationFrame(drawBg);
}
drawBg();

/* ===== DOM Ready & Init ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  // DOM refs
  const login = $('login'), menu = $('menu'), mines = $('mines'), roleta = $('roleta');

  // apply background saved color
  applySavedBg();

  // login handlers
  $('loginBtn').addEventListener('click', tryLogin);
  $('demoBtn').addEventListener('click', ()=> { $('username').value='admin'; $('password').value='123'; tryLogin(); });

  $('bgColor').addEventListener('input', e => {
    const color = e.target.value; document.body.style.background = color;
    localStorage.setItem(STORAGE.BG, JSON.stringify({ color }));
  });
  $('resetBg').addEventListener('click', ()=> { localStorage.removeItem(STORAGE.BG); document.body.style.background = ''; });

  // menu
  $('btnMines').addEventListener('click', ()=> showPanel('mines'));
  $('btnRoleta').addEventListener('click', ()=> showPanel('roleta'));
  $('logoutBtn').addEventListener('click', logout);

  // mines
  $('startMines').addEventListener('click', startMinesGame);
  $('cashoutMines').addEventListener('click', cashoutMines);
  $('backFromMines').addEventListener('click', ()=> showPanel('menu'));

  // roleta
  $('spinBtn').addEventListener('click', spinRoleta);
  $('backFromRoleta').addEventListener('click', ()=> showPanel('menu'));

  // wheel build
  buildWheelCanvas();

  // update UI
  updateBalances();
  $('userLabel').innerText = state.user || '—';
  showPanel(state.user ? 'menu' : 'login');
});

/* ===== Saved BG apply ===== */
function applySavedBg(){
  try{
    const bg = JSON.parse(localStorage.getItem(STORAGE.BG) || '{}');
    if(bg && bg.color) document.body.style.background = bg.color;
  }catch(e){}
}

/* ===== Login / Logout ===== */
function tryLogin(){
  const u = $('username').value.trim(), p = $('password').value.trim();
  if((u === 'admin' && p === '123') || (u && p && u === 'demo')){
    state.user = u || 'admin'; localStorage.setItem(STORAGE.USER, state.user);
    $('userLabel').innerText = state.user;
    showPanel('menu'); playToneOnUserGesture();
  } else { alert('Usuário ou senha incorretos (modo teste).'); clickSound(); }
}
function logout(){ state.user = null; localStorage.removeItem(STORAGE.USER); showPanel('login'); }

/* play audio context resume on first user action */
function playToneOnUserGesture(){ try{ if(audioCtx.state === 'suspended') audioCtx.resume(); }catch(e){} }

/* ===== Panels navigation ===== */
function showPanel(name){
  ['login','menu','mines','roleta'].forEach(id => { const el = $(id); if(el) el.classList.toggle('hidden', id !== name); });
  updateBalances();
  if(name === 'mines') prepareMinesUI();
  if(name === 'roleta') prepareRoletaUI();
}

/* ===== MINES IMPLEMENTATION ===== */

/* Particles canvas for mines */
const minesCanvas = $('minesParticles');
let minesPctx = null;
let minesParticleList = [];
function resizeMinesCanvas(){
  const panel = $('mines');
  if(!panel) return;
  minesCanvas.width = panel.clientWidth;
  minesCanvas.height = panel.clientHeight;
  minesCanvas.style.left = panel.offsetLeft + 'px';
  minesCanvas.style.top = panel.offsetTop + 'px';
}
window.addEventListener('resize', ()=> {
  try{ resizeMinesCanvas(); }catch(e){}
});
resizeMinesCanvas();

function trapAudioContext() { try{ if(audioCtx.state === 'suspended') audioCtx.resume(); }catch(e){} }

function prepareMinesUI(){
  $('minesGrid').innerHTML = '';
  $('minesMult').innerText = '1.00x';
  $('cashoutMines').disabled = true;
  $('betMines').value = '';
  $('balanceMines').innerText = format(state.balance);
  state.mines = { running:false, bet:0, bombs:4, grid:[], revealed:0, mult:1.0 };
  resizeMinesCanvas();
  minesPctx = minesCanvas.getContext('2d');
  minesParticleList = [];
}

/* build 5x5 grid */
function buildMinesGrid(size=5, bombs=4){
  const total = size*size;
  const positions = new Set();
  while(positions.size < bombs) positions.add(Math.floor(Math.random()*total));
  const container = $('minesGrid');
  container.innerHTML = '';
  const grid = [];
  for(let i=0;i<total;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    container.appendChild(cell);
    const isBomb = positions.has(i);
    grid.push({ bomb: isBomb, revealed:false });
    cell.addEventListener('click', ()=> onClickMinesCell(i, cell));
  }
  state.mines.grid = grid;
}

/* start */
function startMinesGame(){
  trapAudioContext();
  const bet = parseFloat($('betMines').value);
  const bombs = parseInt($('bombCount').value);
  if(isNaN(bet) || bet <= 0){ alert('Digite um valor de aposta válido'); return; }
  if(bet > state.balance){ alert('Saldo insuficiente'); return; }
  // debit
  state.balance -= bet; saveBalance();
  state.mines.bet = bet; state.mines.bombs = bombs; state.mines.running = true; state.mines.revealed = 0; state.mines.mult = 1.0;
  $('cashoutMines').disabled = false;
  buildMinesGrid(5, bombs);
  $('minesMult').innerText = state.mines.mult.toFixed(2) + 'x';
  clickSound();
}

/* reveal cell */
function onClickMinesCell(idx, el){
  if(!state.mines.running) return;
  const cellState = state.mines.grid[idx];
  if(cellState.revealed) return;
  // user interacted — ensure audio resumed
  trapAudioContext();
  if(cellState.bomb){
    // explosion
    cellState.revealed = true;
    el.classList.add('bomb','revealed');
    el.textContent = '💣';
    state.mines.running = false; $('cashoutMines').disabled = true;
    explosionSound();
    emitExplosionParticles(el);
    revealAllMines();
    setTimeout(()=> alert('💥 Explodiu! A aposta foi perdida.'), 220);
  } else {
    // reveal safe
    cellState.revealed = true;
    el.classList.add('revealed'); el.textContent = '💎';
    clickSound();
    // update multiplier probabilistic
    const total = state.mines.grid.length;
    const bombs = state.mines.grid.filter(c=>c.bomb).length;
    const revealedSafe = state.mines.grid.filter(c=>c.revealed && !c.bomb).length;
    const revealedBombs = state.mines.grid.filter(c=>c.revealed && c.bomb).length;
    const remainingTotal = total - (revealedSafe+revealedBombs);
    const remainingSafe = (total - bombs) - revealedSafe;
    let p_safe = 1;
    if(remainingTotal > 0) p_safe = Math.max(0.0001, remainingSafe / remainingTotal);
    const factor = 1 / p_safe;
    // apply smoothing to avoid extreme spikes
    state.mines.mult *= Math.min(factor, 1.9);
    if(!isFinite(state.mines.mult) || state.mines.mult > 1e6) state.mines.mult = 1e6;
    state.mines.revealed = revealedSafe;
    $('minesMult').innerText = state.mines.mult.toFixed(2) + 'x';
    emitSparkleParticles(el);
  }
}

/* cashout */
function cashoutMines(){
  if(!state.mines.running) return;
  const win = state.mines.bet * state.mines.mult;
  state.balance += win; saveBalance();
  state.mines.running = false; $('cashoutMines').disabled = true;
  winSound(); emitWinConfetti();
  alert(`💸 Você sacou ${format(win)} créditos!`);
  revealAllMines();
  updateBalances();
}

/* reveal all mines visually */
function revealAllMines(){
  const cells = document.querySelectorAll('#minesGrid .cell');
  cells.forEach((el, i) => {
    const g = state.mines.grid[i];
    if(g.bomb){ el.classList.add('bomb','revealed'); el.textContent = '💣'; }
    else if(g.revealed){ /* already shown */ }
    else { el.classList.add('revealed'); el.textContent = '💎'; }
  });
}

/* ===== Mines Particles engine (simple) ===== */
function emitExplosionParticles(el){
  const rect = el.getBoundingClientRect();
  const panel = $('mines');
  const cx = rect.left + rect.width/2 - panel.getBoundingClientRect().left;
  const cy = rect.top + rect.height/2 - panel.getBoundingClientRect().top;
  for(let i=0;i<60;i++){
    minesParticleList.push({
      x: cx, y: cy,
      vx: (Math.random()-0.5)*8,
      vy: (Math.random()-1.5)*8,
      life: Math.random()*0.9+0.6,
      size: Math.random()*6+2,
      color: `hsl(${Math.random()*20+0},80%,60%)`,
      type: 'expl'
    });
  }
  scheduleMinesParticlesLoop();
}

function emitSparkleParticles(el){
  const rect = el.getBoundingClientRect();
  const panel = $('mines');
  const cx = rect.left + rect.width/2 - panel.getBoundingClientRect().left;
  const cy = rect.top + rect.height/2 - panel.getBoundingClientRect().top;
  for(let i=0;i<20;i++){
    minesParticleList.push({
      x: cx + (Math.random()-0.5)*20, y: cy + (Math.random()-0.5)*20,
      vx: (Math.random()-0.5)*1.5, vy: (Math.random()-1.8)*1.5,
      life: Math.random()*1.1+0.6,
      size: Math.random()*4+1,
      color: `hsl(${Math.random()*120+120},80%,65%)`,
      type: 'spark'
    });
  }
  scheduleMinesParticlesLoop();
}

function emitWinConfetti(){
  // confetti across mines panel
  const panel = $('mines');
  const w = panel.clientWidth, h = panel.clientHeight;
  for(let i=0;i<120;i++){
    minesParticleList.push({
      x: Math.random()*w, y: -10,
      vx: (Math.random()-0.5)*3, vy: Math.random()*3+1,
      life: Math.random()*2+1.2,
      size: Math.random()*6+3,
      color: `hsl(${Math.random()*120+100},85%,55%)`,
      type: 'conf'
    });
  }
  scheduleMinesParticlesLoop();
}

let minesParticlesRunning = false;
function scheduleMinesParticlesLoop(){
  if(minesParticlesRunning) return;
  minesParticlesRunning = true;
  const panel = $('mines');
  minesPctx = minesCanvas.getContext('2d');
  minesCanvas.width = panel.clientWidth;
  minesCanvas.height = panel.clientHeight;
  minesCanvas.style.left = panel.offsetLeft + 'px';
  minesCanvas.style.top = panel.offsetTop + 'px';
  let last = performance.now();
  function loop(now){
    const dt = (now - last)/1000; last = now;
    minesPctx.clearRect(0,0,minesCanvas.width,minesCanvas.height);
    for(let i=minesParticleList.length-1;i>=0;i--){
      const p = minesParticleList[i];
      p.x += p.vx; p.y += p.vy; p.life -= dt;
      // gravity
      if(p.type!=='spark') p.vy += 9*dt;
      minesPctx.beginPath();
      minesPctx.fillStyle = p.color;
      minesPctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      minesPctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      minesPctx.fill();
      if(p.life <= 0 || p.y > minesCanvas.height + 50) minesParticleList.splice(i,1);
    }
    minesPctx.globalAlpha = 1;
    if(minesParticleList.length>0) requestAnimationFrame(loop);
    else minesParticlesRunning = false;
  }
  requestAnimationFrame(loop);
}

/* ===== ROLETTE IMPLEMENTATION ===== */

/* Build wheel on canvas, map segments 0..36 to angles */
const wheelCanvas = $('wheelCanvas');
const wheelCtx = wheelCanvas.getContext('2d');
const wheelSize = 460;
wheelCanvas.width = wheelSize; wheelCanvas.height = wheelSize;
const segments = 37;
const degPer = 360/segments;
let wheelRotation = 0; // degrees

function buildWheelCanvas(){
  // draw segments visually (red/black with green zero)
  const ctx = wheelCtx;
  const cx = wheelSize/2, cy = wheelSize/2, r = wheelSize/2 - 6;
  ctx.clearRect(0,0,wheelSize,wheelSize);
  // background ring
  for(let i=0;i<segments;i++){
    const start = (i*degPer - 90) * Math.PI/180;
    const end = ((i+1)*degPer - 90) * Math.PI/180;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,end);
    ctx.closePath();
    // color mapping
    const num = i; // index maps to number; we'll remap when spinning
    const number = i; // for visual, treat 0..36 sequentially
    const color = (number === 0) ? '#1db954' : (isRedNumber(number) ? '#e74c3c' : '#111');
    ctx.fillStyle = color;
    ctx.fill();
    // small label
    ctx.save();
    ctx.translate(cx,cy);
    const angle = (i*degPer + degPer/2 - 90) * Math.PI/180;
    ctx.rotate(angle);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Inter, Arial';
    ctx.textAlign = 'right';
    ctx.fillText(String(number), r-12, 6);
    ctx.restore();
  }
  // center circle
  ctx.beginPath(); ctx.arc(cx,cy, r*0.45, 0, Math.PI*2); ctx.fillStyle = '#04121a'; ctx.fill();
}

/* decide red numbers */
function isRedNumber(n){
  const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  return reds.has(n);
}

/* spin logic */
let spinning = false;
function spinRoleta(){
  trapAudioContext();
  if(spinning) return;
  const bet = parseFloat($('betRoleta').value);
  const choiceRaw = $('betChoice').value.trim().toLowerCase();
  const type = $('betType').value;
  if(isNaN(bet) || bet <=0){ alert('Aposta inválida'); return; }
  if(bet > state.balance){ alert('Saldo insuficiente'); return; }
  if(type === 'color' && !choiceRaw){ alert('Escolha "red" ou "black"'); return; }
  if(type === 'number' && (choiceRaw==='' || isNaN(Number(choiceRaw)))){ alert('Escolha um número 0-36'); return; }

  // debit
  state.balance -= bet; saveBalance(); updateBalances();
  const result = Math.floor(Math.random()*37); // 0..36
  // choose target rotation so pointer hits result
  const targetTurns = 5 + Math.floor(Math.random()*3); // 5..7 turns
  const targetAngle = (targetTurns*360) + ((segments - result) * degPer) + (Math.random()*degPer - degPer/2);
  const inner = wheelCanvas;
  spinning = true;
  // spin animation using requestAnimationFrame for tick sounds
  const duration = 4200; // ms
  const start = performance.now();
  const startAngle = wheelRotation % 360;
  const change = targetAngle - startAngle;
  let lastTick = 0;
  function animate(now){
    const t = Math.min(1, (now - start) / duration);
    // ease out cubic
    const ease = 1 - Math.pow(1 - t, 3);
    const angle = startAngle + change * ease;
    wheelRotation = angle;
    // apply transform
    inner.style.transform = `rotate(${angle}deg)`;
    // tick sound approx when passes each segment
    if(Math.floor(now/80) !== Math.floor(lastTick/80)){ spinTick(); }
    lastTick = now;
    if(t < 1) requestAnimationFrame(animate);
    else {
      setTimeout(()=> finalizeSpin(result, bet, type, choiceRaw), 120);
      spinning = false;
    }
  }
  requestAnimationFrame(animate);
}

/* finalize result and payout */
function finalizeSpin(number, bet, type, choiceRaw){
  const color = (number === 0) ? 'green' : (isRedNumber(number) ? 'red' : 'black');
  $('roletaStatus').innerText = `Resultado: ${number} (${color})`;
  let win = 0;
  if(type === 'color'){
    if(choiceRaw === color) win = bet * 2;
  } else {
    if(Number(choiceRaw) === number) win = bet * 36;
  }
  if(win > 0){
    state.balance += win; saveBalance(); updateBalances();
    winSound(); showWinAnim(`+${format(win)} cred`);
    alert(`🎉 Você ganhou ${format(win)} créditos!`);
  } else {
    playTone(220,0.16,'sine',0.08); // lose tone
    showLoseAnim('Perdeu');
    alert('😢 Você perdeu');
  }
}

/* small visual win/lose */
function showWinAnim(text){
  const el = $('winAnim'); el.classList.remove('hidden'); el.innerText = `🎉 ${text}`;
  el.style.opacity = 0; el.style.transform = 'translateY(-8px)';
  requestAnimationFrame(()=> { el.style.transition = 'all .5s ease'; el.style.opacity = 1; el.style.transform = 'translateY(0)'; });
  setTimeout(()=> { el.style.transition = 'all .4s ease'; el.style.opacity = 0; setTimeout(()=> el.classList.add('hidden'),420); }, 1500);
}
function showLoseAnim(text){
  const el = $('winAnim'); el.classList.remove('hidden'); el.innerText = `✖ ${text}`;
  el.style.background = 'linear-gradient(90deg, rgba(255,80,80,0.12), rgba(255,80,80,0.06))';
  setTimeout(()=> { el.style.opacity = 0; el.classList.add('hidden'); el.style.background = ''; }, 1200);
}

/* ===== UTIL ===== */
function isRedNumber(n){
  const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  return reds.has(n);
}

/* ===== INIT UI / Expose state ===== */
updateBalances();
window._betApp = { state, saveBalance };

/* ensure wheel canvas element styled transform origin */
(function styleWheelCanvas(){ const c = $('wheelCanvas'); if(c) c.style.transformOrigin = '50% 50%'; })();
