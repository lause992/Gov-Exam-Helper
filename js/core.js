/* ===== xcapp core module: utils + constants + storage + native bridge ===== */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};

  NS.constants = {
    WEEKDAY_NAMES: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  };

  NS.utils = {
    $: function (sel, root) { return (root || document).querySelector(sel); },
    $all: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },
    uid: function () { return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    stripMd: function (s) {
      return String(s || '').replace(/\*\*/g, '').replace(/__(.*?)__/g, '$1')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
    },
    pad: function (n) { return n < 10 ? '0' + n : '' + n; },
    todayStr: function () {
      var d = new Date();
      return d.getFullYear() + '-' + NS.utils.pad(d.getMonth() + 1) + '-' + NS.utils.pad(d.getDate());
    },
    addDays: function (dateStr, n) {
      var p = dateStr.split('-').map(Number);
      var d = new Date(p[0], p[1] - 1, p[2]);
      d.setDate(d.getDate() + n);
      return d.getFullYear() + '-' + NS.utils.pad(d.getMonth() + 1) + '-' + NS.utils.pad(d.getDate());
    },
    fmtDate: function (dateStr) {
      if (!dateStr) return '';
      var p = dateStr.split('-');
      return p[1] + '月' + p[2] + '日';
    },
    nextWeekdayDate: function (fromStr, wd) {
      var p = fromStr.split('-').map(Number);
      var d = new Date(p[0], p[1] - 1, p[2]);
      var cur = d.getDay();
      var target = wd === 7 ? 0 : wd;
      var diff = (target - cur + 7) % 7;
      d.setDate(d.getDate() + diff);
      return d.getFullYear() + '-' + NS.utils.pad(d.getMonth() + 1) + '-' + NS.utils.pad(d.getDate());
    },
    wdLabel: function (wd) {
      return wd >= 1 && wd <= 7 ? NS.constants.WEEKDAY_NAMES[wd - 1] : '';
    },
    stripOptionPrefix: function (text) {
      return String(text || '').replace(/^[A-F]\s*[.、．)）:：]\s*/, '');
    },
    fmtSize: function (bytes) {
      if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
      if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return bytes + ' B';
    },
    toast: function (msg) {
      var box = document.getElementById('toast-box');
      if (!box) return;
      var el = document.createElement('div');
      el.className = 'toast';
      el.textContent = msg;
      box.appendChild(el);
      setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2000);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2400);
    },
    confirmDialog: function (title, msg, okText, danger) {
      return new Promise(function (resolve) {
        var esc = NS.utils.esc;
        var mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML =
          '<div class="modal">' +
          '<div class="m-title">' + esc(title) + '</div>' +
          '<div class="m-msg">' + esc(msg) + '</div>' +
          '<div class="m-btns">' +
          '<button class="btn gray" data-m="cancel">取消</button>' +
          '<button class="btn ' + (danger ? 'danger' : '') + '" data-m="ok">' + esc(okText || '确定') + '</button>' +
          '</div></div>';
        mask.addEventListener('click', function (e) {
          var act = e.target.getAttribute('data-m');
          if (!act) return;
          document.body.removeChild(mask);
          resolve(act === 'ok');
        });
        document.body.appendChild(mask);
      });
    }
  };

  NS.storage = {
    nativeDataStore: function () {
      return !!(window.AndroidBridge && typeof window.AndroidBridge.saveData === 'function' &&
        typeof window.AndroidBridge.loadData === 'function');
    },
    set: function (key, json) {
      if (NS.storage.nativeDataStore()) {
        try { if (window.AndroidBridge.saveData(key, json)) return true; } catch (e) { /* fallthrough */ }
      }
      try {
        if (typeof localStorage !== 'undefined') { localStorage.setItem(key, json); return true; }
      } catch (e) { /* fallthrough */ }
      return false;
    },
    get: function (key) {
      if (NS.storage.nativeDataStore()) {
        try {
          var v = window.AndroidBridge.loadData(key);
          if (v != null && v !== '' && v !== 'null') return v;
        } catch (e) { /* fallthrough */ }
      }
      try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch (e) { return null; }
    },
    del: function (key) {
      if (NS.storage.nativeDataStore()) {
        try { if (window.AndroidBridge.deleteData) { window.AndroidBridge.deleteData(key); return; } } catch (e) { /* fallthrough */ }
      }
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  function imageToCanvas(dataUrl, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var maxDim = opts.maxDim || 1100;
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        var ctx = canvas.getContext('2d');
        if (opts.bg) {
          ctx.fillStyle = opts.bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(opts.mime || 'image/jpeg', opts.quality != null ? opts.quality : 0.7));
      };
      img.onerror = function () { reject(new Error('图片加载失败')); };
      img.src = dataUrl;
    });
  }

  var __cbSeq = 0;
  var __cbs = {};
  if (typeof window !== 'undefined') {
    window.__bridgeResult = function (id, type, payload) {
      var cb = __cbs[id];
      if (cb) { delete __cbs[id]; cb(type, payload); }
    };
  }

  NS.bridge = {
    isNative: function () {
      return !!(window.AndroidBridge && typeof window.AndroidBridge.takePhoto === 'function');
    },
    call: function (name, payload) {
      return new Promise(function (resolve, reject) {
        var id = 'cb' + (++__cbSeq);
        __cbs[id] = function (type, data) {
          if (type === 'ok') resolve(data);
          else reject(new Error(data || '操作失败'));
        };
        try { window.AndroidBridge[name](id, payload || ''); }
        catch (e) { delete __cbs[id]; reject(e); }
      });
    },
    compressImage: function (dataUrl, maxDim, quality) {
      return imageToCanvas(dataUrl, { maxDim: maxDim || 1100, quality: quality || 0.7 });
    },
    prepareOcrImage: function (dataUrl) {
      return imageToCanvas(dataUrl, { maxDim: 2200, quality: 0.85, bg: '#fff' });
    }
  };
})();
