/* ===== modules/crop.js =====
 * 截图裁剪模块：图片裁剪画布、选框交互与确认输出。
 * 对外暴露 XCAPP.crop
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
  function openCrop(dataUrl, cb, target) {
    state.overlay = { type: 'crop', image: dataUrl };
    state.cropCb = cb;
    state.cropTarget = target || 'main';
    state.crop = null;
    render();
  }

  function renderCrop() {
    return '<div class="overlay crop-overlay">' +
      '<div class="overlay-head">' +
      '<span class="back" data-act="cropCancel">&times;</span>' +
      '<div class="title">裁剪截图</div>' +
      '<button class="btn sm ok" data-act="cropConfirm">确定</button>' +
      '</div>' +
      '<div class="crop-body"><canvas id="crop-canvas"></canvas></div>' +
      '<div class="crop-tip">拖动选框或四角/四边调整裁剪范围，双击选框重置</div>' +
      '<div class="crop-actions">' +
      '<button class="btn gray" data-act="cropRepick">重选图片</button>' +
      '<button class="btn" data-act="cropConfirm">确定裁剪</button>' +
      '</div></div>';
  }

  function detachCrop() {
    if (state.crop && state.crop.detach) {
      try {
        state.crop.detach();
        window.removeEventListener('resize', state.crop.winResize);
      } catch (e) { /* ignore */ }
    }
    state.crop = null;
  }

  function closeCrop() {
    detachCrop();
    state.cropCb = null;
    state.overlay = { type: 'form' };
    state.keepScroll = true;
    render();
  }

  function cropConfirm() {
    var c = state.crop;
    if (!c || !c.ready) { toast('请稍候，图片加载中'); return; }
    var sx = Math.round(c.r.x * c.natW);
    var sy = Math.round(c.r.y * c.natH);
    var sw = Math.max(1, Math.round(c.r.w * c.natW));
    var sh = Math.max(1, Math.round(c.r.h * c.natH));
    var out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    var ctx = out.getContext('2d');
    ctx.drawImage(c.img, sx, sy, sw, sh, 0, 0, sw, sh);
    var dataUrl = out.toDataURL('image/jpeg', 0.95);
    var cb = state.cropCb;
    var target = state.cropTarget;
    detachCrop();
    state.cropCb = null;
    state.cropTarget = null;
    state.overlay = { type: 'form' };
    state.keepScroll = true;
    render();
    if (cb) cb(dataUrl, target);
  }

  function initCrop() {
    if (IS_NODE) return;
    var canvas = $('#crop-canvas');
    if (!canvas) return;
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;
    detachCrop();
    var img = new Image();
    img.onload = function () {
      var c = {
        canvas: canvas, ctx: ctx, img: img,
        natW: img.naturalWidth || img.width, natH: img.naturalHeight || img.height,
        r: null, w: 0, h: 0, ox: 0, oy: 0, ready: false
      };
      state.crop = c;
      layoutCrop();
      bindCrop(c);
      c.ready = true;
    };
    img.onerror = function () { toast('图片加载失败'); };
    img.src = state.overlay.image;
  }

  function layoutCrop() {
    var c = state.crop;
    if (!c) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = c.canvas.clientWidth || 1;
    var ch = c.canvas.clientHeight || 1;
    var scale = Math.min(cw / c.natW, ch / c.natH);
    c.w = Math.round(c.natW * scale);
    c.h = Math.round(c.natH * scale);
    c.ox = Math.round((cw - c.w) / 2);
    c.oy = Math.round((ch - c.h) / 2);
    c.canvas.width = Math.round(cw * dpr);
    c.canvas.height = Math.round(ch * dpr);
    c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!c.r) {
      c.r = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 };
    }
    drawCrop();
  }

  function drawCrop() {
    var c = state.crop;
    if (!c) return;
    var ctx = c.ctx;
    var cw = c.canvas.clientWidth, chh = c.canvas.clientHeight;
    ctx.clearRect(0, 0, cw, chh);
    ctx.drawImage(c.img, c.ox, c.oy, c.w, c.h);
    var x = c.ox + c.r.x * c.w, y = c.oy + c.r.y * c.h, w = c.r.w * c.w, h = c.r.h * c.h;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, cw, y);
    ctx.fillRect(0, y + h, cw, chh - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, cw - x - w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    var i;
    for (i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke();
    }
    var hs = 9;
    var pts = [
      [x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2],
      [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]
    ];
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#4f6ef7';
    ctx.lineWidth = 2;
    pts.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], hs, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  function bindCrop(c) {
    var canvas = c.canvas;
    function pos(ev) {
      var rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }
    function toImg(p) {
      return { x: (p.x - c.ox) / c.w, y: (p.y - c.oy) / c.h };
    }
    function clampRect(r) {
      var min = 0.06;
      if (r.w < min) r.w = min;
      if (r.h < min) r.h = min;
      if (r.x < 0) r.x = 0;
      if (r.y < 0) r.y = 0;
      if (r.x + r.w > 1) r.x = 1 - r.w;
      if (r.y + r.h > 1) r.y = 1 - r.h;
      return r;
    }
    function hitTest(p) {
      var r = c.r;
      var x0 = c.ox + r.x * c.w, y0 = c.oy + r.y * c.h, w = r.w * c.w, h = r.h * c.h;
      var tol = 24;
      var handles = [
        { dx: 0, dy: 0 }, { dx: 0.5, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 1, dy: 0.5 }, { dx: 1, dy: 1 }, { dx: 0.5, dy: 1 },
        { dx: 0, dy: 1 }, { dx: 0, dy: 0.5 }
      ];
      for (var i = 0; i < handles.length; i++) {
        var hx = x0 + handles[i].dx * w, hy = y0 + handles[i].dy * h;
        if (Math.abs(p.x - hx) <= tol && Math.abs(p.y - hy) <= tol) {
          return { mode: 'resize', i: i };
        }
      }
      if (p.x >= x0 && p.x <= x0 + w && p.y >= y0 && p.y <= y0 + h) return { mode: 'move' };
      return null;
    }
    var drag = null;
    function onDown(ev) {
      ev.preventDefault();
      var ht = hitTest(pos(ev));
      if (!ht) return;
      drag = { mode: ht.mode, i: ht.i, start: toImg(pos(ev)), orig: { x: c.r.x, y: c.r.y, w: c.r.w, h: c.r.h } };
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
    }
    function onMove(ev) {
      if (!drag) return;
      ev.preventDefault();
      var cur = toImg(pos(ev));
      var d = { x: cur.x - drag.start.x, y: cur.y - drag.start.y };
      var r = { x: drag.orig.x, y: drag.orig.y, w: drag.orig.w, h: drag.orig.h };
      if (drag.mode === 'move') {
        r.x += d.x;
        r.y += d.y;
      } else {
        var h = drag.i;
        if (h === 2 || h === 3 || h === 4) r.w = drag.orig.w + d.x;
        if (h === 6 || h === 7 || h === 0) { r.x = drag.orig.x + d.x; r.w = drag.orig.w - d.x; }
        if (h === 4 || h === 5 || h === 6) r.h = drag.orig.h + d.y;
        if (h === 0 || h === 1 || h === 2) { r.y = drag.orig.y + d.y; r.h = drag.orig.h - d.y; }
      }
      c.r = clampRect(r);
      drawCrop();
    }
    function onUp(ev) {
      drag = null;
      if (canvas.releasePointerCapture && ev.pointerId != null) {
        try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      }
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    var dblClick = function () {
      c.r = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 };
      drawCrop();
    };
    canvas.addEventListener('dblclick', dblClick);
    c.winResize = layoutCrop;
    window.addEventListener('resize', layoutCrop);
    c.detach = function () {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('dblclick', dblClick);
    };
  }

  // === 对外暴露 ===
  NS.crop = {
    openCrop: openCrop,
    renderCrop: renderCrop,
    detachCrop: detachCrop,
    closeCrop: closeCrop,
    cropConfirm: cropConfirm,
    initCrop: initCrop,
    layoutCrop: layoutCrop,
    drawCrop: drawCrop,
    bindCrop: bindCrop
  };
})();
