TML = '<p class="muted mt12">查询中…</p>';
    } else if (mode) {
      box.innerHTML = renderIdiomResult(mode);
    }
  }

  function updateProofreadBox(status, text) {
    var box = $('#proofread-box');
    if (!box) return;
    if (status === 'loading') {
      box.innerHTML = '<p class="muted mt8">AI 校对中…</p>';
    } else if (status === 'result') {
      box.innerHTML = '<div class="proofread-result"></div>';
      var pEl = box.firstChild;
      if (pEl) typeInto(pEl, text, null);
    } else if (status === 'error') {
      box.innerHTML = '<p class="muted mt8" style="color:#c0392b">' + esc(text) + '</p>';
    }
  }

  function renderIdiomResult(r) {
    if (!r) return '';
    var saved = state.idiom.saved.some(function (s) { return s.name === r.name; });
    var html = '<div class="idiom-result card">';
    html += '<div class="idiom-name">' + esc(r.name) +
      (r.extra && r.extra.cx ? '<span class="tag" style="background:#8a93a6;vertical-align:middle;margin-left:8px">' + esc(r.extra.cx) + '</span>' : '') +
      '</div>';
    if (r.meaning) html += '<div class="idiom-block"><div class="lb">释义</div><div class="val">' + esc(r.meaning) + '</div></div>';
    if (r.myMeaning) html += '<div class="idiom-block"><div class="lb">我的释义</div><div class="val">' + esc(r.myMeaning) + '</div></div>';
    if (r.provenance) html += '<div class="idiom-block"><div class="lb">出处</div><div class="val">' + esc(r.provenance) + '</div></div>';
    if (r.example) html += '<div class="idiom-block"><div class="lb">例句</div><div class="val">' + esc(r.example) + '</div></div>';
    if (r.extra && r.extra.discLines && r.extra.discLines.length) {
      html += '<div class="idiom-block"><div class="lb">近义词辨析</div>';
      r.extra.discLines.forEach(function (line) {
        html += '<div class="val">' + esc(line.replace(/^[-*•]\s*/, '')) + '</div>';
      });
      html += '</div>';
    }
    if (r.extra && r.extra.tongyi) html += '<div class="idiom-block"><div class="lb">同义词</div><div class="val">' + esc(r.extra.tongyi) + '</div></div>';
    if (r.extra && r.extra.fanyi) html += '<div class="idiom-block"><div class="lb">反义词</div><div class="val">' + esc(r.extra.fanyi) + '</div></div>';
    if (r.extra && r.extra.yufa) html += '<div class="idiom-block"><div class="lb">语法</div><div class="val">' + esc(r.extra.yufa) + '</div></div>';
    html += '<div class="idiom-block">';
    html += '<div class="lb">我的释义</div>';
    html += '<textarea class="textarea" id="my-meaning" rows="2" placeholder="写下你对这个词语的理解，可交给 AI 校对…"></textarea>';
    html += '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn gray" data-act="proofreadMeaning"' + (state.idiom.proof.loading ? ' disabled' : '') + '>交给 AI 校对</button>' +
      '</div>';
    html += '<div id="proofread-box">';
    if (state.idiom.proof.loading) {
      html += '<p class="muted mt8">AI 校对中…</p>';
    } else if (state.idiom.proof.text) {
      html += '<div class="proofread-result">' + mdRender(state.idiom.proof.text) + '</div>';
    }
    html += '</div>';
    html += '</div>';
    html += '<div class="btn-row" style="margin-top:10px">' +
      (saved
        ? '<button class="btn gray" data-act="unsaveIdiom" data-key="' + esc(r.name) + '">已收藏</button>'
        : '<button class="btn" data-act="saveIdiom" data-key="' + esc(r.name) + '">收藏</button>') +
      '</div>';
    html += '</div>';
    return html;
  }

  function renderIdiom() {
    var it = state.idiom;
    var html = '<div class="idiom-page">';
    html += '<div class="section-title">词语查询</div><div class="card">';
    html += '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<input class="input" id="idiom-input" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="输入词语或成语，如：谱写、马到成功" value="' + esc(state.idiom.input || '') + '" style="flex:1">' +
      '<button class="btn ai-send-btn" data-act="queryIdiom">查询</button>' +
      '</div>';
    html += '<div class="btn-row">' +
      '<button class="btn gray" data-act="randomIdiom">随机一个成语</button>' +
      '</div>';
    html += '</div>';
    html += '<div id="idiom-result-box">';
    if (it.loading) {
      html += '<p class="muted mt12">查询中…</p>';
    } else if (it.result) {
      html += renderIdiomResult(it.result);
    }
    html += '</div>';

    html += '<div id="idiom-saved-box">';
    html += renderIdiomSavedBox();
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderIdiomSavedBox() {
    var it = state.idiom;
    if (!it.saved.length) {
      return '<div class="section-title">我的积累</div><div class="card"><p class="muted">收藏的词语和成语会显示在这里，方便随时复习。</p></div>';
    }
    var html = '<div class="section-title">我的积累（' + it.saved.length + '）</div><div class="card">';
    it.saved.forEach(function (s) {
      var brief = String(s.meaning || '').replace(/\n+/g, ' ');
      if (brief.length > 40) brief = brief.slice(0, 40) + '…';
      html += '<div class="idiom-saved" data-act="openIdiomSaved" data-key="' + esc(s.name) + '">' +
        '<div class="idiom-saved-name">' + esc(s.name) + '</div>' +
        '<div class="idiom-saved-mean">' + esc(brief) + '</div>';
      if (s.myMeaning) html += '<div class="idiom-saved-my">我的释义：' + esc(s.myMeaning) + '</div>';
      html += '<button class="btn danger sm" data-act="unsaveIdiom" data-key="' + esc(s.name) + '" style="margin-top:6px">移除</button>' +
        '</div>';
    });
    html += '<button class="btn danger sm mt12" data-act="clearIdioms">清空收藏</button>';
    html += '</div>';
    return html;
  }

  function updateIdiomSavedBox() {
    var box = $('#idiom-saved-box');
    if (box) box.innerHTML = renderIdiomSavedBox();
  }

  function refreshIdiomSaveBtn() {
    var box = $('#idiom-result-box');
    if (!box) return;
    var r = state.idiom.result;
    var saved = r && state.idiom.saved.some(function (s) { return s.name === r.name; });
    var btn = box.querySelector('[data-act="saveIdiom"], [data-act="unsaveIdiom"]');
    if (!btn) return;
    btn.setAttribute('data-act', saved ? 'unsaveIdiom' : 'saveIdiom');
    btn.textContent = saved ? '已收藏' : '收藏';
    btn.className = saved ? 'btn gray' : 'btn';
  }

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
      .replace(/(^|[^\n])#+\s/g, '$1\n')
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

  function renderNews() {
    var n = state.news;
    var html = '<div class="news-page">';
    html += '<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span>每日时政</span>' +
      '<button class="btn gray sm" data-act="openNewsSaved"' + (n.saved.length ? '' : ' disabled') + '>收藏夹（' + n.saved.length + '）</button>' +
      '</div>';

    if (n.loading) {
      html += '<div class="card" style="text-align:center"><p class="muted">加载中...</p></div>';
    } else if (n.items.length > 0) {
      html += '<p class="muted" style="font-size:12px;margin:0 2px 8px">AI 已从实时热点中筛选出对公考有价值的时政要闻，点击卡片查看 AI 提炼总结与金句</p>';
      n.items.forEach(function (item, i) {
        var isSaved = n.saved.some(function (s) { return s.title === item.title; });
        html += '<div class="news-item card" data-act="openNewsDetail" data-title="' + esc(item.title) + '" data-source="' + esc(item.source || '人民日报') + '" data-time="' + esc(item.time || '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' + esc(item.title) + '</div>' +
          '<div class="news-meta"><span>' + esc(item.source || '人民日报') + '</span><span>' + esc(item.time || '') + '</span></div></div>' +
          '<span class="news-star' + (isSaved ? ' on' : '') + '" data-act="toggleSaveNews" data-title="' + esc(item.title) + '" title="收藏">' + (isSaved ? '★' : '☆') + '</span>' +
          '</div>';
        html += '<div class="news-open">点击提炼总结 ▶</div>';
        html += '</div>';
      });
      html += '<button class="btn ghost mt12" data-act="refreshNews">刷新新闻</button>';
    } else {
      html += '<div class="card">';
      html += '<p class="muted" style="margin-bottom:12px">今日时政要闻（点击卡片查看 AI 提炼总结与金句）</p>';
      html += '<div class="news-list">';
      var fallbackNews = getFallbackNews();
      fallbackNews.forEach(function (item, i) {
        var isSaved = n.saved.some(function (s) { return s.title === item.title; });
        html += '<div class="news-item card" data-act="openNewsDetail" data-title="' + esc(item.title) + '" data-source="' + esc(item.source) + '" data-time="' + esc(item.time) + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' + esc(item.title) + '</div>' +
          '<div class="news-meta"><span>' + esc(item.source) + '</span><span>' + esc(item.time) + '</span></div></div>' +
          '<span class="news-star' + (isSaved ? ' on' : '') + '" data-act="toggleSaveNews" data-title="' + esc(item.title) + '" title="收藏">' + (isSaved ? '★' : '☆') + '</span>' +
          '</div>';
        html += '<div class="news-open">点击提炼总结 ▶</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<button class="btn ghost mt12" data-act="refreshNews">刷新新闻</button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderNewsDetail() {
    var o = state.overlay;
    var title = o.title;
    var n = state.news;
    var cached = n.summaries[title] || '';
    var isSaved = n.saved.some(function (s) { return s.title === title; });
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">AI 时政提炼</div></div>' +
      '<div class="overlay-body">';
    html += '<div class="card">';
    html += '<div class="news-title">' + esc(title) + '</div>';
    html += '<div class="news-meta" style="margin:4px 0 10px"><span>' + esc(o.source || '人民日报') + '</span><span>' + esc(o.time || '') + '</span></div>';
    if (n.detailLoading) {
      html += '<p class="muted">AI 提炼中…</p>';
    } else if (cached) {
      html += '
