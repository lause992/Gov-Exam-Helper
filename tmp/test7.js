.slice(0, 10));
      }).catch(function () {
        resolve(list.slice(0, 10));
      });
    });
  }

  function aiSummarizeNews(item) {
    return new Promise(function (resolve, reject) {
      var now = new Date();
      var dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
      zhipuChat([
        { role: 'system', content: '你是人民日报资深时政编辑，同时是公务员考试（行测常识、申论、面试）备考专家。今天是' + dateStr + '。请对用户提供的时政要闻进行提炼总结，面向公务员考试备考使用。' },
        { role: 'user', content: '请对下面这条时政要闻进行提炼总结，要求：\n' +
          '1. 用 2-3 句话概括事件核心内容；\n' +
          '2. 提炼 3-5 个考试要点（政策名词、关键数据、目标、措施等），便于行测常识和申论积累；\n' +
          '3. 以人民日报评论风格提炼 2-3 句金句，可直接用于申论大作文或面试答题（金句用【金句】标记，每句单独一行）；\n' +
          '4. 内容须客观准确，不编造事实，来源为人民日报。\n\n要闻标题：' + item.title }
      ], 2048, 30000).then(resolve, reject);
    });
  }

  function fetchNews() {
    return new Promise(function (resolve) {
      var apis = [
        'https://cn.apihz.cn/api/xinwen/toutiao.php?id=10019937&key=3e517cc5c3d87dd21ed69d1f63fc3cde',
        'https://tenapi.cn/v2/toutiaohot',
        'https://api.vvhan.com/api/hotlist/wbHot'
      ];
      var attempt = 0;
      function tryNext() {
        if (attempt >= apis.length) {
          resolve(getFallbackNews());
          return;
        }
        var url = apis[attempt];
        attempt++;
        var timeout = setTimeout(function () { tryNext(); }, 5000);
        fetch(url).then(function (r) {
          clearTimeout(timeout);
          if (!r.ok) { tryNext(); return; }
          return r.json();
        }).then(function (data) {
          if (data && data.data && data.data.length > 0) {
            var isApihz = url.indexOf('apihz.cn') >= 0;
            var items = data.data.map(function (item) {
              var hot = item.hot != null ? item.hot : '';
              return {
                title: item.title || item.name || '',
                source: isApihz ? '头条热榜' : (hot || '热搜'),
                time: isApihz ? (hot !== '' ? '热度 ' + hot : '') : ''
              };
            }).filter(function (item) { return !isEntertainmentNews(item.title) && !isForeignNews(item.title); });
            if (items.length) {
              aiFilterNews(items).then(function (picked) {
                var d = new Date();
                var day = (d.getMonth() + 1) + '月' + d.getDate() + '日';
                resolve(picked.map(function (it) {
                  return { title: it.title, source: '人民日报', time: day, summary: '' };
                }));
              });
            } else { tryNext(); }
          } else {
            tryNext();
          }
        }).catch(function () {
          clearTimeout(timeout);
          tryNext();
        });
      }
      tryNext();
    });
  }

  function openForm(q) {
    state.form = q ? {
      id: q.id, category: q.category, stem: q.stem,
      options: (q.options || []).slice(), answer: q.answer,
      wrongThinking: q.wrongThinking || '', correctThinking: q.correctThinking || '',
      reviewDays: q.reviewDays || 3, reviewWeekday: q.reviewWeekday || 0, image: q.image || null, original: q,
      source: q.source || '',
      optImgs: (q.optImgs || (q.options || []).map(function () { return null; })).slice()
    } : freshForm(null);
    state.overlay = { type: 'form' };
  }

  function freshForm(q) {
    var emptyImgs = (q ? (q.options || []) : ['', '', '', '']).map(function () { return null; });
    return {
      id: q && q.id ? q.id : null, category: q ? q.category : '', stem: q ? q.stem : '',
      options: (q ? (q.options || []) : ['', '', '', '']).slice(), answer: q ? q.answer : '',
      wrongThinking: q ? q.wrongThinking || '' : '', correctThinking: q ? q.correctThinking || '' : '',
      reviewDays: q ? q.reviewDays || 3 : 3, reviewWeekday: q ? q.reviewWeekday || 0 : (state.settings.reviewWeekday || 0), image: q ? q.image || null : null, original: q || null,
      source: q ? q.source || '' : '',
      optImgs: (q && q.optImgs ? q.optImgs : emptyImgs).slice()
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
    html += '<div class="section-title" style="margin-top:0">应用到现有错题</div>';
  
