const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const vidaEl = document.getElementById('vida');
const menuEl = document.getElementById('menu');
const mensajeEl = document.getElementById('mensajeCentro');
const nivelActualEl = document.getElementById('nivelActual');
const nombreNivelEl = document.getElementById('nombreNivel');
const tiempoEl = document.getElementById('tiempo');

// NIVELES DE BOLIVIA
const NIVELES = [
  { nombre: "Saya Afro", bpm: 100, color: "#F9E300", notas: ['a','s','k','l'], musicFile: 'audio/saya-afro.mp3' },
  { nombre: "Caporales", bpm: 120, color: "#D52B1E", notas: ['a','s','k','l'], musicFile: 'audio/caporales.mp3' },
  { nombre: "Tinku", bpm: 135, color: "#007A33", notas: ['a','s','k','l'], musicFile: 'audio/tinku.mp3' },
  { nombre: "Morenada", bpm: 150, color: "#45f3ff", notas: ['a','s','k','l'], musicFile: 'audio/morenada.mp3' }
];

const BEATS_BEFORE_HIT = 4;
const SUBDIVISIONS_PER_BEAT = 2;
const NOTE_CHANCE_PER_SUBDIVISION = 0.7;

let nivelSeleccionado = 0;
let nivelDesbloqueado = 0;
let score = 0, combo = 0, vida = 100, maxCombo = 0;
let notes = [];
let jugando = false;
let tiempoRestante = 0;
let audioCtx;
let audioMusica;
let siguienteSubdivision = BEATS_BEFORE_HIT * SUBDIVISIONS_PER_BEAT;
let segundoMostrado = -1;
let inicioMusicaEn = 0;

const TECLAS = { 'a': 0, 's': 1, 'k': 2, 'l': 3 };
const COLORES = ['#D52B1E', '#F9E300', '#007A33', '#45f3ff'];
const musicStatusEl = document.getElementById('musicStatus');

// CLASE NOTA
class Note {
  constructor(lane, tiempoGolpe, tiempoInicio) {
    this.lane = lane; // 0-3
    this.y = -30;
    this.active = true;
    this.width = canvas.width / 4 - 10;
    this.tiempoGolpe = tiempoGolpe;
    this.tiempoInicio = tiempoInicio;
    this.duracionCaida = tiempoGolpe - tiempoInicio;
  }
  update(tiempoMusica) {
    const inicioY = -30;
    const golpeY = canvas.height - 80;
    const progreso = Math.min(1, Math.max(0, (tiempoMusica - this.tiempoInicio) / this.duracionCaida));
    this.y = inicioY + (golpeY - inicioY) * progreso;
    const margenTarde = (40 / (golpeY - inicioY)) * this.duracionCaida;
    if (tiempoMusica > this.tiempoGolpe + margenTarde) {
      this.active = false;
      combo = 0;
      vida = Math.max(0, vida - 12);
      crearFeedback("FALLO", "#D52B1E");
      actualizarHUD();
    }
  }
  draw() {
    const x = (canvas.width / 4) * this.lane + 5;
    ctx.fillStyle = COLORES[this.lane];
    ctx.shadowBlur = 15;
    ctx.shadowColor = COLORES[this.lane];
    ctx.fillRect(x, this.y, this.width, 25);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(Object.keys(TECLAS)[this.lane].toUpperCase(), x + this.width/2 - 5, this.y + 17);
  }
}

function tocarSonido(freq) {
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = freq;
  o.type = 'triangle';
  g.gain.setValueAtTime(0.3, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + 0.3);
}

function spawnNota(tiempoGolpe, tiempoInicio) {
  if(!jugando) return;
  const lanes = NIVELES[nivelSeleccionado].notas;
  const tecla = lanes[Math.floor(Math.random() * lanes.length)];
  const laneIndex = TECLAS[tecla];
  notes.push(new Note(laneIndex, tiempoGolpe, tiempoInicio));
}

function crearFeedback(texto, color) {
  mensajeEl.textContent = texto;
  mensajeEl.style.color = color;
  setTimeout(()=> { if(jugando) mensajeEl.textContent = `¡${NIVELES[nivelSeleccionado].nombre.toUpperCase()}!`; }, 300);
}

