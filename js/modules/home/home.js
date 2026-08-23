/* ===== modules/home.js =====
 * 首页、复盘列表、错题本列表与悬浮按钮。
 * 对外暴露 XCAPP.home
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
  var JS_BUILD = NS.JS_BUILD;

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
  function openDetail(id) {
    return NS.detail.openDetail(id);
  }
  function openForm(q) {
    return NS.form.openForm(q);
  }
  function remoteVersionText() {
    return NS.summary.remoteVersionText();
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function renderHome() {
    var today = todayStr();
    var pending = state.questions.filter(function (q) {
      return q.status === "pending";
    }).length;
    var done = state.questions.filter(function (q) {
      return q.status === "done";
    }).length;
    var dueToday = state.questions.filter(function (q) {
      return q.status === "pending" && q.reviewDate <= today;
    }).length;
    var idioms = state.idiom.saved.length;

    var html = "";
    html +=
      '<div class="stat-grid">' +
      '<div class="stat-cell orange" data-act="jumpStat" data-v="pending"><div class="num">' +
      pending +
      '</div><div class="lbl">待复盘</div></div>' +
      '<div class="stat-cell green" data-act="jumpStat" data-v="done"><div class="num">' +
      done +
      '</div><div class="lbl">已复盘</div></div>' +
      '<div class="stat-cell red" data-act="jumpStat" data-v="dueToday"><div class="num">' +
      dueToday +
      '</div><div class="lbl">今日待复盘</div></div>' +
      '<div class="stat-cell blue" data-act="jumpStat" data-v="idioms"><div class="num">' +
      idioms +
      '</div><div class="lbl">已积累词语</div></div>' +
      "</div>";

    html += '<div class="section-title">学习工具</div>';
    html += '<div class="home-tools">';
    var tools = [
      { key: "bank", name: "错题本", cnt: "", color: "orange" },
      { key: "calc", name: "速算练习", cnt: "", color: "purple" },
      {
        key: "idiom",
        name: "成语积累",
        cnt: "",
        color: "pink",
      },
      { key: "news", name: "每日时政", cnt: "", color: "teal" },
      { key: "unit", name: "单位换算", cnt: "", color: "blue" },
    ];
    tools.forEach(function (t) {
      var act = t.key === "unit" ? "openUnit" : "switchTab";
      var key = t.key === "unit" ? "" : ' data-key="' + t.key + '"';
      html +=
        '<button class="tool-btn ' +
        t.color +
        '" data-act="' +
        act +
        '"' +
        key +
        ">" +
        '<span class="nm">' +
        t.name +
        "</span>" +
        (t.cnt ? '<span class="cnt">' + t.cnt + "</span>" : "") +
        "</button>";
    });
    html += "</div>";

    html += '<div class="section-title">关于与更新</div>';
    html += '<div class="card">';
    html +=
      '<p class="muted" style="font-size:13px">版本：' +
      esc(remoteVersionText()) +
      "<br>构建：" +
      esc(JS_BUILD) +
      "</p>";
    html +=
      '<button class="btn mt12" data-act="manualUpdate">检查更新</button>';
    html += "</div>";
    html += '<div class="home-credit">来自双休日</div>';
    return html;
  }

  function renderReview() {
    var today = todayStr();
    var inCat = function (q) {
      if (state.filterCat !== "all" && q.category !== state.filterCat)
        return false;
      if (state.filterSub && q.subCategory !== state.filterSub) return false;
      return true;
    };
    var due = state.questions
      .filter(function (q) {
        return q.status === "pending" && q.reviewDate <= today && inCat(q);
      })
      .sort(function (a, b) {
        return a.reviewDate < b.reviewDate ? -1 : 1;
      });
    var next = state.questions
      .filter(function (q) {
        return q.status === "pending" && q.reviewDate > today && inCat(q);
      })
      .sort(function (a, b) {
        return a.reviewDate < b.reviewDate ? -1 : 1;
      });
    var done = state.questions.filter(function (q) {
      return q.status === "done" && inCat(q);
    });

    var html = "";
    html += '<div class="stat-grid">';
    html +=
      '<div class="stat-cell orange"><div class="num">' +
      due.length +
      '</div><div class="lbl">待复盘</div></div>';
    html +=
      '<div class="stat-cell blue"><div class="num">' +
      next.length +
      '</div><div class="lbl">即将到期</div></div>';
    html +=
      '<div class="stat-cell green"><div class="num">' +
      done.length +
      '</div><div class="lbl">已完成</div></div>';
    html += "</div>";

    html +=
      '<div class="chips" style="margin-bottom:12px">' +
      '<span class="chip' +
      (state.filterCat === "all" ? " active" : "") +
      '" data-act="filterCat" data-cat="all">全部</span>' +
      CATEGORIES.map(function (c) {
        return (
          '<span class="chip' +
          (state.filterCat === c ? " active" : "") +
          '" data-act="filterCat" data-cat="' +
          c +
          '">' +
          c +
          "</span>"
        );
      }).join("") +
      "</div>";

    var subCats = SUBCATEGORIES[state.filterCat];
    if (subCats && subCats.length) {
      html +=
        '<div class="chips" style="margin-bottom:12px">' +
        '<span class="chip' +
        (!state.filterSub ? " active" : "") +
        '" data-act="filterSub" data-sub="all">全部子类</span>' +
        subCats
          .map(function (sc) {
            return (
              '<span class="chip' +
              (state.filterSub === sc ? " active" : "") +
              '" data-act="filterSub" data-sub="' +
              sc +
              '">' +
              sc +
              "</span>"
            );
          })
          .join("") +
        "</div>";
    }

    if (!due.length && !next.length && !done.length) {
      html +=
        '<div class="empty"><span class="big"></span>' +
        (state.questions.length
          ? "该分类下暂无题目"
          : "暂无错题<br>去「首页」-「添加错题」上传你的第一道错题吧") +
        "</div>";
    } else {
      if (due.length) {
        html += '<div class="section-title">待复盘（' + due.length + "）</div>";
        due.forEach(function (q) {
          html += '<div class="card q-item">';
          html +=
            '<div class="q-top">' +
            catTag(q.category, q.subCategory) +
            statusTag(q) +
            "</div>";
          html += stemPreviewHtml(q);
          html += '<div class="q-meta">';
          html +=
            "<span>" +
            (q.reviewWeekday ? "每周" + wdLabel(q.reviewWeekday) + " · " : "") +
            "复盘日 " +
            fmtDate(q.reviewDate) +
            "</span>";
          html += "<span>已复盘 " + (q.rounds || 0) + " 次</span>";
          html += "</div>";
          html += '<div style="display:flex;gap:8px;margin-top:8px">';
          html +=
            '<button class="btn sm" data-act="practice" data-id="' +
            q.id +
            '">开始复盘</button>';
          html +=
            '<button class="btn gray sm" data-act="delayReview" data-id="' +
            q.id +
            '">延期1天</button>';
          html +=
            '<button class="btn danger sm" data-act="delQuestion" data-id="' +
            q.id +
            '">删除</button>';
          html += "</div></div>";
        });
      }
      if (next.length) {
        html +=
          '<div class="section-title">即将到期（' + next.length + "）</div>";
        next.forEach(function (q) {
          var remain = Math.ceil(
            (new Date(q.reviewDate) - new Date(today)) / 86400000,
          );
          html += '<div class="card q-item">';
          html +=
            '<div class="q-top">' +
            catTag(q.category, q.subCategory) +
            statusTag(q) +
            "</div>";
          html += stemPreviewHtml(q);
          html += '<div class="q-meta">';
          html +=
            "<span>" +
            (q.reviewWeekday ? "每周" + wdLabel(q.reviewWeekday) + " · " : "") +
            "复盘日 " +
            fmtDate(q.reviewDate) +
            "（约" +
            remain +
            "天后）</span>";
          html += "<span>已复盘 " + (q.rounds || 0) + " 次</span>";
          html += "</div>";
          html += '<div style="display:flex;gap:8px;margin-top:8px">';
          html +=
            '<button class="btn gray sm" data-act="delayReview" data-id="' +
            q.id +
            '">延期1天</button>';
          html +=
            '<button class="btn danger sm" data-act="delQuestion" data-id="' +
            q.id +
            '">删除</button>';
          html += "</div></div>";
        });
      }
      if (done.length) {
        html +=
          '<div class="section-title">已完成（' + done.length + "）</div>";
        done.forEach(function (q) {
          html += '<div class="card q-item">';
          html +=
            '<div class="q-top">' +
            catTag(q.category, q.subCategory) +
            '<span class="tag done">已掌握</span></div>';
          html += stemPreviewHtml(q);
          html += '<div class="q-meta">';
          html += "<span>已复盘 " + (q.rounds || 0) + " 次</span>";
          html += "</div>";
          html += '<div style="display:flex;gap:8px;margin-top:8px">';
          html +=
            '<button class="btn gray sm" data-act="reopenQuestion" data-id="' +
            q.id +
            '">重新复盘</button>';
          html +=
            '<button class="btn danger sm" data-act="delQuestion" data-id="' +
            q.id +
            '">删除</button>';
          html += "</div></div>";
        });
      }
    }
    return html;
  }

  function stemPreviewHtml(q) {
    var stem = String(q.stem || "").trim();
    if (stem) {
      return '<div class="q-stem-preview">' + esc(stem) + "</div>";
    }
    if (q.image) {
      return '<div class="q-stem-preview img-hint">[图片题 · 点击查看题干]</div>';
    }
    return '<div class="q-stem-preview"></div>';
  }

  function qItemHtml(q, extra) {
    return (
      '<div class="card q-item" data-act="openDetail" data-id="' +
      q.id +
      '">' +
      '<div class="q-top">' +
      catTag(q.category, q.subCategory) +
      statusTag(q) +
      '<span class="q-star' +
      (q.favorite ? " on" : "") +
      '" data-act="toggleFav" data-id="' +
      q.id +
      '">' +
      (q.favorite ? "★" : "☆") +
      "</span></div>" +
      stemPreviewHtml(q) +
      '<div class="q-meta">' +
      (q.reviewDate
        ? "<span>" +
          (q.reviewWeekday ? "每周" + wdLabel(q.reviewWeekday) + " · " : "") +
          "复盘日 " +
          fmtDate(q.reviewDate) +
          "</span>"
        : "") +
      (q.source ? "<span>来源 " + esc(q.source) + "</span>" : "") +
      (extra ? "<span>" + esc(extra) + "</span>" : "") +
      "<span>已复盘 " +
      (q.rounds || 0) +
      " 次</span>" +
      "</div></div>"
    );
  }

  function renderBank() {
    var html =
      '<div class="field"><input class="input" id="bank-search" placeholder="搜索题干关键词" value="' +
      esc(state.search) +
      '"></div>';
    html +=
      '<div class="chips" style="margin-bottom:12px">' +
      '<span class="chip' +
      (state.filterCat === "all" ? " active" : "") +
      '" data-act="filterCat" data-cat="all">全部</span>' +
      CATEGORIES.map(function (c) {
        return (
          '<span class="chip' +
          (state.filterCat === c ? " active" : "") +
          '" data-act="filterCat" data-cat="' +
          c +
          '">' +
          c +
          "</span>"
        );
      }).join("") +
      "</div>";

    var subCats = SUBCATEGORIES[state.filterCat];
    if (subCats && subCats.length) {
      html +=
        '<div class="chips" style="margin-bottom:12px">' +
        '<span class="chip' +
        (!state.filterSub ? " active" : "") +
        '" data-act="filterSub" data-sub="all">全部子类</span>' +
        subCats
          .map(function (sc) {
            return (
              '<span class="chip' +
              (state.filterSub === sc ? " active" : "") +
              '" data-act="filterSub" data-sub="' +
              sc +
              '">' +
              sc +
              "</span>"
            );
          })
          .join("") +
        "</div>";
    }

    html +=
      '<div class="chips" style="margin-bottom:12px">' +
      '<span class="chip' +
      (state.filterDone === "all" ? " active" : "") +
      '" data-act="filterDone" data-v="all">全部</span>' +
      '<span class="chip' +
      (state.filterDone === "undone" ? " active" : "") +
      '" data-act="filterDone" data-v="undone">只看未复盘</span>' +
      '<span class="chip' +
      (state.filterDone === "done" ? " active" : "") +
      '" data-act="filterDone" data-v="done">只看已复盘</span>' +
      '<span class="chip' +
      (state.favOnly ? " active" : "") +
      '" data-act="toggleFavOnly">' +
      (state.favOnly ? "★ 只看收藏" : "☆ 只看收藏") +
      "</span>" +
      '<span class="chip' +
      (state.todayOnly ? " active" : "") +
      '" data-act="toggleTodayOnly">今日复盘</span>' +
      '<span class="chip summary-chip" data-act="openSummary" style="color:#fff;background:#0d9488">总结</span>' +
      "</div>";

    var kw = state.search.trim();
    var list = state.questions
      .filter(function (q) {
        if (state.filterDone === "undone" && q.status === "done") return false;
        if (state.filterDone === "done" && q.status !== "done") return false;
        if (
          state.todayOnly &&
          !(q.status === "pending" && q.reviewDate <= todayStr())
        )
          return false;
        if (state.favOnly && !q.favorite) return false;
        if (state.filterCat !== "all" && q.category !== state.filterCat)
          return false;
        if (state.filterSub && q.subCategory !== state.filterSub) return false;
        if (kw) {
          var optText = (q.options || []).join(" ");
          var matText = (q.materials || [])
            .map(function (m) {
              return m.title + " " + m.content;
            })
            .join(" ");
          if (
            (q.stem || "").indexOf(kw) < 0 &&
            (q.correctThinking || "").indexOf(kw) < 0 &&
            (q.wrongThinking || "").indexOf(kw) < 0 &&
            (q.source || "").indexOf(kw) < 0 &&
            optText.indexOf(kw) < 0 &&
            matText.indexOf(kw) < 0
          )
            return false;
        }
        return true;
      })
      .sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

    if (!list.length) {
      html +=
        '<div class="empty">没有符合条件的错题' +
        (state.filterDone === "undone"
          ? "（已复盘已隐藏）"
          : state.filterDone === "done"
            ? "（未复盘已隐藏）"
            : "") +
        "</div>";
    } else {
      html +=
        '<div id="bank-list"><div class="section-title">共 ' +
        list.length +
        " 题</div>";
      html += list.map(qItemHtml).join("") + "</div>";
    }
    html += '<div class="fab" id="fab-add" data-act="openAdd">+</div>';
    return html;
  }

  function initFab() {
    var fab = $("#fab-add");
    if (!fab) return;
    if (state.fabPos) {
      fab.style.right = state.fabPos.r + "px";
      fab.style.bottom = state.fabPos.b + "px";
    }
    var drag = null;
    fab.addEventListener("pointerdown", function (ev) {
      drag = { startX: ev.clientX, startY: ev.clientY, moved: false };
      if (fab.setPointerCapture) {
        try {
          fab.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* ignore */
        }
      }
    });
    fab.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.startX;
      var dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
      if (drag.moved) {
        var r = window.innerWidth - ev.clientX - fab.offsetWidth / 2;
        var b = window.innerHeight - ev.clientY - fab.offsetHeight / 2;
        r = Math.max(8, Math.min(r, window.innerWidth - fab.offsetWidth - 8));
        b = Math.max(8, Math.min(b, window.innerHeight - fab.offsetHeight - 8));
        fab.style.right = r + "px";
        fab.style.bottom = b + "px";
      }
    });
    function endDrag() {
      if (!drag) return;
      var wasMoved = drag.moved;
      drag = null;
      if (wasMoved) {
        state.fabDragged = true;
        state.fabPos = {
          r: parseFloat(fab.style.right) || 18,
          b: parseFloat(fab.style.bottom) || 96,
        };
        try {
          storageSet("xcapp_fab_pos", JSON.stringify(state.fabPos));
        } catch (e) {
          /* ignore */
        }
      }
    }
    fab.addEventListener("pointerup", endDrag);
    fab.addEventListener("pointercancel", endDrag);
    fab.addEventListener("click", function (ev) {
      if (state.fabDragged) {
        state.fabDragged = false;
        ev.stopPropagation();
      }
    });
  }

  function renderBankSearchOnly() {
    var kw = state.search.trim();
    var list = state.questions
      .filter(function (q) {
        if (state.filterDone === "undone" && q.status === "done") return false;
        if (state.filterDone === "done" && q.status !== "done") return false;
        if (state.filterCat !== "all" && q.category !== state.filterCat)
          return false;
        if (state.filterSub && q.subCategory !== state.filterSub) return false;
        if (kw) {
          var optText = (q.options || []).join(" ");
          var matText = (q.materials || [])
            .map(function (m) {
              return m.title + " " + m.content;
            })
            .join(" ");
          if (
            (q.stem || "").indexOf(kw) < 0 &&
            (q.correctThinking || "").indexOf(kw) < 0 &&
            (q.wrongThinking || "").indexOf(kw) < 0 &&
            (q.source || "").indexOf(kw) < 0 &&
            optText.indexOf(kw) < 0 &&
            matText.indexOf(kw) < 0
          )
            return false;
        }
        return true;
      })
      .sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    var listBox = $("#bank-list");
    if (listBox) {
      listBox.innerHTML = list.length
        ? '<div class="section-title">共 ' +
          list.length +
          " 题</div>" +
          list.map(qItemHtml).join("")
        : '<div class="empty">没有符合条件的错题</div>';
    }
  }

  // === 对外暴露 ===
  NS.home = {
    renderHome: renderHome,
    renderReview: renderReview,
    stemPreviewHtml: stemPreviewHtml,
    qItemHtml: qItemHtml,
    renderBank: renderBank,
    initFab: initFab,
    renderBankSearchOnly: renderBankSearchOnly,
  };
})();
