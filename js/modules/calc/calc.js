/* ===== modules/calc.js =====
 * 速算练习模块：乘法随机出题、计时、答题判定与历史趋势图。
 * 对外暴露 XCAPP.calc
 * 依赖：state.js、storage.js、core.js
 */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  // === 共享依赖别名（加载时可用） ===
  var $ = NS.utils.$, $all = NS.utils.$all, esc = NS.utils.esc, stripMd = NS.utils.stripMd;
  var pad = NS.utils.pad, todayStr = NS.utils.todayStr, addDays = NS.utils.addDays;
  var fmtDate = NS.utils.fmtDate, nextWeekdayDate = NS.utils.nextWeekdayDate, wdLabel = NS.utils.wdLabel;
  var stripOptionPrefix = NS.utils.stripOptionPrefix, fmtSize = NS.utils.fmtSize;
  var toast = NS.utils.toast, confirmDialog = NS.utils.confirmDialog, uid = NS.utils.uid;
  var storageSet = NS.storage.set, storageGet = NS.storage.get, storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var isNative = NS.bridge.isNative, nativeCall = NS.bridge.call;
  var compressImage = NS.bridge.compressImage, prepareOcrImage = NS.bridge.prepareOcrImage;
  var state = NS.state, IS_NODE = NS.IS_NODE;
  var CATEGORIES = NS.consts.CATEGORIES, SUBCATEGORIES = NS.consts.SUBCATEGORIES;
  var CAT_COLORS = NS.consts.CAT_COLORS, REVIEW_OPTIONS = NS.consts.REVIEW_OPTIONS;
  var optionLetters = NS.consts.optionLetters, STORAGE_KEY = NS.consts.STORAGE_KEY;
  var NAV_TABS = NS.consts.NAV_TABS, HOME_SUB_TABS = NS.consts.HOME_SUB_TABS, UNIT_LIST = NS.consts.UNIT_LIST;
  var save = NS.store.save, load = NS.store.load, findQ = NS.store.findQ;
  var saveSources = NS.store.saveSources, saveSettings = NS.store.saveSettings;
  var saveCalcHistory = NS.store.saveCalcHistory, saveIdioms = NS.store.saveIdioms, saveAiHistory = NS.store.saveAiHistory;
  var saveCompareCache = NS.store.saveCompareCache, saveNewsSaved = NS.store.saveNewsSaved;
  var saveNewsSummaries = NS.store.saveNewsSummaries, saveSummaries = NS.store.saveSummaries;
  var compressQuestionsImages = NS.store.compressQuestionsImages, markImgDirty = NS.store.markImgDirty;
  var imgKey = NS.store.imgKey, qImagesPayload = NS.store.qImagesPayload, persistDirtyImages = NS.store.persistDirtyImages;

  // === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） ===
  function render() { return NS.shell.render(); }
  function renderHeader() { return NS.shell.renderHeader(); }
  function catTag(a, b, c) { return NS.shell.catTag(a, b, c); }
  function statusTag(q) { return NS.shell.statusTag(q); }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function renderCalc() {
    var h = state.calc;
    var today = todayStr();
    var todayRecords = h.history.filter(function (r) { return r.date === today; });
    var totalCorrect = todayRecords.filter(function (r) { return r.correct; }).length;
    var totalToday = todayRecords.length;
    var rateToday = totalToday > 0 ? Math.round(totalCorrect / totalToday * 100) : 0;

    var html = '<div class="calc-page">';
    html += '<div class="stat-grid">';
    html += '<div class="stat-cell blue"><div class="num">' + totalToday + '</div><div class="lbl">今日练习</div></div>';
    html += '<div class="stat-cell green"><div class="num">' + rateToday + '%</div><div class="lbl">今日准确率</div></div>';
    html += '</div>';

    html += '<div class="section-title">速算练习</div><div class="card">';
    html += '<p class="muted" style="margin-bottom:12px">随机乘法练习，快速计算两位数乘法。</p>';

    if (!h.current) {
      html += '<button class="btn" data-act="startCalc">开始练习</button>';
    } else {
      var q = h.current;
      var elapsed = h.startTime > 0 ? ((Date.now() - h.startTime) / 1000).toFixed(1) : 0;
      html += '<div class="calc-question">';
      html += '<p class="calc-stem">' + esc(q.stem) + '</p>';
      html += '<div class="calc-timer">⏱ ' + elapsed + 's</div>';
      html += '<div class="field mt12"><input class="input" id="calc-answer" type="number" placeholder="输入答案"></div>';
      if (!h.answered) {
        html += '<button class="btn" data-act="submitCalc">提交答案</button>';
      } else {
        var userInput = $('#calc-answer') ? $('#calc-answer').value : '';
        userInput = String(userInput || '').replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[^\d.-]/g, '');
        var userVal = parseFloat(userInput);
        var relErr = h.current.answer !== 0 ? Math.abs(userVal - h.current.answer) / h.current.answer * 100 : 0;
        var ok = relErr <= 2;
        html += '<div class="calc-result ' + (ok ? 'correct' : 'wrong') + '">';
        html += '<p>你的答案：' + (h.userAnswer || '-') + '　正确答案：' + h.current.answer + '</p>';
        html += '<p>' + (ok ? '回答正确！' : '回答错误') + '</p>';
        html += '<p>用时：' + h.elapsed + 's</p>';
        html += '</div>';
        html += '<button class="btn" data-act="nextCalc">下一题</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    if (todayRecords.length > 0) {
      html += '<div class="section-title">今日练习记录 (' + todayRecords.length + '题)</div><div class="card">';
      todayRecords.forEach(function (r, idx) {
        var globalIdx = h.history.indexOf(r);
        html += '<div class="calc-record">';
        html += '<span>' + esc(r.stem) + '</span>';
        html += '<span class="' + (r.correct ? 'ok' : 'danger') + '">' + (r.correct ? '✓' : '✗') + ' ' + r.elapsed + 's</span>';
        html += '<button class="btn danger sm" data-act="delCalcRecord" data-i="' + globalIdx + '">删除</button>';
        html += '</div>';
      });
      html += '<button class="btn danger sm mt12" data-act="clearCalcHistory">清空全部记录</button>';
      html += '</div>';
    }

    if (h.history.length > todayRecords.length) {
      var olderRecords = h.history.filter(function (r) { return r.date !== today; });
      html += '<div class="section-title">历史记录 (' + olderRecords.length + '题)</div><div class="card">';
      olderRecords.slice(-20).forEach(function (r) {
        var globalIdx = h.history.indexOf(r);
        html += '<div class="calc-record">';
        html += '<span>' + esc(r.stem) + ' <span class="muted">' + r.date + '</span></span>';
        html += '<span class="' + (r.correct ? 'ok' : 'danger') + '">' + (r.correct ? '✓' : '✗') + ' ' + r.elapsed + 's</span>';
        html += '<button class="btn danger sm" data-act="delCalcRecord" data-i="' + globalIdx + '">删除</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += renderCalcChart();
    html += '</div>';
    return html;
  }

  function renderCalcChart() {
    var h = state.calc.history;
    if (h.length < 2) return '<div class="card" style="text-align:center"><p class="muted">完成更多练习后显示趋势图</p></div>';

    var dateMap = {};
    h.forEach(function (r) {
      if (!dateMap[r.date]) dateMap[r.date] = { total: 0, correct: 0 };
      dateMap[r.date].total++;
      if (r.correct) dateMap[r.date].correct++;
    });

    var dates = Object.keys(dateMap).sort().slice(-7);
    if (dates.length < 2) return '<div class="card" style="text-align:center"><p class="muted">需要至少2天数据才能显示趋势</p></div>';

    var rates = dates.map(function (d) { return dateMap[d].total > 0 ? Math.round(dateMap[d].correct / dateMap[d].total * 100) : 0; });
    var maxRate = 100;
    var chartW = 300, chartH = 150, padL = 40, padB = 30;
    var plotW = chartW - padL - 10;
    var plotH = chartH - padB - 10;

    var points = rates.map(function (r, i) {
      var x = padL + (i / (rates.length - 1)) * plotW;
      var y = 10 + plotH * (1 - r / maxRate);
      return x + ',' + y;
    }).join(' ');

    var html = '<div class="section-title">近7日准确率趋势</div><div class="card">';
    html += '<svg class="calc-chart" viewBox="0 0 ' + chartW + ' ' + chartH + '">';
    html += '<line x1="' + padL + '" y1="10" x2="' + padL + '" y2="' + (10 + plotH) + '" stroke="#e5e9f2" stroke-width="1"/>';
    html += '<line x1="' + padL + '" y1="' + (10 + plotH) + '" x2="' + (padL + plotW) + '" y2="' + (10 + plotH) + '" stroke="#e5e9f2" stroke-width="1"/>';
    html += '<polyline points="' + points + '" fill="none" stroke="#4f6ef7" stroke-width="2" stroke-linejoin="round"/>';
    dates.forEach(function (d, i) {
      var x = padL + (i / (rates.length - 1)) * plotW;
      var y = 10 + plotH * (1 - rates[i] / maxRate);
      html += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#4f6ef7"/>';
      html += '<text x="' + x + '" y="' + (chartH - 5) + '" text-anchor="middle" font-size="9" fill="#8a93a6">' + d.substring(5) + '</text>';
      html += '<text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle" font-size="9" fill="#4f6ef7">' + rates[i] + '%</text>';
    });
    html += '</svg>';
    html += '</div>';
    return html;
  }

  function generateCalcQuestion() {
    var num1 = Math.floor(Math.random() * 90) + 10;
    var num2 = Math.floor(Math.random() * 90) + 10;
    var answer = num1 * num2;
    return { stem: num1 + ' × ' + num2 + ' = ?', answer: answer };
  }

  function startCalcTimer() {
    stopCalcTimer();
    state.calcTimerId = setInterval(function () {
      var timerEl = $('.calc-timer');
      if (timerEl && state.calc.startTime > 0 && !state.calc.answered) {
        var elapsed = ((Date.now() - state.calc.startTime) / 1000).toFixed(1);
        timerEl.textContent = '⏱ ' + elapsed + 's';
      }
    }, 100);
  }

  function stopCalcTimer() {
    if (state.calcTimerId) {
      clearInterval(state.calcTimerId);
      state.calcTimerId = null;
    }
  }

  // === 对外暴露 ===
  NS.calc = {
    renderCalc: renderCalc,
    renderCalcChart: renderCalcChart,
    generateCalcQuestion: generateCalcQuestion,
    startCalcTimer: startCalcTimer,
    stopCalcTimer: stopCalcTimer
  };
})();
