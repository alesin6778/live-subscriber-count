/* ==========================================================================
   js/settings.js — painel de controle (canais, simulação, aparência, dados)
   ========================================================================== */
window.Settings = (function () {
  "use strict";

  let api = null;
  let dom = {};
  let rows = new Map();
  let rowsSignature = "";
  let openState = false;

  function byId(id) {
    return document.getElementById(id);
  }

  /* ---------------------------- construção ---------------------------- */

  function init(app) {
    api = app;

    dom = {
      modal: byId("settingsModal"),
      fab: byId("btnSettings"),
      tabs: Array.prototype.slice.call(document.querySelectorAll("#settingsTabs .tab")),
      panes: Array.prototype.slice.call(document.querySelectorAll(".tabpane")),
      editor: byId("channelEditor"),
      search: byId("channelSearch"),
      channelCount: byId("channelCount"),
      btnAddChannel: byId("btnAddChannel"),

      btnStart: byId("btnStart"),
      btnPause: byId("btnPause"),
      btnRestart: byId("btnRestart"),
      btnResetCounts: byId("btnResetCounts"),
      simStatus: byId("simStatus"),
      globalSpeed: byId("inpGlobalSpeed"),
      updateMs: byId("inpUpdateMs"),
      viewers: byId("inpViewers"),
      likes: byId("inpLikes"),
      gapFrom: byId("inpGapFrom"),
      gapTo: byId("inpGapTo"),
      animMs: byId("inpAnimMs"),

      bg: byId("inpBg"),
      cardBg: byId("inpCardBg"),
      borderColor: byId("inpBorderColor"),
      numberColor: byId("inpNumberColor"),
      nameColor: byId("inpNameColor"),
      rankColor: byId("inpRankColor"),
      font: byId("inpFont"),
      separator: byId("inpSeparator"),
      shadow: byId("inpShadow"),
      anim: byId("inpAnim"),
      autoFire: byId("inpAutoFire"),
      fireMin: byId("inpFireMin"),
      blueFireMin: byId("inpBlueFireMin"),
      autoGap: byId("inpAutoGap"),
      autoGapSeconds: byId("inpAutoGapSeconds"),
      autoGapPairs: byId("inpAutoGapPairs"),
      alertColor: byId("inpAlertColor"),
      countScale: byId("inpCountScale"),
      nameScale: byId("inpNameScale"),
      rankScale: byId("inpRankScale"),
      avatarScale: byId("inpAvatarScale"),
      headerScale: byId("inpHeaderScale"),
      footerScale: byId("inpFooterScale"),
      gapScale: byId("inpGapScale"),
      cardRadius: byId("inpCardRadius"),
      cardGap: byId("inpCardGap"),
      showNames: byId("inpShowNames"),
      showAvatars: byId("inpShowAvatars"),
      upperNames: byId("inpUpperNames"),
      showIndicators: byId("inpShowIndicators"),
      showHeader: byId("inpShowHeader"),
      showFooter: byId("inpShowFooter"),
      obsMode: byId("inpObsMode"),
      transparent: byId("inpTransparent"),
      noGradients: byId("inpNoGradients"),
      btnResetVisual: byId("btnResetVisual"),

      btnExport: byId("btnExport"),
      fileImport: byId("fileImport"),
      importStatus: byId("importStatus"),
      btnRestore: byId("btnRestore"),
      storageStatus: byId("storageStatus"),

      liveStats: byId("liveStats"),
      eventLog: byId("eventLog"),
      btnClearEvents: byId("btnClearEvents"),
    };

    buildRows();
    bindTabs();
    bindChannels();
    bindSimulation();
    bindAppearance();
    bindData();
    bindEventsPane();
    bindOpenClose();
    refresh();
  }

  function buildRows() {
    if (!api || !dom.editor) return;
    dom.editor.textContent = "";
    rows.clear();

    const channels = api.getState().channels.slice().sort(function (a, b) {
      return a.id - b.id;
    });
    const frag = document.createDocumentFragment();

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const row = document.createElement("div");
      row.className = "ch-row";
      row.dataset.id = String(ch.id);
      row.innerHTML =
        '<span class="ch-row__id"></span>' +
        '<input class="input" data-field="nome" type="text" maxlength="40" aria-label="Nome do canal" />' +
        '<input class="input" data-field="imagem" type="text" placeholder="https://... (opcional)" aria-label="URL da imagem" />' +
        '<input class="input input--color" data-field="cor" type="color" aria-label="Cor do canal" />' +
        '<input class="input" data-field="inscritos" type="number" min="0" step="1" aria-label="Inscritos" />' +
        '<input class="input" data-field="crescimentoMin" type="number" step="1" aria-label="Crescimento mínimo por atualização" />' +
        '<input class="input" data-field="crescimentoMax" type="number" step="1" aria-label="Crescimento máximo por atualização" />' +
        '<label class="switch"><input type="checkbox" data-field="ativo" aria-label="Canal ativo" /><span></span></label>' +
        '<button class="icon-btn js-reset-channel" type="button" title="Restaurar valores originais deste canal">&#8635;</button>' +
        (ch.extra
          ? '<button class="icon-btn js-remove-channel" type="button" title="Remover canal extra">&#10005;</button>'
          : '<span></span>');

      row.querySelector(".ch-row__id").textContent = String(ch.id).padStart(2, "0");
      rows.set(ch.id, row);
      frag.appendChild(row);
    }

    dom.editor.appendChild(frag);
    rowsSignature = channels
      .map(function (ch) {
        return ch.id;
      })
      .join(",");
    syncRows();
  }

  /* ---------------------------- sincronização ---------------------------- */

  function syncRow(id, channel) {
    const row = rows.get(id);
    if (!row) return;
    const ch =
      channel ||
      api.getState().channels.filter(function (item) {
        return item.id === id;
      })[0];
    if (!ch) return;

    row.querySelector('[data-field="nome"]').value = ch.nome;
    row.querySelector('[data-field="imagem"]').value = ch.imagem;
    row.querySelector('[data-field="cor"]').value = Utils.normalizeHex(ch.cor, "#7b2ff7");
    row.querySelector('[data-field="inscritos"]').value = Math.round(ch.count);
    row.querySelector('[data-field="crescimentoMin"]').value = ch.crescimentoMin;
    row.querySelector('[data-field="crescimentoMax"]').value = ch.crescimentoMax;
    row.querySelector('[data-field="ativo"]').checked = ch.ativo;
    row.dataset.name = ch.nome.toLowerCase();
  }

  function syncRows() {
    const channels = api.getState().channels;
    for (let i = 0; i < channels.length; i++) syncRow(channels[i].id, channels[i]);
    applySearch();
  }

  function setSelect(select, value, suffix) {
    if (!select) return;
    const v = String(value);
    const exists = Array.prototype.some.call(select.options, function (opt) {
      return opt.value === v;
    });
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v + (suffix || "");
      select.appendChild(opt);
    }
    select.value = v;
  }

  function syncControls() {
    const state = api.getState();
    const c = state.config;

    setSelect(dom.globalSpeed, c.globalSpeed, "×");
    setSelect(dom.updateMs, c.updateMs, " ms");

    dom.viewers.value = Math.round(state.stats.viewers);
    dom.likes.value = Math.round(state.stats.likes);
    dom.gapFrom.value = c.gapFrom;
    dom.gapTo.value = c.gapTo;
    dom.animMs.value = c.animMs;
  }

  function syncAppearance() {
    const cfg = api.getState().config;
    dom.bg.value = Utils.normalizeHex(cfg.theme.bg, "#0b0511");
    dom.cardBg.value = Utils.normalizeHex(cfg.theme.cardBg, "#150d1c");
    dom.borderColor.value = Utils.normalizeHex(cfg.theme.border, "#9669eb");
    dom.numberColor.value = Utils.normalizeHex(cfg.theme.numberColor, "#ffffff");
    dom.nameColor.value = Utils.normalizeHex(cfg.theme.nameColor, "#f4f2f8");
    dom.rankColor.value = Utils.normalizeHex(cfg.theme.rankColor, "#ffffff");
    dom.font.value = cfg.font;
    dom.separator.value = cfg.numberSeparator === "." ? "." : ",";
    dom.shadow.value = cfg.theme.shadow;
    dom.anim.value = cfg.animations;
    dom.showIndicators.checked = cfg.showIndicators;
    dom.showHeader.checked = cfg.showHeader;
    dom.showFooter.checked = cfg.showFooter;
    dom.obsMode.checked = cfg.obsMode;
    dom.transparent.checked = cfg.transparent;
    dom.noGradients.checked = !!cfg.noGradients;

    dom.autoFire.checked = !!cfg.autoFire;
    dom.fireMin.value = cfg.fireMin;
    dom.blueFireMin.value = cfg.blueFireMin;
    dom.autoGap.checked = !!cfg.autoGap;
    dom.autoGapSeconds.value = cfg.autoGapSeconds;
    dom.autoGapPairs.value = cfg.autoGapPairs;
    dom.alertColor.value = Utils.normalizeHex(cfg.alertColor, "#ffd166");
    dom.countScale.value = cfg.countScale;
    dom.nameScale.value = cfg.nameScale;
    dom.rankScale.value = cfg.rankScale;
    dom.avatarScale.value = cfg.avatarScale;
    dom.headerScale.value = cfg.headerScale;
    dom.footerScale.value = cfg.footerScale;
    dom.gapScale.value = cfg.gapScale;
    dom.cardRadius.value = cfg.cardRadius;
    dom.cardGap.value = cfg.cardGap;
    dom.showNames.checked = !!cfg.showNames;
    dom.showAvatars.checked = !!cfg.showAvatars;
    dom.upperNames.checked = !!cfg.uppercaseNames;
  }

  function refreshStatus() {
    const cfg = api.getState().config;
    dom.simStatus.textContent =
      (cfg.paused ? "Pausada" : "Ativa") +
      " · velocidade global " +
      String(cfg.globalSpeed).replace(".", ",") +
      "× · cada canal atualiza a cada " +
      (cfg.updateMs / 1000).toString().replace(".", ",") +
      " s";
    dom.btnStart.disabled = !cfg.paused;
    dom.btnPause.disabled = cfg.paused;
  }

  function updateStorageStatus() {
    if (!dom.storageStatus) return;
    const stamp = api.getLastSavedAt();
    dom.storageStatus.textContent = stamp
      ? "Última gravação automática: " + stamp
      : "Nenhum estado gravado até o momento (salvo automaticamente em instantes).";
  }

  function refresh() {
    if (!api) return;
    const sig = api.getState().channels
      .map(function (ch) {
        return ch.id;
      })
      .join(",");
    if (sig !== rowsSignature) buildRows();
    syncControls();
    syncAppearance();
    syncRows();
    refreshStatus();
    updateStorageStatus();
    renderStats();
    renderEvents();
  }

  /* ---------------------------- abas ---------------------------- */

  function showTab(name) {
    dom.tabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.tab === name);
    });
    dom.panes.forEach(function (pane) {
      pane.classList.toggle("is-active", pane.dataset.pane === name);
    });
    if (name === "eventos") {
      renderStats();
      renderEvents();
    }
    if (name === "dados") updateStorageStatus();
  }

  function bindTabs() {
    dom.tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        showTab(tab.dataset.tab);
      });
    });
  }

  function bindOpenClose() {
    /* controle.html usa o mesmo painel sem o botão flutuante */
    if (dom.fab) dom.fab.addEventListener("click", toggle);
    if (!dom.modal) return;
    dom.modal.addEventListener("click", function (event) {
      if (event.target.closest("[data-close]")) close();
    });
  }

  function open() {
    if (openState) return;
    openState = true;
    dom.modal.hidden = false;
    refresh();
  }

  function close() {
    if (!openState) return;
    openState = false;
    dom.modal.hidden = true;
  }

  function toggle() {
    if (openState) close();
    else open();
  }

  /* ---------------------------- canais ---------------------------- */

  function bindChannels() {
    dom.editor.addEventListener("change", function (event) {
      const input = event.target;
      if (!input || !input.dataset || !input.dataset.field) return;
      const row = input.closest(".ch-row");
      if (!row) return;

      const id = Number(row.dataset.id);
      const field = input.dataset.field;

      if (field === "ativo") {
        api.updateChannel(id, { ativo: input.checked });
        return;
      }

      if (field === "cor") {
        api.updateChannel(id, { cor: input.value });
        return;
      }

      if (field === "nome") {
        const value = input.value.trim();
        if (!value) {
          api.toast("O nome do canal não pode ficar vazio.", "error");
          syncRow(id);
          return;
        }
        api.updateChannel(id, { nome: value });
        syncRow(id);
        return;
      }

      if (field === "imagem") {
        api.updateChannel(id, { imagem: input.value.trim() });
        return;
      }

      const value = Number(input.value);
      if (!Number.isFinite(value)) {
        api.toast("Informe um número válido.", "error");
        syncRow(id);
        return;
      }

      if (field === "inscritos" && value < 0) {
        api.toast("Inscritos não podem ser negativos.", "error");
        syncRow(id);
        return;
      }

      if (field === "inscritos") api.updateChannel(id, { inscritos: value });
      if (field === "crescimentoMin") api.updateChannel(id, { crescimentoMin: value });
      if (field === "crescimentoMax") api.updateChannel(id, { crescimentoMax: value });

      syncRow(id);
    });

    dom.btnAddChannel.addEventListener("click", function () {
      const res = api.addChannel();
      buildRows();
      refresh();
      api.toast(
        "Canal #" + res.id + " adicionado oculto abaixo do top 50. Ele sobe sozinho se crescer.",
        "ok"
      );
    });

    dom.editor.addEventListener("click", function (event) {
      const remove = event.target.closest(".js-remove-channel");
      if (remove) {
        const row = remove.closest(".ch-row");
        const id = Number(row.dataset.id);
        if (!window.confirm("Remover este canal extra?")) return;
        api.removeChannel(id);
        buildRows();
        refresh();
        api.toast("Canal extra removido.", "ok");
        return;
      }

      const button = event.target.closest(".js-reset-channel");
      if (!button) return;
      const row = button.closest(".ch-row");
      if (!row) return;
      const id = Number(row.dataset.id);
      api.resetChannel(id);
      syncRow(id);
      api.toast("Canal restaurado para os valores de data.js.", "ok");
    });

    dom.search.addEventListener("input", applySearch);
  }

  function applySearch() {
    const term = dom.search.value.trim().toLowerCase();
    let visible = 0;

    rows.forEach(function (row, id) {
      const name = String(row.dataset.name || "").toLowerCase();
      const padded = String(id).padStart(2, "0");
      const match = !term || name.indexOf(term) >= 0 || padded === term;
      row.classList.toggle("is-hidden", !match);
      if (match) visible++;
    });

    dom.channelCount.textContent = visible + " de " + rows.size + (rows.size === 1 ? " canal" : " canais");
  }

  /* ---------------------------- simulação ---------------------------- */

  function bindSimulation() {
    dom.btnStart.addEventListener("click", function () {
      api.start();
      refreshStatus();
    });
    dom.btnPause.addEventListener("click", function () {
      api.pause();
      refreshStatus();
    });
    dom.btnRestart.addEventListener("click", function () {
      api.restart();
      refreshStatus();
    });
    dom.btnResetCounts.addEventListener("click", function () {
      if (!window.confirm("Zerar as contagens de todos os canais para os valores iniciais?")) return;
      api.resetCounts();
      api.toast("Contagens reiniciadas.", "ok");
      refreshStatus();
    });

    dom.globalSpeed.addEventListener("change", function () {
      api.patchConfig({ globalSpeed: Utils.safeNumber(dom.globalSpeed.value, 1) });
      refreshStatus();
    });

    dom.updateMs.addEventListener("change", function () {
      api.patchConfig({ updateMs: Utils.safeNumber(dom.updateMs.value, 3000) });
      refreshStatus();
    });

    dom.viewers.addEventListener("change", function () {
      const value = Utils.safeNumber(dom.viewers.value, NaN);
      if (!Number.isFinite(value) || value < 0) {
        api.toast("Viewers deve ser um número maior ou igual a zero.", "error");
        syncControls();
        return;
      }
      api.setStats({ viewers: value });
      api.toast("Contador de viewers atualizado.", "ok");
    });

    dom.likes.addEventListener("change", function () {
      const value = Utils.safeNumber(dom.likes.value, NaN);
      if (!Number.isFinite(value) || value < 0) {
        api.toast("Likes deve ser um número maior ou igual a zero.", "error");
        syncControls();
        return;
      }
      api.setStats({ likes: value });
      api.toast("Contador de likes atualizado.", "ok");
    });

    dom.gapFrom.addEventListener("change", applyGapRange);
    dom.gapTo.addEventListener("change", applyGapRange);

    dom.animMs.addEventListener("input", function () {
      dom.animMs.setAttribute("aria-valuetext", dom.animMs.value + " ms");
    });
    dom.animMs.addEventListener("change", function () {
      api.patchConfig({ animMs: Utils.safeNumber(dom.animMs.value, 700) });
    });
  }

  function applyGapRange() {
    const from = Utils.safeNumber(dom.gapFrom.value, 25);
    const to = Utils.safeNumber(dom.gapTo.value, 40);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to > 50 || from >= to) {
      api.toast("Faixa inválida: use de 1 a 50 com a posição final maior que a inicial.", "error");
      syncControls();
      return;
    }
    api.patchConfig({ gapFrom: from, gapTo: to });
    api.toast("Faixa do SUB GAP atualizada.", "ok");
  }

  /* ---------------------------- aparência ---------------------------- */

  function bindAppearance() {
    dom.bg.addEventListener("input", function () {
      api.patchTheme({ bg: dom.bg.value });
    });
    dom.cardBg.addEventListener("input", function () {
      api.patchTheme({ cardBg: dom.cardBg.value });
    });
    dom.borderColor.addEventListener("input", function () {
      api.patchTheme({ border: dom.borderColor.value });
    });
    dom.numberColor.addEventListener("input", function () {
      api.patchTheme({ numberColor: dom.numberColor.value });
    });
    dom.nameColor.addEventListener("input", function () {
      api.patchTheme({ nameColor: dom.nameColor.value });
    });
    dom.rankColor.addEventListener("input", function () {
      api.patchTheme({ rankColor: dom.rankColor.value });
    });
    dom.font.addEventListener("change", function () {
      api.patchConfig({ font: dom.font.value });
    });
    dom.separator.addEventListener("change", function () {
      api.patchConfig({ numberSeparator: dom.separator.value });
    });
    dom.shadow.addEventListener("input", function () {
      api.patchTheme({ shadow: Utils.safeNumber(dom.shadow.value, 1) });
    });
    dom.anim.addEventListener("change", function () {
      api.patchConfig({ animations: dom.anim.value });
    });

    dom.showIndicators.addEventListener("change", function () {
      api.patchConfig({ showIndicators: dom.showIndicators.checked });
    });
    dom.showHeader.addEventListener("change", function () {
      api.patchConfig({ showHeader: dom.showHeader.checked });
    });
    dom.showFooter.addEventListener("change", function () {
      api.patchConfig({ showFooter: dom.showFooter.checked });
    });
    dom.obsMode.addEventListener("change", function () {
      api.patchConfig({ obsMode: dom.obsMode.checked });
    });
    dom.transparent.addEventListener("change", function () {
      api.patchConfig({ transparent: dom.transparent.checked });
    });
    dom.noGradients.addEventListener("change", function () {
      api.patchConfig({ noGradients: dom.noGradients.checked });
    });

    dom.btnResetVisual.addEventListener("click", function () {
      api.resetAppearance();
      syncAppearance();
      api.toast("Aparência restaurada ao padrão.", "ok");
    });

    /* -------- alertas automáticos -------- */
    dom.autoFire.addEventListener("change", function () {
      api.patchConfig({ autoFire: dom.autoFire.checked });
    });
    dom.fireMin.addEventListener("change", function () {
      const value = Utils.clamp(Math.round(Utils.safeNumber(dom.fireMin.value, 45)), 0, 100000);
      dom.fireMin.value = value;
      api.patchConfig({ fireMin: value });
    });
    dom.blueFireMin.addEventListener("change", function () {
      const value = Utils.clamp(Math.round(Utils.safeNumber(dom.blueFireMin.value, 78)), 0, 100000);
      dom.blueFireMin.value = value;
      api.patchConfig({ blueFireMin: value });
    });
    dom.autoGap.addEventListener("change", function () {
      api.patchConfig({ autoGap: dom.autoGap.checked });
    });
    dom.autoGapSeconds.addEventListener("change", function () {
      const value = Utils.clamp(
        Math.round(Utils.safeNumber(dom.autoGapSeconds.value, 7200)),
        10,
        604800
      );
      dom.autoGapSeconds.value = value;
      api.patchConfig({ autoGapSeconds: value });
    });
    dom.autoGapPairs.addEventListener("change", function () {
      const value = Utils.clamp(Math.round(Utils.safeNumber(dom.autoGapPairs.value, 2)), 1, 10);
      dom.autoGapPairs.value = value;
      api.patchConfig({ autoGapPairs: value });
    });
    dom.alertColor.addEventListener("input", function () {
      api.patchConfig({ alertColor: dom.alertColor.value });
    });

    /* -------- personalização dos cards -------- */
    dom.countScale.addEventListener("change", function () {
      api.patchConfig({ countScale: Utils.clamp(Utils.safeNumber(dom.countScale.value, 1), 0.8, 1.3) });
    });
    dom.nameScale.addEventListener("change", function () {
      api.patchConfig({ nameScale: Utils.clamp(Utils.safeNumber(dom.nameScale.value, 1), 0.6, 1.6) });
    });
    dom.rankScale.addEventListener("change", function () {
      api.patchConfig({ rankScale: Utils.clamp(Utils.safeNumber(dom.rankScale.value, 1), 0.6, 1.6) });
    });
    dom.avatarScale.addEventListener("change", function () {
      api.patchConfig({ avatarScale: Utils.clamp(Utils.safeNumber(dom.avatarScale.value, 1), 0.7, 1.3) });
    });
    dom.headerScale.addEventListener("change", function () {
      api.patchConfig({ headerScale: Utils.clamp(Utils.safeNumber(dom.headerScale.value, 1), 0.7, 1.35) });
    });
    dom.footerScale.addEventListener("change", function () {
      api.patchConfig({ footerScale: Utils.clamp(Utils.safeNumber(dom.footerScale.value, 1), 0.7, 1.3) });
    });
    dom.gapScale.addEventListener("change", function () {
      api.patchConfig({ gapScale: Utils.clamp(Utils.safeNumber(dom.gapScale.value, 1), 0.7, 1.4) });
    });
    dom.cardRadius.addEventListener("change", function () {
      api.patchConfig({ cardRadius: Utils.clamp(Utils.safeNumber(dom.cardRadius.value, 2), 0, 12) });
    });
    dom.cardGap.addEventListener("change", function () {
      api.patchConfig({ cardGap: Utils.clamp(Utils.safeNumber(dom.cardGap.value, 3), 0, 8) });
    });
    dom.showNames.addEventListener("change", function () {
      api.patchConfig({ showNames: dom.showNames.checked });
    });
    dom.showAvatars.addEventListener("change", function () {
      api.patchConfig({ showAvatars: dom.showAvatars.checked });
    });
    dom.upperNames.addEventListener("change", function () {
      api.patchConfig({ uppercaseNames: dom.upperNames.checked });
    });
  }

  /* ---------------------------- dados ---------------------------- */

  function bindData() {
    dom.btnExport.addEventListener("click", function () {
      const ok = api.exportData();
      api.toast(ok ? "Configurações exportadas em JSON." : "Não foi possível exportar.", ok ? "ok" : "error");
    });

    dom.fileImport.addEventListener("change", function () {
      const file = dom.fileImport.files && dom.fileImport.files[0];
      if (!file) return;
      dom.importStatus.textContent = "Validando arquivo...";

      api
        .importFile(file)
        .then(function (result) {
          dom.importStatus.textContent = result.message;
          api.toast(result.message, result.ok ? "ok" : "error");
          if (result.ok) refresh();
          dom.fileImport.value = "";
        })
        .catch(function () {
          dom.importStatus.textContent = "Falha inesperada ao importar o arquivo.";
          api.toast("Falha inesperada ao importar o arquivo.", "error");
          dom.fileImport.value = "";
        });
    });

    dom.btnRestore.addEventListener("click", function () {
      const confirmed = window.confirm(
        "Restaurar todos os 50 canais e configurações originais? O estado salvo será apagado."
      );
      if (!confirmed) return;
      api.restoreDefaults();
      refresh();
      api.toast("Configuração original restaurada.", "ok");
    });
  }

  /* ---------------------------- eventos ---------------------------- */

  function bindEventsPane() {
    dom.btnClearEvents.addEventListener("click", function () {
      api.clearEvents();
      renderEvents();
      api.toast("Registro de ultrapassagens limpo.", "ok");
    });
  }

  function speedLabel(value) {
    const n = Number(value) || 0;
    const sign = n > 0 ? "+" : "";
    return sign + n.toFixed(1).replace(".", ",") + " /s";
  }

  function addStatCard(label, title, value) {
    const card = document.createElement("div");
    card.className = "stat-card";

    const small = document.createElement("small");
    small.textContent = label;

    const b = document.createElement("b");
    b.textContent = title;

    const span = document.createElement("span");
    span.textContent = value;

    card.append(small, b, span);
    dom.liveStats.appendChild(card);
  }

  function renderStats() {
    if (!api || !dom.liveStats) return;
    const s = api.getStats();
    dom.liveStats.textContent = "";

    addStatCard("Canal mais rápido", s.fastest ? s.fastest.name : "—", s.fastest ? speedLabel(s.fastest.value) : "—");
    addStatCard("Canal mais lento", s.slowest ? s.slowest.name : "—", s.slowest ? speedLabel(s.slowest.value) : "—");
    addStatCard(
      "Maior ganho no ciclo",
      s.topGainer ? s.topGainer.name : "—",
      s.topGainer ? Utils.formatNumber(s.topGainer.value) + " inscritos" : "—"
    );
    addStatCard(
      "Maior perda no ciclo",
      s.topLoser ? s.topLoser.name : "—",
      s.topLoser ? Utils.formatNumber(s.topLoser.value) + " inscritos" : "—"
    );
    addStatCard("Total de inscritos", Utils.formatNumber(s.total), "soma dos 50 canais");
    addStatCard(
      "Canais ativos",
      s.active + " de " + (s.totalChannels || 50),
      s.inactive ? s.inactive + " pausado(s)" : "todos simulando"
    );
    addStatCard("Faixa do SUB GAP", "#" + s.gapFrom + " – #" + s.gapTo, "duplas que mudam mais rápido");
    addStatCard("Última ultrapassagem", s.biggestMove || "—", s.biggestMove ? "registro mais recente" : "nenhuma ainda");
    addStatCard(
      "Live agora",
      Utils.formatNumber(s.viewers) + " viewers",
      Utils.formatNumber(s.likes) + " likes"
    );
  }

  function renderEvents() {
    if (!api || !dom.eventLog) return;
    const events = api.getState().events;
    dom.eventLog.textContent = "";

    if (!events.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Nenhuma ultrapassagem registrada ainda.";
      dom.eventLog.appendChild(li);
      return;
    }

    events.forEach(function (event) {
      const li = document.createElement("li");
      const time = document.createElement("time");
      time.textContent = event.time;
      const text = document.createElement("span");
      text.textContent = event.text;
      li.append(time, text);
      dom.eventLog.appendChild(li);
    });
  }

  /* ---------------------------- API pública ---------------------------- */

  return {
    init: init,
    open: open,
    close: close,
    toggle: toggle,
    refresh: refresh,
    isOpen: function () {
      return openState;
    },
  };
})();
