/* ==========================================================================
   js/bridge.js — lado da live: recebe os comandos do painel externo
   --------------------------------------------------------------------------
   Carregado depois de js/app.js. Qualquer alteração feita em controle.html
   chega aqui e é aplicada com as mesmas funções do painel interno, então o
   placar na fonte do OBS muda na hora. Depois de aplicar, o estado atual é
   devolvido ao painel para as caixas de texto continuarem coerentes.
   ========================================================================== */
(function () {
  "use strict";

  if (!window.LiveSync || !window.App) return;

  const App = window.App;
  let lastPush = 0;

  /** Fotografia enxuta do estado, do jeito que o painel externo precisa. */
  function snapshot() {
    const state = App.getState();
    return {
      type: "state",
      at: Date.now(),
      config: Utils.deepClone(state.config),
      stats: {
        viewers: Math.round(Utils.safeNumber(state.stats.viewers, 0)),
        likes: Math.round(Utils.safeNumber(state.stats.likes, 0)),
      },
      events: state.events.slice(0, 12),
      savedAt: App.getLastSavedAt(),
      channels: state.channels.map(function (ch) {
        return {
          id: ch.id,
          nome: ch.nome,
          imagem: ch.imagem,
          cor: ch.cor,
          ativo: ch.ativo,
          extra: !!ch.extra,
          position: ch.position,
          inscritos: Math.round(ch.count),
          velocidade: ch.velocidade,
          crescimentoMin: ch.crescimentoMin,
          crescimentoMax: ch.crescimentoMax,
          delta: Math.round(ch.delta || 0),
        };
      }),
    };
  }

  function push() {
    lastPush = Date.now();
    LiveSync.send(snapshot());
  }

  function apply(message) {
    const payload = message.payload || {};

    switch (message.cmd) {
      case "hello":
        return;
      case "patchConfig":
        App.patchConfig(payload.patch);
        return;
      case "patchTheme":
        App.patchTheme(payload.patch);
        return;
      case "updateChannel":
        App.updateChannel(payload.id, payload.patch);
        return;
      case "addChannel":
        App.addChannel();
        return;
      case "removeChannel":
        App.removeChannel(payload.id);
        return;
      case "resetChannel":
        App.resetChannel(payload.id);
        return;
      case "setStats":
        App.setStats(payload.stats);
        return;
      case "start":
        App.start();
        return;
      case "pause":
        App.pause();
        return;
      case "togglePause":
        App.togglePause();
        return;
      case "restart":
        App.restart();
        return;
      case "resetCounts":
        App.resetCounts();
        return;
      case "resetAppearance":
        App.resetAppearance();
        return;
      case "restoreDefaults":
        App.restoreDefaults();
        return;
      case "clearEvents":
        App.clearEvents();
        return;
      case "import":
        App.importData(payload.data);
        return;
      default:
        return;
    }
  }

  LiveSync.on(function (message) {
    if (!message || message.type !== "cmd") return;
    try {
      apply(message);
    } catch (err) {
      /* um comando inválido não pode parar a live */
    }
    push();
  });

  /* Mantém o painel externo com números frescos mesmo sem comandos. */
  setInterval(function () {
    if (!LiveSync.available) return;
    if (Date.now() - lastPush < 2500) return;
    push();
  }, 3000);

  LiveSync.send({ type: "live-ready", at: Date.now() });
})();
