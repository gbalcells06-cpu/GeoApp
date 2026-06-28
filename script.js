// ---- Estado global ----
let geoData = null;          // FeatureCollection del modo actual (continente o repaso)
let currentContinent = null; // continente activo (para guardar stats con el id correcto)
let countries = [];          // lista mezclada de países pendientes
let currentCountry = null;   // país objetivo actual
let countriesTotal = 0;
let correctCount = 0;
let assistedCount = 0;
let wrongCount = 0;
let mapSelectedOk = false;   // si ya se seleccionó correctamente el país en el mapa
let hintLevel = 0;           // nº de letras de pista reveladas
let usedAssist = false;      // si en el país actual se ha usado pista o reintento

// Modo de juego elegido en el menú (afecta a la siguiente partida que se
// empiece) y modo "congelado" de la partida en curso, para que cambiar el
// selector a mitad de partida no la altere hasta la siguiente vez que se entre.
//   completo: localizar el país en el mapa y luego escribir su capital (modo clásico).
//   mapa:     solo localizar el país en el mapa, sin preguntar la capital.
//   capital:  el país objetivo ya aparece resaltado en el mapa; solo hay que escribir su capital.
//   reverso:  se muestra el nombre de una capital y hay que localizar su país en el mapa.
//   test:     como "completo", pero la capital se responde eligiendo entre 4 opciones.
let gameMode = "completo";
let currentGameMode = "completo";

// ---- Elementos ----
const screens = {
  home: document.getElementById("screen-home"),
  options: document.getElementById("screen-options"),
  menu: document.getElementById("screen-menu"),
  game: document.getElementById("screen-game"),
  summary: document.getElementById("screen-summary"),
  studySelect: document.getElementById("screen-study-select"),
  study: document.getElementById("screen-study"),
  zoneSelect: document.getElementById("screen-zone-select"),
  customSelect: document.getElementById("screen-custom-select"),
};

let zoneContinent = null;          // continente activo en el flujo "Practicar por zonas"
let customSelectedIsos = new Set(); // selección en curso en la pantalla de mapa personalizado

// ---- Idioma / internacionalización ----
// El español vive directamente en los datos (properties.name_es, properties.capital,
// COUNTRY_FACTS, GENERAL_FACTS) y sirve de "fallback" universal: si falta una traducción
// para el idioma activo (p.ej. porque el fichero data/facts-<lang>.js no se ha cargado
// o le falta una clave), siempre se cae de vuelta al español en vez de romperse.
let currentLang = "es";
try {
  const storedLang = localStorage.getItem("app-lang");
  if (storedLang && UI_STRINGS[storedLang]) currentLang = storedLang;
} catch {
  // si localStorage no está disponible, se queda en español
}

// Tablas de nombres traducidos por idioma (data/i18n-names-<lang>.js), si están cargadas.
const COUNTRY_NAMES_BY_LANG = {
  en: typeof COUNTRY_NAMES_EN !== "undefined" ? COUNTRY_NAMES_EN : null,
  fr: typeof COUNTRY_NAMES_FR !== "undefined" ? COUNTRY_NAMES_FR : null,
  pt: typeof COUNTRY_NAMES_PT !== "undefined" ? COUNTRY_NAMES_PT : null,
  de: typeof COUNTRY_NAMES_DE !== "undefined" ? COUNTRY_NAMES_DE : null,
};

// Tablas de curiosidades traducidas por idioma (data/facts-<lang>.js), si están cargadas.
const COUNTRY_FACTS_BY_LANG = {
  en: typeof COUNTRY_FACTS_EN !== "undefined" ? COUNTRY_FACTS_EN : null,
  fr: typeof COUNTRY_FACTS_FR !== "undefined" ? COUNTRY_FACTS_FR : null,
  pt: typeof COUNTRY_FACTS_PT !== "undefined" ? COUNTRY_FACTS_PT : null,
  de: typeof COUNTRY_FACTS_DE !== "undefined" ? COUNTRY_FACTS_DE : null,
};
const GENERAL_FACTS_BY_LANG = {
  en: typeof GENERAL_FACTS_EN !== "undefined" ? GENERAL_FACTS_EN : null,
  fr: typeof GENERAL_FACTS_FR !== "undefined" ? GENERAL_FACTS_FR : null,
  pt: typeof GENERAL_FACTS_PT !== "undefined" ? GENERAL_FACTS_PT : null,
  de: typeof GENERAL_FACTS_DE !== "undefined" ? GENERAL_FACTS_DE : null,
};

// Cadena de interfaz traducida; si falta la clave en el idioma activo, cae a español.
function t(key) {
  const dict = UI_STRINGS[currentLang] || UI_STRINGS.es;
  return dict[key] ?? UI_STRINGS.es[key] ?? key;
}

function tContinentName(continentId) {
  const entry = CONTINENT_NAMES[continentId];
  if (!entry) return continentId;
  return entry[currentLang] || entry.es;
}

function tZoneName(continentId, zoneId) {
  const entry = ZONE_NAMES[`${continentId}.${zoneId}`];
  if (!entry) return zoneId;
  return entry[currentLang] || entry.es;
}

// Nombre/capital localizados de un país o territorio (feature de un FeatureCollection).
// Recurre siempre al español de los datos originales si falta la traducción.
function tCountryName(feature) {
  const iso = feature.properties["ISO3166-1-Alpha-3"];
  const table = COUNTRY_NAMES_BY_LANG[currentLang];
  return (table && table[iso] && table[iso].name) || feature.properties.name_es;
}

function tCapitalName(feature) {
  const iso = feature.properties["ISO3166-1-Alpha-3"];
  const table = COUNTRY_NAMES_BY_LANG[currentLang];
  return (table && table[iso] && table[iso].capital) || feature.properties.capital;
}

function tParentName(parentNameEs) {
  const entry = PARENT_COUNTRY_NAMES[parentNameEs];
  if (!entry) return parentNameEs;
  return entry[currentLang] || entry.es;
}

// Recorre el DOM aplicando las cadenas del idioma activo a cualquier elemento
// marcado con data-i18n (texto) o data-i18n-placeholder (atributo placeholder).
function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
}

function setLanguage(lang) {
  if (!UI_STRINGS[lang]) return;
  currentLang = lang;
  localStorage.setItem("app-lang", lang);
  applyTranslations();
}

const MAX_HINTS = 3; // a partir de la 4ª pista solicitada, se cuenta como fallo

// Para el cálculo del encuadre automático del mapa, ignora los países
// configurados en FIT_BOUNDS_EXCLUDE (p.ej. Rusia en Europa), que de otro
// modo forzarían un zoom alejado y empequeñecerían al resto de países. Esos
// países se siguen dibujando y se pueden seguir pulsando con normalidad.
function getFitData(continentId, data) {
  const exclude = FIT_BOUNDS_EXCLUDE[continentId];
  if (!exclude || !exclude.length) return data;
  const filtered = data.features.filter((f) => !exclude.includes(f.properties["ISO3166-1-Alpha-3"]));
  if (filtered.length === 0) return data;
  return { type: "FeatureCollection", features: filtered };
}

// Algunos continentes (Oceanía) necesitan rotar la proyección para que el
// antimeridiano no corte por en medio de países que lo cruzan de verdad
// (Fiyi, Kiribati, las Chatham de Nueva Zelanda). Ver PROJECTION_ROTATE.
function makeProjection(continentId) {
  const rotate = PROJECTION_ROTATE[continentId];
  const projection = d3.geoMercator();
  if (rotate) projection.rotate(rotate);
  return projection;
}

// ---- Zoom de mapas (rueda/arrastre/doble clic + botones) ----
// Un único d3.zoom() por <svg>, creado la primera vez y reutilizado después: el
// manejador "zoom" busca el grupo ".zoom-layer" en el momento del evento (no guarda
// una referencia fija), así que sigue funcionando aunque el mapa se vuelva a dibujar.
const zoomBehaviors = {};

