/* ===== modules/shenlun-compare.js =====
 * 申论机构答案对比模块：粉笔/华图/中公/半月谈 四家解析生成与对比。
 * 对外暴露 XCAPP.shenlunCompare
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
  function shenlunBodyHtml(q) {
    return NS.detail.shenlunBodyHtml(q);
  }
  function zhipuChat(a, b, c) {
    return NS.ai.zhipuChat(a, b, c);
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  var COMPARE_INSTS = [
    { key: "fenbi", name: "\u7c89\u7b14", color: "#e74c3c" },
    { key: "huatu", name: "\u534e\u56fe", color: "#2980b9" },
    { key: "zhonggong", name: "\u4e2d\u516c", color: "#27ae60" },
    { key: "banyuetan", name: "\u534a\u6708\u8c08", color: "#f39c12" },
  ];

  function renderShenlunInk() {
    var q = findQ(state.overlay.id);
    if (!q || !q.reviewInk || !q.reviewInk[state.overlay.idx]) return "";
    var r = q.reviewInk[state.overlay.idx];
    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">第 ' +
      (state.overlay.idx + 1) +
      " 次笔迹 · " +
      r.date +
      "</div></div>" +
      '<div class="overlay-body">';
    if (!r.ink) {
      html +=
        '<div class="card"><p class="muted" style="text-align:center;padding:20px 0">本次复盘未留下笔迹</p></div>' +
        '<p class="muted" style="font-size:12px;text-align:center;margin-top:8px">' +
        esc(r.date) +
        " 复盘</p></div></div>";
      return html;
    }
    html += '<div class="card shenlun-card"><div class="shenlun-view">';
    html += shenlunBodyHtml(q);
    if (q.image)
      html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
    html += '<img class="shenlun-ink" src="' + r.ink + '" alt="">';
    html += "</div></div>";
    if (q.reviewHistory && q.reviewHistory[state.overlay.idx]) {
      html +=
        '<p class="muted" style="font-size:12px;text-align:center;margin-top:8px">' +
        esc(q.reviewHistory[state.overlay.idx].date) +
        " 复盘</p>";
    }
    html += "</div></div>";
    return html;
  }

  function renderShenlunCompare() {
    var q = findQ(state.overlay.id);
    if (!q) {
      state.overlay = null;
      render();
      return "";
    }
    var cached = state.compareCache[q.id] || {};
    var single = cached.single || {};
    var loadingSingle = state.compareLoadingSingle || "";
    var loadingCompare = state.compareLoading;
    var compareHtml = cached.compare || "";
    var active = state.compareActive || "";
    var hasAny =
      !!single.fenbi ||
      !!single.huatu ||
      !!single.zhonggong ||
      !!single.banyuetan ||
      !!compareHtml;
    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">\u673a\u6784\u7b54\u6848\u5bf9\u6bd4</div>' +
      (hasAny
        ? '<span class="compare-refresh" data-act="clearCompare" data-id="' +
          q.id +
          '">&#x21bb; \u91cd\u65b0\u83b7\u53d6</span>'
        : "") +
      "</div>" +
      '<div class="overlay-body">';

    html +=
      '<p class="muted" style="font-size:12px;margin:0 4px 10px">\u70b9\u51fb\u673a\u6784\u67e5\u770b\u8be6\u7ec6\u89e3\u6790\uff0c\u6216\u4e00\u952e\u5bf9\u6bd4\u5168\u90e8\u3002\u4ee5\u4e0b\u89e3\u6790\u7531 AI \u6a21\u62df\u5404\u673a\u6784\u98ce\u683c\u751f\u6210\uff0c\u4f9b\u53c2\u8003\u3002</p>';

    html += '<div class="compare-inst-bar">';
    COMPARE_INSTS.forEach(function (inst) {
      var has = !!single[inst.key];
      var isLoading = loadingSingle === inst.key;
      var isActive = active === inst.key;
      var cls =
        "compare-inst-btn" +
        (has ? " done" : "") +
        (isLoading ? " loading" : "") +
        (isActive ? " active" : "");
      var btnStyle = "border-color:" + inst.color + ";";
      if (isActive) btnStyle += "background:" + inst.color + ";color:#fff;";
      else btnStyle += "color:" + inst.color + ";";
      html +=
        '<button class="' +
        cls +
        '" data-act="compareOne" data-id="' +
        q.id +
        '" data-inst="' +
        inst.key +
        '"' +
        (isLoading ? " disabled" : "") +
        ' style="' +
        btnStyle +
        '">';
      if (isLoading) html += '<span class="spinner-sm"></span> ';
      else if (has) html += "\u2713 ";
      html += inst.name + "</button>";
    });
    var isCompareAll = active === "compareAll";
    var allBtnCls = "btn compare-all-btn" + (isCompareAll ? " active" : "");
    html +=
      '<button class="' +
      allBtnCls +
      '" data-act="compareAll" data-id="' +
      q.id +
      '"' +
      (loadingCompare ? " disabled" : "") +
      ">";
    if (loadingCompare)
      html += '<span class="spinner-sm"></span> \u5bf9\u6bd4\u4e2d\u2026';
    else html += "\u4e00\u952e\u5bf9\u6bd4";
    html += "</button></div>";

    html += '<div id="compare-content">';

    if (active === "compareAll") {
      if (loadingCompare) {
        html +=
          '<div class="compare-block"><div style="text-align:center;padding:20px 0"><div class="spinner" style="margin:0 auto"></div><p class="muted" style="font-size:12px;margin-top:8px">\u6b63\u5728\u751f\u6210\u56db\u5bb6\u673a\u6784\u5bf9\u6bd4\u2026</p></div></div>';
      } else if (compareHtml) {
        html +=
          '<div class="compare-block"><div class="compare-sec">\u4e00\u952e\u5bf9\u6bd4</div>' +
          compareHtml +
          "</div>";
      }
    } else if (active && single[active]) {
      var instInfo = COMPARE_INSTS.find(function (x) {
        return x.key === active;
      });
      var secColor = instInfo ? instInfo.color : "var(--primary)";
      var secName = instInfo ? instInfo.name : active;
      html +=
        '<div class="compare-block"><div class="compare-sec" style="background:' +
        secColor +
        '">' +
        secName +
        "</div>" +
        single[active] +
        "</div>";
    } else if (active && loadingSingle === active) {
      var instInfo2 = COMPARE_INSTS.find(function (x) {
        return x.key === active;
      });
      var secColor2 = instInfo2 ? instInfo2.color : "var(--primary)";
      var secName2 = instInfo2 ? instInfo2.name : active;
      html +=
        '<div class="compare-block"><div class="compare-sec" style="background:' +
        secColor2 +
        '">' +
        secName2 +
        "</div>";
      html +=
        '<div style="text-align:center;padding:20px 0"><div class="spinner" style="margin:0 auto"></div><p class="muted" style="font-size:12px;margin-top:8px">\u6b63\u5728\u83b7\u53d6 ' +
        secName2 +
        " \u89e3\u6790\u2026</p></div></div>";
    } else if (!active) {
      html +=
        '<div class="card" style="text-align:center;padding:24px 16px">' +
        '<p style="font-size:14px;margin-bottom:4px">\u9009\u62e9\u673a\u6784\u67e5\u770b\u8be6\u7ec6\u89e3\u6790</p>' +
        '<p class="muted" style="font-size:12px">\u70b9\u51fb\u4e0a\u65b9\u673a\u6784\u6309\u94ae\u67e5\u770b\u8be6\u7ec6\u89e3\u6790</p>' +
        "</div>";
    }

    html += "</div>";
    html += "</div></div>";
    return html;
  }

  function buildShenlunCompareOnePrompt(q, instName) {
    var parts = [];
    parts.push("\u3010\u7533\u8bba\u9898\u76ee\u3011");
    parts.push("\u9898\u76ee\u6765\u6e90\uff1a" + (q.source || "\u672a\u77e5"));
    parts.push(
      "\u9898\u578b\u5206\u7c7b\uff1a" + (q.subCategory || "\u7533\u8bba"),
    );
    if (q.stem) parts.push("\u3010\u9898\u76ee\u8981\u6c42\u3011\n" + q.stem);
    (q.materials || []).forEach(function (m, i) {
      if (!m || !(m.content || "").trim()) return;
      var matLabel = m.title
        ? m.title.match(/^\u6750\u6599/)
          ? m.title
          : i + 1 + " " + m.title
        : i + 1;
      parts.push("\u3010\u6750\u6599" + matLabel + "\u3011\n" + m.content);
    });
    parts.push("");
    parts.push(
      '\u8bf7\u4f60\u5b8c\u5168\u4ee5"' +
        instName +
        '"\u673a\u6784\u7684\u7b54\u9898\u98ce\u683c\u548c\u8bc4\u5206\u6807\u51c6\uff0c\u5bf9\u8fd9\u9053\u7533\u8bba\u9898\u7ed9\u51fa\u8be6\u7ec6\u5b8c\u6574\u7684\u89e3\u6790\u3002\u4e0d\u8981\u4f7f\u7528Markdown\u683c\u5f0f\u7b26\u53f7\uff08\u4e0d\u8981\u52a0**\u52a0\u7c97\u6216#\u6807\u9898\uff09\u3002',
    );
    parts.push("");
    parts.push("\u8bf7\u6309\u7167\u4ee5\u4e0b\u987a\u5e8f\u8f93\u51fa\uff1a");
    parts.push("");
    parts.push(
      "\u5148\u8f93\u51fa\u6bcf\u5219\u6750\u6599\u7684\u5b8c\u6574\u539f\u6587\uff0c\u5c06\u4e0e" +
        instName +
        "\u7b54\u6848\u8981\u70b9\u5bf9\u5e94\u7684\u53e5\u5b50\u7528<u><\/u>\u6807\u7b3e\u5305\u88f9\u4ee5\u7a81\u51fa\u663e\u793a\u3002\u6bcf\u5219\u6750\u6599\u5355\u72ec\u4e00\u6bb5\u3002\u6750\u6599\u53ea\u8f93\u51fa\u4e00\u6b21\uff0c\u540e\u7eed\u7ae0\u8282\u4e0d\u5f97\u91cd\u590d\u5f15\u7528\u5b8c\u6574\u6750\u6599\u539f\u6587\u3002",
    );
    parts.push("");
    parts.push(
      "\u968f\u540e\u7d27\u63a5\u8f93\u51fa\u4ee5\u4e0b\u5404\u8282\uff1a",
    );
    parts.push(
      "\u3010\u53c2\u8003\u7b54\u6848\u3011\u7ed9\u51fa\u5b8c\u6574\u7684\u53c2\u8003\u7b54\u6848\u6587\u672c\uff08300\u5b57\u4ee5\u4e0a\uff09\uff0c\u5206\u6761\u5217\u70b9\uff0c\u6bcf\u6761\u8981\u6709\u5b8c\u6574\u7684\u8868\u8ff0\u800c\u975e\u5173\u952e\u8bcd\u3002\u4e0d\u8981\u5728\u6b64\u590d\u5236\u7c98\u8d34\u6750\u6599\u539f\u6587\u3002",
    );
    parts.push(
      "\u3010\u7b54\u9898\u601d\u8def\u3011\u8be6\u7ec6\u8bf4\u660e\u5ba1\u9898\u6b65\u9aa4\u3001\u6750\u6599\u5206\u6790\u65b9\u6cd5\u3001\u7b54\u9898\u6846\u67b6\u6784\u5efa\u8fc7\u7a0b\uff08200\u5b57\u4ee5\u4e0a\uff09\u3002\u53ef\u4ee5\u5f15\u7528\u6750\u6599\u5173\u952e\u8bcd\u6216\u77ed\u53e5\uff0c\u4e0d\u5f97\u6574\u6bb5\u590d\u5236\u6750\u6599\u539f\u6587\u3002",
    );
    parts.push(
      "\u3010\u5f97\u5206\u8981\u70b9\u3011\u9010\u6761\u8bf4\u660e\u6bcf\u4e2a\u8981\u70b9\u5bf9\u5e94\u7684\u6750\u6599\u5173\u952e\u8bcd\u6216\u77ed\u53e5\uff08\u6bcf\u6761\u7528\u5f15\u53f7\u5f15\u7528\u539f\u6587\uff0c\u800c\u975e\u590d\u5236\u6574\u6bb5\u6750\u6599\uff09\uff0c\u8bf4\u660e\u91c7\u5206\u4f9d\u636e\uff08150\u5b57\u4ee5\u4e0a\uff09\u3002",
    );
    parts.push(
      "\u3010\u8be5\u673a\u6784\u7279\u70b9\u3011\u4e00\u53e5\u8bdd\u603b\u7ed3" +
        instName +
        "\u7684\u7b54\u9898\u98ce\u683c\u4e0e\u8bc4\u5206\u504f\u597d\u3002",
    );
    parts.push("");
    parts.push(
      "\u91cd\u8981\uff1a\u6750\u6599\u539f\u6587\u53ea\u80fd\u5728\u5f00\u5934\u8f93\u51fa\u4e00\u6b21\uff0c\u540e\u7eed\u4efb\u4f55\u7ae0\u8282\u5747\u4e0d\u5f97\u518d\u6b21\u5b8c\u6574\u5f15\u7528\u6750\u6599\u539f\u6587\uff0c\u53ea\u80fd\u7528\u5173\u952e\u8bcd\u6216\u77ed\u53e5\u5f15\u7528\u3002\u4e0d\u8981\u590d\u8ff0\u6307\u4ee4\u6216\u6b65\u9aa4\u8bf4\u660e\uff0c\u4e0d\u8981\u8f93\u51fa\u201c\u7b2c\u4e00\u6b65\u201d\u201c\u7b2c\u4e8c\u6b65\u201d\u7b49\u5b57\u6837\uff0c\u76f4\u63a5\u4ece\u6750\u6599\u539f\u6587\u5f00\u59cb\u8f93\u51fa\u3002",
    );
    return parts.join("\n");
  }

  function buildShenlunCompareAllPrompt(q) {
    var parts = [];
    parts.push("\u3010\u7533\u8bba\u9898\u76ee\u3011");
    parts.push("\u9898\u76ee\u6765\u6e90\uff1a" + (q.source || "\u672a\u77e5"));
    parts.push(
      "\u9898\u578b\u5206\u7c7b\uff1a" + (q.subCategory || "\u7533\u8bba"),
    );
    if (q.stem) parts.push("\u3010\u9898\u76ee\u8981\u6c42\u3011\n" + q.stem);
    (q.materials || []).forEach(function (m, i) {
      if (!m || !(m.content || "").trim()) return;
      var matLabel = m.title
        ? m.title.match(/^\u6750\u6599/)
          ? m.title
          : i + 1 + " " + m.title
        : i + 1;
      parts.push("\u3010\u6750\u6599" + matLabel + "\u3011\n" + m.content);
    });
    parts.push("");
    parts.push(
      "\u8bf7\u4f60\u5206\u522b\u4ee5\u7c89\u7b14\u3001\u534e\u56fe\u3001\u4e2d\u516c\u3001\u534a\u6708\u8c08\u56db\u5bb6\u673a\u6784\u7684\u7b54\u9898\u98ce\u683c\uff0c\u5bf9\u8fd9\u9053\u7533\u8bba\u9898\u7ed9\u51fa\u5bf9\u6bd4\u89e3\u6790\u3002\u4e25\u683c\u6309\u4ee5\u4e0b\u683c\u5f0f\u8f93\u51fa\uff0c\u4e0d\u8981\u4f7f\u7528**\u7b49Markdown\u683c\u5f0f\u7b26\u53f7\uff1a",
    );
    parts.push(
      "\u3010\u6750\u6599\u89e3\u8bfb\u3011\u7528200\u5b57\u6982\u62ac\u6750\u6599\u6838\u5fc3\u8981\u70b9\u3002\u6750\u6599\u89e3\u8bfb\u53ea\u8f93\u51fa\u4e00\u6b21\uff0c\u540e\u7eed\u5404\u673a\u6784\u7684\u5206\u6790\u4e0d\u5f97\u91cd\u590d\u5f15\u7528\u5b8c\u6574\u6750\u6599\u539f\u6587\u3002",
    );
    parts.push("");
    parts.push(
      "1. \u7c89\u7b14\uff08\u8981\u70b9\u5316\u3001\u6982\u62ec\u6027\u5f3a\uff09",
    );
    parts.push(
      "   \u53c2\u8003\u7b54\u6848\uff1a\u7ed9\u51fa3-5\u4e2a\u5b8c\u6574\u5206\u70b9\u7b54\u6848\uff0c\u6bcf\u6761\u4e3a\u5b8c\u6574\u8bed\u53e5\u3002",
    );
    parts.push(
      "   \u7b54\u9898\u601d\u8def\uff1a1-2\u53e5\u8bf4\u660e\u8be5\u673a\u6784\u7684\u6838\u5fc3\u89e3\u9898\u8def\u5f84\u3002",
    );
    parts.push("");
    parts.push(
      "2. \u534e\u56fe\uff08\u903b\u8f91\u5206\u5c42\u3001\u603b\u62ec\u53e5\u660e\u663e\uff09",
    );
    parts.push(
      "   \u53c2\u8003\u7b54\u6848\uff1a\u7ed9\u51fa3-5\u4e2a\u5b8c\u6574\u5206\u70b9\u7b54\u6848\uff0c\u6bcf\u6761\u4e3a\u5b8c\u6574\u8bed\u53e5\u3002",
    );
    parts.push(
      "   \u7b54\u9898\u601d\u8def\uff1a1-2\u53e5\u8bf4\u660e\u8be5\u673a\u6784\u7684\u6838\u5fc3\u89e3\u9898\u8def\u5f84\u3002",
    );
    parts.push("");
    parts.push(
      "3. \u4e2d\u516c\uff08\u7ed3\u6784\u5b8c\u6574\u3001\u8d34\u8fd1\u6750\u6599\uff09",
    );
    parts.push(
      "   \u53c2\u8003\u7b54\u6848\uff1a\u7ed9\u51fa3-5\u4e2a\u5b8c\u6574\u5206\u70b9\u7b54\u6848\uff0c\u6bcf\u6761\u4e3a\u5b8c\u6574\u8bed\u53e5\u3002",
    );
    parts.push(
      "   \u7b54\u9898\u601d\u8def\uff1a1-2\u53e5\u8bf4\u660e\u8be5\u673a\u6784\u7684\u6838\u5fc3\u89e3\u9898\u8def\u5f84\u3002",
    );
    parts.push("");
    parts.push(
      "4. \u534a\u6708\u8c08\uff08\u65f6\u653f\u672f\u8bed\u591a\u3001\u653f\u6cbb\u7ad9\u4f4d\u9ad8\uff09",
    );
    parts.push(
      "   \u53c2\u8003\u7b54\u6848\uff1a\u7ed9\u51fa3-5\u4e2a\u5b8c\u6574\u5206\u70b9\u7b54\u6848\uff0c\u6bcf\u6761\u4e3a\u5b8c\u6574\u8bed\u53e5\u3002",
    );
    parts.push(
      "   \u7b54\u9898\u601d\u8def\uff1a1-2\u53e5\u8bf4\u660e\u8be5\u673a\u6784\u7684\u6838\u5fc3\u89e3\u9898\u8def\u5f84\u3002",
    );
    parts.push("");
    parts.push(
      "\u3010\u6613\u9519\u70b9\u63d0\u793a\u3011100\u5b57\u4ee5\u5185\u6307\u51fa\u5e38\u89c1\u9519\u8bef\u601d\u8def\u4e0e\u6ce8\u610f\u4e8b\u9879\u3002",
    );
    return parts.join("\n");
  }

  function requestShenlunCompareOne(id, instKey) {
    var q = findQ(id);
    if (!q) return;
    if (state.compareLoadingSingle) return;
    var instInfo = COMPARE_INSTS.find(function (x) {
      return x.key === instKey;
    });
    if (!instInfo) return;
    if (instKey === "fenbi" && q.fenbiAnswer) {
      state.compareActive = instKey;
      var cached = state.compareCache[id] || {
        date: todayStr(),
        source: q.source || "\u7533\u8bba\u9898",
        single: {},
        compare: "",
      };
      cached.single = cached.single || {};
      cached.single[instKey] = simpleTextToHtml(q.fenbiAnswer);
      cached.date = todayStr();
      cached.source = q.source || "\u7533\u8bba\u9898";
      state.compareCache[id] = cached;
      saveCompareCache();
      state.compareLoadingSingle = "";
      render();
      return;
    }
    state.compareLoadingSingle = instKey;
    state.compareActive = instKey;
    var container = document.getElementById("compare-content");
    if (!container) {
      state.keepScroll = true;
      render();
      return;
    }
    container.innerHTML =
      '<div class="compare-block"><div class="compare-sec" style="background:' +
      instInfo.color +
      '">' +
      instInfo.name +
      '</div><div style="text-align:center;padding:20px 0"><div class="spinner" style="margin:0 auto"></div><p class="muted" style="font-size:12px;margin-top:8px">\u6b63\u5728\u83b7\u53d6 ' +
      instInfo.name +
      " \u89e3\u6790\u2026</p></div></div>";
    var bar = document.querySelector(".compare-inst-bar");
    if (bar) {
      var btns = bar.querySelectorAll(".compare-inst-btn");
      btns.forEach(function (b) {
        var bk = b.getAttribute("data-inst");
        var bi = COMPARE_INSTS.find(function (x) {
          return x.key === bk;
        });
        if (!bi) return;
        if (bk === instKey) {
          b.style.background = bi.color;
          b.style.color = "#fff";
          b.classList.add("active");
        } else {
          b.style.background = "#fff";
          b.style.color = bi.color;
          b.classList.remove("active");
        }
      });
      var allBtn = bar.querySelector(".compare-all-btn");
      if (allBtn) {
        allBtn.classList.remove("active");
      }
    }
    zhipuChat(
      [
        {
          role: "system",
          content:
            '\u4f60\u662f\u4e00\u4f4d\u8d44\u6df1\u516c\u52a1\u5458\u8003\u8bd5\u7533\u8bba\u8bb2\u5e08\uff0c\u7cbe\u901a"' +
            instInfo.name +
            '"\u673a\u6784\u7684\u7b54\u9898\u4f53\u7cfb\u4e0e\u8bc4\u5206\u6807\u51c6\u3002\u8bf7\u7528\u7b80\u4f53\u4e2d\u6587\u4f5c\u7b54\u3002\u4e0d\u8981\u4f7f\u7528Markdown\u683c\u5f0f\uff08\u4e0d\u8981\u52a0**\u52a0\u7c97\u6216#\u6807\u9898\uff09\uff0c\u76f4\u63a5\u8f93\u51fa\u7eaf\u6587\u672c\u3002\u4e0d\u8981\u590d\u8ff0\u6307\u4ee4\u3001\u6b65\u9aa4\u6216\u8981\u6c42\uff0c\u76f4\u63a5\u8f93\u51fa\u6700\u7ec8\u89e3\u6790\u5185\u5bb9\u3002',
        },
        {
          role: "user",
          content: buildShenlunCompareOnePrompt(q, instInfo.name),
        },
      ],
      4096,
      60000,
    )
      .then(function (txt) {
        state.compareLoadingSingle = "";
        var cached = state.compareCache[id] || {
          date: todayStr(),
          source: q.source || "\u7533\u8bba\u9898",
          single: {},
          compare: "",
        };
        cached.single = cached.single || {};
        cached.single[instKey] = simpleTextToHtml(txt);
        cached.date = todayStr();
        cached.source = q.source || "\u7533\u8bba\u9898";
        state.compareCache[id] = cached;
        saveCompareCache();
        if (
          state.compareActive === instKey &&
          document.getElementById("compare-content")
        ) {
          document.getElementById("compare-content").innerHTML =
            '<div class="compare-block"><div class="compare-sec" style="background:' +
            instInfo.color +
            '">' +
            instInfo.name +
            "</div>" +
            cached.single[instKey] +
            "</div>";
        }
      })
      .catch(function (err) {
        state.compareLoadingSingle = "";
        if (
          state.compareActive === instKey &&
          document.getElementById("compare-content")
        ) {
          document.getElementById("compare-content").innerHTML =
            '<div class="compare-block"><div class="compare-sec" style="background:' +
            instInfo.color +
            '">' +
            instInfo.name +
            '</div><p style="text-align:center;color:var(--danger);font-size:13px;padding:12px 0">\u83b7\u53d6\u5931\u8d25\uff1a' +
            ((err && err.message) || "\u8bf7\u91cd\u8bd5") +
            "</p></div>";
        }
        toast(
          "\u83b7\u53d6\u5931\u8d25\uff1a" +
            ((err && err.message) || "\u8bf7\u91cd\u8bd5"),
        );
      });
  }

  function requestShenlunCompareAll(id) {
    var q = findQ(id);
    if (!q) return;
    if (state.compareLoading) return;
    state.compareLoading = true;
    state.compareActive = "compareAll";
    var container = document.getElementById("compare-content");
    if (!container) {
      state.keepScroll = true;
      render();
      return;
    }
    container.innerHTML =
      '<div class="compare-block"><div class="compare-sec">\u4e00\u952e\u5bf9\u6bd4</div><div style="text-align:center;padding:20px 0"><div class="spinner" style="margin:0 auto"></div><p class="muted" style="font-size:12px;margin-top:8px">\u6b63\u5728\u751f\u6210\u56db\u5bb6\u673a\u6784\u5bf9\u6bd4\u2026</p></div></div>';
    var bar = document.querySelector(".compare-inst-bar");
    if (bar) {
      var btns = bar.querySelectorAll(".compare-inst-btn");
      btns.forEach(function (b) {
        b.classList.remove("active");
        b.style.background = "#fff";
        var bi = COMPARE_INSTS.find(function (x) {
          return x.key === b.getAttribute("data-inst");
        });
        if (bi) b.style.color = bi.color;
      });
      var allBtn = bar.querySelector(".compare-all-btn");
      if (allBtn) allBtn.classList.add("active");
    }
    zhipuChat(
      [
        {
          role: "system",
          content:
            "\u4f60\u662f\u4e00\u4f4d\u8d44\u6df1\u516c\u52a1\u5458\u8003\u8bd5\u7533\u8bba\u8bb2\u5e08\uff0c\u719f\u6089\u7c89\u7b14\u3001\u534e\u56fe\u3001\u4e2d\u516c\u3001\u534a\u6708\u8c08\u7b49\u673a\u6784\u7684\u7b54\u9898\u98ce\u683c\u4e0e\u8bc4\u5206\u8981\u70b9\uff0c\u64c5\u957f\u89e3\u6790\u7533\u8bba\u771f\u9898\u6750\u6599\u3002\u8bf7\u7528\u7b80\u4f53\u4e2d\u6587\u4f5c\u7b54\u3002\u4e0d\u8981\u4f7f\u7528Markdown\u683c\u5f0f\uff08\u4e0d\u8981\u52a0**\u52a0\u7c97\u6216#\u6807\u9898\uff09\uff0c\u76f4\u63a5\u8f93\u51fa\u7eaf\u6587\u672c\u3002\u4e0d\u8981\u590d\u8ff0\u6307\u4ee4\u3001\u6b65\u9aa4\u6216\u8981\u6c42\uff0c\u76f4\u63a5\u8f93\u51fa\u6700\u7ec8\u89e3\u6790\u5185\u5bb9\u3002",
        },
        { role: "user", content: buildShenlunCompareAllPrompt(q) },
      ],
      4096,
      60000,
    )
      .then(function (txt) {
        state.compareLoading = false;
        var cached = state.compareCache[id] || {
          date: todayStr(),
          source: q.source || "\u7533\u8bba\u9898",
          single: {},
          compare: "",
        };
        cached.compare = compareAllTextToHtml(txt);
        cached.date = todayStr();
        cached.source = q.source || "\u7533\u8bba\u9898";
        state.compareCache[id] = cached;
        saveCompareCache();
        if (
          state.compareActive === "compareAll" &&
          document.getElementById("compare-content")
        ) {
          document.getElementById("compare-content").innerHTML =
            '<div class="compare-block"><div class="compare-sec">\u4e00\u952e\u5bf9\u6bd4</div>' +
            cached.compare +
            "</div>";
        }
      })
      .catch(function (err) {
        state.compareLoading = false;
        if (
          state.compareActive === "compareAll" &&
          document.getElementById("compare-content")
        ) {
          document.getElementById("compare-content").innerHTML =
            '<div class="compare-block"><div class="compare-sec">\u4e00\u952e\u5bf9\u6bd4</div><p style="text-align:center;color:var(--danger);font-size:13px;padding:12px 0">AI \u751f\u6210\u5931\u8d25\uff1a' +
            ((err && err.message) || "\u8bf7\u91cd\u8bd5") +
            "</p></div>";
        }
        toast(
          "AI \u751f\u6210\u5931\u8d25\uff1a" +
            ((err && err.message) || "\u8bf7\u91cd\u8bd5"),
        );
      });
  }

  function simpleTextToHtml(txt) {
    var s = String(txt || "").trim();
    if (!s)
      return '<p class="muted" style="text-align:center;padding:10px 0">\u672a\u751f\u6210\u6709\u6548\u5185\u5bb9</p>';
    var lines = s.split(/\r?\n/);
    var html = "";
    var buf = "";
    function escKeepU(st) {
      return esc(stripMd(st))
        .replace(/&lt;u&gt;/g, "<u>")
        .replace(/&lt;\/u&gt;/g, "</u>");
    }
    function flush() {
      if (!buf.trim()) return;
      if (inMat) {
        html +=
          '<div class="compare-material">' +
          escKeepU(buf).replace(/\n/g, "<br>") +
          "</div>";
      } else {
        html +=
          '<p class="compare-text">' +
          escKeepU(buf).replace(/\n/g, "<br>") +
          "</p>";
      }
      buf = "";
    }
    var inMat = false;
    var lastMatSec = "";
    lines.forEach(function (line) {
      var t = line.replace(/\s+/g, " ").trim();
      if (!t) return;
      if (/^第[一二三四五六七八九十0-9]+步/.test(t)) return;
      if (/^\u3010/.test(t)) {
        flush();
        var sec = t.replace(/^\u3010|\u3011$/g, "");
        var isNewMat = /^\u3010\u6750\u6599/.test(t);
        if (isNewMat && sec === lastMatSec) {
          inMat = true;
          return;
        }
        inMat = isNewMat;
        if (isNewMat) lastMatSec = sec;
        html += '<div class="compare-sub-sec">' + escKeepU(sec) + "</div>";
      } else if (/^\d+[\.、]/.test(t) && !inMat) {
        flush();
        html += '<div class="compare-text">' + escKeepU(t) + "</div>";
      } else {
        buf += (buf ? "\n" : "") + t;
      }
    });
    flush();
    return html;
  }

  function compareAllTextToHtml(txt) {
    var s = String(txt || "").trim();
    if (!s)
      return '<p class="muted" style="text-align:center;padding:10px 0">\u672a\u751f\u6210\u6709\u6548\u5185\u5bb9</p>';
    var lines = s.split(/\r?\n/);
    var html = "";
    var buf = "";
    var openBlock = false;
    var inGrid = false;
    var gridHtml = "";
    var instPattern =
      /^(1|2|3|4)[\.、]\s*(\u7c89\u7b14|\u534e\u56fe|\u4e2d\u516c|\u534a\u6708\u8c08)/;
    function flush() {
      if (!buf.trim()) return;
      var p = buf.replace(/\s+/g, " ").trim();
      if (inGrid) {
        gridHtml += '<p class="compare-p">' + esc(stripMd(p)) + "</p>";
      } else {
        html +=
          '<div class="compare-text">' +
          esc(stripMd(p)).replace(/\n/g, "<br>") +
          "</div>";
      }
      buf = "";
    }
    function closeBlock() {
      if (!openBlock) return;
      if (inGrid && gridHtml) {
        html += '<div class="compare-grid">' + gridHtml + "</div>";
        gridHtml = "";
      }
      html += "</div>";
      openBlock = false;
      inGrid = false;
    }
    lines.forEach(function (line) {
      var t = line.replace(/\s+/g, " ").trim();
      if (!t) return;
      if (/^\u3010/.test(t)) {
        flush();
        closeBlock();
        var sec = t.replace(/^\u3010|\u3011$/g, "");
        inGrid =
          sec === "\u673a\u6784\u7b54\u6848\u5bf9\u6bd4" ||
          sec === "\u5bf9\u6bd4";
        html +=
          '<div class="compare-block"><div class="compare-sec">' +
          esc(stripMd(sec)) +
          "</div>";
        openBlock = true;
      } else if (instPattern.test(t)) {
        flush();
        if (!inGrid) {
          inGrid = true;
          gridHtml = "";
        }
        gridHtml +=
          '<div class="compare-card">' +
          esc(stripMd(t)).replace(/\n/g, "<br>") +
          "</div>";
      } else if (/^\d+[\.、]/.test(t)) {
        flush();
        if (inGrid) {
          gridHtml += '<div class="compare-text">' + esc(stripMd(t)) + "</div>";
        } else {
          html += '<div class="compare-text">' + esc(stripMd(t)) + "</div>";
        }
      } else {
        buf += (buf ? "\n" : "") + t;
      }
    });
    flush();
    closeBlock();
    return html;
  }

  // === 对外暴露 ===
  NS.shenlunCompare = {
    renderShenlunInk: renderShenlunInk,
    renderShenlunCompare: renderShenlunCompare,
    buildShenlunCompareOnePrompt: buildShenlunCompareOnePrompt,
    buildShenlunCompareAllPrompt: buildShenlunCompareAllPrompt,
    requestShenlunCompareOne: requestShenlunCompareOne,
    requestShenlunCompareAll: requestShenlunCompareAll,
    simpleTextToHtml: simpleTextToHtml,
    compareAllTextToHtml: compareAllTextToHtml,
    COMPARE_INSTS: COMPARE_INSTS,
  };
})();
