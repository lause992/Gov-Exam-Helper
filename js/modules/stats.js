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

    // ========== 预测模拟分 ==========
    html += renderPrediction(qs);

    // ========== 薄弱度热力图 ==========
    html += renderHeatmap(qs);

    // ========== 错题趋势曲线 ==========
    html += renderTrend(qs);

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

  // ========== 预测模拟分（线性回归） ==========
  function renderPrediction(qs) {
    var history = [];
    qs.forEach(function (q) {
      (q.reviewHistory || []).forEach(function (h) {
        if (h.correct !== null && h.correct !== undefined && h.date) {
          history.push({ date: h.date, correct: h.correct ? 1 : 0 });
        }
      });
    });
    if (history.length < 5) {
      return '<div class="section-title">预测模拟分</div><div class="card"><p class="muted">至少需要 5 条复盘记录才能预测分数</p></div>';
    }
    history.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var dailyMap = {};
    history.forEach(function (h) {
      if (!dailyMap[h.date]) dailyMap[h.date] = { correct: 0, total: 0 };
      dailyMap[h.date].correct += h.correct;
      dailyMap[h.date].total += 1;
    });
    var days = Object.keys(dailyMap).sort();
    var points = days.map(function (d) {
      var r = dailyMap[d];
      return { x: days.indexOf(d), y: Math.round((r.correct / r.total) * 100) };
    });
    var n = points.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    points.forEach(function (p) {
      sumX += p.x; sumY += p.y; sumXY += p.x * p.y; sumX2 += p.x * p.x;
    });
    var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    var intercept = (sumY - slope * sumX) / n || 0;
    var lastIdx = points[points.length - 1].x;
    var predScore = Math.max(0, Math.min(100, Math.round(slope * (lastIdx + 7) + intercept)));
    var curScore = points[points.length - 1].y;
    var avgScore = Math.round(sumY / n);
    var trend = slope > 0.5 ? "上升" : slope < -0.5 ? "下降" : "平稳";
    var trendIcon = slope > 0.5 ? "📈" : slope < -0.5 ? "📉" : "➡️";
    var html = '<div class="section-title">预测模拟分</div>';
    html += '<div class="prediction-card">';
    html += '<div class="pred-label">基于线性回归预测（7天后）</div>';
    html += '<div class="pred-score">' + predScore + '分</div>';
    html += '<div class="pred-bar"><div class="pred-bar-fill" style="width:' + predScore + '%"></div></div>';
    html += '<div class="pred-detail">';
    html += '当前正确率：<strong>' + curScore + '%</strong>　';
    html += '平均正确率：<strong>' + avgScore + '%</strong><br>';
    html += '趋势：' + trendIcon + ' ' + trend + '（斜率 ' + (slope > 0 ? '+' : '') + slope.toFixed(2) + '）';
    html += '</div>';
    html += '<div style="margin-top:10px">';
    html += '<span class="pred-tag">总记录 ' + history.length + '</span>';
    html += '<span class="pred-tag">有效天数 ' + days.length + '</span>';
    html += '</div></div>';
    return html;
  }

  // ========== 知识点薄弱度热力图 ==========
  function renderHeatmap(qs) {
    var subMap = {};
    qs.forEach(function (q) {
      var cat = q.category || "未分类";
      var sub = q.subCategory || "";
      var key = sub ? cat + " / " + sub : cat;
      if (!subMap[key]) subMap[key] = { cat: cat, total: 0, wrong: 0 };
      subMap[key].total += 1;
      var wrong = false;
      (q.reviewHistory || []).forEach(function (h) {
        if (h.correct === false) wrong = true;
      });
      if (wrong) subMap[key].wrong += 1;
    });
    var items = Object.keys(subMap).map(function (k) {
      var d = subMap[k];
      var rate = d.total ? Math.round((d.wrong / d.total) * 100) : 0;
      return { key: k, cat: d.cat, total: d.total, wrong: d.wrong, rate: rate };
    });
    items.sort(function (a, b) { return b.rate - a.rate || b.total - a.total; });
    if (!items.length) {
      return '<div class="section-title">薄弱度热力图</div><div class="card"><p class="muted">暂无数据</p></div>';
    }
    var maxRate = Math.max.apply(null, items.map(function (it) { return it.rate; })) || 1;
    function heatColor(rate) {
      var t = rate / Math.max(maxRate, 1);
      if (t < 0.25) return "rgba(34,197,94,0.15)";
      if (t < 0.5) return "rgba(250,204,21,0.25)";
      if (t < 0.75) return "rgba(251,146,60,0.35)";
      return "rgba(239,68,68,0.45)";
    }
    function heatText(rate) {
      var t = rate / Math.max(maxRate, 1);
      if (t < 0.25) return "#16a34a";
      if (t < 0.5) return "#ca8a04";
      if (t < 0.75) return "#ea580c";
      return "#dc2626";
    }
    var html = '<div class="section-title">薄弱度热力图</div><div class="card">';
    html += '<p class="muted" style="font-size:12px;margin-bottom:8px">颜色越深=错误率越高，点击查看该分类题目</p>';
    html += '<div class="heatmap-grid">';
    items.forEach(function (it) {
      html += '<div class="heatmap-cell" style="background:' + heatColor(it.rate) + ';border:1px solid ' + heatText(it.rate) + '20" data-act="filterBySub" data-sub="' + esc(it.key) + '">';
      html += '<div class="h-name" style="color:' + heatText(it.rate) + '">' + esc(it.key) + '</div>';
      html += '<div class="h-val" style="color:' + heatText(it.rate) + '">' + it.rate + '%</div>';
      html += '<div style="font-size:10px;color:var(--muted)">' + it.wrong + '/' + it.total + '题</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="heatmap-legend">';
    html += '<span>低</span>';
    html += '<div class="hl-block" style="background:rgba(34,197,94,0.15)"></div>';
    html += '<div class="hl-block" style="background:rgba(250,204,21,0.25)"></div>';
    html += '<div class="hl-block" style="background:rgba(251,146,60,0.35)"></div>';
    html += '<div class="hl-block" style="background:rgba(239,68,68,0.45)"></div>';
    html += '<span>高</span>';
    html += '<span style="margin-left:auto">错误率</span>';
    html += '</div></div>';
    return html;
  }

  // ========== 错题趋势曲线（近30天） ==========
  function renderTrend(qs) {
    var history = [];
    qs.forEach(function (q) {
      (q.reviewHistory || []).forEach(function (h) {
        if (h.correct !== null && h.correct !== undefined && h.date) {
          history.push({ date: h.date, correct: h.correct ? 1 : 0 });
        }
      });
    });
    if (history.length < 3) {
      return '<div class="section-title">正确率趋势</div><div class="card"><p class="muted">至少需要 3 条复盘记录</p></div>';
    }
    var dailyMap = {};
    history.forEach(function (h) {
      if (!dailyMap[h.date]) dailyMap[h.date] = { correct: 0, total: 0 };
      dailyMap[h.date].correct += h.correct;
      dailyMap[h.date].total += 1;
    });
    var days = Object.keys(dailyMap).sort().slice(-30);
    var points = days.map(function (d) {
      var r = dailyMap[d];
      return { date: d, rate: Math.round((r.correct / r.total) * 100) };
    });
    if (points.length < 2) {
      return '<div class="section-title">正确率趋势</div><div class="card"><p class="muted">数据不足</p></div>';
    }
    var W = 340, H = 140, PAD = 30;
    var cw = W - PAD * 2, ch = H - PAD * 2;
    var minY = 0, maxY = 100;
    function px(i) { return PAD + (i / (points.length - 1)) * cw; }
    function py(v) { return PAD + ch - ((v - minY) / (maxY - minY)) * ch; }
    var linePath = points.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + px(i).toFixed(1) + ',' + py(p.rate).toFixed(1);
    }).join(' ');
    var areaPath = linePath + ' L' + px(points.length - 1).toFixed(1) + ',' + (PAD + ch) + ' L' + px(0).toFixed(1) + ',' + (PAD + ch) + ' Z';
    var html = '<div class="section-title">正确率趋势（近' + days.length + '天）</div><div class="card">';
    html += '<div class="trend-chart">';
    html += '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    html += '<defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">';
    html += '<stop offset="0%" stop-color="var(--primary)" stop-opacity="0.4"/>';
    html += '<stop offset="100%" stop-color="var(--primary)" stop-opacity="0.02"/>';
    html += '</linearGradient></defs>';
    [0, 25, 50, 75, 100].forEach(function (v) {
      var y = py(v);
      html += '<line x1="' + PAD + '" y1="' + y + '" x2="' + (PAD + cw) + '" y2="' + y + '" class="trend-grid-line"/>';
      html += '<text x="' + (PAD - 4) + '" y="' + (y + 3) + '" class="trend-label" text-anchor="end">' + v + '%</text>';
    });
    html += '<line x1="' + PAD + '" y1="' + (PAD + ch) + '" x2="' + (PAD + cw) + '" y2="' + (PAD + ch) + '" class="trend-axes-line"/>';
    html += '<path d="' + areaPath + '" class="trend-area"/>';
    html += '<path d="' + linePath + '" class="trend-line"/>';
    points.forEach(function (p, i) {
      html += '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.rate).toFixed(1) + '" r="3" class="trend-dot">';
      html += '<title>' + p.date + ': ' + p.rate + '%</title></circle>';
    });
    var showN = Math.min(6, points.length);
    var step = Math.max(1, Math.floor(points.length / showN));
    for (var i = 0; i < points.length; i += step) {
      html += '<text x="' + px(i).toFixed(1) + '" y="' + (H - 4) + '" class="trend-label" text-anchor="middle">' + points[i].date.slice(5) + '</text>';
    }
    html += '</svg></div>';
    var avg = Math.round(points.reduce(function (s, p) { return s + p.rate; }, 0) / points.length);
    var last = points[points.length - 1].rate;
    var first = points[0].rate;
    var diff = last - first;
    html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px">';
    html += '<span>平均 <strong>' + avg + '%</strong></span>';
    html += '<span>最新 <strong>' + last + '%</strong></span>';
    html += '<span style="color:' + (diff >= 0 ? 'var(--ok)' : 'var(--danger)') + '">变化 ' + (diff >= 0 ? '+' : '') + diff + '%</span>';
    html += '</div></div>';
    return html;
  }

  // === 对外暴露 ===
  NS.stats = {
    renderStats: renderStats,
  };
})();