function attachZoom(svgId) {
  const svgEl = document.getElementById(svgId);
  const svg = d3.select(svgEl);
  let zoom = zoomBehaviors[svgId];
  if (zoom) {
    zoom.transform(svg, d3.zoomIdentity);
    return;
  }
  // Sin esto, los marcadores de isla (radio fijo en SVG) se agrandan junto con
  // el zoom igual que el propio mapa, así que un grupo de islas pequeñas y
  // pegadas (p.ej. el Caribe) sigue viéndose como una mancha borrosa por mucho
  // que se acerque el zoom: los puntos crecen al mismo ritmo que la distancia
  // entre ellos. Para que acercar el zoom realmente separe los puntos,
  // compensamos el radio y el grosor de borde dividiéndolos por la escala
  // actual, de forma que mantengan un tamaño constante en pantalla.
  zoom = d3
    .zoom()
    .scaleExtent([1, 24])
    .on("zoom", (event) => {
      const layer = svg.select(".zoom-layer");
      layer.attr("transform", event.transform);
      const k = event.transform.k;
      layer.selectAll(".island-marker").attr("r", 6 / k).style("stroke-width", 1.2 / k + "px");
    });
  svg.call(zoom);
  zoomBehaviors[svgId] = zoom;

  const controls = document.createElement("div");
  controls.className = "zoom-controls";
  controls.innerHTML = `
    <button type="button" class="zoom-btn zoom-in" title="Acercar">+</button>
    <button type="button" class="zoom-btn zoom-out" title="Alejar">&minus;</button>
    <button type="button" class="zoom-btn zoom-reset" title="Restablecer zoom">&#10227;</button>
  `;
  svgEl.parentElement.appendChild(controls);
  controls.querySelector(".zoom-in").addEventListener("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1.5));
  controls.querySelector(".zoom-out").addEventListener("click", () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.5));
  controls.querySelector(".zoom-reset").addEventListener("click", () => svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity));
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
  startMusic(name === "game" ? "game" : "menu");
}

// ---- Estadísticas persistentes (para el modo repaso y el progreso) ----
const STATS_KEY = "capitalsStats";
const STATS_VERSION_KEY = "capitalsStatsVersion";
// Subir este número cada vez que se haga un cambio importante en la lógica
// de estadísticas: al detectar un número distinto al guardado, se borran
// los datos antiguos automáticamente para evitar datos corruptos/incompatibles.
const STATS_VERSION = 2;

function ensureStatsVersion() {
  const storedVersion = Number(localStorage.getItem(STATS_VERSION_KEY));
  if (storedVersion !== STATS_VERSION) {
    localStorage.removeItem(STATS_KEY);
    localStorage.setItem(STATS_VERSION_KEY, String(STATS_VERSION));
  }
}

function loadAllStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAllStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

const MASTERED_STREAK = 2; // aciertos directos consecutivos para salir del repaso de fallos

// Rellena campos que falten en entradas guardadas con una versión anterior de la app.
function normalizeEntry(entry) {
  if (entry.assist === undefined) entry.assist = 0;
  if (entry.fail === undefined) entry.fail = 0;
  if (entry.streak === undefined) entry.streak = 0;
  if (entry.attempts === undefined) entry.attempts = entry.assist + entry.fail;
  if (entry.points === undefined) entry.points = entry.assist * 0.5;
  return entry;
}

// outcome: "correct" (acierto directo), "assisted" (con pista/reintento) o "fail" (mostrar respuesta)
function recordOutcome(continentId, iso, outcome) {
  const stats = loadAllStats();
  if (!stats[continentId]) stats[continentId] = {};
  if (!stats[continentId][iso]) {
    stats[continentId][iso] = { assist: 0, fail: 0, streak: 0, attempts: 0, points: 0 };
  }
  const entry = normalizeEntry(stats[continentId][iso]);
  entry.attempts++;
  if (outcome === "correct") {
    entry.points += 1;
    entry.streak++;
  } else if (outcome === "assisted") {
    entry.assist++;
    entry.points += 0.5;
    entry.streak = 0;
  } else if (outcome === "fail") {
    entry.fail++;
    entry.streak = 0;
  }
  saveAllStats(stats);
}

function getDifficultIsos(continentId) {
  const stats = loadAllStats()[continentId] || {};
  return Object.entries(stats)
    .map(([iso, v]) => {
      normalizeEntry(v);
      return { iso, score: v.assist + v.fail * 2, streak: v.streak };
    })
    .filter((e) => e.score > 0 && e.streak < MASTERED_STREAK)
    .sort((a, b) => b.score - a.score)
    .map((e) => e.iso);
}

function getCountryScore(continentId, iso) {
  const stats = loadAllStats()[continentId] || {};
  const e = stats[iso];
  if (!e) return null;
  normalizeEntry(e);
  if (e.attempts === 0) return null;
  return e.points / e.attempts; // 0 (siempre mal) .. 1 (siempre bien a la primera)
}

// ---- Sonido (Web Audio API, sin archivos externos) ----
let audioCtx = null;
function getAudioCtx() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, start, duration, type, peakGain) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain || 0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

let sfxEnabled = true;
try {
  const storedSfx = localStorage.getItem("sfx-enabled");
  if (storedSfx !== null) sfxEnabled = JSON.parse(storedSfx);
} catch {
  // ajuste por defecto si localStorage no está disponible
}

function playSound(kind) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    if (kind === "correct") {
      [523.25, 659.25, 783.99].forEach((f, i) => playTone(f, now + i * 0.08, 0.22, "sine"));
    } else if (kind === "fail") {
      // sonido "trombón triste" descendente
      [392, 349.23, 311.13, 261.63].forEach((f, i) =>
        playTone(f, now + i * 0.14, 0.32, "triangle", 0.2)
      );
    } else if (kind === "wrongAttempt") {
      playTone(220, now, 0.18, "square", 0.12);
    } else if (kind === "wrongCountry") {
      playTone(180, now, 0.12, "sawtooth", 0.1);
    } else if (kind === "mapCorrect") {
      playTone(523.25, now, 0.15, "sine", 0.18);
    } else if (kind === "continent") {
      // pequeña fanfarria percusiva al entrar a practicar un continente
      [196, 233.08, 293.66, 349.23].forEach((f, i) =>
        playTone(f, now + i * 0.1, 0.28, "triangle", 0.22)
      );
    } else if (kind === "click") {
      playTone(660, now, 0.08, "sine", 0.12);
    } else if (kind === "toggle") {
      playTone(500, now, 0.05, "sine", 0.1);
      playTone(720, now + 0.05, 0.08, "sine", 0.1);
    }
  } catch {
    // si el navegador bloquea audio, simplemente se omite el sonido
  }
}

// Golpe percusivo de ruido filtrado (sin archivos de audio): se genera un
// buffer de ruido blanco y se le da forma con un filtro y una envolvente.
// Sirve de base para los efectos "étnicos" de cada continente (tambores,
// palmas, palos, etc.) que no se pueden imitar solo con osciladores.
function playNoiseHit(start, duration, filterFreq, filterType, peakGain) {
  const ctx = getAudioCtx();
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peakGain, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

// Zumbido grave con vibrato rápido, recordando a un didyeridú: una onda de
// diente de sierra cuya frecuencia oscila ligeramente mediante un LFO.
function playDrone(start, duration, freq, peakGain) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 6;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 10;
  lfo.connect(lfoGain).connect(osc.frequency);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  lfo.start(start);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  lfo.stop(start + duration + 0.05);
}

// ---- Efectos de sonido "de bienvenida" por continente ----
// Al elegir un continente (practicar, repaso, zonas o Ver mundo) suena un
// pequeño efecto evocando algún elemento musical característico de la
// región, en vez de un simple "clic" genérico.
function playContinentSound(continentId) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    if (continentId === "africa") {
      // tres golpes de tambor (djembé): grave-medio-grave, con resonancia cálida
      playNoiseHit(now, 0.2, 180, "lowpass", 0.55);
      playNoiseHit(now + 0.17, 0.14, 300, "lowpass", 0.4);
      playNoiseHit(now + 0.32, 0.24, 150, "lowpass", 0.6);
    } else if (continentId === "asia") {
      // gong grave de fondo + frase pentatónica brillante tipo campana/erhu
      playNoiseHit(now, 1.0, 130, "lowpass", 0.3);
      [523.25, 587.33, 659.25, 783.99].forEach((f, i) =>
        playTone(f, now + 0.05 + i * 0.11, 0.5, "triangle", 0.22)
      );
    } else if (continentId === "europa") {
      // pequeña fanfarria orquestal: arpegio de tríada mayor ascendente
      [392.0, 493.88, 587.33, 783.99].forEach((f, i) => playTone(f, now + i * 0.07, 0.35, "sine", 0.25));
    } else if (continentId === "america") {
      // golpes secos sincopados tipo clave/percusión latina + acorde cálido de fondo
      [0, 0.18, 0.36].forEach((t) => playNoiseHit(now + t, 0.07, 1000, "highpass", 0.28));
      [261.63, 329.63, 392.0].forEach((f) => playTone(f, now, 0.45, "sawtooth", 0.1));
    } else if (continentId === "oceania") {
      // zumbido grave tipo didyeridú + dos golpes secos de palo
      playDrone(now, 1.1, 98, 0.25);
      playNoiseHit(now + 0.55, 0.05, 2200, "bandpass", 0.3);
      playNoiseHit(now + 0.75, 0.05, 2200, "bandpass", 0.3);
    } else {
      playSound("click");
    }
  } catch {
    // si el audio falla, simplemente se omite el efecto
  }
}

