/* ==========================================================================
   js/app.js — inicialização, renderização e integração dos módulos
   ========================================================================== */
window.App = (function () {
  "use strict";

  const dom = {};
  const state = {
    channels: [],
    order: [],
    config: Utils.deepClone(DEFAULT_CONFIG),
    stats: { viewers: DEFAULT_STATS.viewers, likes: DEFAULT_STATS.likes },
    events: [],
    battleIds: new Set(),
  };

  /* modos vindos da URL (não são gravados no armazenamento) */
  const urlView = { obs: false, transparent: false, paused: false };

  /* dupla em foco no rodapé + tempo de espera depois de uma ultrapassagem */
  const focus = { a: 0, b: 0, until: 0 };
  const FOCUS_HOLD_MS = 3000;

  /* filtro do gap usado no tempo até a ultrapassagem (Gap.createSmoother) */
  const etaSmoother = Gap.createSmoother(1100);
  const VISIBLE = 50; // slots do placar (5 colunas x 10 linhas)
  let wasLive = false;

  let loop = null;
  let ticks = 0;
  let saveTimer = null;
  let lastSavedAt = null;
  let booted = false;
  let numRaf = null;
  const marks = [];

  /* números do rodapé (contagem animada, igual à dos cards) */
  const footerNums = {
    left: { el: null, from: 0, to: 0, value: 0, start: 0, ms: null },
    right: { el: null, from: 0, to: 0, value: 0, start: 0, ms: null },
    gap: { el: null, from: 0, to: 0, value: 0, start: 0, ms: null },
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function channelById(id) {
    for (let i = 0; i < state.channels.length; i++) {
      if (state.channels[i].id === id) return state.channels[i];
    }
    return null;
  }

  /* ============================ dataset ============================ */

  /* valores iniciais de crescimento por atualização, derivados de data.js */
  function seedMin(velocidade) {
    const v = Number(velocidade) || 0;
    if (v > 0) return Math.max(1, Math.round(v * 1.8));
    if (v < 0) return Math.round(v * 3);
    return 0;
  }

  function seedMax(velocidade) {
    const v = Number(velocidade) || 0;
    if (v > 0) return Math.max(seedMin(v) + 1, Math.round(v * 3.6));
    if (v < 0) return -1;
    return 0;
  }

  function normalizeRange(min, max) {
    let lo = Math.round(Utils.safeNumber(min, 0));
    let hi = Math.round(Utils.safeNumber(max, 0));
    if (hi < lo) {
      const swap = lo;
      lo = hi;
      hi = swap;
    }
    return { min: lo, max: hi };
  }

  /** Velocidade média por segundo, derivada do sorteio min..max. */
  function rateFor(ch) {
    const period = Math.max(1, (Number(state.config.updateMs) || 3000) / 1000);
    return (ch.crescimentoMin + ch.crescimentoMax) / 2 / period;
  }

  function recomputeRates() {
    for (let i = 0; i < state.channels.length; i++) {
      state.channels[i].velocidade = rateFor(state.channels[i]);
    }
  }

  function makeChannel(def, saved) {
    const source = saved || {};
    const nome =
      typeof source.nome === "string" && source.nome.trim() ? source.nome.trim() : def.nome;
    const count = Math.max(0, Utils.safeNumber(source.inscritos, def.inscritos));

    const baseVel = Utils.safeNumber(source.velocidade, def.velocidade);
    const range = normalizeRange(
      source.crescimentoMin === undefined ? seedMin(baseVel) : source.crescimentoMin,
      source.crescimentoMax === undefined ? seedMax(baseVel) : source.crescimentoMax
    );

    return {
      id: def.id,
      nome: nome,
      imagem: typeof source.imagem === "string" ? source.imagem.trim() : "",
      cor: Utils.isHexColor(source.cor) ? Utils.normalizeHex(source.cor) : def.cor,
      ativo: source.ativo === undefined ? def.ativo !== false : source.ativo !== false,

      crescimentoMin: range.min,
      crescimentoMax: range.max,

      count: count,
      display: count,
      start: count,
      inscritos: count,
      prevCount: count,
      delta: 0,
      lastGain: 0,
      velocidade: 0,
      history: [count],
      position: def.id,
      trendKind: "",
      slot: null,
      anim: null,
      numAnim: null,
      flashTimer: null,
      nextUpdate: NaN,
      el: null,
    };
  }

  function buildDataset(savedChannels) {
    const map = new Map();
    if (Array.isArray(savedChannels)) {
      savedChannels.forEach(function (ch) {
        map.set(Number(ch.id), ch);
      });
    }

    const list = DEFAULT_CHANNELS.map(function (def) {
      return makeChannel(def, map.get(def.id));
    });

    /* canais extras criados no painel: continuam simulando abaixo do top 50 */
    if (Array.isArray(savedChannels)) {
      const used = new Set(
        list.map(function (ch) {
          return ch.id;
        })
      );
      savedChannels
        .slice()
        .sort(function (a, b) {
          return Number(a.id) - Number(b.id);
        })
        .forEach(function (saved) {
          const id = Number(saved.id);
          if (!Number.isFinite(id) || used.has(id)) return;
          used.add(id);
          const def = {
            id: id,
            nome: typeof saved.nome === "string" ? saved.nome : "Canal " + id,
            imagem: "",
            cor: "#7b2ff7",
            inscritos: Math.max(0, Utils.safeNumber(saved.inscritos, 0)),
            velocidade: Utils.safeNumber(saved.velocidade, 6),
            ativo: saved.ativo !== false,
          };
          const ch = makeChannel(def, saved);
          ch.extra = true;
          list.push(ch);
        });
    }

    return list;
  }

  /* ============================ cards ============================ */

  function paintAvatar(node, ch) {
    if (!node) return;
    node.style.setProperty("--c", ch.cor);
    node.dataset.for = String(ch.id);
    node.textContent = "";

    if (ch.imagem) {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      img.src = ch.imagem;
      img.addEventListener("error", function () {
        img.remove();
        node.textContent = Utils.initials(ch.nome);
      });
      node.appendChild(img);
    } else {
      node.textContent = Utils.initials(ch.nome);
    }
  }

  /**
   * Indicador abaixo do número da posição:
   *   none  -> nada (canal crescendo normalmente)
   *   fire  -> fogo laranja
   *   blue  -> fogo azul (crescimento ainda maior)
   *   down  -> seta vermelha para baixo (canal caindo)
   */
  function trendKind(ch) {
    if (!ch.ativo) return "none";
    if (ch.lastGain < 0) return "down";

    const cfg = state.config;
    if (!cfg.autoFire) return "none";

    const blue = Math.max(0, Number(cfg.blueFireMin) || 0);
    const fire = Math.max(0, Number(cfg.fireMin) || 0);
    if (ch.lastGain > 0 && ch.lastGain >= blue) return "blue";
    if (ch.lastGain > 0 && ch.lastGain >= fire) return "fire";
    return "none";
  }

  const TREND_HTML = {
    none: "",
    down: '<span class="caret-down"></span>',
    fire: '<span class="flame flame--hot"></span>',
    blue: '<span class="flame flame--cold"></span>',
  };

  function applyTrend(ch) {
    if (!ch.el) return;
    const kind = trendKind(ch);
    if (ch.trendKind === kind) return;
    ch.trendKind = kind;
    ch.el.trend.innerHTML = TREND_HTML[kind] || "";
  }

  function renderRank(ch) {
    if (!ch.el) return;
    const digits = Utils.pad2(ch.position);
    setText(ch.el.rankA, digits.charAt(0));
    setText(ch.el.rankB, digits.charAt(1));
  }

  function writeCount(ch) {
    if (!ch.el) return;
    setText(ch.el.count, Utils.formatNumber(ch.display));
  }

  function paintCard(ch) {
    if (!ch.el) return;
    ch.el.card.style.setProperty("--c", ch.cor);
    ch.el.card.classList.toggle("is-inactive", !ch.ativo);
    ch.el.name.textContent = ch.nome;
    ch.el.name.title = ch.nome;
    paintAvatar(ch.el.avatar, ch);
    ch.trendKind = "";
    applyTrend(ch);
    writeCount(ch);
    renderRank(ch);
  }

  function createCard(ch) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = String(ch.id);
    card.innerHTML =
      '<div class="card-body">' +
      '<div class="rank">' +
      '<div class="rank-digits"><span>0</span><span>1</span></div>' +
      '<div class="trend"></div>' +
      "</div>" +
      '<div class="avatar"></div>' +
      '<div class="info">' +
      '<div class="name"></div>' +
      '<div class="count-line"><span class="count">0</span></div>' +
      "</div>" +
      "</div>";

    ch.el = {
      card: card,
      rankA: card.querySelector(".rank-digits span:first-child"),
      rankB: card.querySelector(".rank-digits span:last-child"),
      avatar: card.querySelector(".avatar"),
      name: card.querySelector(".name"),
      count: card.querySelector(".count"),
      trend: card.querySelector(".trend"),
    };

    paintCard(ch);
    return card;
  }

  /** Só os 50 primeiros ganham card visível; os extras ficam escondidos. */
  function syncBoard() {
    const visible = state.order.slice(0, VISIBLE);

    for (let i = 0; i < visible.length; i++) {
      const ch = visible[i];
      if (!ch.el) createCard(ch);
      if (ch.el.card.hidden) ch.el.card.hidden = false;
      if (!ch.el.card.isConnected) dom.board.appendChild(ch.el.card);
    }

    for (let i = 0; i < state.channels.length; i++) {
      const ch = state.channels[i];
      if (!ch.el) continue;
      if (visible.indexOf(ch) < 0) ch.el.card.hidden = true;
    }
  }

  function buildBoard() {
    dom.board.textContent = "";
    marks.length = 0;
    for (let i = 0; i < state.channels.length; i++) {
      state.channels[i].el = null;
      state.channels[i].slot = null;
      state.channels[i].trendKind = "";
    }
    syncBoard();
  }

  function renderCards() {
    for (let i = 0; i < state.channels.length; i++) {
      const ch = state.channels[i];
      if (!ch.el || ch.el.card.hidden) continue;
      writeCount(ch);
      renderRank(ch);
      applyTrend(ch);

      const battle = state.battleIds.has(ch.id);
      if (ch.el.card.classList.contains("is-battle") !== battle) {
        ch.el.card.classList.toggle("is-battle", battle);
      }
    }
  }

  /* ============================ animação dos números ============================ */

  function ensureNumLoop() {
    if (numRaf) return;
    numRaf = requestAnimationFrame(stepNumbers);
  }

  function stepNumbers(now) {
    numRaf = null;
    let active = false;

    for (let i = 0; i < state.channels.length; i++) {
      const ch = state.channels[i];
      const anim = ch.numAnim;
      if (!anim) continue;

      const t = anim.ms > 0 ? Math.min(1, (now - anim.start) / anim.ms) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      ch.display = anim.from + (anim.to - anim.from) * eased;

      if (t >= 1) {
        ch.display = anim.to;
        ch.numAnim = null;
      } else {
        active = true;
      }
      writeCount(ch);
    }

    if (stepFooterNums(now)) active = true;
    if (active) ensureNumLoop();
  }

  /* ============================ números do rodapé ============================ */

  function writeFooterNum(key) {
    const st = footerNums[key];
    if (!st.el) return;
    setText(st.el, Utils.formatNumber(Math.round(st.value)));
  }

  /** Zera a contagem de um lado (troca de dupla) para o número novo aparecer direto. */
  function resetFooterNum(key) {
    const st = footerNums[key];
    st.el = null;
    st.ms = null;
  }

  function resetFooterNums() {
    resetFooterNum("left");
    resetFooterNum("right");
    resetFooterNum("gap");
  }

  /** Anima o número do rodapé até o novo valor, como a contagem dos cards. */
  function queueFooterNum(key, el, target) {
    const st = footerNums[key];
    if (!el) return;
    const value = Math.round(Number(target) || 0);

    if (!st.el || st.el !== el) {
      st.el = el;
      st.value = value;
      st.to = value;
      st.from = value;
      st.ms = null;
      writeFooterNum(key);
      return;
    }

    /* já está animando (ou já está) neste valor */
    if (value === Math.round(st.to)) {
      if (st.ms === null) writeFooterNum(key);
      return;
    }

    const animate =
      state.config.animations !== "off" &&
      !state.config.paused &&
      Number(state.config.countAnimMs) > 0;

    st.from = st.value;
    st.to = value;
    st.start = performance.now();
    st.ms = animate ? Math.max(120, Number(state.config.countAnimMs) || 700) : 0;

    if (!animate) {
      st.value = value;
      st.ms = null;
      writeFooterNum(key);
      return;
    }
    ensureNumLoop();
  }

  function stepFooterNums(now) {
    let active = false;
    const keys = ["left", "right", "gap"];

    for (let i = 0; i < keys.length; i++) {
      const st = footerNums[keys[i]];
      if (!st.el || st.ms === null) continue;

      const t = st.ms > 0 ? Math.min(1, (now - st.start) / st.ms) : 1;
      const eased = 1 - Math.pow(1 - t, 3);
      st.value = st.from + (st.to - st.from) * eased;

      if (t >= 1) {
        st.value = st.to;
        st.ms = null;
      } else {
        active = true;
      }
      writeFooterNum(keys[i]);
    }

    return active;
  }

  function startCountAnim(ch) {
    const ms = Math.max(120, Number(state.config.countAnimMs) || 700);
    ch.numAnim = {
      from: ch.display,
      to: ch.count,
      start: performance.now(),
      ms: ms,
    };
    ensureNumLoop();
  }

  function flashCount(ch, gain) {
    if (!ch.el || !gain) return;
    const el = ch.el.count;
    const cls = gain > 0 ? "is-up" : "is-down";
    el.classList.remove("is-up", "is-down");
    el.classList.add(cls);
    clearTimeout(ch.flashTimer);
    ch.flashTimer = setTimeout(
      function () {
        el.classList.remove("is-up", "is-down");
      },
      Math.max(150, Number(state.config.flashMs) || 1000)
    );
  }

  /* ============================ alertas / raios ============================ */

  /** Borda âmbar nos pares cuja ultrapassagem está prevista dentro do limite. */
  /** Analisa só as duplas em que o canal de cima aparece no placar. */
  function analyzeVisible() {
    const list = Gap.analyze(
      state.order,
      state.config.gapFrom,
      state.config.gapTo,
      state.config.globalSpeed
    );
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const pair = list[i];
      const index = state.order.indexOf(pair.upper);
      if (index < 0 || index >= VISIBLE) continue;
      out.push(pair);
    }
    return out;
  }

  function computeBattles(analysis) {
    const next = new Set();
    if (state.config.autoGap) {
      const limit = Math.max(10, Number(state.config.autoGapSeconds) || 7200);
      const maxPairs = Math.max(1, Math.min(10, Math.round(Number(state.config.autoGapPairs)) || 2));
      let pairs = 0;
      for (let i = 0; i < analysis.length && pairs < maxPairs; i++) {
        const pair = analysis[i];
        if (!pair.closing || !Number.isFinite(pair.seconds) || pair.seconds > limit) continue;
        next.add(pair.upper.id);
        next.add(pair.lower.id);
        pairs++;
      }
    }
    state.battleIds = next;
  }

  function ensureMarks(count) {
    while (marks.length < count) {
      const mark = document.createElement("span");
      mark.className = "gap-mark";
      mark.innerHTML = '<i class="bolt"></i>';
      dom.board.appendChild(mark);
      marks.push(mark);
    }
    for (let i = 0; i < marks.length; i++) marks[i].hidden = i >= count;
  }

  /**
   * Raios entre os dois canais das 3 duplas mais rápidas.
   * Duplas na mesma coluna: um raio na divisa dos cards.
   * Duplas que viram de coluna (ex.: 30º -> 31º): um raio embaixo do de cima
   * e outro em cima do de baixo. Se o de baixo está oculto (#50 x #51),
   * fica só o raio embaixo do último card da camada.
   */
  function renderGapMarks(analysis) {
    const pairs = [];
    /* a análise já vem da dupla que vai mudar mais rápido para a mais lenta */
    for (let i = 0; i < analysis.length && pairs.length < 3; i++) {
      const pair = analysis[i];
      const upperIndex = state.order.indexOf(pair.upper);
      const lowerIndex = state.order.indexOf(pair.lower);
      if (upperIndex < 0 || upperIndex >= VISIBLE) continue;
      if (lowerIndex !== upperIndex + 1) continue;
      if (!pair.closing && pair.gap > 0) continue;
      pairs.push({ pair: pair, upperIndex: upperIndex, lowerIndex: lowerIndex });
    }

    const w = dom.board.clientWidth;
    const h = dom.board.clientHeight;
    if (!w || !h) {
      ensureMarks(0);
      return;
    }

    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const half = 0.7 * remPx + 2;
    const limitX = function (v) {
      return Math.min(w - half, Math.max(half, Math.round(v)));
    };
    const limitY = function (v) {
      return Math.min(h - half, Math.max(half, Math.round(v)));
    };

    const spots = [];
    for (let i = 0; i < pairs.length; i++) {
      const item = pairs[i];
      const col = Math.floor(item.upperIndex / 10);
      const row = item.upperIndex % 10;
      const top = i === 0;
      const held = Boolean(item.pair.held);

      /* embaixo do card de cima */
      spots.push({
        x: limitX((w * col) / 5 + w / 5 / 2),
        y: limitY((h * (row + 1)) / 10),
        top: top,
        held: held,
      });

      /* em cima do card de baixo, quando a dupla muda de coluna */
      const nextCol = Math.floor(item.lowerIndex / 10);
      if (nextCol !== col && item.lowerIndex < VISIBLE) {
        spots.push({
          x: limitX((w * nextCol) / 5 + w / 5 / 2),
          y: limitY((h * (item.lowerIndex % 10)) / 10),
          top: top,
          held: held,
        });
      }
    }

    ensureMarks(spots.length);

    for (let i = 0; i < spots.length; i++) {
      const mark = marks[i];
      mark.style.transform =
        "translate3d(" + spots[i].x + "px, " + spots[i].y + "px, 0) translate(-50%, -50%)";
      mark.classList.toggle("is-top", spots[i].top);
      mark.classList.toggle("is-held", spots[i].held);
    }
  }

  function renderHot() {
    if (!dom.hot) return;

    const list = state.channels
      .filter(function (ch) {
        return ch.ativo && ch.velocidade > 0;
      })
      .sort(function (a, b) {
        return b.velocidade - a.velocidade;
      })
      .slice(0, 3);

    dom.hot.textContent = "";
    if (!list.length) return;

    const label = document.createElement("span");
    label.className = "hot-label";
    label.textContent = "Em alta";
    dom.hot.appendChild(label);

    list.forEach(function (ch) {
      const item = document.createElement("span");
      item.className = "hot-item";
      item.title =
        ch.nome +
        " ganha em média " +
        Math.round(ch.velocidade * state.config.globalSpeed) +
        " inscritos por segundo";

      const dot = document.createElement("span");
      dot.className = "hot-dot";

      const name = document.createElement("span");
      name.className = "hot-name";
      name.textContent = ch.nome;

      const speed = document.createElement("b");
      speed.textContent = "+" + Math.round(ch.velocidade * state.config.globalSpeed) + "/s";

      item.append(dot, name, speed);
      dom.hot.appendChild(item);
    });
  }

  /* ============================ layout / FLIP ============================ */

  function slotFor(index, size) {
    const col = Math.floor(index / 10);
    const row = index % 10;
    return {
      x: Math.round((size.w * col) / 5),
      y: Math.round((size.h * row) / 10),
    };
  }

  function cancelAnimation(ch) {
    if (!ch.anim) return;
    try {
      ch.anim.cancel();
    } catch (err) {
      /* animação já finalizada */
    }
    ch.anim = null;
  }

  function layout(immediate) {
    const size = { w: dom.board.clientWidth, h: dom.board.clientHeight };
    if (!size.w || !size.h) return;

    const cfg = state.config;
    const animate = !immediate && cfg.animations !== "off" && cfg.animMs > 0;

    if (immediate) {
      for (let i = 0; i < state.channels.length; i++) cancelAnimation(state.channels[i]);
    }

    const slots = Math.min(state.order.length, VISIBLE);
    for (let i = 0; i < slots; i++) {
      const ch = state.order[i];
      if (!ch.el) continue;

      const slot = slotFor(i, size);
      const prev = ch.slot;
      const el = ch.el.card;
      const target = "translate3d(" + slot.x + "px, " + slot.y + "px, 0)";

      const moved = prev && (prev.x !== slot.x || prev.y !== slot.y);

      if (moved) {
        /* FLIP: parte da posição antiga e anima até a nova */
        const dx = prev.x - slot.x;
        const dy = prev.y - slot.y;
        el.style.transform = target;

        if (animate) {
          cancelAnimation(ch);
          ch.anim = el.animate(
            [
              { transform: "translate3d(" + (slot.x + dx) + "px, " + (slot.y + dy) + "px, 0)" },
              { transform: target },
            ],
            { duration: cfg.animMs, easing: "cubic-bezier(.22,.68,.24,1)" }
          );
        } else {
          cancelAnimation(ch);
        }
      } else {
        el.style.transform = target;
      }

      ch.slot = slot;
    }
  }

  /* ============================ footer ============================ */

  function renderSide(which, ch) {
    const refs = which === "left" ? dom.left : dom.right;
    if (!refs) return;

    refs.root.style.setProperty("--c", ch.cor);

    /* a foto aparece aqui também, e é atualizada assim que a URL muda */
    if (refs.id !== ch.id || refs.imagem !== ch.imagem || refs.nome !== ch.nome) {
      if (refs.id !== ch.id) resetFooterNum(which);
      refs.id = ch.id;
      refs.imagem = ch.imagem;
      refs.nome = ch.nome;
      refs.name.textContent = ch.nome;
      paintAvatar(refs.avatar, ch);
    }

    setText(refs.badge, "#" + ch.position);
    queueFooterNum(which, refs.count, ch.count);
  }

  function clearFooter(message) {
    if (!dom.left) return;
    dom.left.id = null;
    dom.right.id = null;
    dom.left.name.textContent = "—";
    dom.right.name.textContent = "—";
    dom.left.badge.textContent = "#--";
    dom.right.badge.textContent = "#--";
    dom.left.count.textContent = "0";
    dom.right.count.textContent = "0";
    dom.left.avatar.textContent = "?";
    dom.right.avatar.textContent = "?";
    dom.left.imagem = "";
    dom.right.imagem = "";
    dom.left.nome = "";
    dom.right.nome = "";
    resetFooterNums();
    setText(dom.gap, "0");
    dom.timer.hidden = true;
    dom.urgent.hidden = true;
    dom.note.hidden = false;
    if (message) dom.note.textContent = message;
  }

  /** Resolve a dupla em foco: a mais rápida a mudar, ou a que acabou de virar. */
  function pickPair(analysis, now) {
    if (focus.until > now && focus.a && focus.b) {
      const upper = channelById(focus.a);
      const lower = channelById(focus.b);
      if (upper && lower) {
        return {
          upper: upper,
          lower: lower,
          gap: Math.abs(Math.round(upper.count) - Math.round(lower.count)),
          rel: (lower.velocidade || 0) - (upper.velocidade || 0),
          closing: true,
          seconds: 0,
          held: true,
        };
      }
      focus.until = 0;
    }

    focus.until = 0;
    /* a análise já vem ordenada: a primeira é a que vai mudar mais rápido */
    const best = analysis[0] || null;
    if (best && best.gap === 0) {
      focus.a = best.upper.id;
      focus.b = best.lower.id;
      focus.until = now + FOCUS_HOLD_MS;
      best.held = true;
    }
    return best;
  }

  function renderFooter(analysis, now) {
    /* avança a contagem do rodapé mesmo se o rAF estiver economizando quadros */
    stepFooterNums(now);

    const pair = pickPair(analysis, now);

    if (!pair) {
      clearFooter("NENHUMA DUPLA DISPONÍVEL NA FAIXA");
      return;
    }

    const info = Gap.compute(pair.upper, pair.lower, state.config.globalSpeed);
    const held = Boolean(pair.held);

    renderSide("left", pair.upper);
    renderSide("right", pair.lower);
    queueFooterNum("gap", dom.gap, info.gap);

    const arrow = info.direction === "down" ? "\u25BC" : info.direction === "up" ? "\u25B2" : "\u2014";
    setText(dom.arrow, arrow);
    dom.arrow.className = "sg-gap-arrow " + info.direction;

    const showTimer = !held && info.hasPrediction && !info.imminent;
    if (!showTimer) etaSmoother.reset(); /* recomeça o filtro quando o relógio volta */

    dom.timer.hidden = !showTimer;
    dom.urgent.hidden = !held && !info.imminent;
    dom.note.hidden = !(info.imminent === false && info.hasPrediction === false);
    dom.note.textContent = "SEM PREVIS\u00C3O COM AS VELOCIDADES ATUAIS";
    dom.urgent.textContent = held ? "ULTRAPASSAGEM!" : "ULTRAPASSAGEM IMINENTE!";

    if (info.hasPrediction && !info.imminent && !held) {
      const predicted = etaSmoother.smooth(
        pair.upper.id + ":" + pair.lower.id + ":" + Math.round(info.rel * 100),
        info.gap,
        now
      );
      const d = Utils.splitDuration(predicted / info.rel);
      setText(dom.day, d.d);
      setText(dom.hrs, d.h);
      setText(dom.min, d.m);
      setText(dom.sec, d.s);
    }
  }

  /* ============================ header ============================ */

  function totalSubscribers() {
    let total = 0;
    for (let i = 0; i < state.channels.length; i++) total += state.channels[i].count;
    return total;
  }

  function renderHeader(total) {
    setText(dom.viewers, Utils.formatNumber(state.stats.viewers));
    setText(dom.likes, Utils.formatNumber(state.stats.likes));
    setText(dom.totalSubs, Utils.formatNumber(total === undefined ? totalSubscribers() : total));
  }

  function driftStats() {
    if (ticks % 2 === 0) {
      const drift = Math.round(Utils.randomBetween(-2, 2.4));
      state.stats.viewers = Math.max(0, state.stats.viewers + drift);
    }
    state.stats.likes += Utils.randomBetween(0, 6);
  }

  /* ============================ loop ============================ */

  function tick() {
    const now = performance.now();
    ticks++;

    const result = Simulation.step(state.channels, state.config, now);

    if (result.updated.length) {
      const ranked = Ranking.apply(state.channels);
      state.order = ranked.sorted;
      syncBoard();

      for (let i = 0; i < result.updated.length; i++) {
        const ch = result.updated[i];
        startCountAnim(ch);
        flashCount(ch, ch.lastGain);
        applyTrend(ch);
      }

      for (let i = 0; i < ranked.moves.length; i++) {
        const move = ranked.moves[i];
        addEvent(move.winner.nome + " ultrapassou " + move.loser.nome);
        focus.a = move.winner.id;
        focus.b = move.loser.id;
        focus.until = now + FOCUS_HOLD_MS;
      }
    }

    const analysis = analyzeVisible();

    computeBattles(analysis);
    driftStats();
    renderCards();
    layout(false);
    renderGapMarks(analysis);
    renderFooter(analysis, now);
    renderHeader(result.total);
    if (ticks % 2 === 0) renderHot();
    if (ticks % 4 === 0) scheduleSave();
  }

  function restartLoop() {
    if (loop) {
      clearInterval(loop);
      loop = null;
    }
    loop = setInterval(tick, Math.max(100, Number(state.config.tickMs) || 200));
  }

  function start() {
    state.config.paused = false;
    dom.pauseBadge.hidden = true;
    restartLoop();
    scheduleSave();
    refreshPanel();
  }

  function pause() {
    state.config.paused = true;
    if (loop) {
      clearInterval(loop);
      loop = null;
    }
    dom.pauseBadge.hidden = false;
    persist();
    refreshPanel();
  }

  function togglePause() {
    if (state.config.paused) start();
    else pause();
  }

  function resetCounts() {
    Simulation.resetCounts(state.channels, state.config);
    const ranked = Ranking.apply(state.channels);
    state.order = ranked.sorted;
    syncBoard();
    focus.a = 0;
    focus.b = 0;
    focus.until = 0;
    resetFooterNums();
    renderCards();
    layout(true);
    renderFooter(analyzeVisible(), performance.now());
    renderHeader(totalSubscribers());
    renderHot();
    scheduleSave();
    refreshPanel();
  }

  function restartSimulation() {
    pause();
    resetCounts();
    start();
  }

  function addEvent(text) {
    state.events.unshift({ time: Utils.formatClock(new Date()), text: text });
    if (state.events.length > 12) state.events.length = 12;
  }

  /* ============================ persistência ============================ */

  function persist() {
    const ok = Storage.save(state);
    if (ok) lastSavedAt = Utils.formatClock(new Date());
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      persist();
    }, 1200);
  }

  /* ============================ aparência ============================ */

  /** true quando nada de controle pode aparecer (fonte do OBS ou modo transmissão ligado). */
  function inLiveMode() {
    return urlView.obs || state.config.obsMode === true;
  }

  function applyView() {
    const cfg = state.config;
    const theme = cfg.theme;
    const root = document.documentElement;

    Utils.setThousandSeparator(cfg.numberSeparator);

    root.style.setProperty("--font-family", Utils.fontStack(cfg.font));
    root.style.setProperty("--count-scale", String(Number(cfg.countScale) || 1));
    root.style.setProperty("--name-scale", String(Number(cfg.nameScale) || 1));
    root.style.setProperty("--rank-scale", String(Number(cfg.rankScale) || 1));
    root.style.setProperty("--avatar-scale", String(Number(cfg.avatarScale) || 1));
    root.style.setProperty("--header-scale", String(Number(cfg.headerScale) || 1));
    root.style.setProperty("--footer-scale", String(Number(cfg.footerScale) || 1));
    root.style.setProperty("--gap-scale", String(Number(cfg.gapScale) || 1));
    root.style.setProperty("--card-radius", (Number(cfg.cardRadius) || 0) + "px");
    root.style.setProperty("--alert-color", cfg.alertColor);
    dom.board.style.setProperty("--card-gap", (Number(cfg.cardGap) || 0) + "px");

    document.body.classList.toggle("hide-names", !cfg.showNames);
    document.body.classList.toggle("hide-avatars", !cfg.showAvatars);
    document.body.classList.toggle("uppercase-names", !!cfg.uppercaseNames);

    root.style.setProperty("--card-bg", theme.cardBg);
    root.style.setProperty("--card-border", Utils.withAlpha(theme.border, 0.55));
    root.style.setProperty("--count-color", theme.numberColor);
    root.style.setProperty("--name-color", theme.nameColor || theme.numberColor);
    root.style.setProperty("--rank-color", theme.rankColor || "#ffffff");
    root.style.setProperty(
      "--card-shadow",
      "0 0.18rem 0.55rem rgba(0, 0, 0, " + (0.35 * theme.shadow).toFixed(3) + ")"
    );

    dom.board.style.setProperty("--board-bg", theme.bg);
    document.body.style.setProperty("--board-bg", theme.bg);
    document.body.style.setProperty("--board-glow", Utils.shade(theme.bg, 0.22));
    document.body.style.setProperty("--board-deep", Utils.shade(theme.bg, -0.12));

    const obsMode = inLiveMode();
    const transparent = cfg.transparent || urlView.transparent;

    dom.topbar.hidden = !cfg.showHeader;
    dom.subgap.hidden = !cfg.showFooter;

    document.body.classList.toggle("is-transparent", transparent);
    document.body.classList.toggle("obs-mode", obsMode);
    /* ao entrar no modo transmissão o painel fecha; depois disso S/C abrem de novo */
    if (obsMode && !wasLive && Settings.isOpen()) Settings.close();
    wasLive = obsMode;
    document.body.classList.toggle("no-indicators", !cfg.showIndicators);
    document.body.classList.toggle("anim-reduced", cfg.animations === "reduced");
    document.body.classList.toggle("anim-off", cfg.animations === "off");
    document.body.classList.toggle("no-gradients", !!cfg.noGradients);

    dom.pauseBadge.hidden = !cfg.paused;

    requestAnimationFrame(function () {
      layout(true);
    });
  }

  /* ============================ painel ============================ */

  function refreshPanel() {
    if (typeof Settings !== "undefined" && Settings.isOpen()) Settings.refresh();
  }

  function toast(message, type) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.className = "toast is-visible" + (type ? " is-" + type : "");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      dom.toast.className = "toast";
    }, 2600);
  }

  /* ============================ ações públicas ============================ */

  function updateChannel(id, patch) {
    const ch = channelById(id);
    if (!ch || !patch) return;

    if (patch.nome !== undefined) {
      const nome = String(patch.nome).trim();
      if (nome) ch.nome = Utils.truncate(nome, 40);
    }
    if (patch.imagem !== undefined) ch.imagem = String(patch.imagem || "").trim();
    if (patch.cor !== undefined && Utils.isHexColor(patch.cor)) ch.cor = Utils.normalizeHex(patch.cor);

    if (patch.inscritos !== undefined) {
      const value = Math.max(0, Utils.safeNumber(patch.inscritos, ch.count));
      ch.count = value;
      ch.display = value;
      ch.inscritos = value;
      ch.start = value;
      ch.numAnim = null;
    }

    const hasMin = patch.crescimentoMin !== undefined;
    const hasMax = patch.crescimentoMax !== undefined;
    if (hasMin || hasMax) {
      const range = normalizeRange(
        hasMin ? patch.crescimentoMin : ch.crescimentoMin,
        hasMax ? patch.crescimentoMax : ch.crescimentoMax
      );
      ch.crescimentoMin = range.min;
      ch.crescimentoMax = range.max;
      ch.velocidade = rateFor(ch);
    }

    if (patch.ativo !== undefined) ch.ativo = patch.ativo !== false;

    paintCard(ch);

    const ranked = Ranking.apply(state.channels);
    state.order = ranked.sorted;
    syncBoard();
    renderCards();
    layout(false);
    renderHeader(totalSubscribers());
    renderHot();
    persist();
  }

  /** Cria um canal extra abaixo do top 50 (oculto até subir de posição). */
  function addChannel() {
    let maxId = 0;
    for (let i = 0; i < state.channels.length; i++) {
      maxId = Math.max(maxId, state.channels[i].id);
    }
    const id = maxId + 1;
    const ref = state.order[VISIBLE - 1] || state.order[state.order.length - 1];
    const base = ref ? Math.max(1, Math.round(ref.count * 0.72)) : 1000;

    const def = {
      id: id,
      nome: "Novo canal " + (id - DEFAULT_CHANNELS.length),
      imagem: "",
      cor: "#7b2ff7",
      inscritos: base,
      velocidade: 6,
      ativo: true,
    };
    const ch = makeChannel(def, {
      nome: def.nome,
      inscritos: base,
      crescimentoMin: 12,
      crescimentoMax: 32,
      ativo: true,
    });
    ch.extra = true;
    ch.velocidade = rateFor(ch);
    state.channels.push(ch);

    const ranked = Ranking.apply(state.channels);
    state.order = ranked.sorted;
    syncBoard();
    renderCards();
    layout(false);
    renderHeader(totalSubscribers());
    Simulation.schedule([ch], state.config, performance.now());
    persist();
    return { id: id };
  }

  /** Remove um canal extra (os 50 originais não podem ser removidos). */
  function removeChannel(id) {
    const ch = channelById(id);
    if (!ch || !ch.extra) return false;

    if (ch.el && ch.el.card.parentNode) ch.el.card.parentNode.removeChild(ch.el.card);
    ch.el = null;

    state.channels = state.channels.filter(function (item) {
      return item.id !== id;
    });

    const ranked = Ranking.apply(state.channels);
    state.order = ranked.sorted;
    syncBoard();
    renderCards();
    layout(false);
    renderHeader(totalSubscribers());
    renderHot();
    persist();
    return true;
  }

  function resetChannel(id) {
    const def = DEFAULT_CHANNELS.filter(function (item) {
      return item.id === id;
    })[0];
    if (!def) return;
    updateChannel(id, {
      nome: def.nome,
      imagem: def.imagem,
      cor: def.cor,
      inscritos: def.inscritos,
      crescimentoMin: seedMin(def.velocidade),
      crescimentoMax: seedMax(def.velocidade),
      ativo: def.ativo,
    });
  }

  function patchConfig(patch) {
    if (!patch || typeof patch !== "object") return;

    const needsLoopRestart = patch.tickMs !== undefined;
    const rateChanged = patch.updateMs !== undefined;

    Object.assign(state.config, patch);

    if (patch.gapFrom !== undefined || patch.gapTo !== undefined) {
      const maxTo = Math.max(2, state.channels.length + 1);
      const from = Utils.clamp(Math.round(state.config.gapFrom), 1, maxTo - 1);
      let to = Utils.clamp(Math.round(state.config.gapTo), 2, maxTo);
      if (to <= from) to = Math.min(maxTo, from + 1);
      state.config.gapFrom = from;
      state.config.gapTo = to;
    }

    if (patch.globalSpeed !== undefined) {
      state.config.globalSpeed = Utils.clamp(Number(patch.globalSpeed) || 1, 0.1, 100);
    }
    if (patch.tickMs !== undefined) {
      state.config.tickMs = Utils.clamp(Number(patch.tickMs) || 200, 100, 10000);
    }
    if (patch.updateMs !== undefined) {
      state.config.updateMs = Utils.clamp(Number(patch.updateMs) || 3000, 500, 60000);
    }
    if (patch.animMs !== undefined) {
      state.config.animMs = Utils.clamp(Number(patch.animMs) || 0, 0, 2000);
    }
    if (patch.countAnimMs !== undefined) {
      state.config.countAnimMs = Utils.clamp(Number(patch.countAnimMs) || 700, 120, 2000);
    }
    if (patch.flashMs !== undefined) {
      state.config.flashMs = Utils.clamp(Number(patch.flashMs) || 1000, 150, 5000);
    }
    if (patch.fireMin !== undefined) {
      state.config.fireMin = Utils.clamp(Math.round(Number(patch.fireMin) || 0), 0, 100000);
    }
    if (patch.blueFireMin !== undefined) {
      state.config.blueFireMin = Utils.clamp(Math.round(Number(patch.blueFireMin) || 0), 0, 100000);
    }
    if (patch.nameScale !== undefined) {
      state.config.nameScale = Utils.clamp(Number(patch.nameScale) || 1, 0.6, 1.6);
    }
    if (patch.rankScale !== undefined) {
      state.config.rankScale = Utils.clamp(Number(patch.rankScale) || 1, 0.6, 1.6);
    }
    if (patch.avatarScale !== undefined) {
      state.config.avatarScale = Utils.clamp(Number(patch.avatarScale) || 1, 0.7, 1.3);
    }
    if (patch.headerScale !== undefined) {
      state.config.headerScale = Utils.clamp(Number(patch.headerScale) || 1, 0.7, 1.35);
    }
    if (patch.footerScale !== undefined) {
      state.config.footerScale = Utils.clamp(Number(patch.footerScale) || 1, 0.7, 1.3);
    }
    if (patch.gapScale !== undefined) {
      state.config.gapScale = Utils.clamp(Number(patch.gapScale) || 1, 0.7, 1.4);
    }

    if (rateChanged) recomputeRates();

    applyView();

    const analysis = analyzeVisible();
    computeBattles(analysis);

    if (patch.numberSeparator !== undefined) {
      renderHeader(totalSubscribers());
    }

    for (let i = 0; i < state.channels.length; i++) applyTrend(state.channels[i]);
    renderCards();
    renderGapMarks(analysis);
    renderFooter(analysis, performance.now());
    renderHot();

    if (needsLoopRestart && !state.config.paused) restartLoop();

    persist();
    refreshPanel();
  }

  function patchTheme(patch) {
    if (!patch || typeof patch !== "object") return;
    Object.keys(patch).forEach(function (key) {
      if (key === "shadow") {
        state.config.theme.shadow = Utils.clamp(Utils.safeNumber(patch.shadow, 1), 0, 2);
      } else if (Utils.isHexColor(patch[key])) {
        state.config.theme[key] = Utils.normalizeHex(patch[key]);
      }
    });
    applyView();
    persist();
  }

  function resetAppearance() {
    state.config.theme = Utils.deepClone(DEFAULT_CONFIG.theme);
    state.config.font = DEFAULT_CONFIG.font;
    state.config.animations = DEFAULT_CONFIG.animations;
    state.config.animMs = DEFAULT_CONFIG.animMs;
    state.config.noGradients = false;
    state.config.showHeader = true;
    state.config.showFooter = true;
    state.config.showIndicators = true;
    state.config.transparent = false;
    state.config.alertColor = DEFAULT_CONFIG.alertColor;
    state.config.countScale = DEFAULT_CONFIG.countScale;
    state.config.nameScale = DEFAULT_CONFIG.nameScale;
    state.config.rankScale = DEFAULT_CONFIG.rankScale;
    state.config.avatarScale = DEFAULT_CONFIG.avatarScale;
    state.config.headerScale = DEFAULT_CONFIG.headerScale;
    state.config.footerScale = DEFAULT_CONFIG.footerScale;
    state.config.gapScale = DEFAULT_CONFIG.gapScale;
    state.config.cardRadius = DEFAULT_CONFIG.cardRadius;
    state.config.cardGap = DEFAULT_CONFIG.cardGap;
    state.config.showNames = true;
    state.config.showAvatars = true;
    state.config.uppercaseNames = false;
    state.config.fireMin = DEFAULT_CONFIG.fireMin;
    state.config.blueFireMin = DEFAULT_CONFIG.blueFireMin;
    state.config.countAnimMs = DEFAULT_CONFIG.countAnimMs;
    state.config.flashMs = DEFAULT_CONFIG.flashMs;
    applyView();
    scheduleSave();
  }

  function setStats(patch) {
    if (!patch) return;
    if (patch.viewers !== undefined) {
      const viewers = Utils.safeNumber(patch.viewers, state.stats.viewers);
      if (viewers >= 0) state.stats.viewers = Math.round(viewers);
    }
    if (patch.likes !== undefined) {
      const likes = Utils.safeNumber(patch.likes, state.stats.likes);
      if (likes >= 0) state.stats.likes = Math.round(likes);
    }
    renderHeader(totalSubscribers());
    persist();
  }

  function clearEvents() {
    state.events.length = 0;
    persist();
  }

  function getStats() {
    const highlight = Ranking.highlights(state.channels);
    let total = 0;
    let active = 0;

    for (let i = 0; i < state.channels.length; i++) {
      total += state.channels[i].count;
      if (state.channels[i].ativo) active++;
    }

    return {
      fastest: highlight.fastest
        ? { name: highlight.fastest.nome, value: highlight.fastest.velocidade }
        : null,
      slowest: highlight.slowest
        ? { name: highlight.slowest.nome, value: highlight.slowest.velocidade }
        : null,
      topGainer: highlight.topGainer
        ? { name: highlight.topGainer.nome, value: Math.round(highlight.topGainer.delta) }
        : null,
      topLoser: highlight.topLoser
        ? { name: highlight.topLoser.nome, value: Math.round(highlight.topLoser.delta) }
        : null,
      total: total,
      active: active,
      inactive: state.channels.length - active,
      totalChannels: state.channels.length,
      biggestMove: state.events.length ? state.events[0].text : null,
      viewers: state.stats.viewers,
      likes: state.stats.likes,
      gapFrom: state.config.gapFrom,
      gapTo: state.config.gapTo,
      updateMs: state.config.updateMs,
    };
  }

  function exportData() {
    return Storage.exportData(state);
  }

  function adoptDataset(data) {
    state.config = data.config;
    state.stats = { viewers: data.stats.viewers, likes: data.stats.likes };
    state.events = data.events.slice();
    state.channels = buildDataset(data.channels);
    recomputeRates();
    state.order = Ranking.apply(state.channels).sorted;
    focus.a = 0;
    focus.b = 0;
    focus.until = 0;

    buildBoard();
    applyView();
    renderCards();
    layout(true);
    const analysis = analyzeVisible();
    computeBattles(analysis);
    renderGapMarks(analysis);
    renderFooter(analysis, performance.now());
    renderHeader(totalSubscribers());
    renderHot();
    Simulation.schedule(state.channels, state.config, performance.now());
    persist();
    if (!state.config.paused) restartLoop();
  }

  /** Importação vinda do painel externo (objeto já validado). */
  function importData(data) {
    try {
      adoptDataset(data);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err && err.message ? err.message : "Falha ao importar." };
    }
  }

  function importFile(file) {
    return Storage.readFile(file)
      .then(function (text) {
        const result = Storage.parseImport(text);
        if (!result.ok) return { ok: false, message: result.error };
        adoptDataset(result.data);
        return { ok: true, message: "Configurações importadas com sucesso." };
      })
      .catch(function (err) {
        return { ok: false, message: err && err.message ? err.message : "Falha ao importar o arquivo." };
      });
  }

  function restoreDefaults() {
    Storage.clear();
    state.config = Utils.deepClone(DEFAULT_CONFIG);
    state.stats = { viewers: DEFAULT_STATS.viewers, likes: DEFAULT_STATS.likes };
    state.events = [];
    state.channels = buildDataset(null);
    recomputeRates();
    state.order = Ranking.apply(state.channels).sorted;
    focus.a = 0;
    focus.b = 0;
    focus.until = 0;

    buildBoard();
    applyView();
    renderCards();
    layout(true);
    const analysis = analyzeVisible();
    computeBattles(analysis);
    renderGapMarks(analysis);
    renderFooter(analysis, performance.now());
    renderHeader(totalSubscribers());
    renderHot();
    persist();

    if (loop) {
      clearInterval(loop);
      loop = null;
    }
    if (!state.config.paused) start();
    else pause();
  }

  /* ============================ eventos globais ============================ */

  function bindStatic() {
    window.addEventListener(
      "resize",
      Utils.debounce(function () {
        layout(true);
        renderGapMarks(
          analyzeVisible()
        );
      }, 120)
    );

    document.addEventListener("keydown", function (event) {
      const target = event.target;
      const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
      const typing =
        tag === "input" || tag === "textarea" || tag === "select" || (target && target.isContentEditable);

      const key = String(event.key || "").toLowerCase();
      const code = event.code;

      if (key === "escape") {
        Settings.close();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey || event.altKey) return;

      /* S e C são o mesmo atalho da engrenagem e valem também durante a gravação */
      if (key === "s" || key === "c" || code === "KeyS" || code === "KeyC") {
        event.preventDefault();
        Settings.toggle();
      } else if (key === " " || code === "Space") {
        event.preventDefault();
        togglePause();
      } else if (key === "o" && event.shiftKey) {
        event.preventDefault();
        patchConfig({ obsMode: !state.config.obsMode });
        toast(state.config.obsMode ? "Modo transmissão ativado." : "Modo transmissão desativado.", "ok");
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) persist();
    });

    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
  }

  function applyUrlOptions() {
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (err) {
      return;
    }
    urlView.obs = params.get("obs") === "1";
    urlView.transparent = params.get("clean") === "1" || params.get("transparent") === "1";
    urlView.paused = params.get("paused") === "1";
  }

  /* ============================ bootstrap ============================ */

  function cacheDom() {
    dom.board = byId("board");
    dom.topbar = byId("topbar");
    dom.subgap = byId("subgap");
    dom.pauseBadge = byId("pauseBadge");
    dom.toast = byId("toast");

    dom.viewers = byId("viewers");
    dom.likes = byId("likes");
    dom.totalSubs = byId("totalSubs");

    dom.hot = byId("hotList");

    dom.gap = byId("sgGap");
    dom.arrow = byId("sgArrow");
    dom.timer = byId("sgTimer");
    dom.urgent = byId("tUrgent");
    dom.note = byId("tNote");
    dom.day = byId("tDay");
    dom.hrs = byId("tHrs");
    dom.min = byId("tMin");
    dom.sec = byId("tSec");

    dom.left = {
      root: byId("sgLeft"),
      badge: byId("sgLeftRank"),
      avatar: byId("sgLeftAvatar"),
      name: byId("sgLeftName"),
      count: byId("sgLeftCount"),
      id: null,
      imagem: "",
      nome: "",
    };

    dom.right = {
      root: byId("sgRight"),
      badge: byId("sgRightRank"),
      avatar: byId("sgRightAvatar"),
      name: byId("sgRightName"),
      count: byId("sgRightCount"),
      id: null,
      imagem: "",
      nome: "",
    };
  }

  function boot() {
    if (booted) return;
    booted = true;

    cacheDom();

    const saved = Storage.load();
    if (saved) {
      state.config = saved.config;
      state.stats = { viewers: saved.stats.viewers, likes: saved.stats.likes };
      state.events = saved.events.slice();
      state.channels = buildDataset(saved.channels);
    } else {
      state.config = Utils.deepClone(DEFAULT_CONFIG);
      state.stats = { viewers: DEFAULT_STATS.viewers, likes: DEFAULT_STATS.likes };
      state.events = [];
      state.channels = buildDataset(null);
    }

    applyUrlOptions();
    /* o modo transmissão salvo não pode esconder a engrenagem fora da fonte do OBS */
    if (!urlView.obs) state.config.obsMode = false;
    recomputeRates();
    state.order = Ranking.apply(state.channels).sorted;

    buildBoard();
    applyView();
    renderCards();
    layout(true);

    const analysis = analyzeVisible();
    computeBattles(analysis);
    renderGapMarks(analysis);
    renderFooter(analysis, performance.now());
    renderHeader(totalSubscribers());
    renderHot();

    Simulation.schedule(state.channels, state.config, performance.now());
    bindStatic();

    Settings.init(api);

    if (state.config.paused || urlView.paused) {
      dom.pauseBadge.hidden = false;
      persist();
    } else {
      start();
    }
  }

  const api = {
    getState: function () {
      return state;
    },
    getStats: getStats,
    getLastSavedAt: function () {
      return lastSavedAt;
    },
    updateChannel: updateChannel,
    addChannel: addChannel,
    removeChannel: removeChannel,
    resetChannel: resetChannel,
    patchConfig: patchConfig,
    patchTheme: patchTheme,
    resetAppearance: resetAppearance,
    setStats: setStats,
    start: start,
    pause: pause,
    togglePause: togglePause,
    restart: restartSimulation,
    resetCounts: resetCounts,
    clearEvents: clearEvents,
    exportData: exportData,
    importFile: importFile,
    importData: importData,
    restoreDefaults: restoreDefaults,
    toast: toast,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return api;
})();
