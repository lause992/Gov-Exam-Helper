/* ===== modules/actions.js =====
 * 动作分发模块：全局 click 事件监听，根据 data-act 分发到各模块。
 * 加载时自动注册 document click 监听器。
 * 依赖：所有功能模块需先加载。
 */
(function () {
  "use strict";
  var NS = (window.XCAPP = window.XCAPP || {});
  var IS_NODE = NS.IS_NODE;

  // === 共享依赖别名 ===
  var $ = NS.utils.$,
    $all = NS.utils.$all,
    esc = NS.utils.esc;
  var toast = NS.utils.toast,
    confirmDialog = NS.utils.confirmDialog,
    uid = NS.utils.uid;
  var todayStr = NS.utils.todayStr,
    addDays = NS.utils.addDays,
    fmtDate = NS.utils.fmtDate;
  var wdLabel = NS.utils.wdLabel,
    pad = NS.utils.pad,
    fmtSize = NS.utils.fmtSize;
  var stripOptionPrefix = NS.utils.stripOptionPrefix;
  var nextWeekdayDate = NS.utils.nextWeekdayDate;
  var storageSet = NS.storage.set,
    storageGet = NS.storage.get,
    storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var isNative = NS.bridge.isNative,
    nativeCall = NS.bridge.call;
  var compressImage = NS.bridge.compressImage,
    prepareOcrImage = NS.bridge.prepareOcrImage;
  var state = NS.state;
  var CATEGORIES = NS.consts.CATEGORIES,
    SUBCATEGORIES = NS.consts.SUBCATEGORIES;
  var CAT_COLORS = NS.consts.CAT_COLORS,
    REVIEW_OPTIONS = NS.consts.REVIEW_OPTIONS;
  var optionLetters = NS.consts.optionLetters,
    STORAGE_KEY = NS.consts.STORAGE_KEY;
  var NAV_TABS = NS.consts.NAV_TABS,
    HOME_SUB_TABS = NS.consts.HOME_SUB_TABS,
    UNIT_LIST = NS.consts.UNIT_LIST;

  // === 模块特有常量 ===
  var FALLBACK_IDIOMS = (NS.idiom && NS.idiom.FALLBACK_IDIOMS) || [];
  var COMPARE_INSTS =
    (NS.shenlunCompare && NS.shenlunCompare.COMPARE_INSTS) || [];

  // === 存储函数 ===
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
    persistDirtyImages = NS.store.persistDirtyImages;

  // === 跨模块引用（运行时通过 NS 解析） ===
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
  function initFab() {
    return NS.home.initFab();
  }
  function qItemHtml(q, extra) {
    return NS.home.qItemHtml(q, extra);
  }
  function openDetail(id) {
    return NS.detail.openDetail(id);
  }
  function openPractice(id) {
    return NS.detail.openPractice(id);
  }
  function swipeDetailId(c, d) {
    return NS.detail.swipeDetailId(c, d);
  }
  function snooze(id) {
    return NS.detail.snooze(id);
  }
  function reactivate(id) {
    return NS.detail.reactivate(id);
  }
  function parseOcrText(t) {
    return NS.detail.parseOcrText(t);
  }
  function submitPractice() {
    return NS.detail.submitPractice();
  }
  function extractMaxChars(q) {
    return NS.detail.extractMaxChars(q);
  }
  function extractLetters(s) {
    return NS.detail.extractLetters(s);
  }
  function del(id) {
    return NS.detail.del(id);
  }
  function runOcr() {
    return NS.detail.runOcr();
  }
  function ocrExtractOptions(d) {
    return NS.detail.ocrExtractOptions(d);
  }
  function finishPractice() {
    return NS.detail.finishPractice();
  }
  function openForm(q) {
    return NS.form.openForm(q);
  }
  function freshForm(q) {
    return NS.form.freshForm(q);
  }
  function saveForm() {
    return NS.form.saveForm();
  }
  function formulaSave() {
    return NS.form.formulaSave();
  }
  function clearFormulaPad() {
    return NS.form.clearFormulaPad();
  }
  function initFormulaPad() {
    return NS.form.initFormulaPad();
  }
  function renderSettings() {
    return NS.form.renderSettings();
  }
  function openCrop(d, cb, t) {
    return NS.crop.openCrop(d, cb, t);
  }
  function closeCrop() {
    return NS.crop.closeCrop();
  }
  function cropConfirm() {
    return NS.crop.cropConfirm();
  }
  function startCalcTimer() {
    return NS.calc.startCalcTimer();
  }
  function stopCalcTimer() {
    return NS.calc.stopCalcTimer();
  }
  function generateCalcQuestion() {
    return NS.calc.generateCalcQuestion();
  }
  function fetchIdiom(w) {
    return NS.idiom.fetchIdiom(w);
  }
  function updateIdiomResultBox(m) {
    return NS.idiom.updateIdiomResultBox(m);
  }
  function updateProofreadBox(s, t) {
    return NS.idiom.updateProofreadBox(s, t);
  }
  function refreshIdiomSaveBtn() {
    return NS.idiom.refreshIdiomSaveBtn();
  }
  function updateIdiomSavedBox() {
    return NS.idiom.updateIdiomSavedBox();
  }
  function fetchAiAnswer(q, h) {
    return NS.ai.fetchAiAnswer(q, h);
  }
  function zhipuChat(m, t, tm) {
    return NS.ai.zhipuChat(m, t, tm);
  }
  function zhipuVision(d, p, m) {
    return NS.ai.zhipuVision(d, p, m);
  }
  function buildWrongBookSummary() {
    return NS.ai.buildWrongBookSummary();
  }
  function aiText(h, t) {
    return NS.ai.aiText(h, t);
  }
  function aiScrollBottom(m) {
    return NS.ai.aiScrollBottom(m);
  }
  function typeInto(el, t, d) {
    return NS.ai.typeInto(el, t, d);
  }
  function requestShenlunCompareOne(id, k) {
    return NS.shenlunCompare.requestShenlunCompareOne(id, k);
  }
  function requestShenlunCompareAll(id) {
    return NS.shenlunCompare.requestShenlunCompareAll(id);
  }
  function fetchNews() {
    return NS.news.fetchNews();
  }
  function fetchLeader() {
    return NS.news.fetchLeader();
  }
  function aiFilterNews(i) {
    return NS.news.aiFilterNews(i);
  }
  function aiSummarizeNews(i) {
    return NS.news.aiSummarizeNews(i);
  }
  function pickFile(k) {
    return NS.fileio.pickFile(k);
  }
  function pickImage(k) {
    return NS.fileio.pickImage(k);
  }
  function exportBackup() {
    return NS.fileio.exportBackup();
  }
  function importBackup() {
    return NS.fileio.importBackup();
  }
  function openSummaryJumpModal() {
    return NS.summary.openSummaryJumpModal();
  }
  function closeSummaryJumpModal() {
    return NS.summary.closeSummaryJumpModal();
  }
  function autoSaveSummaryCur() {
    return NS.summary.autoSaveSummaryCur();
  }
  function remoteVersionText() {
    return NS.summary.remoteVersionText();
  }
  function initSummary() {
    return NS.summary.initSummary();
  }
  function loadSummariesNow() {
    return NS.store.loadSummariesNow();
  }
  function initScratch() {
    return NS.scratch.initScratch();
  }

  // === 模块代码（从 app.js 第 4708-5854 行提取，保持原样） ===
  if (!IS_NODE)
    document.addEventListener("click", function (e) {
      var showBtn = e.target.closest("#detail-show-answer");
      if (showBtn) {
        var ans = $("#detail-answer");
        if (ans) {
          ans.style.display = "inline-block";
          showBtn.style.display = "none";
        }
        return;
      }
      var el = e.target.closest("[data-act]");
      if (!el) return;
      var act = el.getAttribute("data-act");
      var id = el.getAttribute("data-id");
      var cat = el.getAttribute("data-cat");
      var sub = el.getAttribute("data-sub");
      var key = el.getAttribute("data-key");
      var days = el.getAttribute("data-days");
      var kind = el.getAttribute("data-kind");
      var i = el.getAttribute("data-i");

      switch (act) {
        case "goHome":
          state.tab = "home";
          render();
          break;
        case "openAdd":
          openForm(null);
          render();
          break;
        case "switchTab":
          state.tab = key;
          render();
          break;
        case "queryIdiom":
          var idiomWord = $("#idiom-input")
            ? $("#idiom-input").value.trim()
            : "";
          if (!idiomWord) {
            toast("请输入词语或成语");
            return;
          }
          state.idiom.loading = true;
          state.idiom.result = null;
          state.idiom.proof = { loading: false, text: "" };
          updateIdiomResultBox("querying");
          fetchIdiom(idiomWord).then(function (res) {
            state.idiom.loading = false;
            state.idiom.result = res;
            updateIdiomResultBox(res);
          });
          break;
        case "randomIdiom":
          var rnd =
            FALLBACK_IDIOMS[Math.floor(Math.random() * FALLBACK_IDIOMS.length)];
          state.idiom.loading = true;
          state.idiom.result = null;
          state.idiom.proof = { loading: false, text: "" };
          updateIdiomResultBox("querying");
          fetchIdiom(rnd.name).then(function (res) {
            state.idiom.loading = false;
            state.idiom.result = res;
            updateIdiomResultBox(res);
          });
          break;
        case "proofreadMeaning":
          var pw = state.idiom.result ? state.idiom.result.name : "";
          var pm = $("#my-meaning") ? $("#my-meaning").value.trim() : "";
          if (!pm) {
            toast("请先写下你的释义");
            return;
          }
          state.idiom.proof.loading = true;
          state.idiom.proof.text = "";
          updateProofreadBox("loading");
          fetchAiAnswer(
            '请校对下面关于词语"' +
              pw +
              '"的理解是否正确。我的理解：' +
              pm +
              "。如果理解准确，请简要肯定；如果理解有偏差或不完整，请指出问题并给出正确的释义。请用中文简洁回答，200字以内。",
          )
            .then(function (txt) {
              state.idiom.proof.loading = false;
              state.idiom.proof.text = txt;
              updateProofreadBox("result", txt);
            })
            .catch(function (err) {
              state.idiom.proof.loading = false;
              updateProofreadBox(
                "error",
                (err && err.message) || "校对失败，请重试",
              );
            });
          break;
        case "saveIdiom":
          if (state.idiom.result) {
            var exists = state.idiom.saved.some(function (s) {
              return s.name === state.idiom.result.name;
            });
            if (!exists) {
              var src = state.idiom.result;
              var toSave = { name: src.name, meaning: src.meaning || "" };
              if (state.idiom.proof.text)
                toSave.meaning = state.idiom.proof.text;
              if (src.provenance) toSave.provenance = src.provenance;
              if (src.example) toSave.example = src.example;
              if (
                src.extra &&
                src.extra.discLines &&
                src.extra.discLines.length
              )
                toSave.discLines = src.extra.discLines.slice();
              var myMeanEl = $("#my-meaning");
              if (myMeanEl && myMeanEl.value.trim())
                toSave.myMeaning = myMeanEl.value.trim();
              state.idiom.saved.unshift(toSave);
              saveIdioms();
              toast("已收藏");
            }
            refreshIdiomSaveBtn();
            updateIdiomSavedBox();
          }
          break;
        case "unsaveIdiom":
          state.idiom.saved = state.idiom.saved.filter(function (s) {
            return s.name !== key;
          });
          saveIdioms();
          refreshIdiomSaveBtn();
          updateIdiomSavedBox();
          toast("已移除");
          break;
        case "openIdiomSaved":
          for (var si = 0; si < state.idiom.saved.length; si++) {
            if (state.idiom.saved[si].name === key) {
              var sv = state.idiom.saved[si];
              var recon = {
                name: sv.name,
                meaning: sv.meaning || "",
                extra: { type: "word" },
              };
              if (sv.myMeaning) recon.myMeaning = sv.myMeaning;
              if (sv.provenance) recon.provenance = sv.provenance;
              if (sv.example) recon.example = sv.example;
              if (sv.discLines && sv.discLines.length)
                recon.extra.discLines = sv.discLines;
              state.idiom.result = recon;
              state.idiom.proof = { loading: false, text: "" };
              updateIdiomResultBox(recon);
              var box = $("#idiom-result-box");
              if (box)
                box.scrollIntoView({ behavior: "smooth", block: "start" });
              toast("已显示详情");
            }
          }
          break;
        case "clearIdioms":
          confirmDialog(
            "清空收藏",
            "确定清空全部收藏的词语吗？此操作不可恢复。",
            "清空",
            true,
          ).then(function (ok) {
            if (ok) {
              state.idiom.saved = [];
              saveIdioms();
              refreshIdiomSaveBtn();
              updateIdiomSavedBox();
              toast("已清空");
            }
          });
          break;
        case "clearAiAnalysis":
          state.aiAnalysis = "";
          state.keepScroll = true;
          render();
          break;
        case "aiAnalyze":
          if (state.aiAnalyzing) return;
          if (!(state.questions || []).length) {
            toast("暂无错题数据，先去添加错题吧");
            return;
          }
          state.aiAnalyzing = true;
          state.keepScroll = true;
          render();
          var summary = buildWrongBookSummary();
          fetchAiAnswer(
            "请根据我的错题本数据，分析我的学习情况：指出薄弱环节（分类和子分类）、复盘进度的风险点（逾期/待复盘）、以及接下来的复习建议（哪些分类优先、每天怎么安排）。请用中文简洁回答，600字以内。\n\n【数据】\n" +
              summary,
            [],
          )
            .then(function (txt) {
              state.aiAnalyzing = false;
              state.aiAnalysis = txt;
              state.keepScroll = true;
              render();
            })
            .catch(function (err) {
              state.aiAnalyzing = false;
              state.keepScroll = true;
              render();
              toast("AI 分析失败：" + ((err && err.message) || "请重试"));
            });
          break;
        case "sendAiQuestion":
          var aiInputEl = $("#ai-input");
          var aiQ = aiInputEl ? aiInputEl.value.trim() : "";
          var aiImg = state.ai.pendingImg || "";
          if (!aiQ && !aiImg) {
            toast("请输入问题或上传图片");
            return;
          }
          if (state.ai.loading) return;
          state.ai.history.push({ role: "user", content: aiQ, img: aiImg });
          state.ai.loading = true;
          state.ai.pendingImg = "";
          saveAiHistory();
          if (aiInputEl) aiInputEl.value = "";
          state.ai.input = "";
          var msgs = $("#ai-msgs");
          if (msgs) {
            var userEl = document.createElement("div");
            userEl.className = "ai-msg user";
            if (aiImg) {
              var imgEl = document.createElement("img");
              imgEl.className = "ai-msg-img";
              imgEl.src = aiImg;
              imgEl.alt = "图片";
              userEl.appendChild(imgEl);
            }
            if (aiQ) userEl.innerHTML += aiText("", aiQ);
            msgs.appendChild(userEl);
            var typingEl = document.createElement("div");
            typingEl.className = "ai-msg bot typing";
            typingEl.innerHTML = "正在思考…";
            msgs.appendChild(typingEl);
            aiScrollBottom(msgs);
          }
          var aiRequest = aiImg
            ? zhipuVision(
                aiImg,
                (aiQ || "请分析这张图片").replace(/["\\]/g, " "),
                1024,
              )
            : fetchAiAnswer(aiQ, state.ai.history.slice(0, -1));
          aiRequest
            .then(function (answer) {
              state.ai.history.push({ role: "bot", content: answer });
              saveAiHistory();
              if (state.tab === "ai" && msgs) {
                typingEl.className = "ai-msg bot";
                typingEl.innerHTML = "";
                typeInto(typingEl, answer, function () {
                  state.ai.loading = false;
                  var sendBtn = document.querySelector(
                    '[data-act="sendAiQuestion"]',
                  );
                  if (sendBtn) sendBtn.disabled = false;
                  var imgBtn = document.querySelector(
                    '[data-act="pickAiImage"]',
                  );
                  if (imgBtn) imgBtn.disabled = false;
                  aiScrollBottom(msgs);
                });
              } else {
                state.ai.loading = false;
              }
            })
            .catch(function (err) {
              state.ai.history.push({
                role: "bot",
                content: "（" + err.message + "）",
              });
              state.ai.loading = false;
              saveAiHistory();
              if (state.tab === "ai" && msgs) {
                typingEl.className = "ai-msg bot";
                typingEl.innerHTML =
                  '<span class="muted">' + esc(err.message) + "</span>";
                aiScrollBottom(msgs);
              }
            });
          break;
        case "pickAiImage":
          pickImage("gallery")
            .then(function (dataUrl) {
              if (!dataUrl) return;
              return compressImage(dataUrl, 1800, 0.85).then(function (small) {
                state.ai.pendingImg = small;
                state.keepScroll = true;
                render();
                var amsgs = $("#ai-msgs");
                if (amsgs) aiScrollBottom(amsgs);
              });
            })
            .catch(function (err) {
              toast("图片上传失败：" + (err.message || err));
            });
          break;
        case "removeAiImage":
          state.ai.pendingImg = "";
          state.keepScroll = true;
          render();
          var amsgs2 = $("#ai-msgs");
          if (amsgs2) aiScrollBottom(amsgs2);
          break;
        case "clearAiHistory":
          confirmDialog(
            "清空对话",
            "确定清空全部问答记录吗？",
            "清空",
            true,
          ).then(function (ok) {
            if (ok) {
              state.ai.history = [];
              saveAiHistory();
              render();
              toast("已清空");
            }
          });
          break;
        case "openDetail":
          openDetail(id);
          break;
        case "practice":
          openPractice(id);
          break;
        case "openUnit":
          state.overlay = { type: "unit" };
          render();
          break;
        case "unitTab":
          state.unitCat = el.getAttribute("data-cat") || "length";
          render();
          break;
        case "closeOverlay":
          state.overlay = null;
          state.form = null;
          state.practice = null;
          if (state.tab === "add") state.tab = "bank";
          state.keepScroll = true;
          render();
          break;
        case "openFormulaPad":
          state.formulaPadQid =
            el.getAttribute("data-id") || (state.overlay && state.overlay.id);
          state.formulaErase = false;
          state.formulaOpen = true;
          state.keepScroll = true;
          render();
          break;
        case "delFormulaImg":
          var fq = findQ(el.getAttribute("data-id") || state.overlay.id);
          if (fq) {
            markImgDirty(fq.id);
            fq.formulaImg = null;
            save();
            state.keepScroll = true;
            render();
            toast("已删除手写公式");
          }
          break;
        case "formulaSave":
          formulaSave();
          break;
        case "formulaErase":
          state.formulaErase = !state.formulaErase;
          if (state.formulaEngine)
            state.formulaEngine.setErase(state.formulaErase);
          var feBtn = el;
          if (feBtn) feBtn.classList.toggle("active", state.formulaErase);
          break;
        case "formulaClear":
          clearFormulaPad();
          break;
        case "formulaCancel":
          state.formulaOpen = false;
          state.formulaErase = false;
          state.formulaDirty = false;
          state.keepScroll = true;
          render();
          break;
        case "openSummary":
          loadSummariesNow();
          state.summaryCat = state.summaryCat || CATEGORIES[0];
          state.summaryPage = 0;
          state.summaryDirty = false;
          state.summaryErase = false;
          state.overlay = { type: "summary" };
          render();
          break;
        case "summaryCat":
          autoSaveSummaryCur();
          state.summaryCat = el.getAttribute("data-cat") || CATEGORIES[0];
          state.summaryPage = 0;
          state.summaryDirty = false;
          state.summaryErase = false;
          state.keepScroll = true;
          render();
          break;
        case "summaryPrev":
          autoSaveSummaryCur();
          if (state.summaryPage <= 0) break;
          state.summaryPage--;
          state.summaryDirty = false;
          state.keepScroll = true;
          render();
          break;
        case "summaryNext":
          autoSaveSummaryCur();
          var arrN = state.summaries[state.summaryCat];
          var maxP = Math.max((Array.isArray(arrN) ? arrN.length : 1) - 1, 0);
          if (state.summaryPage >= maxP) break;
          state.summaryPage++;
          state.summaryDirty = false;
          state.keepScroll = true;
          render();
          break;
        case "summaryAddPage":
          autoSaveSummaryCur();
          if (!Array.isArray(state.summaries[state.summaryCat]))
            state.summaries[state.summaryCat] = [];
          state.summaries[state.summaryCat].push(null);
          state.summaryPage = state.summaries[state.summaryCat].length - 1;
          state.summaryDirty = false;
          saveSummaries();
          state.keepScroll = true;
          render();
          break;
        case "summaryJumpOpen":
          openSummaryJumpModal();
          break;
        case "summaryJumpGo":
          autoSaveSummaryCur();
          {
            var jmp = parseInt(
              $("#summary-jump-input") ? $("#summary-jump-input").value : "",
              10,
            );
            var arrJ = state.summaries[state.summaryCat];
            var maxJ = Math.max(Array.isArray(arrJ) ? arrJ.length : 1, 1);
            if (!jmp || jmp < 1) jmp = 1;
            if (jmp > maxJ) jmp = maxJ;
            state.summaryPage = jmp - 1;
            state.summaryDirty = false;
            closeSummaryJumpModal();
            state.keepScroll = true;
            render();
          }
          break;
        case "summaryJumpCancel":
          closeSummaryJumpModal();
          break;
        case "noop":
          break;
        case "summaryUndo":
          if (state.summaryEngine && state.summaryEngine.undo()) {
            state.summaryDirty = true;
            NS.summary.autoSaveSummaryCur();
          }
          break;
        case "summaryErase":
          state.summaryErase = !state.summaryErase;
          if (state.summaryEngine)
            state.summaryEngine.setErase(state.summaryErase);
          if (el) el.classList.toggle("active", state.summaryErase);
          break;
        case "summaryClearCanvas":
          {
            if (state.summaryEngine) state.summaryEngine.clear();
            state.summaryDirty = false;
            var arrC = state.summaries[state.summaryCat];
            if (Array.isArray(arrC)) {
              arrC[state.summaryPage] = null;
              saveSummaries();
            }
          }
          break;
        case "closePractice":
          var closePracticeId = state.practice ? state.practice.id : null;
          state.practice = null;
          state.scratch = false;
          if (closePracticeId) {
            state.overlay = { type: "detail", id: closePracticeId };
          } else {
            state.overlay = null;
          }
          if (state.tab === "add") state.tab = "bank";
          render();
          break;
        case "edit":
          openForm(findQ(id));
          render();
          break;
        case "del":
          del(id);
          break;
        case "snooze":
          snooze(id);
          break;
        case "reactivate":
          reactivate(id);
          break;
        case "toggleTodayOnly":
          state.todayOnly = !state.todayOnly;
          render();
          break;
        case "filterCat":
          state.filterCat = cat;
          state.filterSub = "";
          render();
          break;
        case "filterSub":
          state.filterSub = sub === "all" ? "" : sub;
          render();
          break;
        case "filterDone":
          state.filterDone = el.getAttribute("data-v") || "undone";
          render();
          break;
        case "toggleFavOnly":
          state.favOnly = !state.favOnly;
          render();
          break;
        case "toggleFav":
          var favQ = findQ(el.getAttribute("data-id"));
          if (favQ) {
            favQ.favorite = !favQ.favorite;
            save();
            render();
            toast(favQ.favorite ? "已加入收藏" : "已取消收藏");
          }
          break;
        case "toggleScratch":
          state.scratch = !state.scratch;
          var slEl = document.getElementById("scratch-layer");
          if (slEl) {
            slEl.style.display = state.scratch ? "" : "none";
            if (state.scratch) NS.scratch.initScratch();
          }
          var penBtn =
            el && el.closest(".overlay-head")
              ? el
              : document.querySelector('[data-act="toggleScratch"]');
          if (penBtn) {
            penBtn.textContent = state.scratch ? "✓" : "✏";
            penBtn.classList.toggle("on", state.scratch);
          }
          break;
        case "scratchUndo":
          if (state.scratchHistory && state.scratchHistory.length) {
            state.scratchHistory.pop();
            var sCv = $("#scratch-canvas");
            if (sCv) {
              var sCx = sCv.getContext("2d");
              var sdpr = window.devicePixelRatio || 1;
              sCx.setTransform(1, 0, 0, 1, 0, 0);
              sCx.clearRect(0, 0, sCv.width, sCv.height);
              var sprev = state.scratchHistory.length
                ? state.scratchHistory[state.scratchHistory.length - 1]
                : null;
              if (sprev) {
                var simg = new Image();
                simg.onload = function () {
                  sCx.setTransform(1, 0, 0, 1, 0, 0);
                  sCx.drawImage(simg, 0, 0, sCv.width, sCv.height);
                  sCx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
                };
                simg.src = sprev;
              } else {
                sCx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
              }
            }
            toast("已撤回");
          }
          break;
        case "scratchClear":
          var scCanvas = $("#scratch-canvas");
          if (scCanvas) {
            scCanvas
              .getContext("2d")
              .clearRect(0, 0, scCanvas.width, scCanvas.height);
          }
          state.scratchHistory = [];
          break;
        case "scratchTool":
          var tool = el.getAttribute("data-tool") || "pen";
          state.scratchTool = tool;
          var scTb = $(".scratch-bar");
          if (scTb) {
            $all('[data-act="scratchTool"]', scTb).forEach(function (b) {
              b.classList.toggle(
                "active",
                b.getAttribute("data-tool") === tool,
              );
            });
            $all('[data-act="scratchColor"]', scTb).forEach(function (b) {
              b.classList.toggle(
                "active",
                tool !== "eraser" &&
                  b.getAttribute("data-color") === state.scratchColor,
              );
            });
            var scTip = $(".scratch-tip", scTb);
            if (scTip)
              scTip.textContent =
                tool === "eraser"
                  ? "橡皮擦模式：擦除笔迹"
                  : "手写笔 / 手指直接书写";
          }
          var scCv = $("#scratch-canvas");
          if (scCv) {
            var scCtx = scCv.getContext("2d");
            scCtx.globalCompositeOperation =
              tool === "eraser" ? "destination-out" : "source-over";
            scCtx.strokeStyle =
              tool === "eraser" ? "rgba(0,0,0,1)" : state.scratchColor;
          }
          break;
        case "scratchColor":
          var scColor = el.getAttribute("data-color") || "#1f2430";
          state.scratchColor = scColor;
          state.scratchTool = "pen";
          var scCv2 = $("#scratch-canvas");
          if (scCv2) {
            var scCtx2 = scCv2.getContext("2d");
            scCtx2.globalCompositeOperation = "source-over";
            scCtx2.strokeStyle = scColor;
          }
          var scTb2 = $(".scratch-bar");
          if (scTb2) {
            $all('[data-act="scratchTool"]', scTb2).forEach(function (b) {
              b.classList.toggle(
                "active",
                b.getAttribute("data-tool") === "pen",
              );
            });
            $all('[data-act="scratchColor"]', scTb2).forEach(function (b) {
              b.classList.toggle(
                "active",
                b.getAttribute("data-color") === scColor,
              );
            });
            var scTip2 = $(".scratch-tip", scTb2);
            if (scTip2) scTip2.textContent = "手写笔 / 手指直接书写";
          }
          break;
        case "shenlunColor":
          var slColor = el.getAttribute("data-color") || "#d32f2f";
          state.scratchColor = slColor;
          state.scratchTool = "pen";
          var slCv = $("#shenlun-canvas");
          if (slCv) {
            var slCtx = slCv.getContext("2d");
            slCtx.globalCompositeOperation = "source-over";
            slCtx.strokeStyle = slColor;
          }
          $all('.shenlun-bar [data-act="shenlunColor"]').forEach(function (b) {
            b.classList.toggle(
              "active",
              b.getAttribute("data-color") === slColor,
            );
          });
          $all('.shenlun-bar [data-act="shenlunTool"]').forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-tool") === "pen");
          });
          break;
        case "shenlunTool":
          var slTool = el.getAttribute("data-tool") || "pen";
          state.scratchTool = slTool;
          var slCv2 = $("#shenlun-canvas");
          if (slCv2) {
            var slCtx2 = slCv2.getContext("2d");
            slCtx2.globalCompositeOperation =
              slTool === "eraser" ? "destination-out" : "source-over";
            slCtx2.strokeStyle =
              slTool === "eraser" ? "rgba(0,0,0,1)" : state.scratchColor;
          }
          $all('.shenlun-bar [data-act="shenlunTool"]').forEach(function (b) {
            b.classList.toggle(
              "active",
              b.getAttribute("data-tool") === slTool,
            );
          });
          $all('.shenlun-bar [data-act="shenlunColor"]').forEach(function (b) {
            b.classList.toggle(
              "active",
              slTool !== "eraser" &&
                b.getAttribute("data-color") === state.scratchColor,
            );
          });
          break;
        case "shenlunClear":
          var slCv3 = $("#shenlun-canvas");
          if (slCv3)
            slCv3.getContext("2d").clearRect(0, 0, slCv3.width, slCv3.height);
          break;
        case "formCat":
          state.form.category = cat;
          state.form.subCategory = "";
          state.keepScroll = true;
          render();
          break;
        case "formSubCat":
          state.form.subCategory = sub;
          state.keepScroll = true;
          render();
          break;
        case "fillSource":
          state.form.source = el.getAttribute("data-src") || "";
          state.keepScroll = true;
          render();
          break;
        case "delSource":
          var delSrc = el.getAttribute("data-src") || "";
          state.sourceHistory = state.sourceHistory.filter(function (s) {
            return s !== delSrc;
          });
          saveSources();
          state.keepScroll = true;
          render();
          break;
        case "formDays":
          state.form.reviewDays = parseInt(days, 10);
          state.form.reviewWeekday = 0;
          state.keepScroll = true;
          render();
          break;
        case "formWeekday":
          state.form.reviewWeekday =
            parseInt(el.getAttribute("data-wd"), 10) || 0;
          state.keepScroll = true;
          render();
          break;
        case "formAddOpt":
          if (state.form.options.length < 6) {
            state.form.options.push("");
            state.form.optImgs.push(null);
            state.keepScroll = true;
            render();
          }
          break;
        case "formDelOpt":
          state.form.options.splice(parseInt(i, 10), 1);
          state.form.optImgs.splice(parseInt(i, 10), 1);
          state.keepScroll = true;
          render();
          break;
        case "formAddMat":
          state.form.materials.push({
            title: "材料 " + (state.form.materials.length + 1),
            content: "",
          });
          state.keepScroll = true;
          render();
          break;
        case "formDelMat":
          state.form.materials.splice(parseInt(i, 10), 1);
          state.keepScroll = true;
          render();
          break;
        case "formRemoveImg":
          state.form.image = null;
          state.keepScroll = true;
          render();
          break;
        case "formOptImg":
          pickImage("gallery").then(
            function (dataUrl) {
              var idx = parseInt(i, 10);
              openCrop(
                dataUrl,
                function (cropped) {
                  state.form.optImgs[idx] = cropped;
                  state.keepScroll = true;
                  render();
                },
                "opt-" + idx,
              );
            },
            function (err) {
              toast(err.message);
            },
          );
          break;
        case "formOptImgDel":
          state.form.optImgs[parseInt(i, 10)] = null;
          state.keepScroll = true;
          render();
          break;
        case "formOptImgCrop":
          var cropIdx = parseInt(i, 10);
          var cropImg = state.form.optImgs[cropIdx];
          if (cropImg) {
            openCrop(
              cropImg,
              function (cropped) {
                state.form.optImgs[cropIdx] = cropped;
                state.keepScroll = true;
                render();
              },
              "opt-" + cropIdx,
            );
          }
          break;
        case "ocrOptsImage":
          pickImage("gallery").then(
            function (dataUrl) {
              openCrop(
                dataUrl,
                function (cropped) {
                  ocrExtractOptions(cropped);
                },
                "opt-extract",
              );
            },
            function (err) {
              toast(err.message);
            },
          );
          break;
        case "formRepick":
          pickImage(kind).then(
            function (dataUrl) {
              openCrop(dataUrl, function (cropped) {
                state.form.image = cropped;
                state.keepScroll = true;
                render();
              });
            },
            function (err) {
              toast(err.message);
            },
          );
          break;
        case "formCrop":
          if (state.form.image) {
            openCrop(state.form.image, function (cropped) {
              state.form.image = cropped;
              state.keepScroll = true;
              render();
            });
          }
          break;
        case "cropCancel":
          closeCrop();
          break;
        case "cropRepick":
          pickImage("gallery").then(
            function (dataUrl) {
              state.overlay.image = dataUrl;
              state.crop = null;
              render();
            },
            function (err) {
              toast(err.message);
            },
          );
          break;
        case "cropConfirm":
          cropConfirm();
          break;
        case "runOcr":
          runOcr();
          break;
        case "saveForm":
          saveForm();
          break;
        case "pickOpt":
          if (state.practice.answered) return;
          var p = state.practice;
          var q = findQ(p.id);
          var multi = extractLetters(q.answer).length > 1;
          if (p.selected[key]) {
            delete p.selected[key];
          } else {
            if (!multi) p.selected = {};
            p.selected[key] = true;
          }
          var optEls = document.querySelectorAll(".opt[data-key]");
          for (var oi = 0; oi < optEls.length; oi++) {
            var ok = optEls[oi].getAttribute("data-key");
            if (p.selected[ok]) optEls[oi].classList.add("selected");
            else optEls[oi].classList.remove("selected");
          }
          break;
        case "submitAnswer":
          submitPractice();
          break;
        case "finishPractice":
          finishPractice();
          break;
        case "startCalc":
          state.calc.current = generateCalcQuestion();
          state.calc.startTime = Date.now();
          state.calc.answered = false;
          state.calc.userAnswer = null;
          state.keepScroll = true;
          render();
          startCalcTimer();
          break;
        case "submitCalc":
          stopCalcTimer();
          var calcInput = $("#calc-answer") ? $("#calc-answer").value : "";
          calcInput = String(calcInput || "")
            .replace(/[０-９]/g, function (c) {
              return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
            })
            .replace(/[^\d.-]/g, "");
          var calcAnswer = parseFloat(calcInput);
          var elapsed = ((Date.now() - state.calc.startTime) / 1000).toFixed(1);
          var relError =
            state.calc.current.answer !== 0
              ? (Math.abs(calcAnswer - state.calc.current.answer) /
                  state.calc.current.answer) *
                100
              : 0;
          var ok = relError <= 2;
          state.calc.history.push({
            date: todayStr(),
            stem: state.calc.current.stem,
            answer: state.calc.current.answer,
            userAnswer: calcAnswer,
            correct: ok,
            elapsed: elapsed,
          });
          state.calc.answered = true;
          state.calc.userAnswer = calcAnswer;
          state.calc.elapsed = elapsed;
          saveCalcHistory();
          state.keepScroll = true;
          render();
          toast(
            ok ? "回答正确！" : "答错，正确答案：" + state.calc.current.answer,
          );
          break;
        case "nextCalc":
          state.calc.current = generateCalcQuestion();
          state.calc.startTime = Date.now();
          state.calc.answered = false;
          state.calc.userAnswer = null;
          state.keepScroll = true;
          render();
          startCalcTimer();
          break;
        case "delCalcRecord":
          var delIdx = parseInt(i, 10);
          confirmDialog(
            "删除记录",
            "确定删除这条练习记录吗？",
            "删除",
            true,
          ).then(function (ok) {
            if (ok) {
              state.calc.history.splice(delIdx, 1);
              saveCalcHistory();
              render();
              toast("已删除");
            }
          });
          break;
        case "clearCalcHistory":
          confirmDialog(
            "清空记录",
            "确定清空所有练习记录吗？此操作不可恢复。",
            "清空",
            true,
          ).then(function (ok) {
            if (ok) {
              state.calc.history = [];
              saveCalcHistory();
              render();
              toast("已清空");
            }
          });
          break;
        case "delayReview":
          var delayQ = findQ(id);
          if (delayQ) {
            delayQ.reviewDate = delayQ.reviewWeekday
              ? nextWeekdayDate(addDays(todayStr(), 1), delayQ.reviewWeekday)
              : addDays(todayStr(), 1);
            delayQ.updatedAt = Date.now();
            save();
            render();
            toast(
              delayQ.reviewWeekday
                ? "已延期至下周" + wdLabel(delayQ.reviewWeekday)
                : "已延期1天",
            );
          }
          break;
        case "delQuestion":
          var delQ = findQ(id);
          if (delQ) {
            confirmDialog(
              "删除错题",
              "确定删除这道错题吗？此操作不可恢复。",
              "删除",
              true,
            ).then(function (ok) {
              if (ok) {
                state.questions = state.questions.filter(function (q) {
                  return q.id !== id;
                });
                save();
                render();
                toast("已删除");
              }
            });
          }
          break;
        case "reopenQuestion":
          var reopenQ = findQ(id);
          if (reopenQ) {
            reopenQ.status = "pending";
            reopenQ.reviewDate = reopenQ.reviewWeekday
              ? nextWeekdayDate(addDays(todayStr(), 1), reopenQ.reviewWeekday)
              : addDays(todayStr(), 1);
            save();
            render();
            toast(
              reopenQ.reviewWeekday
                ? "已重新加入复盘（每周" + wdLabel(reopenQ.reviewWeekday) + "）"
                : "已重新加入复盘",
            );
          }
          break;
        case "toggleDarkMode":
          // 三态循环:light → dark → auto → light
          var pref = state.darkModePref || "auto";
          var next =
            pref === "light" ? "dark" : pref === "dark" ? "auto" : "light";
          state.darkModePref = next;
          state.darkMode = NS.store.applyDarkMode(next);
          NS.store.saveDarkMode(next);
          render();
          toast(
            next === "dark"
              ? "已切换夜间模式"
              : next === "light"
                ? "已切换日间模式"
                : "已切换跟随系统",
          );
          break;
        case "openSettings":
          state.overlay = { type: "settings" };
          render();
          break;
        case "setDefaultWeekday":
          state.settings.reviewWeekday =
            parseInt(el.getAttribute("data-wd"), 10) || 0;
          saveSettings();
          state.keepScroll = true;
          render();
          toast(
            state.settings.reviewWeekday
              ? "默认每周" + wdLabel(state.settings.reviewWeekday) + "复盘"
              : "已改为不固定",
          );
          break;
        case "setRetryDays":
          state.settings.retryDays =
            parseInt(el.getAttribute("data-days"), 10) || 3;
          saveSettings();
          state.keepScroll = true;
          render();
          toast("默认 " + state.settings.retryDays + " 天后再次复盘");
          break;
        case "applyRetryDays":
          var rd = parseInt($("#f-retry-days").value, 10);
          if (!rd || rd < 1) {
            toast("请输入有效的天数");
            break;
          }
          state.settings.retryDays = rd;
          saveSettings();
          state.keepScroll = true;
          render();
          toast("默认 " + rd + " 天后再次复盘");
          break;
        case "applyWeekdayAll":
          var aw = state.settings.reviewWeekday || 0;
          var applied = 0;
          state.questions.forEach(function (qq) {
            if (qq.status === "pending") {
              qq.reviewWeekday = aw;
              qq.reviewDate = aw
                ? nextWeekdayDate(todayStr(), aw)
                : qq.reviewDate;
              applied++;
            }
          });
          if (applied) {
            save();
            toast(
              aw ? "已应用到 " + applied + " 道待复盘错题" : "已取消固定星期",
            );
          } else {
            toast("没有待复盘错题");
          }
          render();
          break;
        case "manualUpdate":
          if (
            window.AndroidBridge &&
            typeof window.AndroidBridge.checkUpdate === "function"
          ) {
            toast("正在检查更新…");
            nativeCall("checkUpdate", "").then(
              function (msg) {
                toast(msg);
              },
              function (err) {
                toast(err && err.message ? err.message : "检查更新失败");
              },
            );
          } else {
            toast("当前环境不支持在线更新");
          }
          break;
        case "openLeaderDetail":
          var li = parseInt(el.getAttribute("data-idx") || "-1", 10);
          var ldr = state.news.leader.items[li];
          if (ldr) {
            state.news.leader.detail = ldr;
            state.overlay = { type: "leaderDetail" };
            render();
          }
          break;
        case "viewShenlunInk":
          state.overlay = {
            type: "shenlunInk",
            id: id,
            idx: parseInt(el.getAttribute("data-idx") || "0", 10),
          };
          render();
          break;
        case "compareOne":
          var instKey = el.getAttribute("data-inst");
          state.compareActive = instKey;
          var cachedQ = state.compareCache[id];
          if (cachedQ && cachedQ.single && cachedQ.single[instKey]) {
            var instI = COMPARE_INSTS.find(function (x) {
              return x.key === instKey;
            });
            var secC = instI ? instI.color : "var(--primary)";
            var secN = instI ? instI.name : instKey;
            var cc = document.getElementById("compare-content");
            if (cc)
              cc.innerHTML =
                '<div class="compare-block"><div class="compare-sec" style="background:' +
                secC +
                '">' +
                secN +
                "</div>" +
                cachedQ.single[instKey] +
                "</div>";
            var bar2 = document.querySelector(".compare-inst-bar");
            if (bar2) {
              bar2.querySelectorAll(".compare-inst-btn").forEach(function (b) {
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
              var ab2 = bar2.querySelector(".compare-all-btn");
              if (ab2) ab2.classList.remove("active");
            }
          } else {
            requestShenlunCompareOne(id, instKey);
          }
          break;
        case "openShenlunCompare":
          state.compareActive = "";
          state.overlay = { type: "shenlunCompare", id: id };
          render();
          break;
        case "clearCompare":
          state.compareActive = "";
          state.compareLoading = false;
          state.compareLoadingSingle = "";
          state.compareCache[id] = {
            date: todayStr(),
            source: (findQ(id) || {}).source || "申论题",
            single: {},
            compare: "",
          };
          saveCompareCache();
          render();
          break;
        case "compareAll":
          state.compareActive = "compareAll";
          var cachedAll = state.compareCache[id];
          if (cachedAll && cachedAll.compare) {
            var ccAll = document.getElementById("compare-content");
            if (ccAll)
              ccAll.innerHTML =
                '<div class="compare-block"><div class="compare-sec">\u4e00\u952e\u5bf9\u6bd4</div>' +
                cachedAll.compare +
                "</div>";
            var barAll = document.querySelector(".compare-inst-bar");
            if (barAll) {
              barAll
                .querySelectorAll(".compare-inst-btn")
                .forEach(function (b) {
                  b.classList.remove("active");
                  var bi = COMPARE_INSTS.find(function (x) {
                    return x.key === b.getAttribute("data-inst");
                  });
                  if (bi) {
                    b.style.background = "#fff";
                    b.style.color = bi.color;
                  }
                });
              var abAll = barAll.querySelector(".compare-all-btn");
              if (abAll) abAll.classList.add("active");
            }
          } else {
            requestShenlunCompareAll(id);
          }
          break;
        case "manageReviewHistory":
          state.detailManageMode = id;
          state.keepScroll = true;
          render();
          break;
        case "cancelManage":
          state.detailManageMode = null;
          state.keepScroll = true;
          render();
          break;
        case "deleteReviewRecord":
          var delIdx = parseInt(el.getAttribute("data-idx") || "0", 10);
          var dq = findQ(id);
          if (dq && dq.reviewHistory && dq.reviewHistory[delIdx]) {
            dq.reviewHistory.splice(delIdx, 1);
            if (dq.reviewInk && dq.reviewInk[delIdx])
              dq.reviewInk.splice(delIdx, 1);
            dq.rounds = Math.max(0, (dq.rounds || 1) - 1);
            save();
            state.keepScroll = true;
            render();
          }
          break;
        case "toggleReviewExpand":
          var tIdx = parseInt(el.getAttribute("data-idx") || "0", 10);
          state.reviewExpandedIdx =
            state.reviewExpandedIdx === tIdx &&
            id === (state.overlay && state.overlay.id)
              ? -1
              : tIdx;
          render();
          break;
        case "toggleThinking":
          var tk = el.getAttribute("data-tk") || "";
          var contentEl = document.querySelector(
            '.thinking-content[data-tk="' + tk + '"]',
          );
          var arrowEl = document.querySelector(
            '.thinking-arrow[data-tk="' + tk + '"]',
          );
          if (contentEl) {
            var showing = contentEl.style.display !== "none";
            contentEl.style.display = showing ? "none" : "block";
            if (arrowEl) arrowEl.textContent = showing ? "\u25b6" : "\u25bc";
          }
          break;
        case "openNewsSaved":
          state.overlay = { type: "newsSaved" };
          render();
          break;
        case "openNewsDetail":
          var nTitle2 = el.getAttribute("data-title") || "";
          var nSource = el.getAttribute("data-source") || "人民日报";
          var nTime = el.getAttribute("data-time") || "";
          var nws = state.news;
          if (nws.detailLoading) return;
          if (!nws.summaries[nTitle2]) {
            var savedSum = "";
            for (var si2 = 0; si2 < nws.saved.length; si2++) {
              if (nws.saved[si2].title === nTitle2 && nws.saved[si2].summary) {
                savedSum = nws.saved[si2].summary;
                break;
              }
            }
            if (savedSum) {
              nws.summaries[nTitle2] = savedSum;
              saveNewsSummaries();
              state.overlay = {
                type: "newsDetail",
                title: nTitle2,
                source: nSource,
                time: nTime,
              };
              render();
              break;
            }
            nws.detailLoading = true;
            nws.detailError = "";
            state.overlay = {
              type: "newsDetail",
              title: nTitle2,
              source: nSource,
              time: nTime,
            };
            render();
            aiSummarizeNews({ title: nTitle2 })
              .then(function (txt) {
                nws.summaries[nTitle2] = txt;
                saveNewsSummaries();
                nws.detailLoading = false;
                render();
              })
              .catch(function (err) {
                nws.detailLoading = false;
                nws.detailError = (err && err.message) || "总结失败，请重试";
                render();
              });
          } else {
            nws.detailLoading = false;
            state.overlay = {
              type: "newsDetail",
              title: nTitle2,
              source: nSource,
              time: nTime,
            };
            render();
          }
          break;
        case "toggleSaveNews":
          var ts = el.getAttribute("data-title") || "";
          var idx = -1;
          for (var ti = 0; ti < state.news.saved.length; ti++) {
            if (state.news.saved[ti].title === ts) {
              idx = ti;
              break;
            }
          }
          if (idx >= 0) {
            state.news.saved.splice(idx, 1);
            saveNewsSaved();
            toast("已取消收藏");
          } else {
            state.news.saved.unshift({
              title: ts,
              source: el.getAttribute("data-source") || "人民日报",
              time: el.getAttribute("data-time") || "",
              summary: state.news.summaries[ts] || "",
            });
            saveNewsSaved();
            toast("已收藏");
          }
          render();
          break;
        case "unsaveNews":
          var us = el.getAttribute("data-title") || "";
          state.news.saved = state.news.saved.filter(function (s) {
            return s.title !== us;
          });
          saveNewsSaved();
          render();
          toast("已取消收藏");
          break;
        case "refreshNews":
          state.news.loading = true;
          render();
          fetchNews().then(function (items) {
            state.news.items = items;
            state.news.loading = false;
            state.homeNews = items.length
              ? items[Math.floor(Math.random() * items.length)]
              : null;
            render();
          });
          break;
        case "export":
          exportBackup();
          break;
        case "import":
          importBackup();
          break;
      }
    });

  if (!IS_NODE)
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
      var aiInp = $("#ai-input");
      var idmInp = $("#idiom-input");
      if (aiInp && document.activeElement === aiInp) {
        var sendBtn = document.querySelector('[data-act="sendAiQuestion"]');
        if (sendBtn && !sendBtn.disabled) sendBtn.click();
      } else if (idmInp && document.activeElement === idmInp) {
        var queryBtn = document.querySelector('[data-act="queryIdiom"]');
        if (queryBtn) queryBtn.click();
      }
    });

  if (!IS_NODE)
    document.addEventListener("input", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === "idiom-input") {
        state.idiom.input = t.value;
        return;
      }
      if (t.id === "ai-input") {
        state.ai.input = t.value;
        return;
      }
      if (!state.form) return;
      if (t.id === "f-stem") state.form.stem = t.value;
      else if (t.id === "f-answer") state.form.answer = t.value;
      else if (t.id === "f-wrong") state.form.wrongThinking = t.value;
      else if (t.id === "f-correct") state.form.correctThinking = t.value;
      else if (t.id === "f-source") state.form.source = t.value;
      else if (t.id === "f-days") {
        var v = parseInt(t.value, 10);
        if (v > 0) state.form.reviewDays = v;
      } else if (t.dataset && t.dataset.opt != null) {
        state.form.options[parseInt(t.dataset.opt, 10)] = t.value;
      } else if (t.dataset && t.dataset.matTitle != null) {
        state.form.materials[parseInt(t.dataset.matTitle, 10)].title = t.value;
      } else if (t.dataset && t.dataset.matContent != null) {
        state.form.materials[parseInt(t.dataset.matContent, 10)].content =
          t.value;
      }
    });

  if (!IS_NODE)
    document.addEventListener("input", function (e) {
      var t = e.target;
      if (t && t.id === "bank-search") {
        state.search = t.value;
        renderBankSearchOnly();
      }
    });

  function renderBankSearchOnly() {
    return NS.home.renderBankSearchOnly();
  }

  // actions 模块不需要显式导出，click 监听器在加载时自动注册
  NS.actions = {};
})();
