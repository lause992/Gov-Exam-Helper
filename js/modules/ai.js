/* ===== modules/ai.js =====
 * AI 对话与文本渲染模块：智谱 chat/vision、错题摘要、AI 问答、Markdown 渲染等。
 * 对外暴露 XCAPP.ai
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
  function fetchNews() { return NS.news.fetchNews(); }

  // === 模块代码（从 app.js 提取，保持原样） ===
  var ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  var ZHIPU_API_KEY = '9c6f09cc27ae4846995e1474b23db127.Zh68EAialtuTh2oL';
  var ZHIPU_TEXT_MODEL = 'glm-4-flash-250414';
  var ZHIPU_VISION_MODEL = 'glm-4v-flash';

  function zhipuChat(messages, maxTokens, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        reject(new Error('AI 请求超时，请稍后重试'));
      }, timeoutMs || 30000);
      fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + ZHIPU_API_KEY
        },
        body: JSON.stringify({
          model: ZHIPU_TEXT_MODEL,
          messages: messages,
          max_tokens: maxTokens || 2048,
          stream: false,
          temperature: 0.7
        })
      }).then(function (r) {
        clearTimeout(timeout);
        if (!r.ok) {
          throw new Error('AI 服务异常（' + r.status + '）');
        }
        return r.json();
      }).then(function (data) {
        clearTimeout(timeout);
        var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (content) {
          resolve(String(content));
        } else {
          reject(new Error((data && data.error && data.error.message) || 'AI 服务返回异常'));
        }
      }).catch(function (e) {
        clearTimeout(timeout);
        reject(e && e.message ? e : new Error('无法连接 AI 服务，请检查网络'));
      });
    });
  }

  function zhipuVision(dataUrl, prompt, maxTokens) {
    return new Promise(function (resolve, reject) {
      var timeout = setTimeout(function () {
        reject(new Error('识别超时，请稍后重试'));
      }, 30000);
      fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + ZHIPU_API_KEY
        },
        body: JSON.stringify({
          model: ZHIPU_VISION_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: prompt }
            ]
          }],
          max_tokens: Math.min(maxTokens || 1024, 1024),
          stream: false,
          temperature: 0.1
        })
      }).then(function (r) {
        clearTimeout(timeout);
        if (!r.ok) {
          throw new Error('识别服务异常（' + r.status + '）');
        }
        return r.json();
      }).then(function (data) {
        clearTimeout(timeout);
        var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (content) {
          resolve(String(content));
        } else {
          reject(new Error((data && data.error && data.error.message) || '识别服务返回异常'));
        }
      }).catch(function (e) {
        clearTimeout(timeout);
        reject(e && e.message ? e : new Error('无法连接识别服务，请检查网络'));
      });
    });
  }

  function buildWrongBookSummary() {
    try {
      var qs = state.questions || [];
      if (!qs.length) return '';
      var today = todayStr();
      var pending = qs.filter(function (q) { return q.status === 'pending'; });
      var done = qs.filter(function (q) { return q.status === 'done'; });
      var overdue = pending.filter(function (q) { return q.reviewDate < today; }).length;
      var dueToday = pending.filter(function (q) { return q.reviewDate === today; }).length;
      var byCat = {};
      var bySub = {};
      var wrongRounds = 0;
      var wrongTotal = 0;
      qs.forEach(function (q) {
        var c = q.category || '未分类';
        byCat[c] = (byCat[c] || 0) + 1;
        var s = q.subCategory;
        if (s) bySub[s] = (bySub[s] || 0) + 1;
        (q.reviewHistory || []).forEach(function (h) {
          wrongTotal++;
          if (h.correct === null) return;
          if (!h.correct) wrongRounds++;
        });
      });
      var catRank = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
      var subRank = Object.keys(bySub).sort(function (a, b) { return bySub[b] - bySub[a]; });
      var weak = [];
      catRank.forEach(function (c) {
        var arr = qs.filter(function (q) { return q.category === c; });
        var d = arr.filter(function (q) { return q.status === 'done'; }).length;
        var rate = arr.length ? Math.round(d / arr.length * 100) : 0;
        weak.push(c + '（共' + arr.length + '题，完成率' + rate + '%）');
      });
      var parts = [
        '【我的错题本数据摘要】',
        '错题总数：' + qs.length + '题；待复盘：' + pending.length + '题；已复盘：' + done.length + '题。',
        '逾期未复盘：' + overdue + '题；今天应复盘：' + dueToday + '题。',
        '最近' + wrongTotal + '次复盘记录中答错' + wrongRounds + '次（正确率' + (wrongTotal ? Math.round((wrongTotal - wrongRounds) / wrongTotal * 100) : 100) + '%）。',
        '各分类题量排序：' + catRank.join('、') + '。',
        '各分类复盘完成情况：' + weak.join('；') + '。'
      ];
      if (subRank.length) {
        parts.push('高频子分类：' + subRank.slice(0, 6).join('、') + '。');
      }
      return parts.join('\n');
    } catch (e) { return ''; }
  }

  function fetchAiAnswer(question, history) {
    var q = String(question || '');
    var now = new Date();
    var dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    var weekday = '日一二三四五六'.charAt(now.getDay());
    var timeStr = (now.getHours() < 10 ? '0' + now.getHours() : now.getHours()) + ':' + (now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes());
    var sysPrompt = '你是一名公务员考试（国考/省考/事业单位）备考助手，擅长行测、申论、常识、时政等知识。' +
      '本机当前时间：' + dateStr + '（星期' + weekday + '）' + timeStr + '。请以此为准回答一切与时政、新闻、日期、时间相关的问题；用户询问"今天几号/星期几/几点"等日期时间问题时，直接依据该时间作答。' +
      '你的知识截止时间较早，遇到需要最新时政、新闻、时事热点的问题时，必须只依据用户消息中提供的新闻列表作答，不要编造或使用你记忆中的旧新闻，也不要编造新闻。' +
      '回答要简洁、准确、有条理，适当使用换行和序号。' +
      '下面是本次对话的上下文历史（用户和你的历史问答），请结合上下文理解用户意图，但回答时以最新问题为准。';
    var wrongSummary = buildWrongBookSummary();
    if (wrongSummary) {
      sysPrompt += '\n\n【用户错题数据】\n' + wrongSummary +
        '\n当用户询问学习建议、复习计划、薄弱项分析、答题技巧等相关问题时，请结合以上错题数据给出针对性建议（如指出薄弱分类、建议优先复习的方向）；其他问题无需刻意提及这些数据。';
    }
    var msgs = [{ role: 'system', content: sysPrompt }];
    if (history && history.length) {
      var recent = history.slice(-20);
      recent.forEach(function (m) {
        if (m && m.role === 'user') msgs.push({ role: 'user', content: m.content || (m.img ? '（用户上传了一张图片）' : '') });
        else if (m && m.role === 'bot') msgs.push({ role: 'assistant', content: m.content || '' });
      });
    }
    msgs.push({ role: 'user', content: q });
    var isDateAsk = /今天几号|今天是几号|今天星期|今天是星期|几月几号|今天日期|今天几点|现在几点|现在几点了|现在时间|今天时间|哪一天/.test(q);
    var isNewsAsk = isDateAsk ? false : /时政|新闻|头条|要闻|热点|时事|今日.*发生|今天.*发生|最近.*大事|重要讲话|重大会议|最新消息|今年|日期|最新/.test(q);
    if (isNewsAsk) {
      return new Promise(function (resolve, reject) {
        var useItems = function (items) {
          var newsText = items.length
            ? items.map(function (it, i) { return (i + 1) + '. ' + it.title + (it.summary ? '（' + it.summary + '）' : ''); }).join('\n')
            : '（当前未获取到新闻列表）';
          var userMsg = q + '\n\n【今日实时新闻列表】\n' + newsText +
            '\n\n请基于以上新闻回答我的问题；若列表为空，请如实说明未获取到今日新闻。';
          msgs[msgs.length - 1] = { role: 'user', content: userMsg };
          zhipuChat(msgs, 4096).then(resolve, reject);
        };
        if (state.news.items.length) {
          useItems(state.news.items);
        } else {
          fetchNews().then(function (items) {
            state.news.items = items;
            useItems(items);
          });
        }
      });
    }
    return zhipuChat(msgs, 4096);
  }

  function aiText(html, text) {
    return html + String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '<br>');
  }

  function mdInline(s) {
    s = String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/`([^`]+)`/g, '<code class="ai-inline">$1</code>');
    return s;
  }

  function mdRender(text) {
    var t = String(text == null ? '' : text);
    t = t
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/(\d{1,3}[.、])\s/g, '\n$1 ')
      .replace(/([一二三四五六七八九十百]{1,3}[、.])\s/g, '\n$1 ')
      .replace(/(^|[^\n*])\*\s+(?=\*\*)/g, '$1\n* ')
      .replace(/^([ \t]*#{1,6})(?=[^ \t#\n])/gm, '$1 ')
      .replace(/([^\n])#+(?=[ \t]|$)/g, '$1')
      .replace(/[ \t]{2,}\*(?=\s)/g, '\n*');
    var lines = t.split('\n');
    var html = '';
    var inCode = false;
    var codeBuf = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim() === '' ? lines[i] : lines[i].replace(/^\s+/, '');
      if (/^```/.test(line.trim())) {
        if (!inCode) { inCode = true; codeBuf = []; }
        else {
          html += '<pre class="ai-code-block">' + String(codeBuf.join('\n'))
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
          inCode = false;
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }
      var m;
      if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
        var lvl = Math.min(m[1].length, 3);
        html += '<div class="ai-h' + lvl + '">' + mdInline(m[2]) + '</div>';
      } else if ((m = /^>\s?(.*)$/.exec(line))) {
        html += '<div class="ai-quote">' + mdInline(m[1]) + '</div>';
      } else if ((m = /^[-*]\s+(.+)$/.exec(line))) {
        html += '<div class="ai-li">• ' + mdInline(m[1]) + '</div>';
      } else if ((m = /^(\d+)[.、]\s+(.+)$/.exec(line))) {
        html += '<div class="ai-li"><span class="ai-num">' + m[1] + '.</span> ' + mdInline(m[2]) + '</div>';
      } else if (/^\s*$/.test(line)) {
        html += '<div class="ai-pad"></div>';
      } else {
        html += '<div class="ai-p">' + mdInline(line) + '</div>';
      }
    }
    if (inCode) {
      html += '<pre class="ai-code-block">' + String(codeBuf.join('\n'))
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';
    }
    return html;
  }

  function aiScrollBottom(msgs) {
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function typeInto(el, text, done) {
    var i = 0;
    var timer = setInterval(function () {
      if (!el.isConnected) {
        clearInterval(timer);
        if (done) done();
        return;
      }
      i += 2;
      if (i >= text.length) {
        clearInterval(timer);
        el.innerHTML = mdRender(text);
        if (done) done();
      } else {
        el.innerHTML = aiText('', text.slice(0, i));
      }
      var msgs = $('#ai-msgs');
      if (msgs) aiScrollBottom(msgs);
    }, 20);
  }

  function renderAi() {
    var a = state.ai;
    var html = '<div class="ai-page">';
    html += '<div class="ai-hint card">可以问：词语用在这里合适吗？法律常识、历史常识、时政热点、答题技巧…</div>';
    if (a.history.length) {
      html += '<button class="btn danger sm" data-act="clearAiHistory" style="margin:0 2px 8px">清空对话</button>';
    }
    html += '<div class="ai-msgs" id="ai-msgs">';
    a.history.forEach(function (m) {
      if (m.role === 'user') {
        html += '<div class="ai-msg user">' +
          (m.img ? '<img class="ai-msg-img" src="' + esc(m.img) + '" alt="图片">' : '') +
          (m.content ? aiText('', m.content) : '') +
          '</div>';
      } else {
        html += '<div class="ai-msg bot">' + mdRender(m.content) + '</div>';
      }
    });
    if (a.loading) {
      html += '<div class="ai-msg bot typing" id="ai-typing">正在思考…</div>';
    }
    html += '</div>';
    html += '<div class="ai-input-row">' +
      '<input class="input" id="ai-input" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="输入你的问题…" value="' + esc(state.ai.input || '') + '" style="flex:1">' +
      '<button class="btn gray ai-img-btn" data-act="pickAiImage"' + (a.loading ? ' disabled' : '') + ' title="上传图片">图片</button>' +
      '<button class="btn ai-send-btn" data-act="sendAiQuestion"' + (a.loading ? ' disabled' : '') + '>发送</button>' +
      '</div>';
    if (a.pendingImg) {
      html += '<div class="ai-img-preview" id="ai-img-preview">' +
        '<img src="' + a.pendingImg + '" alt="待发送图片">' +
        '<button class="ai-img-remove" data-act="removeAiImage">&times;</button>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  // === 对外暴露 ===
  NS.ai = {
    zhipuChat: zhipuChat,
    zhipuVision: zhipuVision,
    buildWrongBookSummary: buildWrongBookSummary,
    fetchAiAnswer: fetchAiAnswer,
    aiText: aiText,
    mdInline: mdInline,
    mdRender: mdRender,
    aiScrollBottom: aiScrollBottom,
    typeInto: typeInto,
    renderAi: renderAi
  };
})();
