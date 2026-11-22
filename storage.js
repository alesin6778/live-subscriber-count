/* ==========================================================================
   js/storage.js — persistência (localStorage), exportação e importação
   ========================================================================== */
window.Storage = (function () {
  "use strict";

  const KEY = "live-subscriber-count.state";
  const SCHEMA = 2;
  const FONTS = [
    "Montserrat",
    "Inter",
    "Roboto",
    "Poppins",
    "Oswald",
    "Bebas Neue",
    "Anton",
    "Archivo",
    "Raleway",
    "Sora",
    "Space Grotesk",
    "Calibri",
    "Arial",
    "Segoe UI",
    "Verdana",
    "Trebuchet MS",
    "Tahoma",
    "Georgia",
    "Times New Roman",
    "Courier New",
    "system",
  ];
  const ANIMATIONS = ["full", "reduced", "off"];

  function mergeConfig(raw) {
    const cfg = Utils.deepClone(DEFAULT_CONFIG);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return cfg;

    const num = function (value, fallback, min, max) {
      const n = Number(value);
      return Number.isFinite(n) ? Utils.clamp(n, min, max) : fallback;
    };

    cfg.globalSpeed = num(raw.globalSpeed, cfg.globalSpeed, 0.1, 100);
    cfg.tickMs = num(raw.tickMs, cfg.tickMs, 100, 10000);
    cfg.updateMs = num(raw.updateMs, cfg.updateMs, 500, 60000);
    cfg.countAnimMs = num(raw.countAnimMs, cfg.countAnimMs, 120, 2000);
    cfg.flashMs = num(raw.flashMs, cfg.flashMs, 150, 5000);
    cfg.gapFrom = Math.round(num(raw.gapFrom, cfg.gapFrom, 1, 499));
    cfg.gapTo = Math.round(num(raw.gapTo, cfg.gapTo, cfg.gapFrom + 1, 500));
    /* faixa antiga (25..40) passa a cobrir o placar inteiro + o 51º */
    if (cfg.gapFrom === 25 && cfg.gapTo === 40) {
      cfg.gapFrom = 1;
      cfg.gapTo = 51;
    }
    cfg.paused = raw.paused === true;
    cfg.obsMode = raw.obsMode === true;
    cfg.transparent = raw.transparent === true;
    cfg.showHeader = raw.showHeader !== false;
    cfg.showFooter = raw.showFooter !== false;
    cfg.showIndicators = raw.showIndicators !== false;
    cfg.font = FONTS.indexOf(raw.font) >= 0 ? raw.font : cfg.font;
    cfg.numberSeparator = raw.numberSeparator === "." ? "." : ",";

    cfg.autoFire = raw.autoFire !== false;
    cfg.fireMin = Math.round(num(raw.fireMin, cfg.fireMin, 0, 100000));
    cfg.blueFireMin = Math.round(num(raw.blueFireMin, cfg.blueFireMin, 0, 100000));
    cfg.autoGap = raw.autoGap !== false;
    cfg.autoGapSeconds = Math.round(num(raw.autoGapSeconds, cfg.autoGapSeconds, 10, 604800));
    cfg.autoGapPairs = Math.round(num(raw.autoGapPairs, cfg.autoGapPairs, 1, 10));
    cfg.countScale = num(raw.countScale, cfg.countScale, 0.7, 1.4);
    cfg.nameScale = num(raw.nameScale, cfg.nameScale, 0.6, 1.6);
    cfg.rankScale = num(raw.rankScale, cfg.rankScale, 0.6, 1.6);
    cfg.avatarScale = num(raw.avatarScale, cfg.avatarScale, 0.7, 1.3);
    cfg.headerScale = num(raw.headerScale, cfg.headerScale, 0.7, 1.35);
    cfg.footerScale = num(raw.footerScale, cfg.footerScale, 0.7, 1.3);
    cfg.gapScale = num(raw.gapScale, cfg.gapScale, 0.7, 1.4);
    cfg.cardRadius = num(raw.cardRadius, cfg.cardRadius, 0, 16);
    cfg.cardGap = num(raw.cardGap, cfg.cardGap, 0, 12);
    cfg.showNames = raw.showNames !== false;
    cfg.showAvatars = raw.showAvatars !== false;
    cfg.uppercaseNames = raw.uppercaseNames === true;
    if (Utils.isHexColor(raw.alertColor)) cfg.alertColor = Utils.normalizeHex(raw.alertColor);
    cfg.animations = ANIMATIONS.indexOf(raw.animations) >= 0 ? raw.animations : cfg.animations;
    cfg.animMs = num(raw.animMs, cfg.animMs, 0, 2000);
    cfg.noGradients = raw.noGradients === true;

    const theme = raw.theme && typeof raw.theme === "object" ? raw.theme : {};
    ["bg", "cardBg", "border", "numberColor", "nameColor", "rankColor"].forEach(function (key) {
      if (Utils.isHexColor(theme[key])) cfg.theme[key] = Utils.normalizeHex(theme[key]);
    });
    cfg.theme.shadow = num(theme.shadow, cfg.theme.shadow, 0, 2);

    return cfg;
  }

  function validate(payload) {
    const fail = function (message) {
      return { ok: false, error: message };
    };

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return fail("Arquivo inválido: esperado um objeto JSON.");
    }
    if (!Array.isArray(payload.channels)) {
      return fail("Arquivo inválido: a lista \"channels\" está ausente.");
    }
    if (payload.channels.length < DEFAULT_CHANNELS.length) {
      return fail(
        "O arquivo precisa conter pelo menos " +
          DEFAULT_CHANNELS.length +
          " canais (encontrados: " +
          payload.channels.length +
          ")."
      );
    }

    const ids = new Set();
    const channels = [];

    for (let i = 0; i < payload.channels.length; i++) {
      const raw = payload.channels[i];
      const label = "Canal #" + (i + 1);

      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return fail(label + ": registro inválido.");
      }

      const id = Number(raw.id);
      if (!Number.isFinite(id)) return fail(label + ": campo \"id\" inválido.");
      if (ids.has(id)) return fail(label + ": \"id\" duplicado (" + id + ").");
      ids.add(id);

      const nome = typeof raw.nome === "string" ? raw.nome.trim() : "";
      if (!nome) return fail(label + ": o campo \"nome\" é obrigatório.");

      const inscritos = Number(raw.inscritos);
      if (!Number.isFinite(inscritos) || inscritos < 0) {
        return fail(label + ": \"inscritos\" deve ser um número maior ou igual a zero.");
      }

      const velocidade = Number(raw.velocidade);
      if (!Number.isFinite(velocidade)) return fail(label + ": \"velocidade\" deve ser um número.");

      let crescimentoMin = raw.crescimentoMin === undefined ? null : Number(raw.crescimentoMin);
      let crescimentoMax = raw.crescimentoMax === undefined ? null : Number(raw.crescimentoMax);
      if (crescimentoMin !== null && !Number.isFinite(crescimentoMin)) {
        return fail(label + ": \"crescimentoMin\" deve ser um número.");
      }
      if (crescimentoMax !== null && !Number.isFinite(crescimentoMax)) {
        return fail(label + ": \"crescimentoMax\" deve ser um número.");
      }
      if (crescimentoMin === null || crescimentoMax === null) {
        /* arquivos antigos: deriva a faixa da velocidade por segundo */
        const v = velocidade;
        crescimentoMin = v > 0 ? Math.max(1, Math.round(v * 1.8)) : v < 0 ? Math.round(v * 3) : 0;
        crescimentoMax = v > 0 ? Math.max(Math.round(v * 1.8) + 1, Math.round(v * 3.6)) : v < 0 ? -1 : 0;
      }
      const lo = Math.min(Math.round(crescimentoMin), Math.round(crescimentoMax));
      const hi = Math.max(Math.round(crescimentoMin), Math.round(crescimentoMax));

      let ativo = true;
      if (raw.ativo !== undefined) {
        if (typeof raw.ativo !== "boolean") return fail(label + ": \"ativo\" deve ser booleano.");
        ativo = raw.ativo;
      }

      if (raw.cor !== undefined && !Utils.isHexColor(raw.cor)) {
        return fail(label + ": \"cor\" deve ser hexadecimal (ex.: #8A45FF).");
      }

      if (raw.imagem !== undefined && typeof raw.imagem !== "string") {
        return fail(label + ": \"imagem\" deve ser um texto.");
      }

      channels.push({
        id: id,
        nome: nome,
        imagem: typeof raw.imagem === "string" ? raw.imagem.trim() : "",
        cor: Utils.isHexColor(raw.cor) ? Utils.normalizeHex(raw.cor) : "#7b2ff7",
        inscritos: inscritos,
        velocidade: velocidade,
        crescimentoMin: lo,
        crescimentoMax: hi,
        ativo: ativo,
      });
    }

    const stats = payload.stats && typeof payload.stats === "object" ? payload.stats : {};
    const safeStat = function (value, fallback) {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };

    const events = Array.isArray(payload.events)
      ? payload.events
          .filter(function (item) {
            return item && typeof item === "object" && typeof item.text === "string";
          })
          .slice(0, 12)
          .map(function (item) {
            return { time: typeof item.time === "string" ? item.time : "--:--:--", text: item.text };
          })
      : [];

    return {
      ok: true,
      data: {
        schema: SCHEMA,
        channels: channels,
        config: mergeConfig(payload.config),
        stats: {
          viewers: Math.round(safeStat(stats.viewers, DEFAULT_STATS.viewers)),
          likes: Math.round(safeStat(stats.likes, DEFAULT_STATS.likes)),
        },
        events: events,
      },
    };
  }

  function snapshot(state) {
    return {
      app: "live-subscriber-count",
      schema: SCHEMA,
      savedAt: new Date().toISOString(),
      channels: state.channels.map(function (ch) {
        return {
          id: ch.id,
          nome: ch.nome,
          imagem: ch.imagem,
          cor: ch.cor,
          inscritos: Math.round(ch.count),
          velocidade: ch.velocidade,
          crescimentoMin: ch.crescimentoMin,
          crescimentoMax: ch.crescimentoMax,
          ativo: ch.ativo,
        };
      }),
      config: Utils.deepClone(state.config),
      stats: {
        viewers: Math.round(state.stats.viewers),
        likes: Math.round(state.stats.likes),
      },
      events: state.events.slice(0, 12),
    };
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot(state)));
      return true;
    } catch (err) {
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const result = validate(parsed);
      if (!result.ok) return null;
      return result.data;
    } catch (err) {
      return null;
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch (err) {
      return false;
    }
  }

  function exportData(state) {
    try {
      const payload = snapshot(state);
      payload.exportedAt = new Date().toISOString();
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      a.href = url;
      a.download = "live-subscriber-count-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
      return true;
    } catch (err) {
      return false;
    }
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Não foi possível ler o arquivo selecionado."));
      };
      reader.readAsText(file);
    });
  }

  function parseImport(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: "JSON inválido: o arquivo não pôde ser interpretado." };
    }
    return validate(parsed);
  }

  return {
    KEY: KEY,
    SCHEMA: SCHEMA,
    save: save,
    load: load,
    clear: clear,
    validate: validate,
    snapshot: snapshot,
    exportData: exportData,
    readFile: readFile,
    parseImport: parseImport,
    mergeConfig: mergeConfig,
  };
})();
