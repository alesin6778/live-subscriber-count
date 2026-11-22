/* ==========================================================================
   js/utils.js — funções auxiliares (formatação, validação, cores)
   ========================================================================== */
window.Utils = (function () {
  "use strict";

  const formatters = {
    ",": new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    ".": new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }),
  };
  let thousandSeparator = ",";

  function setThousandSeparator(separator) {
    thousandSeparator = separator === "." ? "." : ",";
  }

  function getThousandSeparator() {
    return thousandSeparator;
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  /**
   * Interpreta números digitados em qualquer formato:
   *  - "1.234.567" e "1,234,567" -> milhares
   *  - "1,5" / "1.5" -> decimal
   *  - "1.234,56" / "1,234.56" -> decimal com milhares
   */
  function parseNumericString(value) {
    let text = String(value == null ? "" : value).trim().replace(/\s+/g, "");
    if (!text) return NaN;
    text = text.replace(/[^\d.,-]/g, "");
    if (!text || text === "-" || text === "." || text === ",") return NaN;

    const negative = text.charAt(0) === "-";
    text = text.replace(/-/g, "");

    const hasComma = text.indexOf(",") >= 0;
    const hasDot = text.indexOf(".") >= 0;

    if (hasComma && hasDot) {
      // o último separador encontrado é o decimal
      if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
        text = text.replace(/\./g, "").replace(",", ".");
      } else {
        text = text.replace(/,/g, "");
      }
    } else if (hasComma) {
      text = text.replace(/,/g, (match, offset) => (offset === text.lastIndexOf(",") && text.length - offset <= 3 ? "." : ""));
    } else if (hasDot) {
      const parts = text.split(".");
      const last = parts[parts.length - 1];
      const groupedThousands = parts.length > 2 || (parts.length === 2 && last.length === 3 && parts[0].length > 0);
      if (groupedThousands) text = text.replace(/\./g, "");
    }

    const n = Number(text);
    if (!Number.isFinite(n)) return NaN;
    return negative ? -n : n;
  }

  function safeNumber(value, fallback) {
    const fb = fallback === undefined ? 0 : fallback;
    if (typeof value === "number") return Number.isFinite(value) ? value : fb;
    if (typeof value === "string") {
      const parsed = parseNumericString(value);
      return Number.isFinite(parsed) ? parsed : fb;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : fb;
  }

  function formatNumber(value) {
    const n = Math.round(safeNumber(value, 0));
    return formatters[thousandSeparator].format(Math.max(0, n));
  }

  function pad2(value) {
    return String(Math.max(0, Math.floor(safeNumber(value, 0)))).padStart(2, "0");
  }

  function splitDuration(totalSeconds) {
    const secs = Math.max(0, Math.floor(safeNumber(totalSeconds, 0)));
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return {
      days: days,
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      d: pad2(days),
      h: pad2(hours),
      m: pad2(minutes),
      s: pad2(seconds),
      text: pad2(days) + " : " + pad2(hours) + " : " + pad2(minutes) + " : " + pad2(seconds),
    };
  }

  function initials(name) {
    const clean = String(name == null ? "" : name)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim();
    if (!clean) return "?";
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function isHexColor(value) {
    return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
  }

  function normalizeHex(value, fallback) {
    const fb = fallback || "#000000";
    if (!isHexColor(value)) return fb;
    let hex = value.trim().toLowerCase();
    if (hex.length === 4) {
      hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return hex;
  }

  function hexToRgb(hex) {
    const safe = normalizeHex(hex, "#000000");
    return {
      r: parseInt(safe.slice(1, 3), 16),
      g: parseInt(safe.slice(3, 5), 16),
      b: parseInt(safe.slice(5, 7), 16),
    };
  }

  function withAlpha(hex, alpha) {
    const c = hexToRgb(hex);
    const a = clamp(alpha, 0, 1);
    return "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + a + ")";
  }

  /* amount entre -1 e 1: negativo escurece, positivo clareia */
  function shade(hex, amount) {
    const c = hexToRgb(hex);
    const ratio = clamp(amount, -1, 1);
    const mix = function (channel) {
      return Math.round(ratio >= 0 ? channel + (255 - channel) * ratio : channel * (1 + ratio));
    };
    const hex2 = function (value) {
      return clamp(value, 0, 255).toString(16).padStart(2, "0");
    };
    return "#" + hex2(mix(c.r)) + hex2(mix(c.g)) + hex2(mix(c.b));
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      const context = this;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        fn.apply(context, args);
      }, wait);
    };
  }

  function deepClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (err) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomBetween(min, max + 1));
  }

  function formatClock(date) {
    const d = date instanceof Date ? date : new Date();
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  function truncate(text, max) {
    const value = String(text == null ? "" : text);
    return value.length > max ? value.slice(0, Math.max(0, max - 1)) + "…" : value;
  }

  function fontStack(font) {
    switch (font) {
      case "Inter":
        return '"Inter", "Segoe UI", Arial, sans-serif';
      case "Roboto":
        return '"Roboto", "Segoe UI", Arial, sans-serif';
      case "Poppins":
        return '"Poppins", "Segoe UI", Arial, sans-serif';
      case "Oswald":
        return '"Oswald", "Arial Narrow", Arial, sans-serif';
      case "Bebas Neue":
        return '"Bebas Neue", "Oswald", Impact, sans-serif';
      case "Anton":
        return '"Anton", "Oswald", Impact, sans-serif';
      case "Archivo":
        return '"Archivo", "Segoe UI", Arial, sans-serif';
      case "Raleway":
        return '"Raleway", "Segoe UI", Arial, sans-serif';
      case "Sora":
        return '"Sora", "Segoe UI", Arial, sans-serif';
      case "Space Grotesk":
        return '"Space Grotesk", "Segoe UI", Arial, sans-serif';
      case "Calibri":
        return 'Calibri, "Segoe UI", Tahoma, Arial, sans-serif';
      case "Arial":
        return 'Arial, "Helvetica Neue", Helvetica, sans-serif';
      case "Segoe UI":
        return '"Segoe UI", Tahoma, Arial, sans-serif';
      case "Verdana":
        return 'Verdana, Geneva, "Segoe UI", sans-serif';
      case "Trebuchet MS":
        return '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif';
      case "Tahoma":
        return 'Tahoma, Verdana, "Segoe UI", sans-serif';
      case "Georgia":
        return 'Georgia, "Times New Roman", serif';
      case "Times New Roman":
        return '"Times New Roman", Times, Georgia, serif';
      case "Courier New":
        return '"Courier New", Courier, monospace';
      case "system":
        return 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
      case "Montserrat":
      default:
        return '"Montserrat", "Inter", "Segoe UI", Arial, sans-serif';
    }
  }

  return {
    clamp: clamp,
    safeNumber: safeNumber,
    parseNumericString: parseNumericString,
    formatNumber: formatNumber,
    setThousandSeparator: setThousandSeparator,
    getThousandSeparator: getThousandSeparator,
    pad2: pad2,
    splitDuration: splitDuration,
    initials: initials,
    isHexColor: isHexColor,
    normalizeHex: normalizeHex,
    hexToRgb: hexToRgb,
    withAlpha: withAlpha,
    shade: shade,
    debounce: debounce,
    deepClone: deepClone,
    escapeHtml: escapeHtml,
    randomBetween: randomBetween,
    randomInt: randomInt,
    formatClock: formatClock,
    truncate: truncate,
    fontStack: fontStack,
  };
})();
