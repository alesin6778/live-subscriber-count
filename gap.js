/* ==========================================================================
   js/gap.js — análise das diferenças entre posições vizinhas (SUB GAP)
   --------------------------------------------------------------------------
   O foco não é a menor diferença, e sim a que vai mudar mais rápido:
   gap / velocidade relativa = segundos até a ultrapassagem.
   ========================================================================== */
window.Gap = (function () {
  "use strict";

  /**
   * Analisa todas as duplas vizinhas da faixa e devolve, ordenado da que
   * muda mais rápido para a mais lenta:
   * [{ upper, lower, gap, rel, closing, seconds, index }]
   */
  function analyze(order, from, to, globalSpeed) {
    const list = order || [];
    const total = list.length;
    if (total < 2) return [];

    const start = Utils.clamp(Math.round(Utils.safeNumber(from, 1)), 1, total);
    const end = Utils.clamp(Math.round(Utils.safeNumber(to, total)), start + 1, total);
    const multiplier = Math.max(0.1, Number(globalSpeed) || 1);
    const out = [];

    for (let i = start - 1; i < end - 1; i++) {
      const upper = list[i];
      const lower = list[i + 1];
      if (!upper || !lower) continue;

      const gap = Math.max(0, Math.round(upper.count) - Math.round(lower.count));
      const rel = ((lower.velocidade || 0) - (upper.velocidade || 0)) * multiplier;
      const closing = rel > 0 && Number.isFinite(rel);
      const seconds = closing ? gap / rel : Infinity;

      out.push({
        upper: upper,
        lower: lower,
        gap: gap,
        rel: rel,
        closing: closing,
        seconds: seconds,
        index: i,
      });
    }

    out.sort(function (a, b) {
      if (a.seconds !== b.seconds) return a.seconds - b.seconds;
      return a.gap - b.gap;
    });

    return out;
  }

  /** As N duplas que vão mudar mais rápido. */
  function fastest(order, from, to, globalSpeed, count) {
    const n = Math.max(1, Math.round(count) || 3);
    return analyze(order, from, to, globalSpeed).slice(0, n);
  }

  /** Calcula gap, direção, previsão e estados de exibição de uma dupla. */
  function compute(upper, lower, globalSpeed) {
    const multiplier = Math.max(0.1, Number(globalSpeed) || 1);
    const gap = Math.max(0, Math.round((upper.count || 0) - (lower.count || 0)));
    const rel = ((lower.velocidade || 0) - (upper.velocidade || 0)) * multiplier;

    let direction = "none";
    if (rel > 0) direction = "down";
    else if (rel < 0) direction = "up";

    const imminent = gap <= 0;
    const hasPrediction = !imminent && rel > 0 && Number.isFinite(rel);
    const seconds = hasPrediction ? gap / rel : 0;

    return {
      gap: gap,
      rel: rel,
      direction: direction,
      imminent: imminent,
      hasPrediction: hasPrediction,
      seconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
    };
  }

  /**
   * Suavizador do gap usado na previsão de tempo.
   *
   * Cada canal sorteia um ganho inteiro a cada rodada, então o gap cru oscila
   * centenas de inscritos de uma atualização para a outra — e o tempo até a
   * ultrapassagem pulava (5 s -> 2 s num tick) ou parecia travado. A suavização
   * exponencial dupla (nível + tendência) tira esse serrilhado sem atrasar o
   * número, porque acompanha o gap que fecha em linha reta.
   */
  function createSmoother(halfLifeMs) {
    const halfLife = Math.max(50, Number(halfLifeMs) || 1100);
    const state = { key: "", level: 0, trend: 0, at: 0 };

    function reset() {
      state.key = "";
    }

    /** Devolve o gap filtrado para a chave (dupla + ritmo) informada. */
    function smooth(key, raw, now) {
      const t = Number.isFinite(now) ? now : 0;
      if (key !== state.key) {
        state.key = key;
        state.level = raw;
        state.trend = 0;
        state.at = t;
        return raw;
      }

      const dt = Math.min(2000, Math.max(0, t - state.at));
      state.at = t;
      if (dt <= 0) return Math.max(0, state.level);

      const alpha = 1 - Math.pow(0.5, dt / halfLife);
      const beta = alpha * 0.45;
      const previous = state.level;

      state.level = alpha * raw + (1 - alpha) * (previous + state.trend * dt);
      state.trend = (beta * (state.level - previous)) / dt + (1 - beta) * state.trend;

      return Math.max(0, state.level);
    }

    return { smooth: smooth, reset: reset };
  }

  return { analyze: analyze, fastest: fastest, compute: compute, createSmoother: createSmoother };
})();