// ---- Música de fondo (procedural, Web Audio API, sin archivos externos) ----
// Dos "pistas" generadas por código: una pausada para los menús/Ver mundo y
// otra algo más rítmica (con un pulso de bajo) para cuando se está jugando.
// Cada nota se programa con su propio nodo de ganancia conectado a un nodo
// maestro (musicGain) para poder silenciar/bajar el volumen sin tocar los
// efectos de sonido (playSound), que van directos a ctx.destination.
let musicGain = null;
let musicTimer = null;
let musicStep = 0;
let currentTrack = null; // "menu" | "game" | null
let musicEnabled = true;
let musicVolume = 0.5;

(function loadMusicSettings() {
  try {
    const storedEnabled = localStorage.getItem("music-enabled");
    const storedVolume = localStorage.getItem("music-volume");
    if (storedEnabled !== null) musicEnabled = JSON.parse(storedEnabled);
    if (storedVolume !== null) musicVolume = JSON.parse(storedVolume);
  } catch {
    // ajustes por defecto si localStorage no está disponible
  }
})();

// Factor de escala entre el volumen elegido por el usuario (0..1) y la
// ganancia real del bus de música: se mantiene por debajo de 1 para que la
// música quede de fondo y nunca tape los efectos de sonido ni la mascota.
const MUSIC_GAIN_SCALE = 0.55;

function getMusicGain() {
  if (!musicGain) {
    musicGain = getAudioCtx().createGain();
    musicGain.gain.value = musicEnabled ? musicVolume * MUSIC_GAIN_SCALE : 0;
    musicGain.connect(getAudioCtx().destination);
  }
  return musicGain;
}

function playMusicTone(freq, start, duration, type, peakGain) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(getMusicGain());
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Acordes en Hz por pista. En vez de un único patrón fijo que sube y baja en
// bucle (lo que cansa muy rápido), cada pista es una progresión de acordes:
// cada "chordSteps" pasos se avanza al siguiente acorde, y dentro de cada
// acorde la nota se elige semi-al azar (evitando repetir la misma nota dos
// veces seguidas, y con alguna nota suelta una octava arriba de cuando en
// cuando) para que la melodía varíe constantemente sin perder la armonía de
// fondo. "menu" usa una progresión de acordes de séptima, pausada y
// ambiental; "game" usa una progresión pentatónica más rápida con un golpe de
// bajo (la raíz del acorde, una octava abajo) cada pocos pasos.
const MUSIC_TRACKS = {
  menu: {
    step: 0.6,
    type: "sine",
    noteDuration: 1.3,
    peakGain: 0.55,
    chordSteps: 7,
    restChance: 0.12,
    octaveUpChance: 0.12,
    chords: [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7: C4 E4 G4 B4
      [220.0, 261.63, 329.63, 392.0], // Am7: A3 C4 E4 G4
      [174.61, 220.0, 261.63, 329.63], // Fmaj7: F3 A3 C4 E4
      [196.0, 246.94, 293.66, 329.63], // G6: G3 B3 D4 E4
      [233.08, 293.66, 349.23, 440.0], // Bbmaj7: Bb3 D4 F4 A4 (un giro armónico para no repetirse siempre igual)
    ],
  },
  game: {
    step: 0.34,
    type: "triangle",
    noteDuration: 0.48,
    peakGain: 0.42,
    chordSteps: 6,
    restChance: 0.08,
    octaveUpChance: 0.18,
    bassEvery: 3,
    chords: [
      [196.0, 233.08, 293.66, 349.23], // G3 Bb3 D4 F4
      [261.63, 293.66, 349.23, 392.0], // C4 D4 F4 G4
      [220.0, 261.63, 329.63, 392.0], // A3 C4 E4 G4
      [196.0, 246.94, 293.66, 349.23], // G3 B3 D4 F4
    ],
  },
};

// Recuerda la última nota tocada por pista para no repetirla dos veces
// seguidas (lo que es lo que hacía que la versión anterior se sintiera tan
// machacona).
const lastMusicNote = { menu: null, game: null };

function pickMusicNote(track, chord) {
  let note = chord[Math.floor(Math.random() * chord.length)];
  if (chord.length > 1) {
    let attempts = 0;
    while (note === lastMusicNote[currentTrack] && attempts < 4) {
      note = chord[Math.floor(Math.random() * chord.length)];
      attempts++;
    }
  }
  lastMusicNote[currentTrack] = note;
  if (Math.random() < track.octaveUpChance) note *= 2;
  return note;
}

function scheduleMusicStep() {
  const track = MUSIC_TRACKS[currentTrack];
  if (!track) {
    musicTimer = null;
    return;
  }
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const chordIndex = Math.floor(musicStep / track.chordSteps) % track.chords.length;
    const chord = track.chords[chordIndex];
    const isRest = musicStep > 0 && Math.random() < track.restChance;
    if (!isRest) {
      const note = pickMusicNote(track, chord);
      playMusicTone(note, now, track.noteDuration, track.type, track.peakGain);
    }
    if (track.bassEvery && musicStep % track.bassEvery === 0) {
      playMusicTone(chord[0] / 2, now, track.noteDuration * 1.7, "sine", track.peakGain * 0.75);
    }
  } catch {
    // si una nota concreta falla, la música no debe detenerse por ello
  }
  musicStep++;
  musicTimer = setTimeout(scheduleMusicStep, track.step * 1000);
}

