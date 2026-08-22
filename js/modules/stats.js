/* ===== modules/stats.js =====
 * 统计模块：错题数据统计、分类分布、AI 分析与备份入口。
 * 对外暴露 XCAPP.stats
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
  function mdRender(text) {
    return NS.ai.mdRender(text);
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function renderStats() {
    var qs = state.questions;
    var today = todayStr();
    var done = qs.filter(function (q) {
      return q.status === "done";
    }).length;
    var pending = qs.length - done;
    var overdue = qs.filter(function (q) {
      return q.status === "pending" && q.reviewDate < today;
    }).length;
    var dueToday = qs.filter(function (q) {
      return q.status === "pending" && q.reviewDate === today;
    }).length;
    var rate = qs.length ? Math.round((done / qs.length) * 100) : 0;

    var html =
      '<div class="stat-grid">' +
      '<div class="stat-cell blue"><div class="num">' +
      qs.length +
      '</div><div class="lbl">错题总数</div></div>' +
      '<div class="stat-cell orange"><div class="num">' +
      pending +
      '</div><div class="lbl">待复盘</div></div>' +
      '<div class="stat-cell green"><div class="num">' +
      rate +
      '%</div><div class="lbl">复盘完成率</div></div>' +
      '<div class="stat-cell red"><div class="num">' +
      (overdue + dueToday) +
      '</div><div class="lbl">今天应复盘</div></div>' +
      "</div>";

    html += '<div class="section-title">分类统计</div><div class="card">';
    var max = 1;
    CATEGORIES.forEach(function (c) {
      var n = qs.filter(function (q) {
        return q.category === c;
      }).length;
      if (n > max) max = n;
    });
    CATEGORIES.forEach(function (c) {
      var arr = qs.filter(function (q) {
        return q.category === c;
      });
      var d = arr.filter(function (q) {
        return q.status === "done";
      }).length;
      html +=
        '<div class="cat-bar-row">' +
        '<span class="name">' +
        c +
        "</span>" +
        '<div class="bar-bg"><div class="bar" style="width:' +
        Math.round((arr.length / max) * 100) +
        "%;background:" +
        CAT_COLORS[c] +
        '"></div></div>' +
        '<span class="n">' +
        d +
        "/" +
        arr.length +
        "</span>" +
        "</div>";
    });
    html +=
      '<button class="btn mt12" data-act="aiAnalyze">' +
      (state.aiAnalyzing ? "AI 分析中…" : "AI 分析学习情况") +
      "</button>";
    html += "</div>";

    if (state.aiAnalysis) {
      html += '<div class="section-title">AI 学习分析</div><div class="card">';
      html +=
        '<div class="ai-msg bot" style="padding:0;background:none">' +
        mdRender(state.aiAnalysis) +
        "</div>";
      html +=
        '<button class="btn gray sm mt12" data-act="clearAiAnalysis">收起分析</button>';
      html += "</div>";
    }

    html += '<div class="section-title">数据备份</div><div class="card">';
    html +=
      '<div class="btn-row">' +
      '<button class="btn ghost" data-act="export">导出备份</button>' +
      '<button class="btn gray" data-act="import">导入备份</button>' +
      "</div>";
    html +=
      '<p class="muted mt12">数据保存在本机。建议定期导出备份，卸载应用或清理数据前请先导出。</p>';
    html += "</div>";

    var history = [];
    qs.forEach(function (q) {
      (q.reviewHistory || []).forEach(function (h) {
        history.push({
          date: h.date,
          correct: h.correct,
          cat: q.category,
          score: h.score || "",
          aiComment: h.aiComment || "",
        });
      });
    });
    history.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    if (history.length) {
      html += '<div class="section-title">最近复盘记录</div><div class="card">';
      history.slice(0, 15).forEach(function (h) {
        html +=
          '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13.5px">' +
          "<span>" +
          h.date +
          "</span>" +
          '<span style="color:' +
          CAT_COLORS[h.cat] +
          '">' +
          h.cat +
          "</span>" +
          '<span style="color:' +
          (h.cat === "申论"
            ? "var(--primary)"
            : h.correct
              ? "var(--ok)"
              : "var(--danger)") +
          ';font-weight:600">' +
          (h.cat === "申论"
            ? h.score || "已复盘"
            : h.correct
              ? "答对"
              : "答错") +
          "</span>" +
          "</div>";
      });
      html += "</div>";
    }
    return html;
  }

  // === 对外暴露 ===
  NS.stats = {
    renderStats: renderStats,
  };
})();