function golpear(tecla) {
  if(!jugando) return;
  const lane = TECLAS[tecla];
  if(lane === undefined) return;

  // Efecto visual en carril
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect((canvas.width/4)*lane, canvas.height-100, canvas.width/4, 100);

  for(let i = notes.length-1; i>=0; i--) {
    if(notes[i].lane === lane && notes[i].y > canvas.height - 150 && notes[i].y < canvas.height - 20) {
      const diff = Math.abs(canvas.height - 80 - notes[i].y);
      if(diff < 25) { score += 100 + combo*2; crearFeedback("¡PERFECTO! 🇧🇴", "#F9E300"); }
      else { score += 50; crearFeedback("¡BIEN!", "#00E676"); }
      combo++; maxCombo = Math.max(maxCombo, combo);
      vida = Math.min(100, vida+3);
      notes.splice(i,1);
      tocarSonido(880);
      actualizarHUD();
      return;
    }
  }
  combo = 0;
  actualizarHUD();
}

function actualizarHUD() {
  vida = Math.max(0, Math.min(100, vida));
  scoreEl.textContent = String(score).padStart(4, '0');
  comboEl.textContent = combo;
  vidaEl.style.width = vida + '%';
  nivelActualEl.textContent = nivelSeleccionado + 1;
  nombreNivelEl.textContent = NIVELES[nivelSeleccionado].nombre;
  if (vida <= 0 && jugando) gameOver();
}

