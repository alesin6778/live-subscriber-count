/* ==========================================================================
   js/control.js — painel de controle em página separada (fora da transmissão)
   --------------------------------------------------------------------------
   Esta página usa o MESMO painel da live (js/settings.js): ela importa o bloco
   #settingsModal do index.html e conversa com a página da live pelo
   BroadcastChannel. Nada aqui aparece na fonte do OBS.
   ========================================================================== */
(function () {
  "use strict";

  const state = {
    channels: [],
    config: Utils.deepClone(DEFAULT_CONFIG),
    stats: { viewers: 0, likes: 0 },
    events: [],
    savedAt: null,
  };

  const dom = { host: null, status: null, dot: null, toast: null };
  let booted = false;
  let lastAdopt = 0;
  let pending = null;

  /* ---------------------------- utilidades ---------------------------- */

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text, mode) {
    if (dom.status) dom.status.textContent = text;
    if (dom.dot) dom.dot.className = "ctrl-dot" + (mode ? " is-" + mode : "");
  }

  function toast(message, type) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.className = "toast is-visible" + (type ? " is-" + type : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      dom.toast.className = "toast";
    }, 2600);
  }

  function send(cmd, payload) {
    const ok = LiveSync.send({ type: "cmd", cmd: cmd, payload: payload || {}, at: Date.now() });
    if (!ok) setStatus("sem conexão com a live", "error");
    return ok;
  }

  /** Aplica o estado recebido da live ao espelho local. */
  function adopt(message) {
    state.config = Utils.deepClone(message.config || DEFAULT_CONFIG);
    state.stats = {
      viewers: Math.round(Utils.safeNumber(message.stats && message.stats.viewers, 0)),
      likes: Math.round(Utils.safeNumber(message.stats && message.stats.likes, 0)),
    };
    state.events = Array.isArray(message.events) ? message.events.slice(0, 12) : [];
    state.savedAt = message.savedAt || null;
    state.channels = (message.channels || []).map(function (ch, i) {
      const count = Math.max(0, Utils.safeNumber(ch.inscritos, 0));
      return {
        id: ch.id,
        nome: ch.nome,
        imagem: ch.imagem || "",
        cor: ch.cor,
        ativo: ch.ativo !== false,
        extra: !!ch.extra,
        count: count,
        display: count,
        start: count,
        inscritos: count,
        prevCount: count,
        crescimentoMin: Utils.safeNumber(ch.crescimentoMin, 0),
        crescimentoMax: Utils.safeNumber(ch.crescimentoMax, 0),
        velocidade: Utils.safeNumber(ch.velocidade, 0),
        delta: Utils.safeNumber(ch.delta, 0),
        lastGain: Utils.safeNumber(ch.delta, 0),
        history: [count],
        position: ch.position || i + 1,
        slot: null,
        anim: null,
        numAnim: null,
        el: null,
      };
    });
  }

  function applyChannelPatch(id, patch) {
    const ch = state.channels.filter(function (item) {
      return item.id === id;
    })[0];
    if (!ch || !patch) return;

    if (patch.nome !== undefined) ch.nome = patch.nome;
    if (patch.imagem !== undefined) ch.imagem = patch.imagem;
    if (patch.cor !== undefined) ch.cor = patch.cor;
    if (patch.ativo !== undefined) ch.ativo = patch.ativo !== false;

    if (patch.inscritos !== undefined) {
      const value = Math.max(0, Utils.safeNumber(patch.inscritos, ch.count));
      ch.count = value;
      ch.display = value;
      ch.inscritos = value;
      ch.start = value;
    }
    if (patch.crescimentoMin !== undefined) {
      ch.crescimentoMin = Math.round(Utils.safeNumber(patch.crescimentoMin, ch.crescimentoMin));
    }
    if (patch.crescimentoMax !== undefined) {
      ch.crescimentoMax = Math.round(Utils.safeNumber(patch.crescimentoMax, ch.crescimentoMax));
    }
  }

  function getStats() {
    let total = 0;
    let active = 0;
    let fastest = null;
    let slowest = null;
    let gain = null;
    let loss = null;

    for (let i = 0; i < state.channels.length; i++) {
      const ch = state.channels[i];
      total += ch.count;
      if (ch.ativo) active++;
      if (!fastest || ch.velocidade > fastest.velocidade) fastest = ch;
      if (!slowest || ch.velocidade < slowest.velocidade) slowest = ch;
      if (!gain || ch.delta > gain.delta) gain = ch;
      if (!loss || ch.delta < loss.delta) loss = ch;
    }

    return {
      fastest: fastest ? { name: fastest.nome, value: fastest.velocidade } : null,
      slowest: slowest ? { name: slowest.nome, value: slowest.velocidade } : null,
      topGainer: gain ? { name: gain.nome, value: Math.round(gain.delta) } : null,
      topLoser: loss ? { name: loss.nome, value: Math.round(loss.delta) } : null,
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

  /* ---------------------------- API para o painel ---------------------------- */

  const api = {
    getState: function () {
      return state;
    },
    getStats: getStats,
    getLastSavedAt: function () {
      return state.savedAt;
    },

    patchConfig: function (patch) {
      if (!patch) return;
      Object.assign(state.config, patch);
      send("patchConfig", { patch: patch });
    },
    patchTheme: function (patch) {
      if (!patch) return;
      state.config.theme = Object.assign({}, state.config.theme, patch);
      send("patchTheme", { patch: patch });
    },
    updateChannel: function (id, patch) {
      applyChannelPatch(id, patch);
      send("updateChannel", { id: id, patch: patch });
    },
    addChannel: function () {
      send("addChannel");
      return { ok: true };
    },
    removeChannel: function (id) {
      state.channels = state.channels.filter(function (ch) {
        return ch.id !== id;
      });
      send("removeChannel", { id: id });
    },
    resetChannel: function (id) {
      send("resetChannel", { id: id });
    },
    resetAppearance: function () {
      send("resetAppearance");
    },
    setStats: function (stats) {
      if (!stats) return;
      if (stats.viewers !== undefined) state.stats.viewers = Utils.safeNumber(stats.viewers, state.stats.viewers);
      if (stats.likes !== undefined) state.stats.likes = Utils.safeNumber(stats.likes, state.stats.likes);
      send("setStats", { stats: stats });
    },

    start: function () {
      send("start");
    },
    pause: function () {
      send("pause");
    },
    togglePause: function () {
      send("togglePause");
    },
    restart: function () {
      send("restart");
    },
    resetCounts: function () {
      send("resetCounts");
    },
    restoreDefaults: function () {
      send("restoreDefaults");
    },
    clearEvents: function () {
      state.events = [];
      send("clearEvents");
    },

    exportData: function () {
      if (window.Storage && Storage.exportData) {
        try {
          return Storage.exportData(state);
        } catch (err) {
          /* cai no JSON simples abaixo */
        }
      }
      return JSON.stringify(state, null, 2);
    },
    importFile: function (file) {
      return Storage.readFile(file)
        .then(function (text) {
          const result = Storage.parseImport(text);
          if (!result.ok) return { ok: false, message: result.error };
          send("import", { data: result.data });
          return { ok: true, message: "Configurações aplicadas na live." };
        })
        .catch(function (err) {
          return { ok: false, message: err && err.message ? err.message : "Falha ao ler o arquivo." };
        });
    },

    toast: toast,
  };

  /* ---------------------------- ligação com a live ---------------------------- */

  function isEditing() {
    const el = document.activeElement;
    if (!el || !dom.host) return false;
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    return dom.host.contains(el) && (tag === "input" || tag === "select" || tag === "textarea");
  }

  function onState(message) {
    setStatus("conectado à live · alterações aplicadas na hora", "ok");

    if (isEditing()) {
      pending = message;
      return;
    }
    if (Date.now() - lastAdopt < 700) return;

    lastAdopt = Date.now();
    adopt(message);
    if (booted) Settings.refresh();
    else boot();
  }

  function boot() {
    if (booted) return;
    booted = true;
    Settings.init(api);
  }

  function connect() {
    if (!LiveSync.available) {
      setStatus("este navegador não suporta BroadcastChannel", "error");
      return;
    }

    LiveSync.on(function (message) {
      if (!message) return;
      if (message.type === "state") onState(message);
      else if (message.type === "live-ready") send("hello");
    });

    send("hello");
  }

  /* ---------------------------- inicialização ---------------------------- */

  function injectPanel() {
    return fetch("index.html", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      })
      .then(function (html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const modal = doc.getElementById("settingsModal");
        if (!modal) throw new Error("painel não encontrado no index.html");
        modal.hidden = false;
        modal.removeAttribute("hidden");
        dom.host.appendChild(modal);
      });
  }

  function start() {
    dom.host = byId("panelHost");
    dom.status = byId("ctrlStatus");
    dom.dot = byId("ctrlDot");
    dom.toast = byId("toast");

    document.body.classList.add("control-page");

    injectPanel()
      .then(function () {
        connect();
        byId("btnSync").addEventListener("click", function () {
          if (pending) {
            adopt(pending);
            pending = null;
            if (booted) Settings.refresh();
          }
          send("hello");
          toast("Valores atualizados.", "ok");
        });
      })
      .catch(function (err) {
        setStatus("abra esta página pelo ABRIR-SITE.bat (servidor local)", "error");
        dom.host.innerHTML =
          '<p class="ctrl-error">Não foi possível carregar o painel: ' +
          String(err && err.message ? err.message : err) +
          ".<br />Use o <strong>ABRIR-SITE.bat</strong> e abra o controle pelo endereço http://127.0.0.1:8123/controle.html</p>";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
