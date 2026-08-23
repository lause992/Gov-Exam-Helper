/* ===== modules/storage.js =====
 * 持久化模块：题目、成语、AI、新闻、摘要等数据的读写。
 * 对外暴露 XCAPP.store，包含 load/save/findQ 及各类 saveXxx 函数。
 * 依赖：state.js（XCAPP.state）、core.js（XCAPP.utils/storage/bridge）。
 * 跨模块依赖（运行时解析）：shell.render / crop.openCrop 等。
 */
(function () {
  "use strict";
  var NS = (window.XCAPP = window.XCAPP || {});

  /* === 共享依赖别名（加载时可用） === */
  var state = NS.state;
  var storageGet = NS.storage.get;
  var storageSet = NS.storage.set;
  var storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var compressImage = NS.bridge.compressImage;
  var STORAGE_KEY = NS.consts.STORAGE_KEY;
  var IMG_KEY_PREFIX = NS.consts.IMG_KEY_PREFIX;

  /* === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） === */
  function render() {
    return NS.shell.render();
  }
  function toast(msg) {
    return NS.utils.toast(msg);
  }
  function openCrop(dataUrl, cb, target) {
    return NS.crop.openCrop(dataUrl, cb, target);
  }

  function load() {
    try {
      var raw = storageGet(STORAGE_KEY);
      state.questions = raw ? JSON.parse(raw) : [];
      var srcChanged = false;
      state.questions.forEach(function (q) {
        if (q.source && /\s+\d{1,3}$/.test(q.source)) {
          q.source = q.source.replace(/\s+\d{1,3}$/, "").trim();
          srcChanged = true;
        }
      });
      if (srcChanged) save();
    } catch (e) {
      state.questions = [];
    }
    try {
      var calcRaw = storageGet("xcapp_calc_history");
      state.calc.history = calcRaw ? JSON.parse(calcRaw) : [];
    } catch (e) {
      state.calc.history = [];
    }
    try {
      var idiomRaw = storageGet("xcapp_idioms");
      state.idiom.saved = idiomRaw ? JSON.parse(idiomRaw) : [];
    } catch (e) {
      state.idiom.saved = [];
    }
    try {
      var aiRaw = storageGet("xcapp_ai_history");
      state.ai.history = aiRaw ? JSON.parse(aiRaw) : [];
    } catch (e) {
      state.ai.history = [];
    }
    try {
      var fabRaw = storageGet("xcapp_fab_pos");
      state.fabPos = fabRaw ? JSON.parse(fabRaw) : null;
    } catch (e) {
      state.fabPos = null;
    }
    try {
      var newsRaw = storageGet("xcapp_news_saved");
      state.news.saved = newsRaw ? JSON.parse(newsRaw) : [];
    } catch (e) {
      state.news.saved = [];
    }
    try {
      var sumRaw = storageGet("xcapp_news_summaries");
      state.news.summaries = sumRaw ? JSON.parse(sumRaw) : {};
    } catch (e) {
      state.news.summaries = {};
    }
    try {
      var setRaw = storageGet("xcapp_settings");
      state.settings = setRaw
        ? JSON.parse(setRaw)
        : { reviewWeekday: 0, retryDays: 3 };
      if (!state.settings || typeof state.settings.reviewWeekday !== "number")
        state.settings = { reviewWeekday: 0, retryDays: 3 };
      if (typeof state.settings.retryDays !== "number")
        state.settings.retryDays = 3;
    } catch (e) {
      state.settings = { reviewWeekday: 0, retryDays: 3 };
    }
    try {
      var srcRaw = storageGet("xcapp_sources");
      state.sourceHistory = srcRaw ? JSON.parse(srcRaw) : [];
      if (!Array.isArray(state.sourceHistory)) state.sourceHistory = [];
      var seen = {};
      state.sourceHistory = state.sourceHistory.filter(function (s) {
        var k = String(s || "")
          .trim()
          .toLowerCase();
        if (!k || seen[k]) return false;
        seen[k] = true;
        return true;
      });
    } catch (e) {
      state.sourceHistory = [];
    }
    try {
      var cmpRaw = storageGet("xcapp_shenlun_compare");
      state.compareCache = cmpRaw ? JSON.parse(cmpRaw) : {};
      if (!state.compareCache || typeof state.compareCache !== "object")
        state.compareCache = {};
    } catch (e) {
      state.compareCache = {};
    }
    state.summaries = {};
    state.summaryNav = null;
    try {
      var dmRaw = storageGet("xcapp_dark_mode");
      // 三态: 'light' / 'dark' / 'auto'(跟随系统);向下兼容旧的 '0'/'1' 布尔值
      if (dmRaw === "1" || dmRaw === "dark") state.darkModePref = "dark";
      else if (dmRaw === "0" || dmRaw === "light") state.darkModePref = "light";
      else state.darkModePref = "auto";
      state.darkMode = applyDarkMode(state.darkModePref);
    } catch (e) {
      state.darkModePref = "auto";
      state.darkMode = false;
    }
    setTimeout(function () {
      loadSummariesNow();
    }, 600);
    setTimeout(loadQuestionImages, 0);
  }

  function loadSummariesNow() {
    if (state._summariesLoaded) return;
    state._summariesLoaded = true;
    try {
      var sumRaw2 = storageGet("xcapp_summaries");
      state.summaries = sumRaw2 ? JSON.parse(sumRaw2) : {};
      if (!state.summaries || typeof state.summaries !== "object")
        state.summaries = {};
      Object.keys(state.summaries).forEach(function (k) {
        var v = state.summaries[k];
        if (v && !Array.isArray(v)) {
          state.summaries[k] = [(v && v.img) || null];
        }
        if (!Array.isArray(state.summaries[k])) state.summaries[k] = [];
      });
      state.summaryPage = 0;
      state.summaryDirty = false;
    } catch (e) {
      state.summaries = {};
    }
    try {
      var navRaw = storageGet("xcapp_summary_nav_pos");
      state.summaryNav = navRaw ? JSON.parse(navRaw) : null;
      if (!state.summaryNav || typeof state.summaryNav !== "object")
        state.summaryNav = null;
    } catch (e) {
      state.summaryNav = null;
    }
  }

  function loadQuestionImages() {
    if (state._imgLoading) return;
    state._imgLoading = true;
    var k = 0;
    var legacyMigrated = false;
    var legacyFormat = state.questions.some(function (q) {
      return q && q.image && String(q.image).indexOf("data:") === 0;
    });
    function maybeFinish() {
      if (k < state.questions.length) return;
      state._imgLoading = false;
      if (legacyMigrated) {
        try {
          storageSet(
            STORAGE_KEY,
            JSON.stringify(state.questions, stripQuestionImages),
          );
        } catch (e) {
          /* ignore */
        }
      }
    }
    function batch() {
      var n = 0;
      while (k < state.questions.length && n < 4) {
        var q = state.questions[k];
        k++;
        n++;
        if (!q) continue;
        var key = imgKey(q.id);
        if (legacyFormat && q.image && String(q.image).indexOf("data:") === 0) {
          try {
            storageSet(key, qImagesPayload(q));
            legacyMigrated = true;
          } catch (e) {
            /* image key overflow: keep in memory only */
          }
        } else {
          try {
            var s = storageGet(key);
            if (s) {
              var img = JSON.parse(s);
              if (img && typeof img === "object") {
                if (img.image != null) q.image = img.image;
                if (Array.isArray(img.optImgs)) q.optImgs = img.optImgs;
                if (img.formulaImg != null) q.formulaImg = img.formulaImg;
              }
            }
          } catch (e) {
            /* keep memory image */
          }
        }
      }
      if (k < state.questions.length) {
        setTimeout(batch, 0);
      } else {
        maybeFinish();
      }
    }
    batch();
  }

  function saveSources() {
    try {
      storageSet(
        "xcapp_sources",
        JSON.stringify(state.sourceHistory.slice(0, 50)),
      );
    } catch (e) {
      /* ignore */
    }
  }
  function saveSettings() {
    try {
      storageSet("xcapp_settings", JSON.stringify(state.settings));
    } catch (e) {
      /* ignore */
    }
  }
  function saveCompareCache() {
    try {
      storageSet("xcapp_shenlun_compare", JSON.stringify(state.compareCache));
    } catch (e) {
      /* ignore */
    }
  }
  function saveNewsSaved() {
    try {
      storageSet("xcapp_news_saved", JSON.stringify(state.news.saved));
    } catch (e) {
      /* ignore */
    }
  }
  function saveNewsSummaries() {
    try {
      storageSet("xcapp_news_summaries", JSON.stringify(state.news.summaries));
    } catch (e) {
      /* ignore */
    }
  }
  function saveSummaries() {
    try {
      storageSet("xcapp_summaries", JSON.stringify(state.summaries));
    } catch (e) {
      /* ignore */
    }
  }
  function saveCalcHistory() {
    try {
      storageSet("xcapp_calc_history", JSON.stringify(state.calc.history));
    } catch (e) {
      /* ignore */
    }
  }
  function saveIdioms() {
    try {
      storageSet("xcapp_idioms", JSON.stringify(state.idiom.saved));
    } catch (e) {
      /* ignore */
    }
  }
  function saveAiHistory() {
    try {
      storageSet(
        "xcapp_ai_history",
        JSON.stringify(state.ai.history.slice(0, 50)),
      );
    } catch (e) {
      /* ignore */
    }
  }
  /** 三态深色模式应用:light/dark/auto(跟随系统)
   *  返回当前实际是否为深色(用于 body.dark class 和 state.darkMode)
   *  auto 模式下会监听系统 prefers-color-scheme 变化(通过 matchMedia) */
  function applyDarkMode(pref) {
    var isDark;
    if (pref === "dark") isDark = true;
    else if (pref === "light") isDark = false;
    else {
      // auto: 跟随系统
      var mq =
        window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      isDark = !!(mq && mq.matches);
      // 监听系统切换(auto 模式下实时响应)
      if (mq && mq.addEventListener) {
        mq.addEventListener("change", function (e) {
          if (state.darkModePref === "auto") {
            state.darkMode = !!e.matches;
            document.body.classList.toggle("dark", state.darkMode);
            document.documentElement.classList.toggle(
              "light-pref",
              state.darkModePref === "light",
            );
            if (typeof render === "function") render();
          }
        });
      }
    }
    document.body.classList.toggle("dark", isDark);
    // light-pref class 用于覆盖 @media prefers-color-scheme 的自动应用(防止 light 用户被系统暗色覆盖)
    document.documentElement.classList.toggle("light-pref", pref === "light");
    return isDark;
  }
  function saveDarkMode(pref) {
    try {
      storageSet("xcapp_dark_mode", pref || "auto");
    } catch (e) {
      /* ignore */
    }
  }

  function compressQuestionsImages(maxDim, quality) {
    var jobs = [];
    state.questions.forEach(function (q, qi) {
      if (q && q.image) jobs.push({ qi: qi, kind: "image", oi: -1 });
      ((q && q.optImgs) || []).forEach(function (oi, oiIdx) {
        if (oi) jobs.push({ qi: qi, kind: "opt", oi: oiIdx });
      });
    });
    return jobs.reduce(function (p, job) {
      return p.then(function () {
        var q = state.questions[job.qi];
        if (!q) return null;
        var src = job.kind === "image" ? q.image : (q.optImgs || [])[job.oi];
        if (!src) return null;
        return compressImage(src, maxDim, quality).then(function (out) {
          if (job.kind === "image") {
            q.image = out;
          } else if (q.optImgs) {
            q.optImgs[job.oi] = out;
          }
          markImgDirty(q.id);
        });
      });
    }, Promise.resolve());
  }

  var saveCompressing = false;

  function markImgDirty(id) {
    if (id) state.imgDirty[id] = true;
  }
  function imgKey(id) {
    return IMG_KEY_PREFIX + id;
  }
  function qImagesPayload(q) {
    return JSON.stringify({
      image: q.image || null,
      optImgs: q.optImgs || [],
      formulaImg: q.formulaImg || null,
    });
  }
  function stripQuestionImages(key, value) {
    if (
      key === "image" ||
      key === "optImgs" ||
      key === "formulaImg" ||
      key === "thumb"
    )
      return undefined;
    return value;
  }
  function persistDirtyImages() {
    var ids = Object.keys(state.imgDirty);
    if (!ids.length) return;
    state.imgDirty = {};
    ids.forEach(function (id) {
      var q = findQ(id);
      if (!q) {
        storageDel(imgKey(id));
        return;
      }
      try {
        storageSet(imgKey(id), qImagesPayload(q));
      } catch (e) {
        /* image key overflow: keep in memory only */
      }
    });
  }

  function save() {
    if (typeof localStorage === "undefined" && !nativeDataStore()) return;
    var textOk = false;
    try {
      textOk = storageSet(
        STORAGE_KEY,
        JSON.stringify(state.questions, stripQuestionImages),
      );
    } catch (e) {
      textOk = false;
    }
    persistDirtyImages();
    if (textOk) return;
    if (saveCompressing) return;
    saveCompressing = true;
    compressQuestionsImages(900, 0.6)
      .then(function () {
        try {
          if (
            storageSet(
              STORAGE_KEY,
              JSON.stringify(state.questions, stripQuestionImages),
            )
          ) {
            saveCompressing = false;
            persistDirtyImages();
            render();
            toast("本地存储已满，已自动压缩图片节省空间");
            return;
          }
        } catch (e2) {
          /* still full, clear oldest images */
        }
        var cleared = 0;
        for (var i = state.questions.length - 1; i >= 0; i--) {
          var q = state.questions[i];
          if (q && (q.image || (q.optImgs || []).some(Boolean))) {
            q.image = null;
            q.optImgs = null;
            storageDel(imgKey(q.id));
            cleared++;
            try {
              if (
                storageSet(
                  STORAGE_KEY,
                  JSON.stringify(state.questions, stripQuestionImages),
                )
              ) {
                saveCompressing = false;
                persistDirtyImages();
                render();
                toast(
                  "本地存储已满，已清理最旧的 " +
                    cleared +
                    " 道题图片（文字保留）",
                );
                return;
              }
            } catch (e3) {
              /* continue clearing */
            }
          }
        }
        saveCompressing = false;
        toast("保存失败：本地存储已满，请删除部分错题后再试");
      })
      .catch(function () {
        saveCompressing = false;
        toast("保存失败：图片压缩异常，请删除部分错题后再试");
      });
  }

  /* === 共享工具：按 id 查找题目 === */
  function findQ(id) {
    for (var i = 0; i < state.questions.length; i++) {
      if (state.questions[i].id === id) return state.questions[i];
    }
    return null;
  }

  /* === 对外暴露 === */
  NS.store = {
    load: load,
    save: save,
    findQ: findQ,
    loadSummariesNow: loadSummariesNow,
    loadQuestionImages: loadQuestionImages,
    saveSources: saveSources,
    saveSettings: saveSettings,
    saveCompareCache: saveCompareCache,
    saveNewsSaved: saveNewsSaved,
    saveNewsSummaries: saveNewsSummaries,
    saveSummaries: saveSummaries,
    saveCalcHistory: saveCalcHistory,
    saveIdioms: saveIdioms,
    saveAiHistory: saveAiHistory,
    saveDarkMode: saveDarkMode,
    applyDarkMode: applyDarkMode,
    compressQuestionsImages: compressQuestionsImages,
    markImgDirty: markImgDirty,
    imgKey: imgKey,
    qImagesPayload: qImagesPayload,
    stripQuestionImages: stripQuestionImages,
    persistDirtyImages: persistDirtyImages,
  };
})();
