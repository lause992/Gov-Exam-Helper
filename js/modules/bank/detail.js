/* ===== modules/detail.js =====
 * 错题详情、复盘做题、OCR 识别、申论墨迹/评分等。
 * 对外暴露 XCAPP.detail
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
  var renderLatex = NS.bridge.renderLatex;
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
  var WEEKDAY_NAMES = NS.consts.WEEKDAY_NAMES;
  var COMPARE_INSTS =
    (NS.shenlunCompare && NS.shenlunCompare.COMPARE_INSTS) || [];

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
  function openCrop(d, cb, t) {
    return NS.crop.openCrop(d, cb, t);
  }
  function initScratch() {
    return NS.scratch.initScratch();
  }
  function initShenlunCanvas() {
    return NS.shenlunCanvas.initShenlunCanvas();
  }
  function initFormulaPad() {
    return NS.form.initFormulaPad();
  }
  function fetchAiAnswer(q, h) {
    return NS.ai.fetchAiAnswer(q, h);
  }
  function zhipuChat(m, t, s) {
    return NS.ai.zhipuChat(m, t, s);
  }
  function zhipuVision(d, p, m) {
    return NS.ai.zhipuVision(d, p, m);
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function openDetail(id) {
    var q = findQ(id);
    if (!q) return;
    if (!state.overlay) {
      var lc = $("#content");
      state.listScroll = lc ? lc.scrollTop : 0;
    }
    state.overlay = { type: "detail", id: id };
    render();
  }

  function optContentHtml(q, i, text) {
    var img = q.optImgs && q.optImgs[i];
    if (img) return '<img class="opt-img" src="' + img + '">';
    var clean = stripOptionPrefix(text);
    return renderLatex(clean || text || "");
  }

  function shenlunBodyHtml(q) {
    function parasToHtml(text) {
      return (
        text.split(/\n+/).filter(function (t) {
          return t.trim();
        }) || [""]
      )
        .map(function (t) {
          return '<p class="mat-para">' + esc(t) + "</p>";
        })
        .join("");
    }
    var h = "";
    (q.materials || []).forEach(function (m, i) {
      if (!m || !(m.content || "").trim()) return;
      h +=
        '<div class="material"><div class="material-title">' +
        esc(m.title || "材料 " + (i + 1)) +
        "</div>" +
        parasToHtml(m.content) +
        "</div>";
    });
    if (q.stem) {
      h +=
        '<div class="material material-q" style="margin-top:' +
        (h ? "14px" : "0") +
        '">' +
        '<div class="material-title">题目</div>' +
        parasToHtml(q.stem) +
        "</div>";
    }
    return h;
  }

  function renderDetail() {
    var q = findQ(state.overlay.id);
    if (!q) {
      state.overlay = null;
      render();
      return "";
    }
    var html =
      '<div class="overlay' +
      (state.detailSwipeDir ? " no-anim" : "") +
      '">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">错题详情</div></div>' +
      '<div class="overlay-body' +
      (state.detailSwipeDir === "next"
        ? " slide-in-next"
        : state.detailSwipeDir === "prev"
          ? " slide-in-prev"
          : "") +
      '">';
    state.detailSwipeDir = "";

    html += '<div class="card">';
    html +=
      '<div class="q-top">' +
      catTag(q.category, q.subCategory) +
      statusTag(q) +
      "</div>";
    if (q.source)
      html +=
        '<p class="muted" style="margin-top:6px">来源：' +
        esc(q.source) +
        "</p>";
    if (q.reviewDate)
      html +=
        '<p class="muted">' +
        (q.reviewWeekday
          ? "固定每周" + wdLabel(q.reviewWeekday) + "复盘 · "
          : "") +
        "复盘日：" +
        fmtDate(q.reviewDate) +
        "　已复盘 " +
        (q.rounds || 0) +
        " 次</p>";
    if (q.category === "申论") {
      html += shenlunBodyHtml(q);
      html +=
        '<div style="margin-top:12px"><button class="btn" style="width:100%" data-act="openShenlunCompare" data-id="' +
        q.id +
        '">AI 机构答案对比</button></div>';
    } else {
      if (q.stem)
        html +=
          '<p style="font-size:14.5px;white-space:pre-wrap;margin-top:8px">' +
          renderLatex(q.stem) +
          "</p>";
      if (q.image)
        html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
      if (q.options && q.options.length) {
        html += '<div style="margin-top:10px">';
        q.options.forEach(function (opt, i) {
          html +=
            '<div class="opt" style="cursor:default;border:none;padding:4px 0"><span class="key" style="width:22px;height:22px;font-size:12px">' +
            optionLetters[i] +
            '</span><span class="txt">' +
            optContentHtml(q, i, opt) +
            "</span></div>";
        });
        html += "</div>";
      }
      if (q.answer) {
        html +=
          '<div class="mt12"><span class="answer-pill" id="detail-answer" style="display:none">正确答案 ' +
          esc(q.answer) +
          "</span>" +
          '<button class="btn gray sm" id="detail-show-answer">查看正确答案</button></div>';
      }
    }
    html += "</div>";

    var hasThinking = q.wrongThinking || q.correctThinking || q.fenbiAnswer;
    if (hasThinking) {
      html += '<div class="card">';
      if (q.wrongThinking) {
        html +=
          '<div class="detail-block"><div class="lb" style="cursor:pointer;display:flex;align-items:center;gap:6px" data-act="toggleThinking" data-tk="wrong"><span class="thinking-arrow" data-tk="wrong">\u25b6</span>\u5f53\u65f6\u7684\u9519\u8bef\u601d\u8def</div>' +
          '<div class="val thinking-content" data-tk="wrong" style="display:none">' +
          esc(q.wrongThinking) +
          "</div></div>";
      }
      if (q.correctThinking) {
        var tkLabel =
          q.category === "\u7533\u8bba"
            ? "\u4e0a\u6b21\u4f5c\u7b54"
            : "\u6b63\u786e\u601d\u8def";
        html +=
          '<div class="detail-block"><div class="lb" style="cursor:pointer;display:flex;align-items:center;gap:6px" data-act="toggleThinking" data-tk="correct"><span class="thinking-arrow" data-tk="correct">\u25b6</span>' +
          tkLabel +
          "</div>" +
          '<div class="val thinking-content" data-tk="correct" style="display:none">' +
          esc(q.correctThinking) +
          "</div></div>";
      }
      if (q.fenbiAnswer) {
        html +=
          '<div class="detail-block"><div class="lb" style="cursor:pointer;display:flex;align-items:center;gap:6px" data-act="toggleThinking" data-tk="fenbi"><span class="thinking-arrow" data-tk="fenbi">\u25b6</span>\u7c89\u7b14\u7b54\u6848</div>' +
          '<div class="val thinking-content" data-tk="fenbi" style="display:none;white-space:pre-wrap">' +
          esc(q.fenbiAnswer) +
          "</div></div>";
      }
      html += "</div>";
    }

    html +=
      '<div class="card"><div class="detail-block"><div class="lb">手写公式 <span class="muted" style="font-size:12px">\uff08\u8d44\u6599\u5206\u6790\u8ba1\u7b97\u53ef\u624b\u5199\uff09</span></div>';
    var padOpen = state.formulaOpen && state.formulaPadQid === q.id;
    if (padOpen) {
      html +=
        '<div class="formula-tools" style="margin-top:10px">' +
        '<span class="chip' +
        (state.formulaErase ? " active" : "") +
        '" data-act="formulaErase">\u6a61\u76ae</span>' +
        '<span class="chip" data-act="formulaClear">\u6e05\u7a7a</span>' +
        '<button class="btn sm" style="margin-left:auto" data-act="formulaSave">\u5b8c\u6210\u5e76\u4fdd\u5b58</button>' +
        '<button class="btn gray sm" data-act="formulaCancel">\u53d6\u6d88</button></div>';
      html +=
        '<div class="formula-wrap"><canvas id="formula-canvas" style="touch-action:none"></canvas></div>';
    } else if (q.formulaImg) {
      html +=
        '<div class="img-wrap" style="margin-top:8px"><img src="' +
        q.formulaImg +
        '" style="width:100%"></div>';
      html +=
        '<div class="actions" style="margin-top:10px">' +
        '<button class="btn sm" data-act="openFormulaPad" data-id="' +
        q.id +
        '">\u91cd\u65b0\u624b\u5199</button>' +
        '<button class="btn danger sm" data-act="delFormulaImg" data-id="' +
        q.id +
        '">\u5220\u9664</button></div>';
    } else {
      html +=
        '<button class="btn sm mt12" data-act="openFormulaPad" data-id="' +
        q.id +
        '">\u270e \u624b\u5199\u516c\u5f0f</button>';
    }
    html += "</div></div>";

    if (q.reviewHistory && q.reviewHistory.length) {
      var hasAnyInk =
        q.category === "申论" &&
        q.reviewInk &&
        q.reviewInk.some(function (r) {
          return r && r.ink;
        });
      html +=
        '<div class="card"><div class="detail-block"><div class="lb">复盘记录</div>';
      var manageMode = state.detailManageMode === q.id;
      var expandedIdx = state.reviewExpandedIdx;
      var latestIdx = q.reviewHistory.length - 1;
      q.reviewHistory.forEach(function (h, hi) {
        var isLatest = hi === latestIdx;
        var isExpanded =
          expandedIdx === hi && q.id === (state.overlay && state.overlay.id);
        var thisInk = q.reviewInk && q.reviewInk[hi] && q.reviewInk[hi].ink;
        html +=
          '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:3px 0">';
        var dateHtml = h.date + (h.correct === null ? "（申论）" : "");
        if (!manageMode) {
          html +=
            '<span data-act="toggleReviewExpand" data-id="' +
            q.id +
            '" data-idx="' +
            hi +
            '" style="cursor:pointer;text-decoration:underline">' +
            dateHtml +
            "</span>";
        } else {
          html += "<span>" + dateHtml + "</span>";
        }
        html += '<span style="display:flex;align-items:center;gap:6px">';
        if (manageMode) {
          html +=
            '<span data-act="deleteReviewRecord" data-id="' +
            q.id +
            '" data-idx="' +
            hi +
            '" style="color:var(--danger);cursor:pointer;font-size:13px">删除</span>';
        } else {
          html +=
            '<span style="color:' +
            (h.correct === null
              ? "var(--primary)"
              : h.correct
                ? "var(--ok)"
                : "var(--danger)") +
            ';font-weight:600">' +
            (h.correct === null
              ? h.score || (thisInk ? "有笔迹" : "已复盘")
              : h.correct
                ? "答对"
                : "答错") +
            "</span>";
        }
        html += "</span></div>";
        if (!manageMode && isExpanded) {
          if (h.answer) {
            html +=
              '<div style="font-size:12px;color:var(--muted);padding:4px 0;margin-top:4px;border-top:1px dashed var(--line)">';
            html +=
              '<div style="font-weight:600;margin-bottom:2px">当次作答：</div>';
            html +=
              '<div style="white-space:pre-wrap;line-height:1.5">' +
              esc(h.answer) +
              "</div>";
            html += "</div>";
          }
          if (h.score && h.aiComment) {
            html += '<div class="ai-analysis-block">';
            html +=
              '<div class="ai-analysis-score">\u3010\u603b\u5206\u3011' +
              esc(h.score) +
              "</div>";
            if (h.scoreDetail) {
              var sd = h.scoreDetail;
              var cats = [
                { label: "\u5185\u5bb9\u8d28\u91cf", val: sd.content },
                { label: "\u7ed3\u6784\u5e03\u5c40", val: sd.structure },
                { label: "\u8bed\u8a00\u8868\u8fbe", val: sd.expression },
                { label: "\u5377\u9762\u683c\u5f0f", val: sd.format },
              ];
              cats.forEach(function (c) {
                if (c.val)
                  html +=
                    '<div class="ai-analysis-item"><span class="ai-label">' +
                    c.label +
                    '</span><span class="ai-val">' +
                    esc(c.val) +
                    "</span></div>";
              });
            }
            html +=
              '<div class="ai-analysis-item"><span class="ai-label">\u3010\u70b9\u8bc4\u3011</span><span class="ai-val">' +
              esc(h.aiComment) +
              "</span></div>";
            if (h.aiMissing)
              html +=
                '<div class="ai-analysis-item"><span class="ai-label">\u3010\u8981\u70b9\u7f3a\u6f0f\u3011</span><span class="ai-val">' +
                esc(h.aiMissing) +
                "</span></div>";
            if (h.aiStrength)
              html +=
                '<div class="ai-analysis-item"><span class="ai-label">\u3010\u4f5c\u7b54\u4f18\u70b9\u3011</span><span class="ai-val">' +
                esc(h.aiStrength) +
                "</span></div>";
            if (h.aiNonMaterial)
              html +=
                '<div class="ai-analysis-item"><span class="ai-label">\u3010\u975e\u6750\u6599\u5185\u5bb9\u3011</span><span class="ai-val">' +
                esc(h.aiNonMaterial) +
                "</span></div>";
            if (h.aiExprFix)
              html +=
                '<div class="ai-analysis-item"><span class="ai-label">\u3010\u8868\u8fbe\u4fee\u6b63\u3011</span><span class="ai-val">' +
                esc(h.aiExprFix) +
                "</span></div>";
            html += "</div>";
          }
        }
      });
      if (q.category === "申论" && hasAnyInk && !manageMode) {
        html +=
          '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">';
        q.reviewInk.forEach(function (r, ri) {
          if (r && r.ink) {
            html +=
              '<button class="btn gray sm" data-act="viewShenlunInk" data-id="' +
              q.id +
              '" data-idx="' +
              ri +
              '">查看第 ' +
              (ri + 1) +
              " 次笔迹</button>";
          }
        });
        html += "</div>";
      }
      html +=
        '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">';
      if (manageMode) {
        html +=
          '<button class="btn gray sm" data-act="cancelManage" data-id="' +
          q.id +
          '">取消管理</button>';
      } else {
        html +=
          '<button class="btn gray sm" data-act="manageReviewHistory" data-id="' +
          q.id +
          '">管理记录</button>';
      }
      html += "</div>";
      html += "</div></div>";
    }

    html += '<div class="actions">';
    if (q.status === "pending") {
      html +=
        '<button class="btn" data-act="practice" data-id="' +
        q.id +
        '">去复盘</button>';
      html +=
        '<button class="btn gray" data-act="snooze" data-id="' +
        q.id +
        '">推迟3天</button>';
    } else {
      html +=
        '<button class="btn" data-act="practice" data-id="' +
        q.id +
        '">再做一次</button>';
      html +=
        '<button class="btn gray" data-act="reactivate" data-id="' +
        q.id +
        '">重新待复盘</button>';
    }
    html += "</div>";
    html +=
      '<div class="actions">' +
      '<button class="btn ghost" data-act="edit" data-id="' +
      q.id +
      '">编辑</button>' +
      '<button class="btn ghost' +
      (q.favorite ? " fav-on" : "") +
      '" data-act="toggleFav" data-id="' +
      q.id +
      '">' +
      (q.favorite ? "★ 已收藏" : "☆ 收藏") +
      "</button>" +
      '<button class="btn danger" data-act="del" data-id="' +
      q.id +
      '">删除</button>' +
      "</div>";
    html += "</div></div>";
    return html;
  }

  function openPractice(id) {
    var q = findQ(id);
    if (!q) return;
    state.practice = {
      id: id,
      selected: {},
      answered: false,
      again: false,
      note: "",
    };
    state.overlay = { type: "practice", id: id };
    render();
  }

  function renderPractice() {
    var q = findQ(state.overlay.id);
    if (!q) {
      state.overlay = null;
      render();
      return "";
    }
    var p = state.practice;
    var answerSet = extractLetters(q.answer);
    var multi = answerSet.length > 1;
    var isShenlun = q.category === "申论";

    var html =
      '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closePractice">&times;</span>' +
      '<div class="title">' +
      (isShenlun ? "申论复盘" : "复盘做题") +
      "</div>" +
      '<span class="header-pen' +
      (state.scratch ? " on" : "") +
      '" data-act="toggleScratch" title="临时草稿纸">' +
      (state.scratch ? "✓" : "✏") +
      "</span></div>" +
      '<div class="overlay-body">';

    html +=
      '<div class="practice-head">' +
      '<span class="round-badge">第 ' +
      ((q.rounds || 0) + 1) +
      " 次复盘</span>" +
      "<h2>" +
      catTag(q.category, q.subCategory) +
      "</h2></div>";

    if (isShenlun) {
      html +=
        '<div class="shenlun-tip">直接在题目上书写批注（每次复盘的笔迹单独保留）</div>';
      html += '<div class="card shenlun-card" id="shenlun-wrap">';
      html += shenlunBodyHtml(q);
      if (q.image)
        html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
      html += '<canvas id="shenlun-canvas"></canvas>';
      html += "</div>";
      html +=
        '<div class="shenlun-bar">' +
        '<span class="scratch-colors">' +
        [
          ["#d32f2f", "红"],
          ["#1565c0", "蓝"],
          ["#1f2430", "黑"],
          ["#e65100", "橙"],
        ]
          .map(function (c) {
            return (
              '<button class="scratch-color' +
              (state.scratchColor === c[0] ? " active" : "") +
              '" data-act="shenlunColor" data-color="' +
              c[0] +
              '" title="' +
              c[1] +
              '色笔" style="background:' +
              c[0] +
              '"></button>'
            );
          })
          .join("") +
        "</span>" +
        '<button class="btn gray sm' +
        (state.scratchTool === "eraser" ? " active" : "") +
        '" data-act="shenlunTool" data-tool="eraser">橡皮</button>' +
        '<button class="btn gray sm' +
        (state.scratchTool === "pen" ? " active" : "") +
        '" data-act="shenlunTool" data-tool="pen">画笔</button>' +
        '<button class="btn gray sm" data-act="shenlunClear">清空</button>' +
        "</div>";
      html += '<div class="card">';
      html +=
        '<div class="field"><span class="label">写下你的申论作答</span>' +
        '<textarea class="textarea" id="p-note" rows="6" placeholder="在此输入你的申论答案，将结合机构参考答案由 AI 进行评分……">' +
        esc(p.note) +
        "</textarea>" +
        '<div class="word-count" id="word-count">0/' +
        extractMaxChars(q) +
        "</div></div>";
      html +=
        '<button class="btn" data-act="finishPractice">' +
        (state.shenlunScoring ? "AI 评分中…" : "完成本次复盘") +
        "</button>";
      html += "</div>";
      html += "</div>";
      html += "</div>";
      return html;
    }

    html += '<div class="card">';
    if (q.stem)
      html +=
        '<p style="font-size:15px;white-space:pre-wrap">' +
        renderLatex(q.stem) +
        "</p>";
    if (q.image)
      html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
    if (q.options && q.options.length) {
      html += '<div class="opt-list">';
      q.options.forEach(function (opt, i) {
        var key = optionLetters[i];
        var cls = "opt";
        if (p.answered) {
          var correct = answerSet.indexOf(key) >= 0;
          var chosen = !!p.selected[key];
          if (correct) cls += " correct";
          else if (chosen) cls += " wrong";
        } else if (p.selected[key]) {
          cls += " selected";
        }
        html +=
          '<div class="' +
          cls +
          '" data-act="pickOpt" data-key="' +
          key +
          '">' +
          '<span class="key">' +
          key +
          '</span><span class="txt">' +
          optContentHtml(q, i, opt) +
          "</span></div>";
      });
      html += "</div>";
      if (multi && !p.answered)
        html += '<p class="muted">本题为多选题，可多选</p>';
    }
    if (!p.answered) {
      html +=
        '<button class="btn mt12" data-act="submitAnswer">提交答案</button>';
    }
    html += "</div>";

    if (p.answered) {
      var correct = isCorrect(p.selected, q.answer);
      html += '<div class="result-box">';
      html +=
        '<div class="result-banner ' +
        (correct ? "right" : "wrong") +
        '">' +
        (correct ? "回答正确" : "回答错误") +
        "</div>";
      html += '<div class="card" style="margin-top:12px">';
      html +=
        '<div class="detail-block"><div class="lb">正确答案</div><div class="val"><span class="answer-pill">' +
        esc(q.answer) +
        "</span></div></div>";
      if (q.wrongThinking) {
        html +=
          '<div class="think-box"><div class="lb">回顾：你当时的错误思路</div>' +
          esc(q.wrongThinking) +
          "</div>";
      }
      html += "</div>";

      var hist = q.reviewHistory || [];
      if (hist.length || q.correctThinking) {
        html += '<div class="card" style="margin-top:12px">';
        html +=
          '<div class="section-title" style="margin-top:0">历史复盘' +
          (hist.length ? "（" + hist.length + " 次）" : "") +
          "</div>";
        if (q.correctThinking) {
          html +=
            '<div class="think-box" style="margin-bottom:8px"><div class="lb">最近一次正确思路</div>' +
            esc(q.correctThinking) +
            "</div>";
        }
        if (hist.length) {
          html += hist
            .slice()
            .reverse()
            .map(function (h) {
              var c = h.correct === null ? "" : h.correct ? "答对" : "答错";
              var sc = h.score ? " · 得分 " + h.score : "";
              return (
                '<div style="padding:6px 0;border-bottom:1px solid #f0f0f0">' +
                '<div class="muted" style="font-size:12px">' +
                fmtDate(h.date) +
                (c ? " · " + c : "") +
                sc +
                "</div>" +
                (h.answer
                  ? '<div style="font-size:13px;white-space:pre-wrap;margin-top:4px">' +
                    esc(h.answer) +
                    "</div>"
                  : "") +
                "</div>"
              );
            })
            .join("");
        }
        html += "</div>";
      }

      html += '<div class="card">';
      html +=
        '<div class="field"><span class="label">' +
        (isShenlun
          ? "现在写下上次作答"
          : "现在写下正确思路（复盘的意义所在）") +
        "</span>" +
        '<textarea class="textarea" id="p-note" rows="' +
        (isShenlun ? "6" : "4") +
        '" placeholder="' +
        (isShenlun
          ? "写下你的申论作答内容"
          : "例如：这类题应先看提问方式，再定位原文，关键词是……") +
        '">' +
        esc(p.note) +
        "</textarea></div>";
      var retryDays = (state.settings && state.settings.retryDays) || 3;
      html +=
        '<label style="display:flex;align-items:center;gap:6px;font-size:14px;margin-bottom:12px;cursor:pointer">' +
        '<input type="checkbox" id="p-again"' +
        (p.again ? " checked" : "") +
        ">" +
        '<input type="number" id="p-retry-days" value="' +
        retryDays +
        '" min="1" max="365" oninput="var cb=document.getElementById(\'p-again\'); if(cb&&!cb.checked) cb.checked=true;" style="width:48px;text-align:center;font-size:14px;padding:2px 4px;border:1px solid #ddd;border-radius:4px;">' +
        " 天后再次复盘</label>";
      html += '<button class="btn" data-act="finishPractice">完成复盘</button>';
      html += "</div>";
      html += "</div>";
    }
    html += "</div>";
    html += "</div>";
    html += NS.scratch.renderScratch();
    return html;
  }

  function extractLetters(s) {
    var m = String(s || "")
      .toUpperCase()
      .match(/[A-F]/g);
    return m ? m : [];
  }
  function isCorrect(selected, answer) {
    var a = extractLetters(answer).sort().join("");
    var b = Object.keys(selected).sort().join("");
    return a !== "" && a === b;
  }

  function submitPractice() {
    var p = state.practice;
    var keys = Object.keys(p.selected);
    if (!keys.length) {
      toast("请先选择答案");
      return;
    }
    p.answered = true;
    var q = findQ(p.id);
    var correct = isCorrect(p.selected, q.answer);
    p.again = !correct;
    state.keepScroll = true;
    render();
  }

  function extractMaxChars(q) {
    var userMax = q && q.maxChars ? parseInt(q.maxChars, 10) : 0;
    if (userMax > 0) return userMax;
    var s = String((q && q.stem) || "");
    var m = s.match(/(?:不超过|不多于|在)\s*(\d+)\s*字/);
    if (m) return parseInt(m[1], 10);
    m = s.match(/(\d+)\s*字(?:以内|左右|左右为宜|以内为宜)/);
    if (m) return parseInt(m[1], 10);
    m = s.match(/(\d+)\s*(?:至|到|-)\s*(\d+)\s*字/);
    if (m) return parseInt(m[2], 10);
    m = s.match(/(\d{3,5})\s*字/);
    if (m) return parseInt(m[1], 10);
    return 1000;
  }

  function extractScore(q) {
    var userScore = q && q.maxScore ? parseInt(q.maxScore, 10) : 0;
    if (userScore > 0) return userScore;
    var s = String((q && q.stem) || "");
    var m = s.match(/[（(](\d+)分[）)]/);
    if (m) return parseInt(m[1], 10);
    m = s.match(/满分\s*(\d+)\s*分/);
    if (m) return parseInt(m[1], 10);
    m = s.match(/(\d+)\s*分(?![\d字])/);
    if (m) return parseInt(m[1], 10);
    return 0;
  }

  function captureShenlunInk() {
    var canvas = $("#shenlun-canvas");
    if (!canvas || canvas.width < 10 || canvas.height < 10) return null;
    var blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    var hasInk = false;
    try {
      var data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      for (var i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          hasInk = true;
          break;
        }
      }
    } catch (e) {
      hasInk = true;
    }
    if (!hasInk) return null;
    return canvas.toDataURL("image/png");
  }

  function generateFenbiAnswer(q) {
    var parts = [];
    parts.push("\u7c89\u7b14\u7533\u8bba\u7b54\u6848\u751f\u6210");
    parts.push("");
    if (q.stem) parts.push("\u3010\u9898\u76ee\u8981\u6c42\u3011\n" + q.stem);
    (q.materials || []).forEach(function (m, i) {
      if (!m || !(m.content || "").trim()) return;
      parts.push(
        "\u3010\u6750\u6599" +
          (i + 1) +
          (m.title ? " " + m.title : "") +
          "\u3011\n" +
          m.content,
      );
    });
    parts.push("");
    parts.push(
      "\u8bf7\u4ee5\u7c89\u7b14\u673a\u6784\u7684\u7b54\u9898\u98ce\u683c\uff0c\u5bf9\u8fd9\u9053\u7533\u8bba\u9898\u7ed9\u51fa\u5b8c\u6574\u7684\u53c2\u8003\u7b54\u6848\u3002\u4e0d\u8981\u4f7f\u7528Markdown\u683c\u5f0f\u7b26\u53f7\u3002",
    );
    parts.push("");
    parts.push("\u8f93\u51fa\u683c\u5f0f\uff1a");
    parts.push("\u3010\u53c2\u8003\u7b54\u6848\u3011");
    parts.push(
      "\uff08\u7ed9\u51fa\u5b8c\u6574\u7684\u53c2\u8003\u7b54\u6848\u6587\u672c\uff0c300\u5b57\u4ee5\u4e0a\uff0c\u5206\u6761\u5217\u70b9\uff0c\u6bcf\u6761\u8981\u6709\u5b8c\u6574\u7684\u8868\u8ff0\uff09",
    );
    parts.push("");
    parts.push("\u3010\u7b54\u9898\u601d\u8def\u3011");
    parts.push(
      "\uff081-2\u53e5\u8bf4\u660e\u7c89\u7b14\u7684\u6838\u5fc3\u89e3\u9898\u8def\u5f84\uff09",
    );
    parts.push("");
    parts.push("\u3010\u5f97\u5206\u8981\u70b9\u3011");
    parts.push(
      "\uff08\u9010\u6761\u8bf4\u660e\u6bcf\u4e2a\u8981\u70b9\u5bf9\u5e94\u7684\u6750\u6599\u5173\u952e\u8bcd\uff0c\u8bf4\u660e\u91c7\u5206\u4f9d\u636e\uff09",
    );
    return zhipuChat(
      [
        {
          role: "system",
          content:
            "\u4f60\u662f\u4e00\u4f4d\u8d44\u6df1\u516c\u52a1\u5458\u8003\u8bd5\u7533\u8bba\u8bb2\u5e08\uff0c\u7cbe\u901a\u7c89\u7b14\u673a\u6784\u7684\u7b54\u9898\u4f53\u7cfb\u4e0e\u8bc4\u5206\u6807\u51c6\u3002\u8bf7\u7528\u7b80\u4f53\u4e2d\u6587\u4f5c\u7b54\uff0c\u4e0d\u8981\u4f7f\u7528Markdown\u3002",
        },
        { role: "user", content: parts.join("\n") },
      ],
      2048,
      60000,
    ).then(function (txt) {
      var match = txt.match(
        /\u3010\u53c2\u8003\u7b54\u6848\u3011\s*([\s\S]*?)\s*\u3010\u7b54\u9898\u601d\u8def/,
      );
      var answer = match ? match[1].trim() : txt.slice(0, 1500);
      var q2 = findQ(q.id);
      if (q2) {
        q2.fenbiAnswer = answer;
        save();
      }
      return answer;
    });
  }

  function scoreShenlunAnswer(q, userAnswer) {
    var compareData = state.compareCache[q.id] || {};
    var singleAnswers = compareData.single || {};
    var parts = ["【申论题目】"];
    parts.push("题目来源：" + (q.source || "未知"));
    parts.push("题型分类：" + (q.subCategory || "申论"));
    if (q.stem) parts.push("【题目要求】\n" + q.stem);
    (q.materials || []).forEach(function (m, i) {
      if (!m || !(m.content || "").trim()) return;
      parts.push(
        "【材料" +
          (i + 1) +
          (m.title ? " " + m.title : "") +
          "】\n" +
          m.content,
      );
    });
    parts.push("");
    parts.push("【机构参考答案】");
    COMPARE_INSTS.forEach(function (inst) {
      if (singleAnswers[inst.key]) {
        parts.push(
          inst.name +
            "：" +
            singleAnswers[inst.key].replace(/<[^>]+>/g, "").slice(0, 800),
        );
      }
    });
    parts.push("");
    parts.push("【考生作答】");
    parts.push(userAnswer);
    parts.push("");
    parts.push(
      "\u8bf7\u4f60\u4ee5\u8d44\u6df1\u7533\u8bba\u9605\u5377\u4e13\u5bb6\u8eab\u4efd\uff0c\u7efc\u5408\u56db\u5bb6\u673a\u6784\u7684\u53c2\u8003\u7b54\u6848\uff0c\u5bf9\u8003\u751f\u4f5c\u7b54\u8fdb\u884c\u8bc4\u5206\u3002\u4e25\u683c\u6309\u7167\u4ee5\u4e0b\u8bc4\u5206\u6807\u51c6\u548c\u683c\u5f0f\u8f93\u51fa\uff0c\u4e0d\u8981\u4f7f\u7528Markdown\uff1a",
    );
    parts.push("");
    var fullScore = extractScore(q);
    var maxChars = extractMaxChars(q);
    var scoreBase = fullScore > 0 ? fullScore : 100;
    var sContent = Math.round(scoreBase * 0.4);
    var sStructure = Math.round(scoreBase * 0.2);
    var sExpression = Math.round(scoreBase * 0.3);
    var sFormat = scoreBase - sContent - sStructure - sExpression;
    parts.push(
      "\u5b57\u6570\u9650\u5236\uff1a" +
        maxChars +
        "\u5b57\u3002\u672c\u9898\u6ee1\u5206\uff1a" +
        scoreBase +
        "\u5206\u3002",
    );
    parts.push("");
    parts.push(
      "\u8bc4\u5206\u6807\u51c6\uff08\u6309\u4ee5\u4e0b\u56db\u4e2a\u7ef4\u5ea6\u5206\u522b\u6253\u5206\uff0c\u6700\u540e\u52a0\u603b\uff09\uff1a",
    );
    parts.push("");
    parts.push(
      "\u4e00\u3001\u5185\u5bb9\u8d28\u91cf\uff08" + sContent + "\u5206\uff09",
    );
    parts.push(
      "  \u8bba\u70b9\u660e\u786e\u6027\uff1a\u8bba\u70b9\u9c9c\u660e\uff0c\u4e2d\u5fc3\u601d\u60f3\u7a81\u51fa\uff0c\u80fd\u76f4\u63a5\u56de\u5e94\u9898\u76ee\u8981\u6c42\u3002",
    );
    parts.push(
      "  \u8bba\u636e\u5145\u5206\u6027\uff1a\u8bba\u636e\u4e30\u5bcc\u591a\u6837\uff0c\u5305\u62ec\u4e8b\u5b9e\u4f9d\u636e\u3001\u7406\u8bba\u4f9d\u636e\u7b49\uff0c\u80fd\u6709\u6548\u652f\u6301\u8bba\u70b9\u3002",
    );
    parts.push(
      "  \u5206\u6790\u6df1\u5ea6\uff1a\u5206\u6790\u95ee\u9898\u5168\u9762\u6df1\u5165\uff0c\u80fd\u63ed\u793a\u95ee\u9898\u672c\u8d28\uff0c\u63d0\u51fa\u6709\u9488\u5bf9\u6027\u7684\u89e3\u51b3\u7b56\u7565\u3002",
    );
    parts.push(
      "  \u521b\u65b0\u6027\uff1a\u5728\u4fdd\u6301\u57fa\u672c\u89c2\u70b9\u6b63\u786e\u7684\u524d\u63d0\u4e0b\uff0c\u80fd\u63d0\u51fa\u65b0\u9896\u72ec\u5230\u7684\u89c1\u89e3\u6216\u89e3\u51b3\u65b9\u6848\u3002",
    );
    parts.push("");
    parts.push(
      "\u4e8c\u3001\u7ed3\u6784\u5e03\u5c40\uff08" +
        sStructure +
        "\u5206\uff09",
    );
    parts.push(
      "  \u5f00\u5934\u7ed3\u5c3e\uff1a\u5f00\u5934\u7b80\u6d01\u660e\u4e86\uff0c\u5feb\u901f\u5f15\u5165\u4e3b\u9898\uff1b\u7ed3\u5c3e\u603b\u7ed3\u6709\u529b\uff0c\u5347\u534e\u4e3b\u9898\u3002",
    );
    parts.push(
      "  \u6bb5\u843d\u5212\u5206\uff1a\u6bb5\u843d\u5b89\u6392\u5408\u7406\uff0c\u5c42\u6b21\u5206\u660e\uff0c\u8fc7\u6e21\u81ea\u7136\u6d41\u7545\u3002",
    );
    parts.push(
      "  \u903b\u8f91\u8fde\u8d2f\u6027\uff1a\u6574\u4f53\u601d\u8def\u6e05\u6670\uff0c\u5404\u90e8\u5206\u4e4b\u95f4\u903b\u8f91\u5173\u7cfb\u7d27\u5bc6\uff0c\u65e0\u8df3\u8dc3\u73b0\u8c61\u3002",
    );
    parts.push(
      "  \u91cd\u70b9\u7a81\u51fa\uff1a\u80fd\u591f\u51c6\u786e\u628a\u63e1\u5e76\u7a81\u51fa\u6587\u7ae0\u7684\u91cd\u70b9\u90e8\u5206\u3002",
    );
    parts.push("");
    parts.push(
      "\u4e09\u3001\u8bed\u8a00\u8868\u8fbe\uff08" +
        sExpression +
        "\u5206\uff09",
    );
    parts.push(
      "  \u51c6\u786e\u6027\uff1a\u7528\u8bcd\u7cbe\u51c6\uff0c\u8868\u8fbe\u65e0\u8bef\uff0c\u7b26\u5408\u8bed\u5883\u8981\u6c42\u3002",
    );
    parts.push(
      "  \u6d41\u7545\u5ea6\uff1a\u53e5\u5b50\u901a\u987a\uff0c\u886c\u63a5\u81ea\u7136\uff0c\u8bfb\u8d77\u6765\u6717\u6717\u4e0a\u53e3\u3002",
    );
    parts.push(
      "  \u89c4\u8303\u6027\uff1a\u9075\u5faa\u6c49\u8bed\u8bed\u6cd5\u89c4\u5219\uff0c\u907f\u514d\u9519\u522b\u5b57\u548c\u75c5\u53e5\u3002",
    );
    parts.push(
      "  \u6587\u91c7\u4e0e\u98ce\u683c\uff1a\u9002\u5f53\u8fd0\u7528\u4fee\u8f9e\u624b\u6cd5\uff0c\u63d0\u5347\u6587\u7ae0\u7684\u6587\u5b66\u6027\u548c\u53ef\u8bfb\u6027\u3002",
    );
    parts.push("");
    parts.push(
      "\u56db\u3001\u5377\u9762\u4e0e\u683c\u5f0f\uff08" +
        sFormat +
        "\u5206\uff09",
    );
    parts.push(
      "  \u5377\u9762\u6574\u6d01\uff1a\u5b57\u8ff9\u5de5\u6574\u6e05\u6670\uff0c\u65e0\u660e\u663e\u6d82\u6539\u75d5\u8ff9\uff08\u7535\u5b50\u4f5c\u7b54\u53ef\u915e\u60c5\u6b64\u9879\u6ee1\u5206\uff09\u3002",
    );
    parts.push(
      "  \u683c\u5f0f\u89c4\u8303\uff1a\u6807\u9898\u3001\u6bb5\u843d\u3001\u6807\u70b9\u7b26\u53f7\u7b49\u683c\u5f0f\u7b26\u5408\u8981\u6c42\uff0c\u6392\u7248\u6574\u9f50\u7f8e\u89c2\u3002",
    );
    parts.push("");
    parts.push(
      "\u82e5\u4f5c\u7b54\u4e3a\u91cd\u590d\u65e0\u610f\u4e49\u6587\u5b57\u3001\u4e71\u7801\u6216\u65e0\u5b9e\u8d28\u5185\u5bb9\uff0c\u56db\u4e2a\u7ef4\u5ea6\u5747\u7ed90\u5206\u3002",
    );
    parts.push("");
    parts.push(
      "\u8bf7\u6309\u7167\u4ee5\u4e0b\u683c\u5f0f\u8f93\u51fa\uff08\u4e0d\u8981\u4f7f\u7528Markdown\uff09\uff1a",
    );
    parts.push("");
    parts.push(
      "\u3010\u5185\u5bb9\u8d28\u91cf\u3011X/" +
        sContent +
        "\uff08\u5206\u522b\u5217\u51fa\u8bba\u70b9\u660e\u786e\u6027\u3001\u8bba\u636e\u5145\u5206\u6027\u3001\u5206\u6790\u6df1\u5ea6\u3001\u521b\u65b0\u6027\u56db\u9879\u5f97\u5206\uff09",
    );
    parts.push(
      "\u3010\u7ed3\u6784\u5e03\u5c40\u3011X/" +
        sStructure +
        "\uff08\u5206\u522b\u5217\u51fa\u5f00\u5934\u7ed3\u5c3e\u3001\u6bb5\u843d\u5212\u5206\u3001\u903b\u8f91\u8fde\u8d2f\u6027\u3001\u91cd\u70b9\u7a81\u51fa\u56db\u9879\u5f97\u5206\uff09",
    );
    parts.push(
      "\u3010\u8bed\u8a00\u8868\u8fbe\u3011X/" +
        sExpression +
        "\uff08\u5206\u522b\u5217\u51fa\u51c6\u786e\u6027\u3001\u6d41\u7545\u5ea6\u3001\u89c4\u8303\u6027\u3001\u6587\u91c7\u4e0e\u98ce\u683c\u56db\u9879\u5f97\u5206\uff09",
    );
    parts.push(
      "\u3010\u5377\u9762\u683c\u5f0f\u3011X/" +
        sFormat +
        "\uff08\u5206\u522b\u5217\u51fa\u5377\u9762\u6574\u6d01\u3001\u683c\u5f0f\u89c4\u8303\u4e24\u9879\u5f97\u5206\uff09",
    );
    parts.push("\u3010\u603b\u5206\u3011X/" + scoreBase);
    parts.push("");
    parts.push(
      "\u3010\u70b9\u8bc4\u3011200\u5b57\u4ee5\u5185\uff0c\u4ece\u56db\u4e2a\u7ef4\u5ea6\u7efc\u5408\u70b9\u8bc4\uff0c\u6307\u51fa\u4e3b\u8981\u5f97\u5206\u70b9\u548c\u6263\u5206\u539f\u56e0\u3002",
    );
    parts.push("");
    parts.push(
      "\u3010\u8981\u70b9\u7f3a\u6f0f\u3011\u6307\u51fa\u8003\u751f\u4f5c\u7b54\u4e2d\u7f3a\u5c11\u7684\u5173\u952e\u8981\u70b9\uff0850\u5b57\u4ee5\u5185\uff09\u3002",
    );
    parts.push("");
    parts.push(
      "\u3010\u4f5c\u7b54\u4f18\u70b9\u3011\u80af\u5b9a\u8003\u751f\u4f5c\u7b54\u4e2d\u7684\u4f18\u70b9\uff0830\u5b57\u4ee5\u5185\uff09\u3002",
    );
    parts.push("");
    parts.push(
      "\u3010\u975e\u6750\u6599\u5185\u5bb9\u3011\u5224\u65ad\u8003\u751f\u4f5c\u7b54\u4e2d\u662f\u5426\u6709\u4e0d\u7b26\u5408\u6750\u6599\u7684\u5185\u5bb9\uff0c\u7b80\u8ff0\u5224\u65ad\u7ed3\u679c\uff0830\u5b57\u4ee5\u5185\uff09\u3002",
    );
    parts.push("");
    parts.push(
      "\u3010\u8868\u8fbe\u4fee\u6b63\u3011\u6307\u51fa\u8003\u751f\u4f5c\u7b54\u4e2d\u8868\u8fbe\u4e0d\u51c6\u786e\u3001\u4e0d\u89c4\u8303\u7684\u90e8\u5206\u5e76\u7ed9\u51fa\u51c6\u786e\u5199\u6cd5\u3002\u683c\u5f0f\uff1a\u201c\u539f\u6587\uff1aXXX \u2192 \u4fee\u6b63\uff1aXXX\u201d\uff0c\u6bcf\u5904\u4e00\u884c\uff0c\u6700\u591a3\u5904\u3002\u539f\u6587\u5fc5\u987b\u9010\u5b57\u5f15\u7528\u8003\u751f\u4f5c\u7b54\u4e2d\u5b9e\u9645\u5b58\u5728\u7684\u6587\u5b57\uff0c\u4e25\u7981\u7f16\u9020\uff1b\u82e5\u65e0\u660e\u663e\u95ee\u9898\uff0c\u76f4\u63a5\u8f93\u51fa\u201c\u65e0\u201d\u3002",
    );
    return zhipuChat(
      [
        {
          role: "system",
          content:
            "你是一位资深公务员考试申论阅卷专家，精通各家培训机构的答题体系与评分标准。请用简体中文作答，不要使用Markdown格式。",
        },
        { role: "user", content: parts.join("\n") },
      ],
      1024,
      60000,
    ).then(function (txt) {
      var totalMatch = txt.match(
        /\u3010\u603b\u5206\u3011\s*(\d+)\s*\/\s*(\d+)/,
      );
      var score = totalMatch ? totalMatch[1] + "/" + totalMatch[2] : "";
      if (!score) {
        var oldMatch = txt.match(
          /\u3010\u5206\u6570\u3011\s*([\d]+\s*\/\s*[\d]+|[\d]+\s*%|[\d]+\s*\u5206)/,
        );
        score = oldMatch ? oldMatch[1].replace(/\s/g, "") : "";
      }
      var catMatch = function (label) {
        var re = new RegExp(
          "\u3010" + label + "\u3011\\s*(\\d+)\\s*/\\s*(\\d+)",
        );
        var m = txt.match(re);
        return m ? m[1] + "/" + m[2] : "";
      };
      var scoreDetail = {
        content: catMatch("\u5185\u5bb9\u8d28\u91cf"),
        structure: catMatch("\u7ed3\u6784\u5e03\u5c40"),
        expression: catMatch("\u8bed\u8a00\u8868\u8fbe"),
        format: catMatch("\u5377\u9762\u683c\u5f0f"),
      };
      var commentMatch = txt.match(
        /\u3010\u70b9\u8bc4\u3011\s*([\s\S]*?)\s*\u3010(?:\u8981\u70b9\u7f3a\u6f0f|\u975e\u6750\u6599)/,
      );
      var comment = commentMatch ? commentMatch[1].trim().slice(0, 300) : "";
      var missingMatch = txt.match(
        /\u3010\u8981\u70b9\u7f3a\u6f0f\u3011\s*([\s\S]*?)\s*\u3010[\u4e00-\u9fa5]+?\u3011/,
      );
      var missing = missingMatch ? missingMatch[1].trim().slice(0, 200) : "";
      var strengthMatch = txt.match(
        /\u3010\u4f5c\u7b54\u4f18\u70b9\u3011\s*([\s\S]*?)\s*\u3010\u975e\u6750\u6599/,
      );
      var strength = strengthMatch ? strengthMatch[1].trim().slice(0, 150) : "";
      var nonMaterialMatch = txt.match(
        /\u3010\u975e\u6750\u6599\u5185\u5bb9\u3011\s*([\s\S]*?)\s*\u3010\u8868\u8fbe\u4fee\u6b63\u3011/,
      );
      var nonMaterial = nonMaterialMatch
        ? nonMaterialMatch[1].trim().slice(0, 150)
        : "";
      var exprFixMatch = txt.match(
        /\u3010\u8868\u8fbe\u4fee\u6b63\u3011\s*([\s\S]*)/,
      );
      var exprFix = exprFixMatch ? exprFixMatch[1].trim().slice(0, 300) : "";
      var ansLen = (userAnswer || "").replace(/\s+/g, "").length;
      var uniqueChars = new Set((userAnswer || "").replace(/\s+/g, "")).size;
      var isLowQuality =
        ansLen < 30 ||
        uniqueChars < 5 ||
        (ansLen > 0 && uniqueChars / ansLen < 0.25);
      if (isLowQuality) {
        score = "0/" + scoreBase;
        scoreDetail = {
          content: "0/" + Math.round(scoreBase * 0.4),
          structure: "0/" + Math.round(scoreBase * 0.2),
          expression: "0/" + Math.round(scoreBase * 0.3),
          format:
            "0/" +
            (scoreBase -
              Math.round(scoreBase * 0.4) -
              Math.round(scoreBase * 0.2) -
              Math.round(scoreBase * 0.3)),
        };
        comment =
          "\u4f5c\u7b54\u65e0\u5b9e\u8d28\u5185\u5bb9\uff08\u91cd\u590d\u6216\u4e71\u7801\u6587\u5b57\uff09\uff0c\u65e0\u6cd5\u8bc4\u5206\u3002\u8bf7\u8ba4\u771f\u9605\u8bfb\u6750\u6599\u540e\u91cd\u65b0\u4f5c\u7b54\u3002";
        missing = "";
        strength = "";
        nonMaterial = "";
        exprFix = "";
      } else if (maxChars > 0 && ansLen > maxChars) {
        var overRatio = (ansLen - maxChars) / maxChars;
        var penalty =
          overRatio <= 0.1
            ? 1
            : overRatio <= 0.2
              ? 2
              : overRatio <= 0.5
                ? 3
                : 5;
        var numMatch2 = String(score).match(/^(\d+)\s*\/\s*(\d+)/);
        if (numMatch2) {
          var cur = parseInt(numMatch2[1], 10);
          var tot = parseInt(numMatch2[2], 10);
          var newScore = Math.max(0, cur - penalty);
          score = newScore + "/" + tot;
        }
      }
      if (exprFix) {
        exprFix = exprFix
          .split(/\r?\n/)
          .filter(function (l) {
            var orig = l.match(/原文\s*[:：]\s*(.*?)\s*→/);
            if (!orig) return true;
            var o = (orig[1] || "").replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
            var a = (userAnswer || "").replace(
              /[^\u4e00-\u9fa5a-zA-Z0-9]/g,
              "",
            );
            if (!o) return false;
            if (o.length <= 1) return false;
            return a.indexOf(o) > -1;
          })
          .join("\n")
          .slice(0, 300);
      }
      return {
        score: score,
        scoreDetail: scoreDetail,
        comment: comment,
        missing: missing,
        strength: strength,
        nonMaterial: nonMaterial,
        exprFix: exprFix,
      };
    });
  }

  function snooze(id) {
    var q = findQ(id);
    if (!q) return;
    q.reviewDate = q.reviewWeekday
      ? nextWeekdayDate(todayStr(), q.reviewWeekday)
      : addDays(todayStr(), 3);
    q.updatedAt = Date.now();
    save();
    render();
    toast(
      q.reviewWeekday ? "已推迟到" + wdLabel(q.reviewWeekday) : "已推迟 3 天",
    );
  }

  function reactivate(id) {
    var q = findQ(id);
    if (!q) return;
    q.status = "pending";
    q.reviewDate = q.reviewWeekday
      ? nextWeekdayDate(todayStr(), q.reviewWeekday)
      : addDays(todayStr(), 1);
    q.updatedAt = Date.now();
    save();
    render();
    toast(
      q.reviewWeekday
        ? "已重新加入复盘计划（每周" + wdLabel(q.reviewWeekday) + "）"
        : "已重新加入复盘计划（明天）",
    );
  }

  function finishPractice() {
    var p = state.practice;
    if (!p) return;
    var q = findQ(p.id);
    if (!q) { state.overlay = null; render(); return; }
    var retryInput = document.getElementById("p-retry-days");
    var retryDays = retryInput ? parseInt(retryInput.value, 10) : 3;
    if (!retryDays || retryDays < 1) retryDays = 3;
    var againCb = document.getElementById("p-again");
    var again = againCb ? againCb.checked : p.again;
    if (again) {
      q.status = "pending";
      q.reviewDate = addDays(todayStr(), retryDays);
      q.reviewWeekday = 0;
    } else {
      q.status = "done";
    }
    if (!q.reviewHistory) q.reviewHistory = [];
    var noteInput = document.getElementById("p-note");
    var note = noteInput ? noteInput.value.trim() : "";
    if (q.category === "申论") {
      var inkData = captureShenlunInk();
      if (inkData) {
        if (!q.reviewInk) q.reviewInk = [];
        q.reviewInk.push({ ink: inkData, date: todayStr() });
      }
      if (note) {
        state.shenlunScoring = true;
        render();
        scoreShenlunAnswer(q, note).then(function (result) {
          state.shenlunScoring = false;
          var score = result && result.score ? result.score : "";
          q.reviewHistory.push({ date: todayStr(), correct: null, answer: note, score: score, aiResult: result || null });
          q.rounds = (q.rounds || 0) + 1;
          q.updatedAt = Date.now();
          save();
          state.practice = null;
          state.overlay = { type: "detail", id: p.id };
          render();
          toast("AI 评分完成：" + (score || "已评分"));
        }).catch(function () {
          state.shenlunScoring = false;
          var simpleParts = ["【申论题目】"];
          simpleParts.push("题目来源：" + (q.source || "未知"));
          if (q.stem) simpleParts.push("【题目要求】\n" + q.stem);
          (q.materials || []).forEach(function (m, i) {
            if (!m || !(m.content || "").trim()) return;
            simpleParts.push("【材料" + (i + 1) + "】\n" + m.content);
          });
          simpleParts.push("【考生作答】");
          simpleParts.push(note);
          simpleParts.push("\n请简要评分，输出格式：【总分】X/X");
          zhipuChat([{ role: "system", content: "你是申论阅卷专家。" }, { role: "user", content: simpleParts.join("\n") }], 512, 30000).then(function (txt) {
            var m2 = (txt || "").match(/(\d+)\s*\/\s*(\d+)/);
            var score2 = m2 ? m2[1] + "/" + m2[2] : "";
            q.reviewHistory.push({ date: todayStr(), correct: null, answer: note, score: score2, aiResult: txt });
            q.rounds = (q.rounds || 0) + 1;
            q.updatedAt = Date.now();
            save();
            state.practice = null;
            state.overlay = { type: "detail", id: p.id };
            render();
            toast("AI 评分完成：" + (score2 || "已评分"));
          }).catch(function () {
            q.reviewHistory.push({ date: todayStr(), correct: null, answer: note, score: "" });
            q.rounds = (q.rounds || 0) + 1;
            q.updatedAt = Date.now();
            save();
            state.practice = null;
            state.overlay = { type: "detail", id: p.id };
            render();
            toast("AI 评分失败，已记录复盘");
          });
        });
        return;
      }
      q.reviewHistory.push({ date: todayStr(), correct: null, answer: note, score: "" });
    } else {
      q.reviewHistory.push({ date: todayStr(), correct: !!p.again === false, answer: note });
    }
    q.rounds = (q.rounds || 0) + 1;
    q.updatedAt = Date.now();
    save();
    state.practice = null;
    state.overlay = { type: "detail", id: p.id };
    render();
    toast(again ? retryDays + " 天后再次复盘" : "已完成复盘");
  }

  async function del(id) {
    var q = findQ(id);
    if (!q) return;
    var ok = await confirmDialog(
      "删除错题",
      "确定删除这道错题吗？删除后不可恢复。",
      "删除",
      true,
    );
    if (!ok) return;
    state.questions = state.questions.filter(function (x) {
      return x.id !== id;
    });
    delete state.imgDirty[id];
    storageDel(imgKey(id));
    save();
    state.overlay = null;
    render();
    toast("已删除");
  }

  function parseOcrText(text) {
    var lines = String(text || "")
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    var result = { stem: "", options: [], answer: "", category: "", subCategory: "" };
    var raw = String(text || "").trim();

    // 提取JSON：找到第一个{和最后一个}之间的内容
    function extractJson(str) {
      var start = str.indexOf('{');
      var end = str.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      return str.substring(start, end + 1);
    }

    // 修复被截断的JSON
    function fixTruncatedJson(str) {
      var fixed = str;
      // 移除末尾不完整的值
      fixed = fixed.replace(/,\s*$/, '');
      fixed = fixed.replace(/:\s*"[^"]*$/, ':""');
      fixed = fixed.replace(/:\s*$/, ':""');
      // 补全括号
      var openB = (fixed.match(/{/g) || []).length;
      var closeB = (fixed.match(/}/g) || []).length;
      var openS = (fixed.match(/\[/g) || []).length;
      var closeS = (fixed.match(/]/g) || []).length;
      for (var i = 0; i < openS - closeS; i++) fixed += ']';
      for (var i = 0; i < openB - closeB; i++) fixed += '}';
      return fixed;
    }

    // 尝试解析JSON
    function tryParseJson(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        var fixed = fixTruncatedJson(str);
        try {
          return JSON.parse(fixed);
        } catch (e2) {
          return null;
        }
      }
    }

    // 从原始文本提取JSON（忽略markdown包裹）
    var jsonStr = extractJson(raw);
    if (jsonStr) {
      var j = tryParseJson(jsonStr);
      if (j) {
        if (j.category) result.category = j.category;
        if (j.subCategory) result.subCategory = j.subCategory;
        if (j.stem) result.stem = j.stem;
        if (j.answer) result.answer = String(j.answer).charAt(0).toUpperCase();
        if (Array.isArray(j.options) && j.options.length >= 2) {
          result.options = j.options.map(function (o) { return String(o).trim(); });
        }
        if (result.stem) return result;
      }
    }
    var optionReStrict = /^([A-F])\s*[.、．)）:：]\s*(.+)$/;
    var optionReNoSep = /^([A-F])\s+(.+)$/;
    var optionReLoose = /([A-F])\s*[.、．)）:：]\s*(.+)$/;
    var answerRe =
      /(?:正\s*确|参\s*考|标\s*准|应\s*选|应\s*该|选\s*择)?\s*答[案秦窒]\s*(?:是|为|[:：])?\s*([A-F])|(?:正\s*确|应\s*选)\s*(?:选\s*项|答[案秦窒])?\s*(?:是|为|[:：])?\s*([A-F])|(?:选|选择|选中)\s*([A-F])(?:\s|$)/;
    var stemLines = [];
    var optionLines = [];
    var inOptions = false;

    lines.forEach(function (line) {
      if (!result.answer) {
        var am = line.match(answerRe);
        if (am) {
          result.answer = am[1] || am[2] || am[3];
          line = line.replace(answerRe, "").trim();
        }
      }
      var m = line.match(optionReStrict) || line.match(optionReNoSep);
      if (m) {
        inOptions = true;
        optionLines.push({ key: m[1], text: m[2] });
        return;
      }
      if (!inOptions) {
        stemLines.push(line);
        return;
      }
      var lm = line.match(optionReLoose);
      if (
        lm &&
        optionLines.length &&
        lm[1] > optionLines[optionLines.length - 1].key
      ) {
        optionLines.push({ key: lm[1], text: lm[2] });
      } else if (optionLines.length) {
        optionLines[optionLines.length - 1].text += line;
      }
    });

    if (optionLines.length >= 2) {
      result.stem = stemLines.join("\n");
      result.options = optionLines.map(function (o) {
        return o.key + ". " + o.text;
      });
      if (!result.stem) result.stem = "（题干识别失败，请手动补充）";
    } else {
      result.stem = lines.join("\n");
    }
    return result;
  }

  function fuzzyMatchSubCategory(category, raw) {
    if (!raw || !category) return raw || '';
    var list = SUBCATEGORIES[category];
    if (!list) return raw;
    for (var i = 0; i < list.length; i++) {
      if (raw === list[i] || list[i].indexOf(raw) >= 0 || raw.indexOf(list[i]) >= 0) return list[i];
    }
    for (var i = 0; i < list.length; i++) {
      if (list[i].indexOf(raw.substring(0, 2)) >= 0 || raw.indexOf(list[i].substring(0, 2)) >= 0) return list[i];
    }
    return raw;
  }

  async function aiDetectBounds(dataUrl) {
    var img = await prepareOcrImage(dataUrl);
    var text = await zhipuVision(
      img,
      "识别截图中考试题目的精确边界。返回JSON（不要markdown包裹）：" +
        '{"x":0.0,"y":0.0,"w":1.0,"h":1.0}' +
        "其中x/y是题目区域左上角归一化坐标(0-1)，w/h是宽度和高度。" +
        "只框选题目文字和选项区域，排除状态栏、标题栏、导航栏等非题目内容。直接返回JSON。",
      256,
    );
    var stripped = String(text || "").trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      var j = JSON.parse(stripped);
      return {
        x: Math.max(0, Math.min(1, parseFloat(j.x) || 0)),
        y: Math.max(0, Math.min(1, parseFloat(j.y) || 0)),
        w: Math.max(0.1, Math.min(1, parseFloat(j.w) || 1)),
        h: Math.max(0.1, Math.min(1, parseFloat(j.h) || 1))
      };
    } catch (e) {
      return null;
    }
  }

  async function autoCropAndOcr(dataUrl) {
    var f = state.form;
    if (!f) return;
    state.ocrRunning = true;
    state.ocrProgress = 0;
    state.ocrStatus = "AI 定位题目范围…";
    render();
    try {
      var bounds = await aiDetectBounds(dataUrl);
      var cropped = dataUrl;
      if (bounds) {
        var img = new Image();
        await new Promise(function (resolve, reject) {
          img.onload = resolve;
          img.onerror = reject;
          img.src = dataUrl;
        });
        var sx = Math.round(bounds.x * img.naturalWidth);
        var sy = Math.round(bounds.y * img.naturalHeight);
        var sw = Math.max(1, Math.round(bounds.w * img.naturalWidth));
        var sh = Math.max(1, Math.round(bounds.h * img.naturalHeight));
        sx = Math.max(0, Math.min(sx, img.naturalWidth - 1));
        sy = Math.max(0, Math.min(sy, img.naturalHeight - 1));
        sw = Math.min(sw, img.naturalWidth - sx);
        sh = Math.min(sh, img.naturalHeight - sy);
        var canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        cropped = canvas.toDataURL('image/jpeg', 0.85);
      }
      f.image = cropped;
      state.ocrRunning = false;
      state.keepScroll = true;
      render();
    } catch (e) {
      state.ocrRunning = false;
      f.image = dataUrl;
      render();
      toast("自动裁剪失败，已使用原图：" + (e && e.message ? e.message : e));
    }
  }

  function ocrUpdate(status, progress) {
    state.ocrStatus = status;
    state.ocrProgress = progress || 0;
    var fill = $("#ocr-fill");
    var label = $("#ocr-status");
    if (fill) fill.style.width = Math.round((progress || 0) * 100) + "%";
    if (label) label.textContent = status;
  }

  async function runOcr() {
    var f = state.form;
    if (!f || !f.image) {
      toast("请先选择错题截图");
      return;
    }
    state.ocrRunning = true;
    state.ocrProgress = 0;
    state.ocrStatus = "正在识别题干与选项…";
    render();
    try {
      var img = await prepareOcrImage(f.image);
      ocrUpdate("AI 识别中…", 0.5);
      var text = await zhipuVision(
        img,
        "识别截图返回JSON（不要markdown包裹）：" +
          '{"category":"分类","subCategory":"子分类","stem":"完整题干(含文段和提问句)","options":["A.xx","B.xx"],"answer":"字母"}' +
          "stem必须包含：1.文段材料完整原文(不省略) 2.提问句如'下列说法符合这段文字的是'等。" +
          "分类：言语理解/政治理论/常识判断/判断推理/资料分析/数量关系/申论。答案：绿色标记选项。直接返回JSON。",
        1024,
      );
      if (!state.form || !state.overlay || state.overlay.type !== "form") {
        state.ocrRunning = false;
        return;
      }
      var parsed = parseOcrText(text);
      if (parsed.category && !f.category) f.category = parsed.category;
      if (parsed.subCategory && !f.subCategory) f.subCategory = fuzzyMatchSubCategory(parsed.category, parsed.subCategory);
      f.stem = parsed.stem || f.stem;
      if (parsed.options.length >= 2) {
        var oldImgs = f.optImgs || [];
        f.options = parsed.options;
        f.optImgs = parsed.options.map(function (_, idx) {
          return idx < oldImgs.length ? oldImgs[idx] : null;
        });
      }
      if (parsed.answer) f.answer = f.answer || parsed.answer;
      state.ocrRunning = false;
      state.keepScroll = true;
      render();
      var info = [];
      if (parsed.category) info.push(parsed.category + (parsed.subCategory ? '/' + parsed.subCategory : ''));
      if (parsed.options.length >= 2) info.push('已识别' + parsed.options.length + '个选项');
      if (parsed.answer) info.push('答案：' + parsed.answer);
      toast(info.length ? '识别完成：' + info.join('，') + '，请核对' : '识别完成，请核对内容');
    } catch (e) {
      state.ocrRunning = false;
      render();
      toast("识别失败：" + (e && e.message ? e.message : e));
    }
  }

  async function ocrExtractOptions(dataUrl) {
    var f = state.form;
    if (!f) return;
    state.ocrRunning = true;
    state.ocrProgress = 0;
    state.ocrStatus = "正在识别选项…";
    render();
    try {
      var img = await prepareOcrImage(dataUrl);
      ocrUpdate("AI 识别中…", 0.5);
      var text = await zhipuVision(
        img,
        "识别图片中的选项文字，每行一个，格式\"A. 内容\"。完整输出，不要解释。",
        1024,
      );
      if (!state.form || !state.overlay || state.overlay.type !== "form") {
        state.ocrRunning = false;
        return;
      }
      var parsed = parseOcrText(text);
      if (parsed.options.length >= 2) {
        var oldImgs = f.optImgs || [];
        f.options = parsed.options;
        f.optImgs = parsed.options.map(function (_, idx) {
          return idx < oldImgs.length ? oldImgs[idx] : null;
        });
        state.ocrRunning = false;
        state.keepScroll = true;
        render();
        toast("已提取 " + parsed.options.length + " 个选项，请核对");
      } else {
        state.ocrRunning = false;
        state.keepScroll = true;
        render();
        toast("未能识别出选项，请上传更清晰的截图");
      }
    } catch (e) {
      state.ocrRunning = false;
      render();
      toast("识别失败：" + (e && e.message ? e.message : e));
    }
  }

  function swipeDetailId(curId, dir) {
    var fromReview = state.tab === "review";
    var filterDone = state.filterDone || "all";
    var kw = String(state.search || "").trim();
    var queue = state.questions.filter(function (q) {
      if (q.id === curId) return true;
      if (fromReview) return q.status === "pending";
      if (filterDone === "undone" && q.status === "done") return false;
      if (filterDone === "done" && q.status !== "done") return false;
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
    });
    if (fromReview) {
      queue.sort(function (a, b) {
        var da = a.reviewDate || "9999-12-31",
          db = b.reviewDate || "9999-12-31";
        return da < db ? -1 : da > db ? 1 : 0;
      });
    } else {
      queue.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    }
    if (!queue.length) return "";
    var idx = -1;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].id === curId) {
        idx = i;
        break;
      }
    }
    if (idx === -1) return "";
    var n = dir === "prev" ? idx - 1 : idx + 1;
    if (n < 0 || n >= queue.length) return "";
    return queue[n].id;
  }

  // === 对外暴露 ===
  NS.detail = {
    openDetail: openDetail,
    optContentHtml: optContentHtml,
    shenlunBodyHtml: shenlunBodyHtml,
    renderDetail: renderDetail,
    openPractice: openPractice,
    renderPractice: renderPractice,
    extractLetters: extractLetters,
    isCorrect: isCorrect,
    extractMaxChars: extractMaxChars,
    extractScore: extractScore,
    captureShenlunInk: captureShenlunInk,
    generateFenbiAnswer: generateFenbiAnswer,
    scoreShenlunAnswer: scoreShenlunAnswer,
    snooze: snooze,
    reactivate: reactivate,
    parseOcrText: parseOcrText,
    ocrUpdate: ocrUpdate,
    swipeDetailId: swipeDetailId,
    submitPractice: submitPractice,
    finishPractice: finishPractice,
    del: del,
    runOcr: runOcr,
    ocrExtractOptions: ocrExtractOptions,
    autoCropAndOcr: autoCropAndOcr,
  };
})();
