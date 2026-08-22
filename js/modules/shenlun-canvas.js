/* ===== modules/shenlun-canvas.js =====
 * 申论答题画布（shenlun-canvas）：手写绘制、橡皮、双指滚动复用 scratch 的能力。
 * 对外暴露 XCAPP.shenlunCanvas
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
  function pushScratchHistory(cv) { return NS.scratch.pushScratchHistory(cv); }
  function attachTwoFingerScroll(canvas, setMulti) { return NS.scratch.attachTwoFingerScroll(canvas, setMulti); }
  // 如需调用其他模块函数，在此添加懒加载包装器，例如：
  // function fetchAiAnswer(q, h) { return NS.ai.fetchAiAnswer(q, h); }

  // === 模块代码（从 app.js 提取，保持原样） ===
  function initShenlunCanvas() {
    var canvas = $('#shenlun-canvas');
    if (!canvas) return;
    var wrap = $('#shenlun-wrap');
    if (!wrap) return;

    var ctx = canvas.getContext('2d');
    var isEraser = function () { return state.scratchTool === 'eraser'; };
    function applyMode() {
      ctx.globalCompositeOperation = isEraser() ? 'destination-out' : 'source-over';
      ctx.strokeStyle = isEraser() ? 'rgba(0,0,0,1)' : state.scratchColor;
    }

    function resizeCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      if (w < 10 || h < 10) return;
      var old = null;
      if (canvas.width > 10 && canvas.height > 10) {
        try { old = canvas.toDataURL('image/png'); } catch (e) { old = null; }
      }
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (old) {
        var img = new Image();
        img.onload = function () {
          var c2 = canvas.getContext('2d');
          c2.setTransform(1, 0, 0, 1, 0, 0);
          c2.drawImage(img, 0, 0, canvas.width, canvas.height);
          c2.setTransform(dpr, 0, 0, dpr, 0, 0);
          applyMode();
        };
        img.src = old;
      }
      applyMode();
    }

    resizeCanvas();
    setTimeout(function () { resizeCanvas(); }, 100);
    setTimeout(function () { resizeCanvas(); }, 500);

    var drawing = false;
    var lastX = 0;
    var lastY = 0;
    function pos(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function widthFor(e) {
      if (isEraser()) return 22;
      var p = e.pressure || 0;
      if (p > 0) return Math.max(1.5, p * 5);
      var pt = e.pointerType || (e.touches ? 'touch' : 'mouse');
      return pt === 'touch' ? 3 : 2;
    }
    function startDraw(clientX, clientY, e) {
      drawing = true;
      applyMode();
      var p = pos(clientX, clientY);
      lastX = p.x;
      lastY = p.y;
      ctx.lineWidth = widthFor(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
    function moveDraw(clientX, clientY, e) {
      if (!drawing) return;
      applyMode();
      var p = pos(clientX, clientY);
      ctx.lineWidth = widthFor(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x;
      lastY = p.y;
    }
    function endDraw(clientX, clientY) {
      if (!drawing) return;
      if (clientX != null && clientY != null) {
        var p = pos(clientX, clientY);
        if (Math.abs(p.x - lastX) > 0.1 || Math.abs(p.y - lastY) > 0.1) {
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
      }
      drawing = false;
      pushScratchHistory(canvas);
    }
    var multiTouch = false;
    var pendingTouch = null;
    var pendingTimer = null;
    function cancelPending() {
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
      pendingTouch = null;
    }
    function onPointerDown(e) {
      if (multiTouch) { e.preventDefault(); return; }
      e.preventDefault();
      if (e.pointerType === 'touch') {
        pendingTouch = { x: e.clientX, y: e.clientY, e: e };
        pendingTimer = setTimeout(function () {
          pendingTimer = null;
          if (pendingTouch && !multiTouch) {
            startDraw(pendingTouch.x, pendingTouch.y, pendingTouch.e);
          }
          pendingTouch = null;
        }, 120);
      } else {
        startDraw(e.clientX, e.clientY, e);
      }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    function onPointerMove(e) {
      if (multiTouch) { e.preventDefault(); return; }
      if (pendingTouch) {
        pendingTouch.e = e;
        if (Math.abs(e.clientX - pendingTouch.x) > 6 || Math.abs(e.clientY - pendingTouch.y) > 6) {
          if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
          startDraw(pendingTouch.x, pendingTouch.y, e);
          pendingTouch = null;
        }
        return;
      }
      if (!drawing) return;
      e.preventDefault();
      moveDraw(e.clientX, e.clientY, e);
    }
    function onPointerUp(e) {
      if (pendingTouch) cancelPending();
      endDraw(e.clientX, e.clientY);
    }
    attachTwoFingerScroll(canvas, function (v) { multiTouch = v; if (v) cancelPending(); });
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resizeCanvas(); }, 150);
    });
  }

  // === 对外暴露 ===
  NS.shenlunCanvas = {
    initShenlunCanvas: initShenlunCanvas
  };
})();