function stopMusicTimer() {
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

function startMusic(track) {
  try {
    currentTrack = track;
    if (!musicEnabled) return; // se recuerda la pista, pero no se reproduce
    if (musicTimer) return; // ya hay un ciclo de notas programado; el próximo paso usará la nueva pista
    musicStep = 0;
    scheduleMusicStep();
  } catch {
    // si el navegador bloquea audio (p.ej. antes de la primera interacción), se omite
  }
}

// Los navegadores no dejan sonar audio hasta la primera interacción del
// usuario: el AudioContext se crea "suspended" y, aunque el bucle de música
// ya esté programado de fondo, no se oirá nada hasta este resume().
function unlockAudioOnce() {
  try {
    getAudioCtx().resume();
  } catch {
    // sin soporte de Web Audio, no hay nada que desbloquear
  }
  document.removeEventListener("click", unlockAudioOnce);
  document.removeEventListener("keydown", unlockAudioOnce);
}
document.addEventListener("click", unlockAudioOnce);
document.addEventListener("keydown", unlockAudioOnce);

function setMusicEnabled(enabled) {
  // Esta función se llama directamente desde el clic del interruptor en
  // Opciones, así que es un buen sitio extra para desbloquear el audio (por
  // si el navegador no llegó a desbloquearlo antes con otro clic).
  try {
    getAudioCtx().resume();
  } catch {
    // sin soporte de Web Audio, no hay nada que desbloquear
  }
  musicEnabled = enabled;
  localStorage.setItem("music-enabled", JSON.stringify(enabled));
  if (enabled) {
    getMusicGain().gain.value = musicVolume * MUSIC_GAIN_SCALE;
    if (!currentTrack) currentTrack = "menu";
    if (!musicTimer) scheduleMusicStep();
    playMusicTone(440, getAudioCtx().currentTime, 0.3, "sine", 0.4); // pequeño tono de confirmación audible
  } else {
    stopMusicTimer();
    getMusicGain().gain.value = 0;
  }
}

function setMusicVolume(v) {
  try {
    getAudioCtx().resume();
  } catch {
    // sin soporte de Web Audio, no hay nada que desbloquear
  }
  musicVolume = v;
  localStorage.setItem("music-volume", JSON.stringify(v));
  if (musicEnabled) getMusicGain().gain.value = v * MUSIC_GAIN_SCALE;
}

// ---- Menú ----
function buildMenu() {
  document.getElementById("toggle-menu-territories").checked = false;
  const list = document.getElementById("continent-list");
  list.innerHTML = "";

  CONTINENTS.forEach((c) => {
    const group = document.createElement("div");
    group.className = "continent-group";

    const cName = tContinentName(c.id);
    const btn = document.createElement("button");
    btn.className = "continent-btn" + (c.enabled ? "" : " disabled");
    btn.textContent = `${cName} ${t("menu.completo")}`;
    if (c.enabled) {
      btn.addEventListener("click", () => {
        playContinentSound(c.id);
        startContinent(c);
      });
    } else {
      btn.disabled = true;
      btn.title = t("menu.comingSoon");
    }
    group.appendChild(btn);

    if (c.enabled) {
      const reinforceBtn = document.createElement("button");
      const difficultCount = getDifficultIsos(c.id).length;
      reinforceBtn.className = "continent-btn reinforce" + (difficultCount === 0 ? " disabled" : "");
      reinforceBtn.textContent = `${cName} — ${t("menu.reinforce")} (${difficultCount})`;
      if (difficultCount > 0) {
        reinforceBtn.addEventListener("click", () => {
          playContinentSound(c.id);
          startReinforcement(c);
        });
      } else {
        reinforceBtn.disabled = true;
        reinforceBtn.title = t("menu.noReinforce");
      }
      group.appendChild(reinforceBtn);

      const zoneBtn = document.createElement("button");
      zoneBtn.className = "continent-btn zone-saved";
      zoneBtn.textContent = `${cName} — ${t("menu.zones")}`;
      zoneBtn.addEventListener("click", () => {
        playContinentSound(c.id);
        openZoneSelect(c);
      });
      group.appendChild(zoneBtn);
    }

    list.appendChild(group);
  });
}

function buildStudyMenu() {
  const list = document.getElementById("study-continent-list");
  list.innerHTML = "";
  CONTINENTS.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "continent-btn" + (c.enabled ? "" : " disabled");
    btn.textContent = tContinentName(c.id);
    if (c.enabled) {
      btn.addEventListener("click", () => {
        playContinentSound(c.id);
        openStudy(c);
      });
    } else {
      btn.disabled = true;
      btn.title = t("menu.comingSoon");
    }
    list.appendChild(btn);
  });
}

// ---- Modo "Ver mundo" (estudio, con progreso opcional) ----
let studyContinent = null;
let studyData = null;
let studyProgressMode = false;
let studyTerritoryMode = "sovereign"; // sovereign | both | territoriesOnly

function openStudy(continent) {
  studyContinent = continent;
  studyData = continent.getData();
  document.getElementById("study-title").textContent = tContinentName(continent.id);
  document.getElementById("toggle-study-progress").checked = false;
  studyProgressMode = false;
  studyTerritoryMode = "sovereign";
  document.querySelectorAll("#study-territory-mode .segmented-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === "sovereign");
  });
  document.getElementById("study-progress-legend").classList.add("hidden");
  drawStudyMap();
  buildStudyList();
  showScreen("study");
  if (window.mascot) window.mascot.setExpression("curious", 2000);
}

// Países que entran en la lista lateral y se pueden seleccionar con normalidad,
// según el modo de territorios elegido en "Ver mundo".
function studyVisibleFeatures() {
  if (studyTerritoryMode === "sovereign") return studyData.features.filter((f) => !f.properties.isTerritory);
  if (studyTerritoryMode === "territoriesOnly") return studyData.features.filter((f) => f.properties.isTerritory);
  return studyData.features;
}

