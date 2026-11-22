/* ==========================================================================
   js/sync.js — ponte entre a live (index.html) e o painel externo (controle.html)
   --------------------------------------------------------------------------
   As duas páginas rodam no mesmo navegador/máquina, então um BroadcastChannel
   leva comandos do painel para a live e devolve o estado atualizado.
   ========================================================================== */
window.LiveSync = (function () {
  "use strict";

  const CHANNEL = "live-subscriber-count.bridge";
  const handlers = [];
  let channel = null;

  try {
    if (typeof BroadcastChannel === "function") channel = new BroadcastChannel(CHANNEL);
  } catch (err) {
    channel = null;
  }

  if (channel) {
    channel.onmessage = function (event) {
      const message = event.data;
      for (let i = 0; i < handlers.length; i++) {
        try {
          handlers[i](message);
        } catch (err) {
          /* um ouvinte com problema nunca derruba os outros */
        }
      }
    };
  }

  function send(message) {
    if (!channel) return false;
    try {
      channel.postMessage(message);
      return true;
    } catch (err) {
      return false;
    }
  }

  function on(handler) {
    if (typeof handler === "function") handlers.push(handler);
  }

  return { available: !!channel, send: send, on: on };
})();
