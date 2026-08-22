/* ===== modules/form.js =====
 * 错题表单（添加/编辑）与复盘设置、手写公式板。
 * 对外暴露 XCAPP.form
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
  var WEEKDAY_NAMES = NS.constants.WEEKDAY_NAMES;
  var JS_BUILD = NS.JS_BUILD;

  // === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） ===
  function render() { return NS.shell.render(); }
  function renderHeader() { return NS.shell.renderHeader(); }
  function catTag(a, b, c) { return NS.shell.catTag(a, b, c); }
  function statusTag(q) { return NS.shell.statusTag(q); }
  function openCrop(d, cb, t) { return NS.crop.openCrop(d, cb, t); }
  function parseOcrText(t) { return NS.detail.parseOcrText(t); }
  function ocrUpdate(s, p) { return NS.detail.ocrUpdate(s, p); }
  function generateFenbiAnswer(q) { return NS.detail.generateFenbiAnswer(q); }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function openForm(q) {
    state.form = q ? {
      id: q.id, category: q.category, subCategory: q.subCategory || '', stem: q.stem,
      options: (q.options || []).slice(), answer: q.answer,
      wrongThinking: q.wrongThinking || '', correctThinking: q.correctThinking || '',
      reviewDays: q.reviewDays || 3, reviewWeekday: q.reviewWeekday || 0, image: q.image || null,
      source: q.source || '',
      optImgs: (q.optImgs || (q.options || []).map(function () { return null; })).slice(),
      materials: (q.materials || []).map(function (m) { return { title: m.title || '', content: m.content || '' }; }),
      fenbiUrl: q.fenbiUrl || '',
      fenbiAnswer: q.fenbiAnswer || ''
    } : freshForm(null);
    state.overlay = { type: 'form' };
  }

  function freshForm(q) {
    var emptyImgs = (q ? (q.options || []) : ['', '', '', '']).map(function () { return null; });
    return {
      id: q && q.id ? q.id : null, category: q ? q.category : '', subCategory: q ? q.subCategory || '' : '', stem: q ? q.stem : '',
      options: (q ? q.options || [] : ['', '', '', '']).slice(), answer: q ? q.answer : '',
      wrongThinking: q ? q.wrongThinking || '' : '', correctThinking: q ? q.correctThinking || '' : '',
      reviewDays: q ? q.reviewDays || 3 : 3, reviewWeekday: q ? q.reviewWeekday || 0 : (state.settings.reviewWeekday || 0), image: q ? q.image || null : null,
      source: q ? q.source || '' : '',
      optImgs: (q && q.optImgs ? q.optImgs : emptyImgs).slice(),
      materials: (q && q.materials ? q.materials.map(function (m) { return { title: m.title || '', content: m.content || '' }; }) : []).slice(),
      fenbiAnswer: q ? q.fenbiAnswer || '' : ''
    };
  }

  function renderSettings() {
    var wd = state.settings.reviewWeekday || 0;
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">复盘设置</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">默认固定复盘星期</div>';
    html += '<p class="muted" style="font-size:13px">设置后，新建错题将自动默认在每周固定星期复盘，无需每次手动选择。</p>';
    html += '<div class="chips" style="margin-top:10px">' +
      '<span class="chip' + (!wd ? ' active' : '') + '" data-act="setDefaultWeekday" data-wd="0">不固定</span>' +
      WEEKDAY_NAMES.map(function (name, i) {
        return '<span class="chip' + (wd === i + 1 ? ' active' : '') + '" data-act="setDefaultWeekday" data-wd="' + (i + 1) + '">' + name + '</span>';
      }).join('') +
      '</div>';
    html += '</div>';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">再次复盘默认天数</div>';
    html += '<p class="muted" style="font-size:13px">复盘结束后默认填写的天数，可在复盘时临时修改。</p>';
    var rd = state.settings.retryDays || 3;
    html += '<div class="chips" style="margin-top:10px">' +
      [1, 2, 3, 5, 7, 14].map(function (n) {
        return '<span class="chip' + (rd === n ? ' active' : '') + '" data-act="setRetryDays" data-days="' + n + '">' + n + ' 天</span>';
      }).join('') +
      '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">' +
      '<input class="input" id="f-retry-days" type="number" min="1" max="365" placeholder="自定义天数" value="' + ([1, 2, 3, 5, 7, 14].indexOf(rd) < 0 ? rd : '') + '" style="width:100px">' +
      '<button class="btn sm" data-act="applyRetryDays">确定</button></div>';
    html += '</div>';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">应用到现有错题</div>';
    html += '<p class="muted" style="font-size:13px">将上方默认星期应用到所有「待复盘」错题，已完成的错题不受影响。</p>';
    html += '<button class="btn mt12" data-act="applyWeekdayAll">应用到所有待复盘错题</button>';
    html += '</div>';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">数据存储</div>';
    var stInfo = { dataBytes: 0, availBytes: 0 };
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.getStorageInfo === 'function') {
        var ir = JSON.parse(window.AndroidBridge.getStorageInfo());
        stInfo.dataBytes = ir.dataBytes || 0;
        stInfo.availBytes = ir.availBytes || 0;
      }
    } catch (e) { /* ignore */ }
    if (nativeDataStore()) {
      html += '<p class="muted" style="font-size:13px">错题数据保存在本机文件（App 数据目录），不受网页存储上限限制，卸载应用前请先导出备份。</p>' +
        '<p class="muted" style="font-size:12px;margin-top:4px">数据占用：' + fmtSize(stInfo.dataBytes) + '　手机剩余：' + fmtSize(stInfo.availBytes) + '</p>';
    } else {
      html += '<p class="muted" style="font-size:13px">错题数据保存在网页本地存储（有大小上限），建议及时导出备份。</p>';
    }
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function initFormulaPad() {
    var cv = $('#formula-canvas');
    if (!cv) return;
    var wrap = $('.formula-wrap');
    if (!wrap) return;
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth || (window.innerWidth - 40);
    var h = Math.max(240, Math.round(Math.min(w * 0.95, 400)));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    XCAPP.ink.grid(ctx, w, h);
    var existQ = findQ(state.formulaPadQid);
    if (existQ && existQ.formulaImg) {
      XCAPP.ink.loadInto(cv, ctx, w, h, existQ.formulaImg);
    }
    state.formulaDirty = false;
    state.formulaEngine = XCAPP.ink.create(cv, {
      initialErase: state.formulaErase,
      onDown: function () { state.formulaDirty = true; }
    });
  }

  function clearFormulaPad() {
    if (state.formulaEngine) state.formulaEngine.clear();
    state.formulaDirty = false;
  }

  function formulaSave() {
    var cv = $('#formula-canvas');
    if (!cv) return;
    var q = findQ(state.formulaPadQid);
    if (!q) return;
    if (!state.formulaDirty) { toast('请先在画布上书写内容'); return; }
    var url = cv.toDataURL('image/png');
    if (url.length < 600) { toast('请先书写内容'); return; }
    q.formulaImg = url;
    markImgDirty(q.id);
    save();
    state.formulaOpen = false;
    state.formulaErase = false;
    state.formulaDirty = false;
    state.keepScroll = true;
    render();
    toast('已保存手写公式');
  }

  function renderForm() {
    var f = state.form;
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">' + (f.id ? '编辑错题' : '添加错题') + '</div></div>' +
      '<div class="overlay-body">';

    html += '<div class="field"><span class="label">错题截图</span>';
    if (f.image) {
      html += '<div class="img-wrap"><img id="form-img" src="' + f.image + '"></div>' +
        '<div class="btn-row">' +
        '<button class="btn ghost" data-act="formCrop">裁剪</button>' +
        '<button class="btn gray" data-act="formRepick" data-kind="gallery">更换图片</button>' +
        '<button class="btn gray" data-act="formRemoveImg">移除</button>' +
        '</div>';
    } else {
      html += '<div class="add-img-area" data-act="formRepick" data-kind="gallery"><span class="big">+</span>点击选择截图<br>（拍照或从相册选取）</div>' +
        '<div class="pick-btns">' +
        '<button class="btn gray" data-act="formRepick" data-kind="gallery">从相册选择</button>' +
        '<button class="btn gray" data-act="formRepick" data-kind="camera">拍照</button>' +
        '</div>';
    }
    html += '</div>';

    if (f.image && !state.ocrRunning) {
      html += '<button class="btn ocr-btn" data-act="runOcr">识别题干与选项</button>';
    }
    if (state.ocrRunning) {
      html += '<div class="ocr-progress">' +
        '<div class="ocr-bar"><div id="ocr-fill" style="width:' + Math.round(state.ocrProgress * 100) + '%"></div></div>' +
        '<div class="ocr-status" id="ocr-status">' + esc(state.ocrStatus || '准备中…') + '</div></div>';
    }

    html += '<div class="field mt12"><span class="label">分类 <span class="req">*</span></span>' +
      '<div class="chips">' +
      CATEGORIES.map(function (c) {
        return '<span class="chip' + (f.category === c ? ' active' : '') + '" data-act="formCat" data-cat="' + c + '">' + c + '</span>';
      }).join('') +
      '</div></div>';

    var subCats = SUBCATEGORIES[f.category];
    if (subCats && subCats.length) {
      html += '<div class="field"><span class="label">子分类 <span class="req">*</span></span>' +
        '<div class="chips">' +
        subCats.map(function (sc) {
          return '<span class="chip' + (f.subCategory === sc ? ' active' : '') + '" data-act="formSubCat" data-sub="' + sc + '">' + sc + '</span>';
        }).join('') +
        '</div></div>';
    }

    html += '<div class="field"><span class="label">题目来源</span>' +
      '<input class="input" id="f-source" placeholder="如：2026国考行测真题、粉笔题库、XX模拟卷" value="' + esc(f.source) + '">';
    if (state.sourceHistory.length) {
      html += '<div class="chips" style="margin-top:8px;gap:5px">' +
        state.sourceHistory.slice(0, 8).map(function (s) {
          return '<span class="chip source-chip" data-act="fillSource" data-src="' + esc(s) + '" style="font-size:12px">' + esc(s) +
            '<span class="source-del" data-act="delSource" data-src="' + esc(s) + '" title="删除">×</span></span>';
        }).join('') +
        '</div>';
    }
    html += '</div>';

    var isShenlunForm = f.category === '申论';

    html += '<div class="field"><span class="label">题干文字 <span class="muted">（可选，截图已含题干可留空）</span></span>' +
      '<textarea class="textarea" id="f-stem" rows="3" placeholder="题目内容（截图已包含题干时可留空）">' + esc(f.stem) + '</textarea></div>';

    if (isShenlunForm) {
      html += '<div class="field"><span class="label">材料 <span class="muted">（可多个，按卷面顺序填写）</span></span>';
      f.materials.forEach(function (m, i) {
        html += '<div class="material-card">' +
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">' +
          '<input class="input" data-mat-title="' + i + '" placeholder="材料 ' + (i + 1) + '" value="' + esc(m.title) + '" style="flex:1">' +
          '<button class="btn danger sm" data-act="formDelMat" data-i="' + i + '">删除</button>' +
          '</div>' +
          '<textarea class="textarea" data-mat-content="' + i + '" rows="4" placeholder="材料内容……">' + esc(m.content) + '</textarea>' +
          '</div>';
      });
      html += '<button class="btn ghost sm" data-act="formAddMat">+ 添加材料</button></div>';
      html += '<div class="field"><span class="label">\u7c89\u7b14URL <span class="muted">\uff08\u53ef\u9009\uff0c\u586b\u5199\u540e\u4fdd\u5b58\u65f6\u81ea\u52a8\u83b7\u53d6\u7c89\u7b14\u7b54\u6848\uff09</span></span>' +
        '<input class="input" id="f-fenbi-url" placeholder="\u5982\uff1ahttps://www.fenbi.com/spa/tiku/guide/shenlunList/shenlun/1000?page=0&id=102" value="' + esc(f.fenbiUrl || '') + '">' +
        '<div style="font-size:11px;color:var(--muted);margin-top:4px">\u4fdd\u5b58\u540e\u5c06\u81ea\u52a8\u7528AI\u5206\u6790\u9898\u76ee\u5e76\u751f\u6210\u7c89\u7b14\u98ce\u683c\u53c2\u8003\u7b54\u6848</div></div>';
    }

    if (!isShenlunForm) {
    html += '<div class="field"><span class="label">选项</span>' +
      '<div class="btn-row" style="margin-bottom:8px">' +
      '<button class="btn gray sm" data-act="ocrOptsImage">上传选项截图，自动提取选项</button>' +
      '</div>';

    f.options.forEach(function (opt, i) {
      var optImg = f.optImgs[i];
      html += '<div class="field"><span class="label">选项 ' + optionLetters[i] + '</span>';
      if (optImg) {
        html += '<div class="opt-img-wrap"><img src="' + optImg + '"></div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn gray sm" data-act="formOptImgCrop" data-i="' + i + '">裁剪</button>' +
          '<button class="btn gray sm" data-act="formOptImg" data-i="' + i + '">更换</button>' +
          '<button class="btn gray sm" data-act="formOptImgDel" data-i="' + i + '">改为文字</button>' +
          (f.options.length > 2 ? '<button class="btn danger sm" data-act="formDelOpt" data-i="' + i + '">删除</button>' : '') +
          '</div>';
      } else {
        html += '<div style="display:flex;gap:8px">' +
          '<textarea class="textarea" data-opt="' + i + '" rows="2" placeholder="选项内容（也可用图片）" style="flex:1">' + esc(stripOptionPrefix(opt) || opt) + '</textarea>' +
          '<button class="btn ghost sm" data-act="formOptImg" data-i="' + i + '" style="align-self:flex-start">传图</button>' +
          (f.options.length > 2 ? '<button class="btn danger sm" data-act="formDelOpt" data-i="' + i + '" style="align-self:flex-start">删除</button>' : '') +
          '</div>';
      }
      html += '</div>';
    });
    if (f.options.length < 6) {
      html += '<button class="btn ghost sm" data-act="formAddOpt">+ 增加选项</button>';
    }

    html += '<div class="field mt12"><span class="label">正确答案 <span class="req">*</span></span>' +
      '<input class="input" id="f-answer" placeholder="如：B（多选可填 AB）" value="' + esc(f.answer) + '"></div>';
    }

    html += '<div class="field"><span class="label">当时错误思路（防止以后再次踩坑）</span>' +
      '<textarea class="textarea" id="f-wrong" rows="3" placeholder="你当时为什么做错？错误的想法是什么？">' + esc(f.wrongThinking) + '</textarea></div>';

    html += '<div class="field"><span class="label">' + (f.category === '\u7533\u8bba' ? '\u4e0a\u6b21\u4f5c\u7b54' : '\u6b63\u786e\u601d\u8def') + '\uff08\u53ef\u9009\uff0c\u590d\u76d8\u65f6\u518d\u8865\u5145\uff09</span>' +
      '<textarea class="textarea" id="f-correct" rows="3" placeholder="' + (f.category === '\u7533\u8bba' ? '\u4f60\u4e0a\u6b21\u7684\u4f5c\u7b54\u5185\u5bb9' : '\u8fd9\u9053\u9898\u7684\u6b63\u786e\u89e3\u9898\u601d\u8def') + '">' + esc(f.correctThinking) + '</textarea></div>';

    html += '<div class="field"><span class="label">几天后复盘 <span class="req">*</span></span>' +
      '<div class="chips">' +
      REVIEW_OPTIONS.map(function (n) {
        return '<span class="chip' + (f.reviewDays === n && !f.reviewWeekday ? ' active' : '') + '" data-act="formDays" data-days="' + n + '">' + n + '天</span>';
      }).join('') +
      '</div>' +
      '<input class="input mt12" id="f-days" type="number" min="1" max="365" placeholder="或自定义天数" value="' + (REVIEW_OPTIONS.indexOf(f.reviewDays) < 0 && !f.reviewWeekday ? f.reviewDays : '') + '"></div>';

    html += '<div class="field"><span class="label">固定每周星期几复盘 <span class="muted">（可选，选此则忽略上面天数）</span></span>' +
      '<div class="chips">' +
      '<span class="chip' + (!f.reviewWeekday ? ' active' : '') + '" data-act="formWeekday" data-wd="0">不固定</span>' +
      WEEKDAY_NAMES.map(function (name, i) {
        return '<span class="chip' + (f.reviewWeekday === i + 1 ? ' active' : '') + '" data-act="formWeekday" data-wd="' + (i + 1) + '">' + name + '</span>';
      }).join('') +
      '</div></div>';

    html += '<button class="btn" data-act="saveForm">' + (f.id ? '保存修改' : '保存错题') + '</button>';
    html += '<div class="divider"></div>';
    html += '<button class="btn gray" data-act="closeOverlay">取消</button>';
    html += '</div></div>';
    return html;
  }

  function saveForm() {
    var f = state.form;
    var category = f.category;
    var stemEl = $('#f-stem');
    var stem = stemEl ? stemEl.value.trim() : (f.stem || '');
    var answerEl = $('#f-answer');
    var answer = answerEl ? answerEl.value.trim().toUpperCase() : (f.answer || '');
    var wrong = $('#f-wrong').value.trim();
    var correct = $('#f-correct').value.trim();
    var sourceEl = $('#f-source');
    var source = sourceEl ? sourceEl.value.trim() : (f.source || '');
    source = source.replace(/\s+\d{1,3}$/, '').trim();
    f.source = source;
    var customDays = parseInt($('#f-days').value, 10);
    var reviewDays = customDays > 0 ? customDays : f.reviewDays;
    var reviewWeekday = f.reviewWeekday || 0;

    var isShenlunForm = category === '申论';

    if (!category) { toast('请选择题目的分类'); return; }
    if (SUBCATEGORIES[category] && SUBCATEGORIES[category].length && !f.subCategory) { toast('请选择子分类'); return; }
    if (!f.image && !stem && !isShenlunForm) { toast('请上传题干截图'); return; }
    if (!isShenlunForm && !answer) { toast('请填写正确答案'); return; }
    if (!reviewWeekday && (!reviewDays || reviewDays < 1)) { toast('请选择复盘天数或固定星期'); return; }

    var materials = [];
    if (isShenlunForm) {
      $all('[data-mat-title]').forEach(function (inp, i) {
        var title = inp.value.trim();
        var contentEl = $('[data-mat-content="' + i + '"]');
        var content = contentEl ? contentEl.value.trim() : '';
        if (content) materials.push({ title: title || '材料 ' + (i + 1), content: content });
      });
      if (!f.image && !stem && !materials.length) { toast('请填写题目或至少一个材料'); return; }
    }

    var fenbiEl = $('#f-fenbi-url');
    var fenbiUrl = fenbiEl ? fenbiEl.value.trim() : (f.fenbiUrl || '');
    var fenbiAnswer = f.fenbiAnswer || '';

    var opts = [];
    var optImgs = [];
    f.options.forEach(function (o, i) {
      var text = String(o || '').trim().replace(/^[A-F]\s*[.、．)）:：]\s*/, '');
      var img = f.optImgs[i];
      if (text || img) {
        opts.push(optionLetters[i] + '. ' + text);
        optImgs.push(img || null);
      }
    });

    var now = todayStr();
    var nextReview = reviewWeekday ? nextWeekdayDate(now, reviewWeekday) : addDays(now, reviewDays);
    if (f.id) {
      var q = findQ(f.id);
      q.category = category;
      q.subCategory = f.subCategory || '';
      q.stem = stem;
      q.materials = isShenlunForm ? materials : (q.materials || []);
      q.options = opts;
      q.optImgs = optImgs;
      q.answer = answer;
      q.wrongThinking = wrong;
      q.correctThinking = correct;
      q.source = source;
      q.reviewDays = reviewDays;
      q.reviewWeekday = reviewWeekday;
      q.reviewDate = nextReview;
      q.image = f.image;
      q.fenbiUrl = fenbiUrl;
      q.fenbiAnswer = fenbiAnswer;
      q.status = 'pending';
      q.updatedAt = Date.now();
    } else {
      state.questions.unshift({
        id: uid(),
        category: category,
        subCategory: f.subCategory || '',
        stem: stem,
        materials: isShenlunForm ? materials : [],
        options: opts,
        optImgs: optImgs,
        answer: answer,
        wrongThinking: wrong,
        correctThinking: correct,
        source: source,
        fenbiUrl: fenbiUrl,
        fenbiAnswer: fenbiAnswer,
        image: f.image,
        reviewDays: reviewDays,
        reviewWeekday: reviewWeekday,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewDate: nextReview,
        status: 'pending',
        rounds: 0,
        reviewHistory: []
      });
    }
    markImgDirty(f.id || state.questions[0].id);
    save();
    if (source) {
      var normSrc = source.replace(/\s+\d{1,3}$/, '').trim();
      state.sourceHistory = state.sourceHistory.filter(function (s) {
        var sl = s.trim().toLowerCase().replace(/\s+\d{1,3}$/, '');
        var nl = normSrc.toLowerCase();
        return sl !== nl;
      });
      state.sourceHistory.unshift(normSrc);
      saveSources();
    }
    var savedId = f.id || state.questions[0].id;
    if (isShenlunForm && fenbiUrl && !fenbiAnswer) {
      var sq = findQ(savedId);
      if (sq) {
        generateFenbiAnswer(sq);
      }
    }
    state.overlay = null;
    state.form = null;
    state.tab = 'bank';
    render();
    toast(reviewWeekday ? '已保存，每周' + wdLabel(reviewWeekday) + '复盘' : '已保存，' + reviewDays + ' 天后复盘');
  }

  // === 对外暴露 ===
  NS.form = {
    openForm: openForm,
    freshForm: freshForm,
    renderForm: renderForm,
    saveForm: saveForm,
    initFormulaPad: initFormulaPad,
    clearFormulaPad: clearFormulaPad,
    formulaSave: formulaSave,
    renderSettings: renderSettings
  };
})();
