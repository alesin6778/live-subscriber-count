/* ==========================================================================
   js/simulation.js — motor de simulação (independente da interface)
   --------------------------------------------------------------------------
   Cada canal atualiza sozinho a cada "updateMs", num instante aleatório
   (fase sorteada), e cresce/cai por um valor inteiro sorteado entre
   "crescimentoMin" e "crescimentoMax" daquele canal.
   ========================================================================== */
window.Simulation = (function () {
  "use strict";

  const HISTORY_LIMIT = 20;

  /** Período (ms) entre atualizações de cada canal, já com a velocidade global. */
  function periodOf(config) {
    const base = Math.max(300, Number(config.updateMs) || 3000);
    const multiplier = Math.max(0.1, Number(config.globalSpeed) || 1);
    return Math.max(120, base / multiplier);
  }

  /** Sorteia o ganho (ou perda) desta atualização. */
  function drawGain(ch) {
    let min = Math.round(Utils.safeNumber(ch.crescimentoMin, 0));
    let max = Math.round(Utils.safeNumber(ch.crescimentoMax, 0));
    if (max < min) {
      const swap = min;
      min = max;
      max = swap;
    }
    if (min === max) return min;
    return Utils.randomInt(min, max);
  }

  /** Distribui as fases iniciais para os canais não atualizarem juntos. */
  function schedule(channels, config, now) {
    const period = periodOf(config);
    const t = Number.isFinite(now) ? now : performance.now();
    for (let i = 0; i < channels.length; i++) {
      channels[i].nextUpdate = t + Utils.randomBetween(60, period);
    }
    return period;
  }

  /**
   * Aplica as atualizações vencidas até "now".
   * Retorna { total, updated, period } — updated traz só os canais que mudaram.
   */
  function step(channels, config, now) {
    const period = periodOf(config);
    const t = Number.isFinite(now) ? now : performance.now();
    const updated = [];
    let total = 0;

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      try {
        if (!ch.ativo) {
          ch.delta = 0;
          ch.lastGain = 0;
          ch.nextUpdate = t + period;
          total += ch.count;
          continue;
        }

        if (!Number.isFinite(ch.nextUpdate)) ch.nextUpdate = t + Utils.randomBetween(60, period);
        if (t < ch.nextUpdate) {
          total += ch.count;
          continue;
        }

        const gain = drawGain(ch);
        ch.prevCount = ch.count;
        ch.count = Math.max(0, ch.count + gain);
        ch.inscritos = ch.count;
        ch.delta = ch.count - ch.prevCount;
        ch.lastGain = ch.delta;

        ch.history.push(ch.count);
        if (ch.history.length > HISTORY_LIMIT) ch.history.shift();

        ch.nextUpdate += period;
        if (ch.nextUpdate <= t) ch.nextUpdate = t + Utils.randomBetween(60, period);

        total += ch.count;
        updated.push(ch);
      } catch (err) {
        /* um canal com problema nunca interrompe os outros */
        ch.delta = 0;
        total += ch.count || 0;
      }
    }

    return { total: total, updated: updated, period: period };
  }

  function resetCounts(channels, config) {
    const period = periodOf(config || {});
    const now = performance.now();
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      ch.count = Math.max(0, ch.start);
      ch.display = ch.count;
      ch.inscritos = ch.count;
      ch.prevCount = ch.count;
      ch.delta = 0;
      ch.lastGain = 0;
      ch.numAnim = null;
      ch.history.length = 0;
      ch.history.push(ch.count);
      ch.nextUpdate = now + Utils.randomBetween(60, period);
    }
  }

  return {
    step: step,
    schedule: schedule,
    periodOf: periodOf,
    resetCounts: resetCounts,
    HISTORY_LIMIT: HISTORY_LIMIT,
  };
})();
