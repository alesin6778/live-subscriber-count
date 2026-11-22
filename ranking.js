/* ==========================================================================
   js/ranking.js — ordenação, posições e detecção de ultrapassagens
   ========================================================================== */
window.Ranking = (function () {
  "use strict";

  /**
   * Ordena os canais por inscritos (decrescente) e atualiza as posições.
   * Retorna { sorted, moves } onde moves descreve ultrapassagens do ciclo.
   */
  function apply(channels) {
    const previous = new Map();
    for (let i = 0; i < channels.length; i++) {
      previous.set(channels[i].id, channels[i].position);
    }

    const sorted = channels.slice().sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.id - b.id;
    });

    for (let i = 0; i < sorted.length; i++) {
      sorted[i].position = i + 1;
    }

    const moves = [];
    for (let i = 0; i < sorted.length; i++) {
      const ch = sorted[i];
      const before = previous.get(ch.id);
      if (before && before !== ch.position && ch.position < before) {
        const passed = sorted[before - 1];
        if (passed && passed.id !== ch.id) {
          moves.push({ winner: ch, loser: passed, from: before, to: ch.position });
        }
      }
    }

    return { sorted: sorted, moves: moves };
  }

  /** Canais com melhor e pior desempenho no ciclo. */
  function highlights(channels) {
    let fastest = null;
    let slowest = null;
    let topGainer = null;
    let topLoser = null;

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      if (!ch.ativo) continue;
      if (!fastest || ch.velocidade > fastest.velocidade) fastest = ch;
      if (!slowest || ch.velocidade < slowest.velocidade) slowest = ch;
      if (!topGainer || ch.delta > topGainer.delta) topGainer = ch;
      if (!topLoser || ch.delta < topLoser.delta) topLoser = ch;
    }

    return { fastest: fastest, slowest: slowest, topGainer: topGainer, topLoser: topLoser };
  }

  return { apply: apply, highlights: highlights };
})();
