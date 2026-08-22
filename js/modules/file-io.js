/* ===== modules/file-io.js =====
 * 文件 IO 模块：图片选择、相机调用、备份导入导出。
 * 对外暴露 XCAPP.fileio
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
  function pickFile(kind) {
    return new Promise(function (resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (kind === 'camera') input.setAttribute('capture', 'environment');
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) { reject(new Error('未选择文件')); return; }
        var rd = new FileReader();
        rd.onload = function () { resolve(rd.result); };
        rd.onerror = function () { reject(new Error('读取文件失败')); };
        rd.readAsDataURL(f);
      };
      input.click();
    });
  }

  function pickImage(kind) {
    if (kind === 'camera' && isNative()) {
      return nativeCall('takePhoto')
        .catch(function (err) {
          toast('相机调用失败：' + (err.message || err) + '，已改为文件选择');
          return pickFile(kind);
        });
    }
    return pickFile(kind);
  }

  function downloadBackup(json) {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '行测错题备份_' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function exportBackup() {
    var json = JSON.stringify({ app: '行测错题复盘', version: 1, exportedAt: new Date().toISOString(), questions: state.questions }, null, 2);
    if (isNative() && window.AndroidBridge.exportBackup) {
      nativeCall('exportBackup', json).then(function () { toast('已导出'); }, function (e) { toast(e.message); });
    } else {
      downloadBackup(json);
      toast('已导出');
    }
  }

  function importBackup() {
    function merge(text) {
      var data;
      try { data = JSON.parse(text); } catch (e) { toast('备份文件格式错误'); return; }
      var list = data.questions || data;
      if (!Array.isArray(list)) { toast('备份文件格式错误'); return; }
      var ids = {};
      state.questions.forEach(function (q) { ids[q.id] = true; });
      var added = 0;
      list.forEach(function (q) {
        if (q && q.id && q.stem && !ids[q.id]) {
          state.questions.push(q);
          ids[q.id] = true;
          added++;
          markImgDirty(q.id);
        }
      });
      save();
      render();
      toast('导入完成，新增 ' + added + ' 题');
    }
    if (isNative() && window.AndroidBridge.importBackup) {
      nativeCall('importBackup').then(merge, function (e) { toast(e.message); });
    } else {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { merge(rd.result); };
        rd.readAsText(f);
      };
      input.click();
    }
  }

  // === 对外暴露 ===
  NS.fileio = {
    pickFile: pickFile,
    pickImage: pickImage,
    downloadBackup: downloadBackup,
    exportBackup: exportBackup,
    importBackup: importBackup
  };
})();
