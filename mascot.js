// ---- Mascota: globo terráqueo flotante ----
// API expuesta en window.mascot: setExpression(kind, holdMs), say(text), hide(),
// enable(), disable(), isEnabled()
(function () {
  const SIZE = 96;
  const MARGIN = 16;
  const MAX_SPEED = 16; // px/frame — evita que un lanzamiento brusco lo haga "teleportarse"

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // ---- Estado de movimiento ----
  let x = 80;
  let y = 140;
  let vx = 0.4;
  let vy = 0.3;
  let driftAngle = Math.random() * Math.PI * 2;
  let prevDriftAngle = driftAngle;
  let wanderTilt = 0; // inclinación cosmética al "virar" mientras deambula
  let scrollWiggle = 0; // pequeño bamboleo al pasar la rueda del ratón encima

  // ---- Autonomía de movimiento: a veces decide ir a un punto, a veces se para a mirar ----
  let moveMode = "drift"; // drift | goto | pause
  let moveTarget = { x: 0, y: 0 };
  let moveModeUntil = Date.now() + rand(4000, 8000);

  // ---- Estado de giro fuerte (lanzamientos) ----
  let rotation = 0;
  let spinSpeed = 0;
  let lastSpinSign = 1;
  let settling = false;
  let settleTarget = 0;

  // ---- Squash & stretch ----
  let scaleX = 1;
  let scaleY = 1;
  let bounceUntil = 0;
  let bounceAxis = "x";
  let bounceIntensity = 0.6; // 0..1, proporcional a la velocidad del impacto
  let stretchUntil = 0; // estiramiento manual (bit "stretch")
  let funPulseStart = 0;
  let funPulseUntil = 0; // doble pulso (boop / salto de alegría)

  // ---- Mareo progresivo (girar mucho o zarandear con el ratón lo marea poco a poco) ----
  let dizzyAccum = 0;
  let dizzyLevel = "calm"; // calm | worried | queasy | panic
  let screaming = false;
  let lastDragX = null;
  let lastDragY = null;
  let prevDragVx = 0;
  let prevDragVy = 0;

  // ---- Mirada autónoma (no siempre el ratón) ----
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let gazeMode = "mouse"; // mouse | random | direction | up | down | edge
  let gazeTarget = { x: mouseX, y: mouseY };
  let gazeUntil = 0;
  let nextGazeShift = Date.now() + rand(5000, 9000);

  // ---- Parpadeo / guiño ----
  let blinkAt = Date.now() + rand(3000, 6000);
  let blinkUntil = 0;
  let winkSide = null; // "left" | "right" | null
  let winkUntil = 0;

  // ---- Expresión activa ----
  let exprUntil = 0;
  let exprLock = null;

  // ---- Comportamientos autónomos ("bits") ----
  let nextBitAt = Date.now() + rand(9000, 16000);
  let peekUntil = 0;
  let peekDir = { x: 0, y: 0 };

  // ---- Sueño ----
  let sleepyAt = Date.now() + rand(20000, 35000);

  // ---- Activar / desactivar ----
  const MASCOT_PREF_KEY = "mascotEnabled";
  let enabled = localStorage.getItem(MASCOT_PREF_KEY) !== "false";

  // ---- Arrastre / clic / doble clic ----
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let history = [];
  let downTime = 0;
  let downX = 0;
  let downY = 0;
  let dragDistance = 0;

  // ---- DOM ----
  const root = document.createElement("div");
  root.id = "mascot-root";
  root.innerHTML = `
    <div id="mascot-bubble" class="mascot-bubble hidden">
      <button id="mascot-bubble-close" class="mascot-bubble-close" aria-label="Cerrar">&times;</button>
      <span id="mascot-bubble-text"></span>
    </div>
    <svg id="mascot-svg" viewBox="0 0 100 100" width="${SIZE}" height="${SIZE}">
      <defs>
        <linearGradient id="mascot-sphere-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6ec3f4"></stop>
          <stop offset="55%" stop-color="#3b97e8"></stop>
          <stop offset="100%" stop-color="#1f6fc4"></stop>
        </linearGradient>
      </defs>
      <g id="mascot-spin-group">
        <circle cx="50" cy="50" r="46" fill="url(#mascot-sphere-grad)" stroke="#15324f" stroke-width="2"></circle>
        <path d="M22,22 C34,14 48,18 48,30 C48,40 38,46 28,44 C18,42 14,30 22,22 Z" fill="#67d17e"></path>
        <path d="M58,48 C70,42 84,48 82,62 C80,76 66,86 56,80 C50,76 51,63 54,55 C55,51 56,49 58,48 Z" fill="#67d17e"></path>
        <path d="M68,20 C76,16 86,20 84,28 C82,34 72,35 68,29 C65,25 66,22 68,20 Z" fill="#67d17e"></path>
        <path d="M50,5 C64,5 76,13 76,22 C76,28 66,30 58,26 C54,24 50,25 46,26 C38,30 24,28 24,22 C24,13 36,5 50,5 Z" fill="#eef6fb" opacity="0.92"></path>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#15324f" stroke-width="2"></circle>

        <path id="mascot-brow-left" d="M27,33 Q33,29 40,33" stroke="#1f5c2f" stroke-width="4" fill="none" stroke-linecap="round"></path>
        <path id="mascot-brow-right" d="M60,33 Q67,29 73,33" stroke="#1f5c2f" stroke-width="4" fill="none" stroke-linecap="round"></path>

        <g id="mascot-eyes-normal">
          <g id="mascot-eye-left">
            <circle cx="35" cy="47" r="13.5" fill="#ffffff"></circle>
            <circle class="mascot-pupil" cx="35" cy="47" r="7.4" fill="#16213a"></circle>
            <circle class="mascot-pupil-shine" cx="37.8" cy="44" r="2.5" fill="#ffffff"></circle>
          </g>
          <g id="mascot-eye-right">
            <circle cx="65" cy="47" r="13.5" fill="#ffffff"></circle>
            <circle class="mascot-pupil" cx="65" cy="47" r="7.4" fill="#16213a"></circle>
            <circle class="mascot-pupil-shine" cx="67.8" cy="44" r="2.5" fill="#ffffff"></circle>
          </g>
          <path id="mascot-eyelid-left" d="" fill="url(#mascot-sphere-grad)"></path>
          <path id="mascot-eyelid-right" d="" fill="url(#mascot-sphere-grad)"></path>
        </g>

        <g id="mascot-eyes-dizzy" style="display:none">
          <circle cx="35" cy="47" r="13.5" fill="#ffffff"></circle>
          <circle cx="65" cy="47" r="13.5" fill="#ffffff"></circle>
          <path d="M28,47 a7,7 0 1,1 14,0 a4,4 0 1,1 -8,0 a2,2 0 1,1 4,0" fill="none" stroke="#16213a" stroke-width="1.6"></path>
          <path d="M58,47 a7,7 0 1,1 14,0 a4,4 0 1,1 -8,0 a2,2 0 1,1 4,0" fill="none" stroke="#16213a" stroke-width="1.6"></path>
        </g>

        <g id="mascot-eyes-love" style="display:none">
          <text x="24.5" y="54" font-size="19">💗</text>
          <text x="54.5" y="54" font-size="19">💗</text>
        </g>

        <ellipse id="mascot-cheek-left" cx="23" cy="60" rx="6.5" ry="4.2" fill="#ff8fa3" opacity="0"></ellipse>
        <ellipse id="mascot-cheek-right" cx="77" cy="60" rx="6.5" ry="4.2" fill="#ff8fa3" opacity="0"></ellipse>

        <path id="mascot-mouth" d="M40,64 Q50,68 60,64" stroke="#15324f" stroke-width="3.4" fill="none" stroke-linecap="round"></path>
        <path id="mascot-mouth-fill" d="" fill="#9b3b46"></path>

        <g id="mascot-stars" style="display:none">
          <text x="20" y="14" font-size="11">⭐</text>
          <text x="68" y="10" font-size="9">⭐</text>
        </g>

        <g id="mascot-sweat" style="display:none">
          <path d="M76,30 q4,6 0,11 q-4,-2 -4,-6 q0,-3 4,-5 Z" fill="#bfe6fb" stroke="#3b97e8" stroke-width="0.6"></path>
        </g>

        <g id="mascot-think-bubble" style="display:none">
          <circle cx="80" cy="20" r="3" fill="#ffffff" opacity="0.9"></circle>
          <circle cx="86" cy="13" r="4.2" fill="#ffffff" opacity="0.9"></circle>
          <text x="79" y="16" font-size="9">💭</text>
        </g>
      </g>
    </svg>
  `;
  document.body.appendChild(root);
  if (!enabled) root.style.display = "none";

  const svg = document.getElementById("mascot-svg");
  const spinGroup = document.getElementById("mascot-spin-group");
  const mouth = document.getElementById("mascot-mouth");
  const mouthFill = document.getElementById("mascot-mouth-fill");
  const browLeft = document.getElementById("mascot-brow-left");
  const browRight = document.getElementById("mascot-brow-right");
  const cheekLeft = document.getElementById("mascot-cheek-left");
  const cheekRight = document.getElementById("mascot-cheek-right");
  const eyesNormal = document.getElementById("mascot-eyes-normal");
  const eyesDizzy = document.getElementById("mascot-eyes-dizzy");
  const eyesLove = document.getElementById("mascot-eyes-love");
  const stars = document.getElementById("mascot-stars");
  const sweat = document.getElementById("mascot-sweat");
  const thinkBubble = document.getElementById("mascot-think-bubble");
  const eyelidLeft = document.getElementById("mascot-eyelid-left");
  const eyelidRight = document.getElementById("mascot-eyelid-right");
  const pupils = document.querySelectorAll(".mascot-pupil, .mascot-pupil-shine");
  const bubble = document.getElementById("mascot-bubble");
  const bubbleText = document.getElementById("mascot-bubble-text");
  const bubbleClose = document.getElementById("mascot-bubble-close");

  const LID_CLOSED_L = "M21,47 Q35,17 49,47 Q35,77 21,47 Z";
  const LID_CLOSED_R = "M51,47 Q65,17 79,47 Q65,77 51,47 Z";
  const LID_HALF_L = "M21,48 Q35,18 49,48 Q35,52 21,48 Z";
  const LID_HALF_R = "M51,48 Q65,18 79,48 Q65,52 51,48 Z";

  // ---- Expresiones ----
  // eyes: "normal" | "dizzy" | "love" — qué juego de ojos se muestra
  const EXPRESSIONS = {
    neutral: {
      mouth: "M40,64 Q50,68 60,64",
      mouthFill: "",
      browL: "M27,33 Q33,29 40,33",
      browR: "M60,33 Q67,29 73,33",
      cheeks: 0,
      eyes: "normal",
    },
    happy: {
      mouth: "M33,61 Q50,79 67,61 Z",
      mouthFill: "M38,63 Q50,75 62,63 Z",
      browL: "M26,31 Q33,25 41,30",
      browR: "M59,30 Q67,25 74,31",
      cheeks: 0.9,
      eyes: "normal",
    },
    sad: {
      mouth: "M38,70 Q50,58 62,70",
      mouthFill: "",
      browL: "M27,35 Q34,31 41,37",
      browR: "M59,37 Q66,31 73,35",
      cheeks: 0,
      eyes: "normal",
    },
    worried: {
      mouth: "M42,66 a5,4 0 1,0 10,0 a5,4 0 1,0 -10,0",
      mouthFill: "M42,66 a5,4 0 1,0 10,0 a5,4 0 1,0 -10,0",
      browL: "M26,36 Q34,30 41,33",
      browR: "M59,33 Q66,30 74,36",
      cheeks: 0,
      eyes: "normal",
      sweat: true,
    },
    panic: {
      mouth: "M44,63 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0",
      mouthFill: "M44,63 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0",
      browL: "M26,27 Q33,33 41,27",
      browR: "M59,27 Q67,33 74,27",
      cheeks: 0,
      eyes: "dizzy",
      sparkle: true,
    },
    queasy: {
      // etapa intermedia entre "worried" y "panic": ya ve doble pero aún no ha perdido del todo el control
      mouth: "M41,67 Q50,70 59,67",
      mouthFill: "",
      browL: "M26,34 Q33,29 41,33",
      browR: "M59,33 Q67,29 74,34",
      cheeks: 0,
      eyes: "dizzy",
      sweat: true,
    },
    excited: {
      mouth: "M28,58 Q50,86 72,58 Z",
      mouthFill: "M34,62 Q50,80 66,62 Z",
      browL: "M25,29 Q33,21 42,28",
      browR: "M58,28 Q67,21 75,29",
      cheeks: 1,
      eyes: "normal",
      sparkle: true,
    },
    determined: {
      mouth: "M40,65 L60,65",
      mouthFill: "",
      browL: "M26,30 L41,34",
      browR: "M59,34 L74,30",
      cheeks: 0,
      eyes: "normal",
    },
    relieved: {
      mouth: "M40,63 Q50,67 60,63",
      mouthFill: "",
      browL: "M27,32 Q34,29 41,32",
      browR: "M59,32 Q66,29 73,32",
      cheeks: 0.4,
      eyes: "normal",
      sweat: true,
    },
    sleepy: {
      mouth: "M44,65 a6,5 0 1,0 12,0 a6,5 0 1,0 -12,0",
      mouthFill: "M44,65 a6,5 0 1,0 12,0 a6,5 0 1,0 -12,0",
      browL: "M27,38 Q34,35 41,38",
      browR: "M59,38 Q66,35 73,38",
      cheeks: 0,
      eyes: "normal",
      sleepyLids: true,
    },
    curious: {
      mouth: "M42,65 Q50,68 58,63",
      mouthFill: "",
      browL: "M27,30 Q34,23 41,28",
      browR: "M59,35 Q66,32 73,35",
      cheeks: 0,
      eyes: "normal",
    },
    thinking: {
      mouth: "M44,66 Q50,63 56,66",
      mouthFill: "",
      browL: "M27,30 Q34,24 41,29",
      browR: "M59,32 Q66,30 73,33",
      cheeks: 0,
      eyes: "normal",
      thinking: true,
    },
    shy: {
      mouth: "M42,64 Q50,67 58,64",
      mouthFill: "",
      browL: "M27,34 Q34,31 41,34",
      browR: "M59,34 Q66,31 73,34",
      cheeks: 1,
      eyes: "normal",
    },
    laughing: {
      mouth: "M28,58 Q50,84 72,58 Z",
      mouthFill: "M34,61 Q50,78 66,61 Z",
      browL: "M25,28 Q33,24 42,28",
      browR: "M58,28 Q67,24 75,28",
      cheeks: 1,
      eyes: "normal",
      sparkle: true,
    },
    love: {
      mouth: "M35,60 Q50,76 65,60 Z",
      mouthFill: "M40,62 Q50,72 60,62 Z",
      browL: "M26,30 Q33,25 41,29",
      browR: "M59,29 Q67,25 74,30",
      cheeks: 1,
      eyes: "love",
    },
  };

  function applyExpression(kind) {
    const e = EXPRESSIONS[kind] || EXPRESSIONS.neutral;
    mouth.setAttribute("d", e.mouth);
    mouthFill.setAttribute("d", e.mouthFill);
    browLeft.setAttribute("d", e.browL);
    browRight.setAttribute("d", e.browR);
    cheekLeft.style.opacity = e.cheeks;
    cheekRight.style.opacity = e.cheeks;
    eyesNormal.style.display = e.eyes === "normal" ? "" : "none";
    eyesDizzy.style.display = e.eyes === "dizzy" ? "" : "none";
    eyesLove.style.display = e.eyes === "love" ? "" : "none";
    stars.style.display = e.sparkle ? "" : "none";
    sweat.style.display = e.sweat ? "" : "none";
    thinkBubble.style.display = e.thinking ? "" : "none";
    if (e.eyes === "normal") {
      eyelidLeft.setAttribute("d", e.sleepyLids ? LID_HALF_L : "");
      eyelidRight.setAttribute("d", e.sleepyLids ? LID_HALF_R : "");
    }
  }

  function setExpression(kind, holdMs) {
    exprLock = kind;
    applyExpression(kind);
    exprUntil = holdMs ? Date.now() + holdMs : 0;
  }

  // ---- Mareo progresivo: cuanto más se le zarandea o gira, peor lo pasa ----
  const DIZZY_QUEASY_AT = 55;
  const DIZZY_PANIC_AT = 140;

  function levelForDizzy(accum) {
    if (accum > DIZZY_PANIC_AT) return "panic";
    if (accum > DIZZY_QUEASY_AT) return "queasy";
    return "worried";
  }

  const SCREAMS = ["¡Aaaah!", "¡Uoooh!", "¡Ahh, ahh, ahh!", "¡Para, para, paraaa!", "¡Que me mareo!"];

  function screamInterrupt() {
    clearInterval(typeTimer);
    typeTimer = null;
    bubbleText.textContent = SCREAMS[Math.floor(Math.random() * SCREAMS.length)];
    bubble.classList.remove("hidden");
    positionBubble();
    startTalkMouth();
    screaming = true;
  }

  function updateDizzyExpression(accum) {
    const level = levelForDizzy(accum);
    if (level !== dizzyLevel) {
      if (level === "panic" && dizzyLevel !== "panic" && !bubble.classList.contains("hidden") && !screaming) {
        screamInterrupt();
      }
      dizzyLevel = level;
    }
    setExpression(level);
  }

  function settleDizziness() {
    // se le ha pasado el mareo del todo: si seguía gritando, que se calle al cabo de un momento
    dizzyLevel = "calm";
    if (screaming) {
      setTimeout(() => {
        screaming = false;
        hide();
      }, 700);
    }
  }

  function clearExpressionIfDue(now) {
    if (exprLock && now > exprUntil) {
      exprLock = null;
      applyExpression("neutral");
    }
  }

  // ---- Mirada autónoma: no siempre fija en el ratón ----
  function resolveGazeTarget() {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    switch (gazeMode) {
      case "direction":
        return { x: cx + vx * 50, y: cy + vy * 50 };
      case "up":
        return { x: cx, y: cy - 120 };
      case "down":
        return { x: cx, y: cy + 120 };
      case "edge":
        return { x: cx + peekDir.x * 200, y: cy + peekDir.y * 80 };
      case "random":
        return gazeTarget;
      default:
        return { x: mouseX, y: mouseY };
    }
  }

  function updateGazeAutonomy(now) {
    if (now > gazeUntil && gazeMode !== "mouse") {
      gazeMode = "mouse";
    }
    if (gazeMode === "mouse" && now > nextGazeShift) {
      const r = Math.random();
      if (r < 0.4) {
        gazeMode = "random";
        gazeTarget = { x: rand(60, window.innerWidth - 60), y: rand(60, window.innerHeight * 0.6) };
      } else if (r < 0.7) {
        gazeMode = "direction";
      } else {
        gazeMode = "up";
      }
      gazeUntil = now + rand(1400, 3200);
      nextGazeShift = now + rand(6000, 12000);
    }
  }

  function updatePupils() {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const target = resolveGazeTarget();
    const angle = Math.atan2(target.y - cy, target.x - cx);
    const dx = Math.cos(angle) * 2.6;
    const dy = Math.sin(angle) * 2.6;
    pupils.forEach((p) => p.setAttribute("transform", `translate(${dx}, ${dy})`));
  }

  // ---- Parpadeo y guiño ----
  function updateBlink(now) {
    if (eyesNormal.style.display === "none") return;
    if (winkSide) {
      if (now > winkUntil) {
        winkSide = null;
      } else {
        return; // el guiño tiene prioridad visual mientras dura
      }
    }
    if (exprLock) return; // no parpadear con una expresión activa (la propia expresión controla los ojos)
    if (now > blinkAt && blinkUntil === 0) {
      blinkUntil = now + 110;
    }
    if (blinkUntil && now > blinkUntil) {
      blinkUntil = 0;
      blinkAt = now + rand(2500, 6500);
    }
    eyelidLeft.setAttribute("d", blinkUntil ? LID_CLOSED_L : "");
    eyelidRight.setAttribute("d", blinkUntil ? LID_CLOSED_R : "");
  }

  function doWink() {
    if (eyesNormal.style.display === "none" || dragging) return;
    winkSide = Math.random() < 0.5 ? "left" : "right";
    winkUntil = Date.now() + 480;
    eyelidLeft.setAttribute("d", winkSide === "left" ? LID_CLOSED_L : "");
    eyelidRight.setAttribute("d", winkSide === "right" ? LID_CLOSED_R : "");
  }

  // ---- Sonido propio (boop), autocontenido para no depender de script.js ----
  let audioCtx = null;
  function playBoop() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // si el navegador bloquea audio, no pasa nada
    }
  }

  // ---- Globo de diálogo (con animación de "hablar" en la boca) ----
  let typeTimer = null;
  let talkMouthTimer = null;
  let talkToggle = false;
  const TALK_OPEN_MOUTH = "M40,62 Q50,79 60,62 Q50,70 40,62 Z";

  function startTalkMouth() {
    clearInterval(talkMouthTimer);
    talkMouthTimer = setInterval(() => {
      talkToggle = !talkToggle;
      const resting = (EXPRESSIONS[exprLock] || EXPRESSIONS.neutral).mouth;
      mouth.setAttribute("d", talkToggle ? TALK_OPEN_MOUTH : resting);
    }, 110);
  }

  function stopTalkMouth() {
    clearInterval(talkMouthTimer);
    talkMouthTimer = null;
    mouth.setAttribute("d", (EXPRESSIONS[exprLock] || EXPRESSIONS.neutral).mouth);
  }

  function hide() {
    clearInterval(typeTimer);
    stopTalkMouth();
    bubble.classList.add("hidden");
    screaming = false;
  }

  function say(text) {
    screaming = false; // un dato nuevo real sustituye al grito, aunque siguiera "mareado"
    clearInterval(typeTimer);
    bubbleText.textContent = "";
    bubble.classList.remove("hidden");
    positionBubble();
    startTalkMouth();
    let i = 0;
    typeTimer = setInterval(() => {
      i++;
      bubbleText.textContent = text.slice(0, i);
      positionBubble();
      if (i >= text.length) {
        clearInterval(typeTimer);
        stopTalkMouth();
      }
    }, 16);
  }

  function positionBubble() {
    const margin = 10;
    bubble.style.left = "50%";
    bubble.style.transform = "translateX(-50%)";
    bubble.classList.remove("below");

    requestAnimationFrame(() => {
      const rect = bubble.getBoundingClientRect();
      if (rect.top < margin) {
        bubble.classList.add("below");
      }
      const afterRect = bubble.getBoundingClientRect();
      let shiftX = 0;
      if (afterRect.left < margin) shiftX = margin - afterRect.left;
      if (afterRect.right > window.innerWidth - margin) {
        shiftX = window.innerWidth - margin - afterRect.right;
      }
      if (shiftX !== 0) {
        bubble.style.transform = `translateX(calc(-50% + ${shiftX}px))`;
      }
    });
  }

  bubbleClose.addEventListener("click", (e) => {
    e.stopPropagation();
    hide();
  });

  // ---- Arrastrar / clic / doble clic con el ratón ----
  svg.style.pointerEvents = "auto";
  svg.style.cursor = "grab";

  function startDrag(e) {
    e.preventDefault();
    dragging = true;
    spinSpeed = 0;
    settling = false;
    sleepyAt = Date.now() + rand(25000, 40000);
    downTime = Date.now();
    downX = e.clientX;
    downY = e.clientY;
    dragDistance = 0;
    svg.style.cursor = "grabbing";
    dragOffsetX = e.clientX - x;
    dragOffsetY = e.clientY - y;
    history = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    lastDragX = x;
    lastDragY = y;
    prevDragVx = 0;
    prevDragVy = 0;
    // si ya venía mareado de un lanzamiento anterior, no se le borra el mareo de golpe al agarrarlo
    updateDizzyExpression(Math.max(dizzyAccum, 1));
  }

  function triggerBoop() {
    setExpression("laughing", 1000);
    funPulseStart = Date.now();
    funPulseUntil = funPulseStart + 420;
    playBoop();
  }

  function releaseDrag() {
    if (!dragging) return;
    dragging = false;
    svg.style.cursor = "grab";

    const wasQuickClick = dragDistance < 8 && Date.now() - downTime < 280;
    if (wasQuickClick) {
      exprLock = null;
      triggerBoop();
      return;
    }

    exprLock = null;
    moveMode = "drift";
    moveModeUntil = Date.now() + rand(3000, 6000);
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const dt = Math.max(30, last.t - first.t);
      vx = ((last.x - first.x) / dt) * 16;
      vy = ((last.y - first.y) / dt) * 16;
    } else {
      vx = 0;
      vy = 0;
    }
    const rawSpeed = Math.hypot(vx, vy);
    if (rawSpeed > MAX_SPEED) {
      vx = (vx / rawSpeed) * MAX_SPEED;
      vy = (vy / rawSpeed) * MAX_SPEED;
    }
    const speed = Math.hypot(vx, vy);
    if (speed > 3) {
      // la dirección del giro sigue la curvatura real del lanzamiento (si lo lanzas
      // en arco, gira hacia donde curva el arco; si es una línea recta, sigue el sentido lateral)
      let torque = 0;
      if (history.length >= 4) {
        const mid = history[Math.floor(history.length / 2)];
        const a = history[0];
        const b = history[history.length - 1];
        const v1x = mid.x - a.x;
        const v1y = mid.y - a.y;
        const v2x = b.x - mid.x;
        const v2y = b.y - mid.y;
        torque = v1x * v2y - v1y * v2x;
      }
      const torqueSign = Math.abs(torque) > 60 ? Math.sign(torque) : vx >= 0 ? 1 : -1;
      spinSpeed = torqueSign * Math.min(24, 5 + speed * 1.05);
      dizzyAccum = Math.min(DIZZY_PANIC_AT + 40, dizzyAccum + speed * 2.2);
      updateDizzyExpression(dizzyAccum);
    } else {
      dizzyAccum *= 0.4;
      if (dizzyAccum < DIZZY_QUEASY_AT) {
        settleDizziness();
        setExpression("neutral");
      } else {
        updateDizzyExpression(dizzyAccum);
      }
    }
  }

  svg.addEventListener("mousedown", startDrag);
  document.addEventListener("mouseup", releaseDrag);
  window.addEventListener("blur", releaseDrag);

  svg.addEventListener("dblclick", (e) => {
    e.preventDefault();
    setExpression("love", 1800);
  });

  svg.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("mascot-rightclick"));
  });

  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      scrollWiggle = Math.max(-18, Math.min(18, scrollWiggle + e.deltaY * 0.06));
    },
    { passive: false }
  );

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (dragging) {
      if (e.buttons === 0) {
        releaseDrag();
        return;
      }
      dragDistance = Math.max(dragDistance, Math.hypot(e.clientX - downX, e.clientY - downY));
      x = e.clientX - dragOffsetX;
      y = e.clientY - dragOffsetY;
      history.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (history.length > 6) history.shift();
    }
  });

  // ---- Reacción al acercar el cursor (sin hacer clic) ----
  let wasNear = false;
  function updateProximity(now) {
    if (dragging || exprLock) {
      wasNear = false;
      return;
    }
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(mouseX - cx, mouseY - cy);
    const near = dist < 70;
    if (near && !wasNear) {
      // pequeño gesto de sorpresa agradable al notar que el cursor se acerca
      browLeft.setAttribute("d", "M26,29 Q33,24 41,29");
      browRight.setAttribute("d", "M59,29 Q67,24 74,29");
      setTimeout(() => {
        if (!exprLock) applyExpression("neutral");
      }, 350);
    }
    wasNear = near;
  }

  // ---- Squash & stretch (impacto, movimiento, respiración, bits) ----
  function bounce(axis, impactSpeed) {
    bounceUntil = Date.now() + 160;
    bounceAxis = axis;
    // cuanto más fuerte el golpe contra la pared, más se aplasta (con un mínimo para que siempre se note algo)
    bounceIntensity = Math.max(0.25, Math.min(1, (impactSpeed || 6) / 13));
  }

  function updateSquash(speed, now, dirVx, dirVy) {
    const ux = dirVx === undefined ? vx : dirVx;
    const uy = dirVy === undefined ? vy : dirVy;
    let targetX = 1;
    let targetY = 1;
    if (now < funPulseUntil) {
      const t = (now - funPulseStart) / (funPulseUntil - funPulseStart);
      const wobble = Math.sin(t * Math.PI * 3) * (1 - t);
      targetX = 1 + wobble * 0.3;
      targetY = 1 - wobble * 0.3;
    } else if (now < stretchUntil) {
      targetX = 0.72;
      targetY = 1.32;
    } else if (now < bounceUntil) {
      const amt = 0.1 + bounceIntensity * 0.32;
      if (bounceAxis === "x") {
        targetX = 1 - amt;
        targetY = 1 + amt;
      } else {
        targetX = 1 + amt;
        targetY = 1 - amt;
      }
    } else if (speed < 0.35) {
      // respiración: un pulso muy sutil para que se sienta vivo incluso quieto
      const breathe = Math.sin(now / 900) * 0.018;
      targetX = 1 + breathe;
      targetY = 1 - breathe;
    } else {
      const stretch = 1 + (Math.min(speed, 18) / 18) * 0.22;
      const horizontal = Math.abs(ux) >= Math.abs(uy);
      if (horizontal) {
        targetX = stretch;
        targetY = 1 / Math.sqrt(stretch);
      } else {
        targetX = 1 / Math.sqrt(stretch);
        targetY = stretch;
      }
    }
    scaleX += (targetX - scaleX) * 0.3;
    scaleY += (targetY - scaleY) * 0.3;
  }

  // ---- Autonomía de movimiento: decide a dónde ir, sin depender del ratón ----
  function updateMoveMode(now) {
    if (now < moveModeUntil) return;
    const r = Math.random();
    if (r < 0.45) {
      moveMode = "goto";
      moveTarget = { x: rand(70, window.innerWidth - 70), y: rand(70, window.innerHeight * 0.75) };
      moveModeUntil = now + rand(3000, 5500);
      if (!exprLock) setExpression("determined", 900);
    } else if (r < 0.68) {
      moveMode = "pause";
      moveModeUntil = now + rand(1800, 3400);
      if (!exprLock) setExpression("curious", 1500);
      gazeMode = "random";
      gazeTarget = { x: rand(60, window.innerWidth - 60), y: rand(60, window.innerHeight * 0.6) };
      gazeUntil = now + rand(1500, 3000);
    } else {
      moveMode = "drift";
      moveModeUntil = now + rand(7000, 13000);
    }
  }

  // ---- Comportamientos autónomos ("bits") ----
  function startRandomBit(now) {
    const bits = ["thinking", "shy", "wink", "stretch", "happybounce", "peek"];
    const type = bits[Math.floor(Math.random() * bits.length)];
    nextBitAt = now + rand(11000, 19000);

    switch (type) {
      case "thinking":
        setExpression("thinking", 2600);
        gazeMode = "up";
        gazeUntil = now + 2600;
        break;
      case "shy":
        setExpression("shy", 2200);
        gazeMode = "down";
        gazeUntil = now + 2200;
        break;
      case "wink":
        doWink();
        break;
      case "stretch":
        stretchUntil = now + 700;
        break;
      case "happybounce":
        setExpression("excited", 900);
        funPulseStart = now;
        funPulseUntil = now + 700;
        break;
      case "peek": {
        const towardLeft = x < window.innerWidth / 2;
        peekDir = { x: towardLeft ? -1 : 1, y: 0 };
        setExpression("curious", 2400);
        gazeMode = "edge";
        gazeUntil = now + 2400;
        peekUntil = now + 2400;
        break;
      }
    }
  }

  // ---- Bucle principal ----
  function tick() {
    if (!enabled) {
      requestAnimationFrame(tick);
      return;
    }
    const maxX = window.innerWidth - SIZE - MARGIN;
    const maxY = window.innerHeight - SIZE - MARGIN;
    const now = Date.now();

    updateGazeAutonomy(now);
    updateProximity(now);
    scrollWiggle *= 0.88;

    if (!dragging) {
      const speed = Math.hypot(vx, vy);
      const isSpinning = Math.abs(spinSpeed) > 0.6;

      if (isSpinning) {
        x += vx;
        y += vy;
        vx *= 0.985;
        vy *= 0.985;
        rotation += spinSpeed;
        spinSpeed *= 0.965;
        lastSpinSign = spinSpeed >= 0 ? 1 : -1;
        settleTarget =
          lastSpinSign >= 0 ? Math.ceil(rotation / 360) * 360 : Math.floor(rotation / 360) * 360;
        // cuanto más gira, más mareado se pone (progresivamente, no de golpe)
        dizzyAccum += Math.abs(spinSpeed) * 0.8;
        updateDizzyExpression(dizzyAccum);
      } else if (!settling && Math.abs(rotation % 360) > 0.6) {
        settling = true;
      }

      if (settling) {
        x += vx;
        y += vy;
        vx *= 0.9;
        vy *= 0.9;
        const remaining = settleTarget - rotation;
        rotation += remaining * 0.06;
        if (Math.abs(remaining) < 28 && Math.abs(remaining) > 0.5) {
          // últimas vueltas: pequeño tambaleo amortiguado, como una peonza perdiendo fuerza
          rotation += Math.sin(now / 45) * (Math.abs(remaining) / 28) * 2.2;
        }
        dizzyAccum *= 0.975; // se va recuperando poco a poco incluso mientras termina de asentarse
        updateDizzyExpression(dizzyAccum);
        if (Math.abs(remaining) < 0.5) {
          rotation = settleTarget;
          settling = false;
          dizzyAccum *= 0.5; // el golpe de aterrizar le despeja bastante, pero no del todo
          if (dizzyAccum < DIZZY_QUEASY_AT) {
            settleDizziness();
            exprLock = null;
            applyExpression("neutral");
          } else {
            updateDizzyExpression(dizzyAccum);
          }
        }
      } else if (!isSpinning) {
        // si no gira ni se asienta, el mareo se le va pasando solo con el tiempo
        if (dizzyAccum > 0) {
          dizzyAccum *= 0.96;
          if (dizzyAccum < DIZZY_QUEASY_AT) {
            settleDizziness();
          } else {
            updateDizzyExpression(dizzyAccum);
          }
        }
        // deambular con autonomía propia: a veces decide ir a un punto concreto,
        // a veces se detiene a observar algo, a veces solo flota sin rumbo fijo
        updateMoveMode(now);
        prevDriftAngle = driftAngle;
        driftAngle += (Math.random() - 0.5) * 0.06;
        const bob = Math.sin(now / 600) * 0.08;
        let targetVx;
        let targetVy;
        let applyMousePull = true;

        if (moveMode === "goto") {
          const dx = moveTarget.x - (x + SIZE / 2);
          const dy = moveTarget.y - (y + SIZE / 2);
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 16) {
            moveMode = "pause";
            moveModeUntil = now + rand(1400, 2800);
          }
          targetVx = (dx / dist) * 1.15;
          targetVy = (dy / dist) * 1.15;
          applyMousePull = false;
        } else if (moveMode === "pause") {
          targetVx = 0;
          targetVy = 0;
          applyMousePull = false;
        } else {
          targetVx = Math.cos(driftAngle) * 0.5;
          targetVy = Math.sin(driftAngle) * 0.5 + bob;
        }

        if (now < peekUntil) {
          // durante el bit "peek" se deja llevar suavemente hacia el borde más cercano
          targetVx = peekDir.x * 0.35;
          targetVy = peekDir.y * 0.15;
          applyMousePull = false;
        }

        const toMouseX = mouseX - (x + SIZE / 2);
        const toMouseY = mouseY - (y + SIZE / 2);
        const mouseDist = Math.hypot(toMouseX, toMouseY) || 1;
        const pull = applyMousePull ? 0.0015 : 0;
        vx += (targetVx - vx) * 0.02 + (toMouseX / mouseDist) * pull;
        vy += (targetVy - vy) * 0.02 + (toMouseY / mouseDist) * pull;
        x += vx;
        y += vy;

        // banco/inclinación cosmética al virar, para un movimiento más orgánico
        const turnRate = Math.atan2(Math.sin(driftAngle - prevDriftAngle), Math.cos(driftAngle - prevDriftAngle));
        wanderTilt += (turnRate * 90 - wanderTilt) * 0.08;

        clearExpressionIfDue(now);
        updateBlink(now);

        if (!exprLock && now > sleepyAt) {
          setExpression("sleepy", 2600);
          sleepyAt = now + rand(25000, 45000);
        } else if (!exprLock && now > nextBitAt) {
          startRandomBit(now);
        }
      }

      if (x < MARGIN) {
        const impact = Math.abs(vx);
        x = MARGIN;
        vx = Math.abs(vx);
        driftAngle = Math.random() * Math.PI - Math.PI / 2;
        bounce("x", impact);
        if (impact > 5 && !isSpinning && !settling) {
          spinSpeed += (Math.random() < 0.5 ? -1 : 1) * Math.min(8, impact * 0.5);
          dizzyAccum += impact * 1.2;
        }
      }
      if (x > maxX) {
        const impact = Math.abs(vx);
        x = maxX;
        vx = -Math.abs(vx);
        driftAngle = Math.random() * Math.PI + Math.PI / 2;
        bounce("x", impact);
        if (impact > 5 && !isSpinning && !settling) {
          spinSpeed += (Math.random() < 0.5 ? -1 : 1) * Math.min(8, impact * 0.5);
          dizzyAccum += impact * 1.2;
        }
      }
      if (y < MARGIN) {
        const impact = Math.abs(vy);
        y = MARGIN;
        vy = Math.abs(vy);
        bounce("y", impact);
        if (impact > 5 && !isSpinning && !settling) {
          spinSpeed += (Math.random() < 0.5 ? -1 : 1) * Math.min(8, impact * 0.5);
          dizzyAccum += impact * 1.2;
        }
      }
      if (y > maxY) {
        const impact = Math.abs(vy);
        y = maxY;
        vy = -Math.abs(vy);
        bounce("y", impact);
        if (impact > 5 && !isSpinning && !settling) {
          spinSpeed += (Math.random() < 0.5 ? -1 : 1) * Math.min(8, impact * 0.5);
          dizzyAccum += impact * 1.2;
        }
      }

      updateSquash(speed, now);
    } else {
      // mientras lo arrastras: el squash/stretch sigue la velocidad real con la que lo mueves
      if (lastDragX === null) {
        lastDragX = x;
        lastDragY = y;
      }
      const dragVx = x - lastDragX;
      const dragVy = y - lastDragY;
      lastDragX = x;
      lastDragY = y;
      const dragSpeed = Math.hypot(dragVx, dragVy);
      updateSquash(dragSpeed * 2.2, now, dragVx, dragVy);

      // si lo zarandeas de un lado a otro muy rápido (cambios de dirección bruscos), se marea igual
      // que si lo lanzaras dando vueltas, aunque nunca llegue a soltarlo
      const jerkDot = dragVx * prevDragVx + dragVy * prevDragVy;
      const jerkSpeed = Math.hypot(dragVx, dragVy);
      if (jerkDot < 0 && jerkSpeed > 3.5) {
        dizzyAccum += jerkSpeed * 1.4;
        bounce(Math.abs(dragVx) >= Math.abs(dragVy) ? "x" : "y", jerkSpeed);
      } else {
        dizzyAccum *= 0.99;
      }
      prevDragVx = dragVx;
      prevDragVy = dragVy;
      updateDizzyExpression(Math.max(dizzyAccum, 1));
    }

    const cosmeticTilt = settling || Math.abs(spinSpeed) > 0.6 || dragging ? 0 : wanderTilt + scrollWiggle;
    root.style.transform = `translate(${x}px, ${y}px)`;
    spinGroup.setAttribute(
      "transform",
      `translate(50,50) rotate(${rotation + cosmeticTilt}) scale(${scaleX},${scaleY}) translate(-50,-50)`
    );
    updatePupils();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- Activar / desactivar la mascota ----
  function spawnDebris() {
    const colors = ["#3b97e8", "#67d17e", "#1f6fc4", "#4cc26a", "#ffffff"];
    const cx = x + SIZE / 2;
    const cy = y + SIZE / 2;
    for (let i = 0; i < 10; i++) {
      const d = document.createElement("div");
      d.style.position = "fixed";
      d.style.left = cx + "px";
      d.style.top = cy + "px";
      d.style.width = "10px";
      d.style.height = "10px";
      d.style.marginLeft = "-5px";
      d.style.marginTop = "-5px";
      d.style.borderRadius = "50%";
      d.style.background = colors[i % colors.length];
      d.style.zIndex = "9998";
      d.style.pointerEvents = "none";
      d.style.transition = "transform 0.5s ease-out, opacity 0.5s ease-out";
      document.body.appendChild(d);
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
      const dist = 55 + Math.random() * 45;
      requestAnimationFrame(() => {
        d.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) scale(0.2)`;
        d.style.opacity = "0";
      });
      setTimeout(() => d.remove(), 550);
    }
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    localStorage.setItem(MASCOT_PREF_KEY, "false");
    hide();
    spawnDebris();
    root.style.transition = "transform 0.18s ease-in, opacity 0.18s ease-in";
    root.style.opacity = "0";
    spinGroup.setAttribute("transform", "translate(50,50) scale(1.35) translate(-50,-50)");
    setTimeout(() => {
      root.style.display = "none";
      root.style.transition = "";
      root.style.opacity = "1";
      vx = 0.4;
      vy = 0.3;
      rotation = 0;
      spinSpeed = 0;
      settling = false;
      scaleX = 1;
      scaleY = 1;
      wanderTilt = 0;
      scrollWiggle = 0;
      applyExpression("neutral");
    }, 200);
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    localStorage.setItem(MASCOT_PREF_KEY, "true");
    root.style.display = "";
    root.style.opacity = "0";
    sleepyAt = Date.now() + rand(25000, 40000);
    requestAnimationFrame(() => {
      root.style.transition = "opacity 0.35s ease-out";
      root.style.opacity = "1";
      setExpression("excited", 1800);
      setTimeout(() => {
        root.style.transition = "";
      }, 400);
    });
  }

  function isEnabled() {
    return enabled;
  }

  window.mascot = { setExpression, say, hide, enable, disable, isEnabled };
})();
