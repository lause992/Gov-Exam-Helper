/* ===== modules/summary.js =====
 * 分科总结与设置模块：分科总结画板、公式画板、复盘设置等。
 * 对外暴露 XCAPP.summary
 * 依赖：state.js、storage.js、core.js
 */
(function () {
  "use strict";
  var NS = (window.XCAPP = window.XCAPP || {});

  // === 共享依赖别名（加载时可用） ===
  var $ = NS.utils.$,
    $all = NS.utils.$all,
    esc = NS.utils.esc,
    stripMd = NS.utils.stripMd;
  var pad = NS.utils.pad,
    todayStr = NS.utils.todayStr,
    addDays = NS.utils.addDays;
  var fmtDate = NS.utils.fmtDate,
    nextWeekdayDate = NS.utils.nextWeekdayDate,
    wdLabel = NS.utils.wdLabel;
  var stripOptionPrefix = NS.utils.stripOptionPrefix,
    fmtSize = NS.utils.fmtSize;
  var toast = NS.utils.toast,
    confirmDialog = NS.utils.confirmDialog,
    uid = NS.utils.uid;
  var storageSet = NS.storage.set,
    storageGet = NS.storage.get,
    storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var isNative = NS.bridge.isNative,
    nativeCall = NS.bridge.call;
  var compressImage = NS.bridge.compressImage,
    prepareOcrImage = NS.bridge.prepareOcrImage;
  var state = NS.state,
    IS_NODE = NS.IS_NODE;
  var CATEGORIES = NS.consts.CATEGORIES,
    SUBCATEGORIES = NS.consts.SUBCATEGORIES;
  var CAT_COLORS = NS.consts.CAT_COLORS,
    REVIEW_OPTIONS = NS.consts.REVIEW_OPTIONS;
  var optionLetters = NS.consts.optionLetters,
    STORAGE_KEY = NS.consts.STORAGE_KEY;
  var NAV_TABS = NS.consts.NAV_TABS,
    HOME_SUB_TABS = NS.consts.HOME_SUB_TABS,
    UNIT_LIST = NS.consts.UNIT_LIST;
  var save = NS.store.save,
    load = NS.store.load,
    findQ = NS.store.findQ;
  var saveSources = NS.store.saveSources,
    saveSettings = NS.store.saveSettings;
  var saveCalcHistory = NS.store.saveCalcHistory,
    saveIdioms = NS.store.saveIdioms,
    saveAiHistory = NS.store.saveAiHistory;
  var saveCompareCache = NS.store.saveCompareCache,
    saveNewsSaved = NS.store.saveNewsSaved;
  var saveNewsSummaries = NS.store.saveNewsSummaries,
    saveSummaries = NS.store.saveSummaries;
  var compressQuestionsImages = NS.store.compressQuestionsImages,
    markImgDirty = NS.store.markImgDirty;
  var imgKey = NS.store.imgKey,
    qImagesPayload = NS.store.qImagesPayload,
    persistDirtyImages = NS.store.persistDirtyImages;
  var XCAPP = NS;
  var WEEKDAY_NAMES = NS.constants.WEEKDAY_NAMES;

  // === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） ===
  function render() {
    return NS.shell.render();
  }
  function renderHeader() {
    return NS.shell.renderHeader();
  }
  function catTag(a, b, c) {
    return NS.shell.catTag(a, b, c);
  }
  function statusTag(q) {
    return NS.shell.statusTag(q);
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function renderSummary() {
    var cat = state.summaryCat || CATEGORIES[0];
    state.summaryCat = cat;
    var arr = state.summaries[cat];
    if (!Array.isArray(arr)) arr = state.summaries[cat] = [];
    if (state.summaryPage >= arr.length && arr.length)
      state.summaryPage = arr.length - 1;
    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">分科总结</div></div>' +
      '<div class="overlay-body">';
    html +=
      '<div class="chips" style="margin-bottom:10px">' +
      CATEGORIES.map(function (c) {
        var has =
          Array.isArray(state.summaries[c]) &&
          state.summaries[c].some(function (p) {
            return !!p;
          });
        return (
          '<span class="chip' +
          (cat === c ? " active" : "") +
          '" data-act="summaryCat" data-cat="' +
          c +
          '">' +
          c +
          (has ? " ·" : "") +
          "</span>"
        );
      }).join("") +
      "</div>";
    html +=
      '<div class="page-nav" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
      '<span class="chip" data-act="summaryPrev">\u25c0 \u4e0a\u4e00\u9875</span>' +
      '<span class="chip" data-act="summaryNext">\u4e0b\u4e00\u9875 \u25b6</span>' +
      '<span class="chip" data-act="summaryAddPage" style="color:#fff;background:#0d9488">\uff0b \u52a0\u9875</span>' +
      "</div>";
    html += '<div class="card">';
    html +=
      '<div class="formula-tools">' +
      '<span class="chip' +
      (state.summaryErase ? " active" : "") +
      '" data-act="summaryErase">\u6a61\u76ae</span>' +
      '<span class="chip" data-act="summaryClearCanvas">\u6e05\u7a7a\u672c\u9875</span></div>';
    html +=
      '<div class="formula-wrap"><canvas id="summary-canvas" style="touch-action:none"></canvas></div>';
    html += "</div></div>";
    html +=
      '<div class="summary-nav" id="summary-nav" data-act="summaryJumpOpen" style="right:' +
      (state.summaryNav ? state.summaryNav.r : 16) +
      "px;bottom:" +
      (state.summaryNav ? state.summaryNav.b : 110) +
      'px"><span>' +
      (state.summaryPage + 1) +
      "</span><em>/</em><span>" +
      Math.max(arr.length, 1) +
      "</span></div>";
    return html;
  }

  function initSummary() {
    var cv = $("#summary-canvas");
    if (!cv) return;
    var wrap = $(".formula-wrap");
    if (!wrap) return;
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth || window.innerWidth - 40;
    var h = Math.round(w * 1.35);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    XCAPP.ink.grid(ctx, w, h);
    state.summaryDirty = false;
    var cat = state.summaryCat;
    var arr = state.summaries[cat];
    state.summaryEngine = XCAPP.ink.create(cv, {
      initialErase: state.summaryErase,
      onDown: function () {
        state.summaryDirty = true;
      },
      onUp: function () {
        autoSaveSummaryCur();
      },
    });
    if (Array.isArray(arr) && arr[state.summaryPage]) {
      XCAPP.ink.loadInto(cv, ctx, w, h, arr[state.summaryPage]);
    }
    initSummaryNav();
  }

  function openSummaryJumpModal() {
    if (state.summaryJumpOpen) return;
    if (document.querySelector(".modal-mask")) return;
    state.summaryJumpOpen = true;
    var arrM = state.summaries[state.summaryCat];
    var maxM = Math.max(Array.isArray(arrM) ? arrM.length : 1, 1);
    var mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.setAttribute("data-act", "summaryJumpCancel");
    mask.innerHTML =
      '<div class="modal" style="position:relative" data-act="noop">' +
      '<div class="m-title">\u8df3\u8f6c\u5230\u9875\u7801</div>' +
      '<input class="input" id="summary-jump-input" type="number" min="1" max="' +
      maxM +
      '" value="' +
      (state.summaryPage + 1) +
      '" style="text-align:center;margin-bottom:12px">' +
      '<div class="m-btns">' +
      '<button class="btn gray" data-act="summaryJumpCancel">\u53d6\u6d88</button>' +
      '<button class="btn" data-act="summaryJumpGo">\u786e\u5b9a</button>' +
      "</div></div>";
    ($("#content") || document.body).appendChild(mask);
    var inp = $("#summary-jump-input");
    if (inp) {
      try {
        inp.focus();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function closeSummaryJumpModal() {
    state.summaryJumpOpen = false;
    var m = document.querySelector(".modal-mask");
    if (m && m.parentNode) m.parentNode.removeChild(m);
  }

  function initSummaryNav() {
    var nav = $("#summary-nav");
    if (!nav) return;
    var drag = null;
    var lastMoved = false;
    nav.addEventListener("pointerdown", function (e) {
      drag = {
        sx: e.clientX,
        sy: e.clientY,
        r: parseFloat(nav.style.right) || 16,
        b: parseFloat(nav.style.bottom) || 110,
        moved: false,
      };
      if (nav.setPointerCapture) {
        try {
          nav.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
    });
    nav.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.sx;
      var dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) {
        var r = drag.r - dx;
        var b = drag.b - dy;
        r = Math.max(8, Math.min(r, window.innerWidth - 90));
        b = Math.max(8, Math.min(b, window.innerHeight - 60));
        nav.style.right = r + "px";
        nav.style.bottom = b + "px";
      }
    });
    function endNav(e) {
      if (!drag) return;
      var moved = drag.moved;
      var r = parseFloat(nav.style.right) || 16;
      var b = parseFloat(nav.style.bottom) || 110;
      drag = null;
      if (moved) {
        lastMoved = true;
        state.summaryNav = { r: r, b: b };
        try {
          storageSet("xcapp_summary_nav_pos", JSON.stringify(state.summaryNav));
        } catch (err) {
          /* ignore */
        }
      }
    }
    nav.addEventListener("pointerup", endNav);
    nav.addEventListener("pointercancel", endNav);
    nav.addEventListener("click", function (e) {
      if (lastMoved) {
        lastMoved = false;
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  function autoSaveSummaryCur() {
    var cv = $("#summary-canvas");
    if (!cv || !state.summaryDirty) return;
    var cat = state.summaryCat;
    if (!Array.isArray(state.summaries[cat])) state.summaries[cat] = [];
    var url = cv.toDataURL("image/png");
    if (url.length < 600) return;
    var arr = state.summaries[cat];
    if (state.summaryPage >= arr.length) arr.length = state.summaryPage + 1;
    arr[state.summaryPage] = url;
    saveSummaries();
    state.summaryDirty = false;
  }

  function remoteVersionText() {
    try {
      if (
        window.AndroidBridge &&
        typeof window.AndroidBridge.getAppVersion === "function"
      ) {
        var raw = window.AndroidBridge.getAppVersion();
        var v = JSON.parse(raw);
        return "v" + (v.base || "1.0") + "（远程版本 " + (v.local || 0) + "）";
      }
    } catch (e) {
      /* ignore */
    }
    return "v1.0";
  }

  // === 对外暴露 ===
  NS.summary = {
    renderSummary: renderSummary,
    initSummary: initSummary,
    openSummaryJumpModal: openSummaryJumpModal,
    closeSummaryJumpModal: closeSummaryJumpModal,
    initSummaryNav: initSummaryNav,
    autoSaveSummaryCur: autoSaveSummaryCur,
    remoteVersionText: remoteVersionText,
  };
})();