function gameLoop() {
  if(!jugando || !audioMusica) return;
  const nivel = NIVELES[nivelSeleccionado];
  const tiempoMusica = audioMusica.currentTime - inicioMusicaEn;
  const duracionPulso = 60 / nivel.bpm;
  const tiempoAnticipacion = BEATS_BEFORE_HIT * duracionPulso;

  while (siguienteSubdivision * duracionPulso / SUBDIVISIONS_PER_BEAT - tiempoAnticipacion <= tiempoMusica) {
    const tiempoGolpe = siguienteSubdivision * duracionPulso / SUBDIVISIONS_PER_BEAT;
    const tiempoInicio = tiempoGolpe - tiempoAnticipacion;
    if (Math.random() < NOTE_CHANCE_PER_SUBDIVISION && tiempoGolpe <= audioMusica.duration) {
      spawnNota(tiempoGolpe, tiempoInicio);
    }
    siguienteSubdivision++;
  }

  const segundosRestantes = Math.max(0, Math.ceil(audioMusica.duration - audioMusica.currentTime));
  if (segundosRestantes !== segundoMostrado) {
    tiempoRestante = segundosRestantes;
    segundoMostrado = segundosRestantes;
    actualizarTiempo();
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Dibuja carriles
  for(let i=0; i<4; i++) {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.strokeRect((canvas.width/4)*i, 0, canvas.width/4, canvas.height);
  }
  // Linea de golpe
  ctx.fillStyle = "#F9E300";
  ctx.shadowBlur = 10; ctx.shadowColor = "#F9E300";
  ctx.fillRect(0, canvas.height-80, canvas.width, 6);
  ctx.shadowBlur = 0;

  // Actualizar y dibujar notas
  for (let i = notes.length - 1; i >= 0; i--) {
    notes[i].update(tiempoMusica);
    if (!jugando) return;
    notes[i].draw();
    if (!notes[i].active) {
      notes.splice(i, 1);
    }
  }
  requestAnimationFrame(gameLoop);
}

function iniciarJuego() {
  if (jugando) return;
  score = 0; combo = 0; vida = 100; maxCombo = 0; notes = [];
  tiempoRestante = 0;
  siguienteSubdivision = BEATS_BEFORE_HIT * SUBDIVISIONS_PER_BEAT;
  segundoMostrado = -1;
  jugando = true;
  menuEl.style.display = 'none';
  iniciarMusicaDelNivel().then((duracion) => {
    if (!jugando || !audioMusica) return;
    tiempoRestante = Math.ceil(duracion);
    actualizarTiempo();
    actualizarHUD();
    gameLoop();
    tocarSonido(523);
  }).catch((error) => {
    jugando = false;
    detenerMusica();
    menuEl.style.display = 'block';
    musicStatusEl.textContent = `No se pudo reproducir la música de ${NIVELES[nivelSeleccionado].nombre}: ${error.message}`;
  });
}

function actualizarTiempo() {
  const minutos = Math.floor(tiempoRestante / 60);
  const segundos = tiempoRestante % 60;
  tiempoEl.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

function terminarCancion() {
  gameOver('Canción completada');
}

function gameOver(motivo = 'Vida agotada') {
  if (!jugando) return;
  jugando = false;
  detenerMusica();
  notes = [];
  menuEl.style.display = 'block';
  musicStatusEl.textContent = 'Música detenida.';

  let desbloqueo = '';
  if (score >= 2000 && nivelDesbloqueado < NIVELES.length - 1) {
    nivelDesbloqueado++;
    desbloqueo = ` ¡Nivel desbloqueado: ${NIVELES[nivelDesbloqueado].nombre}!`;
    actualizarBloqueos();
  }

  mensajeEl.textContent = `${motivo} - Puntuación final: ${score} - Mejor combo: ${maxCombo}.${desbloqueo}`;
}

function seleccionarNivel(n) {
  if (n > nivelDesbloqueado) return;
  nivelSeleccionado = n;
  document.querySelectorAll('.nivel-btn').forEach((b,i)=>{
    b.classList.toggle('activo', i===n);
  });
  nombreNivelEl.textContent = NIVELES[n].nombre;
  nivelActualEl.textContent = n+1;
  actualizarMusicaDelNivel();
}

// Controles
document.addEventListener('keydown', e=>{
  if(Object.keys(TECLAS).includes(e.key.toLowerCase())) golpear(e.key.toLowerCase());
});

document.querySelectorAll('.nivel-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> seleccionarNivel(parseInt(btn.dataset.nivel)));
});

document.querySelectorAll('.btn-movil').forEach(b=>{
  b.addEventListener('pointerdown', e=>{
    e.preventDefault();
    golpear(b.dataset.tecla);
  });
});

document.getElementById('btnJugar').addEventListener('click', iniciarJuego);

function actualizarMusicaDelNivel() {
  const nivel = NIVELES[nivelSeleccionado];
  musicStatusEl.textContent = `Al pulsar Jugar comenzará: ${nivel.musicFile.split('/').pop()}.`;
}

function iniciarMusicaDelNivel() {
  detenerMusica();
  const nivel = NIVELES[nivelSeleccionado];
  audioMusica = new Audio(new URL(nivel.musicFile, document.baseURI).href);
  audioMusica.loop = false;
  audioMusica.volume = 0.6;
  audioMusica.addEventListener('ended', terminarCancion, { once: true });
  const musica = audioMusica;
  const metadataLista = new Promise((resolve, reject) => {
    if (Number.isFinite(musica.duration)) {
      resolve();
      return;
    }
    musica.addEventListener('loadedmetadata', resolve, { once: true });
    musica.addEventListener('error', () => reject(new Error('No se pudo cargar el archivo de audio.')), { once: true });
  });
  return Promise.all([musica.play(), metadataLista]).then(() => {
    if (!Number.isFinite(musica.duration) || musica.duration <= 0) {
      throw new Error('El archivo de audio no tiene una duración válida.');
    }
    if (audioMusica !== musica) return 0;
    inicioMusicaEn = musica.currentTime;
    musicStatusEl.textContent = `Reproduciendo: ${nivel.musicFile.split('/').pop()}.`;
    return musica.duration;
  }).catch((error) => {
    if (audioMusica === musica) {
      musicStatusEl.textContent = `No se pudo reproducir la música de ${nivel.nombre}: ${error.message}`;
    }
    throw error;
  });
}

function detenerMusica() {
  if (!audioMusica) return;
  audioMusica.pause();
  audioMusica.currentTime = 0;
  audioMusica = null;
}

function actualizarBloqueos() {
  document.querySelectorAll('.nivel-btn').forEach((btn, index) => {
    const bloqueado = index > nivelDesbloqueado;
    btn.classList.toggle('bloqueado', bloqueado);
    btn.disabled = bloqueado;
  });
}

ctx.imageSmoothingEnabled = true;
actualizarBloqueos();
actualizarMusicaDelNivel();
gameLoop();