function scoreToColor(score) {
  if (score === null) return "#9aa6b8"; // sin datos todavía (gris claro, bien distinguible del azul pizarra por defecto)
  const red = [194, 59, 59];
  const yellow = [255, 209, 102];
  const green = [47, 158, 88];
  let from, to, t;
  if (score < 0.5) {
    from = red;
    to = yellow;
    t = score / 0.5;
  } else {
    from = yellow;
    to = green;
    t = (score - 0.5) / 0.5;
  }
  const rgb = from.map((c0, i) => Math.round(c0 + (to[i] - c0) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function studyFillColor(iso) {
  if (!studyProgressMode) return null; // null = usar el color por defecto del CSS
  return scoreToColor(getCountryScore(studyContinent.id, iso));
}

function drawStudyMap() {
  const svg = d3.select("#study-map");
  svg.selectAll("*").remove();

  // En "solo países" los territorios no se dibujan; en los otros dos modos se
  // dibujan todos, atenuando los países soberanos cuando el modo es "solo
  // territorios" (para conservar la silueta del continente sin que sean
  // interactivos, ver CSS de .dimmed).
  const mapFeatures =
    studyTerritoryMode === "sovereign" ? studyData.features.filter((f) => !f.properties.isTerritory) : studyData.features;

  const projection = makeProjection(studyContinent.id).fitSize([960, 960], getFitData(studyContinent.id, { type: "FeatureCollection", features: mapFeatures }));
  const path = d3.geoPath().projection(projection);
  const layer = svg.append("g").attr("class", "zoom-layer");
  const isDimmed = (d) => studyTerritoryMode === "territoriesOnly" && !d.properties.isTerritory;

  layer
    .append("g")
    .selectAll("path")
    .data(mapFeatures)
    .join("path")
    .attr("d", path)
    .attr("data-iso", (d) => d.properties["ISO3166-1-Alpha-3"])
    .classed("is-territory", (d) => !!d.properties.isTerritory)
    .classed("dimmed", isDimmed)
    .style("fill", (d) => studyFillColor(d.properties["ISO3166-1-Alpha-3"]))
    .on("click", (event, d) => highlightStudyEntry(d.properties["ISO3166-1-Alpha-3"]));

  const smallFeatures = mapFeatures.filter((d) => path.area(d) < SMALL_COUNTRY_AREA_PX);

  layer
    .append("g")
    .selectAll("circle")
    .data(smallFeatures)
    .join("circle")
    .attr("class", "island-marker")
    .attr("data-iso", (d) => d.properties["ISO3166-1-Alpha-3"])
    .classed("is-territory", (d) => !!d.properties.isTerritory)
    .classed("dimmed", isDimmed)
    .attr("cx", (d) => path.centroid(d)[0])
    .attr("cy", (d) => path.centroid(d)[1])
    .attr("r", 6)
    .style("fill", (d) => studyFillColor(d.properties["ISO3166-1-Alpha-3"]))
    .on("click", (event, d) => highlightStudyEntry(d.properties["ISO3166-1-Alpha-3"]));

  attachZoom("study-map");
}

function buildStudyList() {
  const list = document.getElementById("study-list");
  list.innerHTML = "";
  const stats = loadAllStats()[studyContinent.id] || {};
  const sorted = studyVisibleFeatures().sort((a, b) =>
    tCountryName(a).localeCompare(tCountryName(b), currentLang)
  );
  sorted.forEach((f) => {
    const iso = f.properties["ISO3166-1-Alpha-3"];
    const name = tCountryName(f);
    const capital = tCapitalName(f);
    const s = stats[iso];
    const statsHtml = s && (s.assist || s.fail)
      ? `<div class="row-stats">${s.assist ? `<span class="stat-assist">🛟 ${s.assist}</span> ` : ""}${s.fail ? `<span class="stat-fail">✗ ${s.fail}</span>` : ""}</div>`
      : "";
    const score = getCountryScore(studyContinent.id, iso);
    const pctHtml =
      score === null
        ? ""
        : `<span class="stat-pct" style="color:${scoreToColor(score)}">${Math.round(score * 100)}%</span>`;
    const wikiUrl = `https://${currentLang}.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, "_"))}`;
    const territoryHtml = f.properties.isTerritory
      ? `<span class="territory-tag">${t("territory.of")} ${tParentName(f.properties.parentName_es)}</span>`
      : "";

    const li = document.createElement("li");
    li.id = `study-row-${iso}`;
    li.innerHTML = `
      <div class="row-main">
        <span class="country">${name}</span>
        ${pctHtml}
        <span class="capital">${capital}</span>
      </div>
      ${territoryHtml}
      ${statsHtml}
      <a class="wiki-link" href="${wikiUrl}" target="_blank" rel="noopener noreferrer">${t("study.wikipedia")}</a>
    `;
    li.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // no interferir con el enlace
      highlightStudyEntry(iso);
    });
    list.appendChild(li);
  });
}

function highlightStudyEntry(iso) {
  d3.selectAll("#study-map [data-iso]").classed("highlight", false);
  d3.selectAll(`#study-map [data-iso="${iso}"]`).classed("highlight", true);
  document.querySelectorAll(".study-list li").forEach((li) => li.classList.remove("highlight"));
  const row = document.getElementById(`study-row-${iso}`);
  if (row) {
    row.classList.add("highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Quita los territorios autónomos de un FeatureCollection salvo que se pida
// incluirlos explícitamente (por defecto siempre se practica solo con países
// soberanos). Las zonas/regiones predefinidas no usan esto: ya llevan sus
// territorios incluidos directamente en su lista de ISOs.
function filterTerritories(data, includeTerritories) {
  if (includeTerritories) return data;
  return { type: "FeatureCollection", features: data.features.filter((f) => !f.properties.isTerritory) };
}

// ---- Inicio de una práctica de continente ----
function startContinent(continent) {
  currentContinent = continent;
  const includeTerritories = document.getElementById("toggle-menu-territories").checked;
  const data = filterTerritories(continent.getData(), includeTerritories);
  beginRound(data);
}

function startReinforcement(continent) {
  currentContinent = continent;
  const difficultIsos = getDifficultIsos(continent.id);
  startWithIsos(continent, difficultIsos);
}

// Inicia una ronda de práctica limitada a un subconjunto de países (por ISO).
function startWithIsos(continent, isos) {
  currentContinent = continent;
  const full = continent.getData();
  const filtered = {
    type: "FeatureCollection",
    features: full.features.filter((f) => isos.includes(f.properties["ISO3166-1-Alpha-3"])),
  };
  if (window.mascot) window.mascot.setExpression("determined", 1500);
  beginRound(filtered);
}

// ---- Practicar por zonas ----
const CUSTOM_SELECTIONS_KEY = "capitalsCustomSelections";

function loadCustomSelections(continentId) {
  try {
    const all = JSON.parse(localStorage.getItem(CUSTOM_SELECTIONS_KEY)) || {};
    return all[continentId] || [];
  } catch {
    return [];
  }
}

function saveCustomSelections(continentId, selections) {
  let all = {};
  try {
    all = JSON.parse(localStorage.getItem(CUSTOM_SELECTIONS_KEY)) || {};
  } catch {
    all = {};
  }
  all[continentId] = selections;
  localStorage.setItem(CUSTOM_SELECTIONS_KEY, JSON.stringify(all));
}

function openZoneSelect(continent) {
  zoneContinent = continent;
  document.getElementById("zone-title").textContent = `${t("zone.title")} — ${tContinentName(continent.id)}`;
  buildZoneRegionList(continent);
  buildZoneSavedList(continent);
  showScreen("zoneSelect");
}

function buildZoneRegionList(continent) {
  const list = document.getElementById("zone-region-list");
  list.innerHTML = "";
  const regions = REGIONS[continent.id] || [];
  regions.forEach((region) => {
    const btn = document.createElement("button");
    btn.className = "continent-btn";
    btn.textContent = tZoneName(continent.id, region.id);
    btn.addEventListener("click", () => startWithIsos(continent, region.isos));
    list.appendChild(btn);
  });
}

function buildZoneSavedList(continent) {
  const list = document.getElementById("zone-saved-list");
  list.innerHTML = "";
  const selections = loadCustomSelections(continent.id);
  if (selections.length === 0) {
    const p = document.createElement("p");
    p.className = "subtitle";
    p.textContent = t("zone.noSaved");
    list.appendChild(p);
    return;
  }
  selections.forEach((sel) => {
    const wrap = document.createElement("div");
    wrap.className = "zone-saved-item";

    const btn = document.createElement("button");
    btn.className = "continent-btn zone-saved";
    btn.textContent = `${sel.name} (${sel.isos.length})`;
    btn.addEventListener("click", () => startWithIsos(continent, sel.isos));

    const actions = document.createElement("div");
    actions.className = "zone-saved-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.textContent = t("zone.delete");
    delBtn.addEventListener("click", () => {
      const remaining = loadCustomSelections(continent.id).filter((s) => s.id !== sel.id);
      saveCustomSelections(continent.id, remaining);
      buildZoneSavedList(continent);
    });
    actions.appendChild(delBtn);

    wrap.appendChild(btn);
    wrap.appendChild(actions);
    list.appendChild(wrap);
  });
}

function openCustomSelect() {
  customSelectedIsos = new Set();
  document.getElementById("toggle-custom-territories").checked = false;
  drawCustomMap(filterTerritories(zoneContinent.getData(), false));
  updateCustomSelectedCount();
  showScreen("customSelect");
}

function drawCustomMap(data) {
  const svg = d3.select("#custom-map");
  svg.selectAll("*").remove();

  const projection = makeProjection(zoneContinent.id).fitSize([960, 960], getFitData(zoneContinent.id, data));
  const path = d3.geoPath().projection(projection);
  const layer = svg.append("g").attr("class", "zoom-layer");

  layer
    .append("g")
    .selectAll("path")
    .data(data.features)
    .join("path")
    .attr("d", path)
    .attr("data-iso", (d) => d.properties["ISO3166-1-Alpha-3"])
    .classed("is-territory", (d) => !!d.properties.isTerritory)
    .on("click", (event, d) => toggleCustomSelection(d.properties["ISO3166-1-Alpha-3"]));

  const smallFeatures = data.features.filter((d) => path.area(d) < SMALL_COUNTRY_AREA_PX);

  layer
    .append("g")
    .selectAll("circle")
    .data(smallFeatures)
    .join("circle")
    .attr("class", "island-marker")
    .classed("is-territory", (d) => !!d.properties.isTerritory)
    .attr("data-iso", (d) => d.properties["ISO3166-1-Alpha-3"])
    .attr("cx", (d) => path.centroid(d)[0])
    .attr("cy", (d) => path.centroid(d)[1])
    .attr("r", 6)
    .on("click", (event, d) => toggleCustomSelection(d.properties["ISO3166-1-Alpha-3"]));

  attachZoom("custom-map");
}

function toggleCustomSelection(iso) {
  if (customSelectedIsos.has(iso)) {
    customSelectedIsos.delete(iso);
  } else {
    customSelectedIsos.add(iso);
  }
  d3.selectAll(`#custom-map [data-iso="${iso}"]`).classed("selected", customSelectedIsos.has(iso));
  updateCustomSelectedCount();
}

function updateCustomSelectedCount() {
  document.getElementById("custom-selected-count").textContent = customSelectedIsos.size;
}

function beginRound(data) {
  currentGameMode = gameMode;
  geoData = data;
  countries = shuffle([...data.features]);
  countriesTotal = countries.length;
  correctCount = 0;
  assistedCount = 0;
  wrongCount = 0;
  prevCounts = { correct: 0, assisted: 0, wrong: 0 };
  updateCounters();
  drawMap(data);
  showScreen("game");
  playSound("continent");
  nextCountry();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Dibujo del mapa con D3 ----
const SMALL_COUNTRY_AREA_PX = 60; // por debajo de esto, se añade un marcador clicable

function drawMap(data) {
  const svg = d3.select("#map");
  svg.selectAll("*").remove();

  const projection = makeProjection(currentContinent.id).fitSize([960, 960], getFitData(currentContinent.id, data));
  const path = d3.geoPath().projection(projection);
  const layer = svg.append("g").attr("class", "zoom-layer");

  layer
    .append("g")
    .attr("class", "countries-layer")
    .selectAll("path")
    .data(data.features)
    .join("path")
    .attr("d", path)
    .attr("data-iso", (d) => d.properties["ISO3166-1-Alpha-3"])
    .classed("is-territory", (d) => !!d.properties.isTerritory)
    .on("click", (event, d) => onCountryClick(d));

  const smallFeatures = data.features.filter((d) => path.area(d) < SMALL_COUNTRY_AREA_PX);

  layer
    .append("g")
    .attr("class", "islands-layer")
    .selectAll("circle")
    .data(smallFeatures)
    .join("circle")
    .attr("class", "island-marker")
    .classed("is-territory", (d) => !!d.properties.isTerritory)
    .attr("data-iso", (d) => d.properties["ISO3166-1-Alpha-3"])
    .attr("cx", (d) => path.centroid(d)[0])
    .attr("cy", (d) => path.centroid(d)[1])
    .attr("r", 6)
    .on("click", (event, d) => onCountryClick(d));

  attachZoom("map");
}

// ---- Flujo de juego ----
function nextCountry() {
  resetCapitalPanel();
  mapSelectedOk = false;
  usedAssist = false;
  clearTargetHighlight();

  if (countries.length === 0) {
    finishContinent();
    return;
  }

  currentCountry = countries.shift();
  const territorySuffix = currentCountry.properties.isTerritory
    ? ` (${t("territory.of")} ${tParentName(currentCountry.properties.parentName_es)})`
    : "";

  const labelEl = document.getElementById("target-label");
  const nameEl = document.getElementById("target-country-name");
  const flagEl = document.getElementById("target-flag");
  if (currentGameMode === "bandera") {
    labelEl.textContent = t("game.findFlagCountry");
    nameEl.textContent = "";
    flagEl.src = flagImageUrl(currentCountry.properties["ISO3166-1-Alpha-2"]);
    flagEl.hidden = false;
  } else if (currentGameMode === "reverso") {
    labelEl.textContent = t("game.whichCountry");
    nameEl.textContent = tCapitalName(currentCountry);
    flagEl.hidden = true;
  } else {
    labelEl.textContent = t("game.findOnMap");
    nameEl.textContent = tCountryName(currentCountry) + territorySuffix;
    flagEl.hidden = true;
  }

  // En "bandera" y "reverso" el país objetivo no se ve escrito en ningún
  // sitio (solo la bandera o la capital), así que es fácil quedarse atascado
  // sin ninguna pista más: se ofrece un botón para pasar de país sabiendo
  // cuál era la respuesta, en vez de tener que adivinar a ciegas sin fin.
  document.getElementById("dont-know-wrap").classList.toggle(
    "hidden",
    currentGameMode !== "bandera" && currentGameMode !== "reverso"
  );

  updateCounters();
  if (window.mascot) window.mascot.hide();
  maybeShowFact();

  // En el modo "solo capital" el país objetivo ya se resalta directamente en
  // el mapa, así que no hace falta esperar a que se haga clic en él.
  if (currentGameMode === "capital") {
    mapSelectedOk = true;
    setTargetHighlight(currentCountry.properties["ISO3166-1-Alpha-3"]);
    openCapitalPanel();
  }
}

// "No lo sé, siguiente": disponible en "bandera" y "reverso", donde no hay
// ninguna otra forma de rendirse y pasar al siguiente país si no se sabe.
function handleDontKnow() {
  if (mapSelectedOk) return;
  mapSelectedOk = true;
  usedAssist = true;
  wrongCount++;
  const iso = currentCountry.properties["ISO3166-1-Alpha-3"];
  recordOutcome(currentContinent.id, iso, "fail");
  markCountryResult(iso, "wrong");
  setTargetHighlight(iso);
  updateCounters();
  playSound("fail");
  if (window.mascot) window.mascot.setExpression("sad", 1600);
  const el = document.getElementById("map-feedback");
  el.textContent = `${t("game.countryWas")} ${tCountryName(currentCountry)}`;
  el.className = "map-feedback show bad";
  document.getElementById("dont-know-wrap").classList.add("hidden");
  clearTimeout(showMapFeedback._t);
  setTimeout(() => {
    el.className = "map-feedback";
  }, 1400);
  setTimeout(nextCountry, 1500);
}

document.getElementById("btn-dont-know").addEventListener("click", handleDontKnow);

// Ruta a la imagen de bandera de un país a partir de su ISO3166-1 alpha-2.
// Se usan SVG locales (lib/flags/) en vez de emoji de bandera porque Windows
// no dibuja los emoji de banderas de país: muestra solo las dos letras del código.
function flagImageUrl(iso2) {
  if (!iso2 || iso2.length !== 2) return "";
  return `lib/flags/${iso2.toLowerCase()}.svg`;
}

function setTargetHighlight(iso) {
  d3.selectAll(`#map [data-iso="${iso}"]`).classed("target-highlight", true);
}

function clearTargetHighlight() {
  d3.selectAll("#map .target-highlight").classed("target-highlight", false);
}

// El globo terráqueo suelta un dato curioso del país con bastante frecuencia,
// pero no siempre. El dato se queda visible hasta que pases de país o lo cierres.
function maybeShowFact() {
  if (!window.mascot) return;
  if (Math.random() > 0.65) return; // ~65% de probabilidad
  // En "bandera" y "reverso" el país objetivo es justo lo que hay que adivinar
  // (no se muestra su nombre en pantalla), así que un dato sobre ese país
  // concreto sería una pista que destriparía la respuesta. En esos modos la
  // mascota se limita a datos genéricos de geografía, no ligados a un país.
  if (currentGameMode === "bandera" || currentGameMode === "reverso") {
    sayGeneralFact();
  } else {
    sayFactAbout(currentCountry);
  }
}

// Cada dato curioso ya menciona el nombre del país de forma natural dentro
// de la frase, así que se puede mostrar directamente, sin anteponer nada.
function sayFactAbout(feature) {
  const iso = feature.properties["ISO3166-1-Alpha-3"];
  const localTable = COUNTRY_FACTS_BY_LANG[currentLang];
  const facts = (localTable && localTable[iso]) || COUNTRY_FACTS[iso];
  if (!facts || facts.length === 0) return;
  const fact = facts[Math.floor(Math.random() * facts.length)];
  window.mascot.say(fact);
}

// Dato de geografía general (no ligado a un país concreto), para cuando no
// se está practicando ningún país en particular.
function sayGeneralFact() {
  if (!window.mascot) return;
  const pools = CONTINENTS.filter((c) => c.enabled && GENERAL_FACTS[c.id] && GENERAL_FACTS[c.id].length);
  if (pools.length === 0) return;
  const pool = pools[Math.floor(Math.random() * pools.length)];
  const localTable = GENERAL_FACTS_BY_LANG[currentLang];
  const facts = (localTable && localTable[pool.id]) || GENERAL_FACTS[pool.id];
  const fact = facts[Math.floor(Math.random() * facts.length)];
  window.mascot.say(fact);
}

// Clic derecho en la mascota: si se está practicando, dato seguro del país
// actual; en cualquier otra pantalla, casi siempre un dato (de un país al
// azar o de geografía general entre los continentes disponibles).
document.addEventListener("mascot-rightclick", () => {
  if (!window.mascot) return;
  if (screens.game.classList.contains("active") && currentCountry) {
    // en "bandera" y "reverso" el país objetivo es la respuesta que hay que
    // adivinar, así que tampoco aquí se le puede dar un dato que lo delate
    if (currentGameMode === "bandera" || currentGameMode === "reverso") {
      sayGeneralFact();
    } else {
      sayFactAbout(currentCountry);
    }
    return;
  }
  if (Math.random() < 0.4) {
    sayGeneralFact();
    return;
  }
  const allFeatures = CONTINENTS.filter((c) => c.enabled).flatMap((c) => c.getData().features);
  if (allFeatures.length === 0) return;
  const feature = allFeatures[Math.floor(Math.random() * allFeatures.length)];
  sayFactAbout(feature);
});

// Mientras no se está practicando, el globo suelta de cuando en cuando algún
// dato (general o de un país al azar) para dar vida a los menús y pantallas
// de selección, no solo a la pantalla de juego.
setInterval(() => {
  if (!window.mascot || !window.mascot.isEnabled()) return;
  if (screens.game.classList.contains("active")) return;
  if (Math.random() > 0.55) return;
  if (Math.random() < 0.45) {
    sayGeneralFact();
    return;
  }
  const allFeatures = CONTINENTS.filter((c) => c.enabled).flatMap((c) => c.getData().features);
  if (allFeatures.length === 0) return;
  const feature = allFeatures[Math.floor(Math.random() * allFeatures.length)];
  sayFactAbout(feature);
}, 26000);

let prevCounts = { correct: 0, assisted: 0, wrong: 0 };

function bumpCounter(id) {
  const el = document.getElementById(id).closest(".counter");
  if (!el) return;
  el.classList.remove("bump");
  void el.offsetWidth; // fuerza el reflow para poder reiniciar la animación
  el.classList.add("bump");
}

function updateCounters() {
  document.getElementById("counter-remaining").textContent =
    countries.length + (currentCountry ? 1 : 0);
  document.getElementById("counter-correct").textContent = correctCount;
  document.getElementById("counter-assisted").textContent = assistedCount;
  document.getElementById("counter-wrong").textContent = wrongCount;

  if (correctCount !== prevCounts.correct) bumpCounter("counter-correct");
  if (assistedCount !== prevCounts.assisted) bumpCounter("counter-assisted");
  if (wrongCount !== prevCounts.wrong) bumpCounter("counter-wrong");
  prevCounts = { correct: correctCount, assisted: assistedCount, wrong: wrongCount };
}

function onCountryClick(feature) {
  if (mapSelectedOk) return; // ya superado este paso para el país actual

  const clickedIso = feature.properties["ISO3166-1-Alpha-3"];
  const targetIso = currentCountry.properties["ISO3166-1-Alpha-3"];
  const els = d3.selectAll(`[data-iso="${clickedIso}"]`);

  if (clickedIso === targetIso) {
    showMapFeedback(true);
    playSound("mapCorrect");
    mapSelectedOk = true;
    // "mapa" y "reverso" no preguntan la capital: con localizar el país en
    // el mapa ya está resuelta la ronda.
    if (currentGameMode === "mapa" || currentGameMode === "reverso" || currentGameMode === "bandera") {
      resolveRoundSuccess();
    } else {
      openCapitalPanel();
    }
  } else {
    usedAssist = true;
    els.classed("flash-wrong", true);
    showMapFeedback(false);
    playSound("wrongCountry");
    setTimeout(() => els.classed("flash-wrong", false), 500);
  }
}

// Aplica el color final (verde/amarillo/rojo) al país una vez se conoce el resultado.
function markCountryResult(iso, result) {
  const els = d3.selectAll(`[data-iso="${iso}"]`);
  els.classed("correct", result === "correct");
  els.classed("assisted", result === "assisted");
  els.classed("wrong", result === "wrong");
}

function showMapFeedback(ok) {
  const el = document.getElementById("map-feedback");
  el.textContent = ok ? t("game.correctCountry") : t("game.wrongCountry");
  el.className = "map-feedback show " + (ok ? "ok" : "bad");
  clearTimeout(showMapFeedback._t);
  showMapFeedback._t = setTimeout(() => {
    el.className = "map-feedback";
  }, 900);
}

// ---- Panel de capital ----
function openCapitalPanel() {
  hintLevel = 0;
  document.getElementById("capital-panel").classList.remove("hidden");
  document.getElementById("capital-country-label").textContent =
    tCountryName(currentCountry);
  document.getElementById("hint-text").textContent = "";
  document.getElementById("capital-feedback").textContent = "";
  document.getElementById("capital-feedback").className = "capital-feedback";
  document.getElementById("retry-buttons").classList.add("hidden");
  document.getElementById("next-button-wrap").classList.add("hidden");

  if (currentGameMode === "test") {
    document.getElementById("capital-form").classList.add("hidden");
    buildCapitalChoices();
  } else {
    document.getElementById("capital-form").classList.remove("hidden");
    document.getElementById("capital-choices").classList.add("hidden");
    document.getElementById("capital-input").disabled = false;
    document.getElementById("capital-input").value = "";
    document.getElementById("capital-input").focus();
    document.getElementById("btn-submit-capital").disabled = false;
  }
}

function resetCapitalPanel() {
  document.getElementById("capital-panel").classList.add("hidden");
  const choices = document.getElementById("capital-choices");
  choices.classList.add("hidden");
  choices.innerHTML = "";
}

// Registra el acierto (o acierto con ayuda) del país actual y pasa al
// siguiente tras una breve pausa. Lo comparten el envío de capital escrita,
// la elección correcta en modo test y los modos sin paso de capital (mapa/reverso).
function resolveRoundSuccess() {
  const iso = currentCountry.properties["ISO3166-1-Alpha-3"];
  if (usedAssist) {
    assistedCount++;
    recordOutcome(currentContinent.id, iso, "assisted");
    markCountryResult(iso, "assisted");
  } else {
    correctCount++;
    recordOutcome(currentContinent.id, iso, "correct");
    markCountryResult(iso, "correct");
  }
  updateCounters();
  playSound("correct");
  if (window.mascot) window.mascot.setExpression(usedAssist ? "relieved" : "happy", 1200);
  setTimeout(nextCountry, 800);
}

// ---- Modo test (capital de opción múltiple) ----
function buildCapitalChoices() {
  const container = document.getElementById("capital-choices");
  container.classList.remove("hidden");
  container.innerHTML = "";

  const correctCapital = tCapitalName(currentCountry);
  const pool = geoData.features
    .filter((f) => f !== currentCountry)
    .map((f) => tCapitalName(f))
    .filter((capital) => capital !== correctCapital);
  const distractors = shuffle([...pool]).slice(0, 3);
  const options = shuffle([correctCapital, ...distractors]);

  options.forEach((capital) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = capital;
    btn.addEventListener("click", () => handleChoiceClick(btn, capital, correctCapital));
    container.appendChild(btn);
  });
}

function handleChoiceClick(btn, chosen, correctCapital) {
  const container = document.getElementById("capital-choices");
  container.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));

  if (chosen === correctCapital) {
    btn.classList.add("correct");
    const fb = document.getElementById("capital-feedback");
    fb.textContent = t("game.correct");
    fb.className = "capital-feedback ok";
    resolveRoundSuccess();
  } else {
    usedAssist = true;
    btn.classList.add("wrong");
    container.querySelectorAll(".choice-btn").forEach((b) => {
      if (b.textContent === correctCapital) b.classList.add("correct");
    });
    wrongCount++;
    const iso = currentCountry.properties["ISO3166-1-Alpha-3"];
    recordOutcome(currentContinent.id, iso, "fail");
    markCountryResult(iso, "wrong");
    updateCounters();
    playSound("fail");
    if (window.mascot) window.mascot.setExpression("sad", 2000);
    const fb = document.getElementById("capital-feedback");
    fb.textContent = `${t("game.capitalWas")} ${correctCapital}`;
    fb.className = "capital-feedback bad";
    document.getElementById("next-button-wrap").classList.remove("hidden");
  }
}

function normalize(str) {
  const decomposed = str.trim().toLowerCase().normalize("NFD");
  let result = "";
  for (const ch of decomposed) {
    const code = ch.codePointAt(0);
    if (code < 0x0300 || code > 0x036f) result += ch; // descarta acentos
  }
  return result;
}

function handleCapitalSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("capital-input");
  const answer = normalize(input.value);
  const correctAnswer = normalize(tCapitalName(currentCountry));

  if (!answer) return;

  if (answer === correctAnswer) {
    const fb = document.getElementById("capital-feedback");
    fb.textContent = t("game.correct");
    fb.className = "capital-feedback ok";
    document.getElementById("capital-input").disabled = true;
    document.getElementById("btn-submit-capital").disabled = true;
    resolveRoundSuccess();
  } else {
    usedAssist = true;
    playSound("wrongAttempt");
    if (window.mascot) window.mascot.setExpression("sad", 1200);
    const fb = document.getElementById("capital-feedback");
    fb.textContent = t("game.incorrect");
    fb.className = "capital-feedback bad";
    document.getElementById("retry-buttons").classList.remove("hidden");
    document.getElementById("capital-input").disabled = true;
    document.getElementById("btn-submit-capital").disabled = true;
  }
}

function handleHint() {
  if (hintLevel >= MAX_HINTS) {
    handleReveal();
    return;
  }
  usedAssist = true;
  hintLevel++;
  const capital = tCapitalName(currentCountry);
  const revealed = capital.slice(0, hintLevel);
  const hintDisplay = revealed + "_".repeat(Math.max(0, capital.length - hintLevel));
  document.getElementById("hint-text").textContent = hintDisplay;
  if (window.mascot) window.mascot.say(`${t("game.hintPrefix")} ${hintDisplay}`);
}

function handleRetry() {
  usedAssist = true;
  document.getElementById("retry-buttons").classList.add("hidden");
  const fb = document.getElementById("capital-feedback");
  fb.textContent = "";
  fb.className = "capital-feedback";
  const input = document.getElementById("capital-input");
  input.disabled = false;
  input.value = "";
  input.focus();
  document.getElementById("btn-submit-capital").disabled = false;
}

function handleReveal() {
  wrongCount++;
  const iso = currentCountry.properties["ISO3166-1-Alpha-3"];
  recordOutcome(currentContinent.id, iso, "fail");
  markCountryResult(iso, "wrong");
  updateCounters();
  playSound("fail");
  if (window.mascot) window.mascot.setExpression("sad", 2000);
  const fb = document.getElementById("capital-feedback");
  fb.textContent = `${t("game.capitalWas")} ${tCapitalName(currentCountry)}`;
  fb.className = "capital-feedback bad";
  document.getElementById("retry-buttons").classList.add("hidden");
  document.getElementById("capital-input").disabled = true;
  document.getElementById("btn-submit-capital").disabled = true;
  document.getElementById("next-button-wrap").classList.remove("hidden");
}

// ---- Resumen final ----
function finishContinent() {
  document.getElementById("summary-correct").textContent = correctCount;
  document.getElementById("summary-assisted").textContent = assistedCount;
  document.getElementById("summary-wrong").textContent = wrongCount;
  buildMenu(); // refresca el nº de países disponibles para repaso
  showScreen("summary");
  if (window.mascot) window.mascot.setExpression("excited", 3000);
}

// ---- Switch de visibilidad de progreso ----
document.getElementById("toggle-progress").addEventListener("change", (e) => {
  document.getElementById("map").classList.toggle("hide-progress", !e.target.checked);
});

// ---- Eventos globales ----
document.getElementById("capital-form").addEventListener("submit", handleCapitalSubmit);
document.getElementById("btn-hint").addEventListener("click", handleHint);
document.getElementById("btn-retry").addEventListener("click", handleRetry);
document.getElementById("btn-reveal").addEventListener("click", handleReveal);
document.getElementById("btn-next-country").addEventListener("click", nextCountry);
document.getElementById("btn-back-menu").addEventListener("click", () => {
  buildMenu();
  showScreen("menu");
});
document.getElementById("btn-to-menu").addEventListener("click", () => {
  buildMenu();
  showScreen("menu");
});
document.getElementById("btn-restart").addEventListener("click", () => {
  beginRound(geoData);
});

document.getElementById("btn-go-practice").addEventListener("click", () => {
  buildMenu();
  showScreen("menu");
});
document.getElementById("btn-go-study").addEventListener("click", () => {
  buildStudyMenu();
  showScreen("studySelect");
});
document.getElementById("btn-menu-back-home").addEventListener("click", () => showScreen("home"));
document.getElementById("btn-study-back-home").addEventListener("click", () => showScreen("home"));
document.getElementById("btn-study-back").addEventListener("click", () => showScreen("studySelect"));

// ---- Opciones (música y efectos de sonido) ----
document.getElementById("btn-go-options").addEventListener("click", () => {
  document.getElementById("toggle-music").checked = musicEnabled;
  document.getElementById("music-volume").value = musicVolume;
  document.getElementById("toggle-sfx").checked = sfxEnabled;
  showScreen("options");
});
document.getElementById("btn-options-back-home").addEventListener("click", () => showScreen("home"));
document.getElementById("toggle-music").addEventListener("change", (e) => setMusicEnabled(e.target.checked));
document.getElementById("music-volume").addEventListener("input", (e) => setMusicVolume(parseFloat(e.target.value)));
document.getElementById("music-volume").addEventListener("change", (e) => {
  // un único tono de prueba al soltar el deslizador, no en cada tick mientras se arrastra
  try {
    playMusicTone(440, getAudioCtx().currentTime, 0.25, "sine", parseFloat(e.target.value) * 0.5 + 0.05);
  } catch {
    // si el audio falla, se omite el tono de prueba
  }
});
document.getElementById("toggle-sfx").addEventListener("change", (e) => {
  sfxEnabled = e.target.checked;
  localStorage.setItem("sfx-enabled", JSON.stringify(sfxEnabled));
  if (sfxEnabled) playSound("toggle");
});

document.getElementById("toggle-study-progress").addEventListener("change", (e) => {
  studyProgressMode = e.target.checked;
  document.getElementById("study-progress-legend").classList.toggle("hidden", !studyProgressMode);
  drawStudyMap();
  buildStudyList();
});

document.getElementById("game-mode-select").addEventListener("click", (e) => {
  const btn = e.target.closest(".segmented-btn");
  if (!btn) return;
  gameMode = btn.dataset.mode;
  document.querySelectorAll("#game-mode-select .segmented-btn").forEach((b) => b.classList.toggle("active", b === btn));
  buildMenu();
});

document.getElementById("study-territory-mode").addEventListener("click", (e) => {
  const btn = e.target.closest(".segmented-btn");
  if (!btn) return;
  studyTerritoryMode = btn.dataset.mode;
  document.querySelectorAll("#study-territory-mode .segmented-btn").forEach((b) => b.classList.toggle("active", b === btn));
  drawStudyMap();
  buildStudyList();
});

document.getElementById("btn-zone-back-menu").addEventListener("click", () => {
  buildMenu();
  showScreen("menu");
});
document.getElementById("btn-zone-new-custom").addEventListener("click", openCustomSelect);
document.getElementById("btn-custom-back").addEventListener("click", () => showScreen("zoneSelect"));
document.getElementById("toggle-custom-territories").addEventListener("change", (e) => {
  customSelectedIsos = new Set();
  drawCustomMap(filterTerritories(zoneContinent.getData(), e.target.checked));
  updateCustomSelectedCount();
});
document.getElementById("btn-custom-practice").addEventListener("click", () => {
  if (customSelectedIsos.size === 0) {
    alert(t("custom.alertPractice"));
    return;
  }
  startWithIsos(zoneContinent, [...customSelectedIsos]);
});
document.getElementById("btn-custom-save").addEventListener("click", () => {
  if (customSelectedIsos.size === 0) {
    alert(t("custom.alertSave"));
    return;
  }
  const name = prompt(t("custom.namePrompt"));
  if (!name) return;
  const selections = loadCustomSelections(zoneContinent.id);
  selections.push({ id: Date.now().toString(), name, isos: [...customSelectedIsos] });
  saveCustomSelections(zoneContinent.id, selections);
  buildZoneSavedList(zoneContinent);
  showScreen("zoneSelect");
});

// ---- Switch para mostrar/ocultar la mascota ----
const toggleMascotEl = document.getElementById("toggle-mascot");
toggleMascotEl.addEventListener("change", (e) => {
  if (!window.mascot) return;
  if (e.target.checked) {
    window.mascot.enable();
  } else {
    window.mascot.disable();
  }
});

// ---- Sonido suave de navegación e interacción con la interfaz ----
document.addEventListener("click", (e) => {
  const el = e.target.closest(
    ".continent-btn, .btn-link, .btn-delete, #btn-zone-new-custom, #btn-custom-practice, #btn-custom-save, #btn-restart, #btn-to-menu, #btn-hint, #btn-retry, #btn-next-country"
  );
  if (el) playSound("click");
});
document.querySelectorAll('.switch-label input[type="checkbox"]').forEach((el) => {
  el.addEventListener("change", () => playSound("toggle"));
});

// ---- Selector de idioma (Opciones) ----
const languageSelectEl = document.getElementById("language-select");
languageSelectEl.value = currentLang;
languageSelectEl.addEventListener("change", (e) => setLanguage(e.target.value));

// ---- Arranque ----
ensureStatsVersion();
if (window.mascot) toggleMascotEl.checked = window.mascot.isEnabled();
applyTranslations();
showScreen("home");
