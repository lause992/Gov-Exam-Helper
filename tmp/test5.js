<div class="news-ai-summary">' + mdRender(cached) + '</div>';
    } else if (n.detailError) {
      html += '<p class="muted" style="color:#c0392b">' + esc(n.detailError) + '</p>';
    } else {
      html += '<p class="muted">AI 提炼中…</p>';
    }
    html += '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn' + (isSaved ? ' gray' : '') + '" data-act="toggleSaveNews" data-title="' + esc(title) + '" data-source="' + esc(o.source || '人民日报') + '" data-time="' + esc(o.time || '') + '">' + (isSaved ? '★ 已收藏' : '☆ 收藏') + '</button>' +
      '</div>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function renderNewsSaved() {
    var n = state.news;
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">我的收藏（' + n.saved.length + '）</div></div>' +
      '<div class="overlay-body">';
    if (!n.saved.length) {
      html += '<div class="card"><p class="muted">还没有收藏任何时政要闻。在新闻卡片上点击 ☆ 即可收藏。</p></div>';
    } else {
      n.saved.forEach(function (item) {
        html += '<div class="news-item card" style="cursor:pointer" data-act="openNewsDetail" data-title="' + esc(item.title) + '" data-source="' + esc(item.source || '人民日报') + '" data-time="' + esc(item.time || '') + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="flex:1"><div class="news-title">' + esc(item.title) + '</div>' +
          '<div class="news-meta"><span>' + esc(item.source || '人民日报') + '</span><span>' + esc(item.time || '') + '</span></div></div>' +
          '<span class="news-star on" data-act="unsaveNews" data-title="' + esc(item.title) + '" title="取消收藏">★</span>' +
          '</div>';
        html += '</div>';
      });
    }
    html += '</div></div>';
    return html;
  }

  function getFallbackNews() {
    var today = new Date();
    var m = today.getMonth() + 1;
    var d = today.getDate();
    return [
      { title: '2026年政府工作报告要点', source: '人民日报', time: m + '月' + d + '日', summary: '报告强调高质量发展，推进科技创新和产业升级。' },
      { title: '国务院常务会议部署重点工作', source: '新华社', time: m + '月' + d + '日', summary: '会议研究部署进一步扩大内需、促进消费的政策措施。' },
      { title: '乡村振兴战略深入推进', source: '人民日报', time: m + '月' + d + '日', summary: '农业农村部表示将加大支持力度，推动农业现代化发展。' },
      { title: '科技创新助力经济高质量发展', source: '新华社', time: m + '月' + d + '日', summary: '科技部表示将加大基础研究投入，推动关键核心技术攻关。' },
      { title: '民生保障政策持续完善', source: '人民日报', time: m + '月' + d + '日', summary: '人社部表示将健全多层次社会保障体系，提高保障水平。' }
    ];
  }

  function isEntertainmentNews(title) {
    var t = (title || '').toLowerCase();
    var keywords = ['明星','演员','综艺','电影','电视剧','歌曲','音乐','恋情','结婚','离婚','出轨',
      '偶像','选秀','网红','直播','带货','真人秀','脱口秀','喜剧','相声','小品','魔术','舞蹈',
      '偶像团体','创造营','青春有你','快乐大本营','天天向上','我是歌手','奔跑吧','极限挑战',
      '爸爸去哪儿','中国好声音','梦想的声音','蒙面歌王','跨界歌王','声临其境','演员的诞生',
      '这！就是街舞','热血街舞团','乘风破浪的姐姐','披荆斩棘的哥哥','脱口秀大会','吐槽大会',
      '奇葩说','中国达人秀','达人秀','舞林大会','笑傲江湖','相声有新人','欢乐喜剧人',
      '我为喜剧狂','今夜百乐门','我就是演员','演员请就位','热搜','爆','沸','热',
      '恋情','官宣','分手','怀孕','产子','婚礼','离婚','出轨','出轨',
      '导演','编剧','票房','首映','上映','杀青','开机','片场','片酬','代言','代言费',
      '时尚','穿搭','美妆','护肤','健身','减肥','减肥法','食谱','旅游','美食','探店',
      '游戏','电竞','LOL','王者荣耀','和平精英','绝地求生','原神','崩坏','鸣潮',
      '网红','主播','带货','直播带货','电商','购物','双十一','618','年货节',
      '明星','艺人','idol','偶像','饭圈','粉丝','应援','打榜','控评','反黑'];
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  function isForeignNews(title) {
    var t = (title || '').toLowerCase();
    var keywords = ['美国','特朗普','拜登','俄罗斯','普京','乌克兰','日本','韩国','朝鲜','英国','法国',
      '德国','欧盟','北约','以色列','巴勒斯坦','伊朗','印度','澳大利亚','加拿大',
      '中东','加沙','俄乌','美联储','美元加息','关税战','贸易战',
      '大选','州长','澳网','世界杯','欧冠','NBA'];
    for (var i = 0; i < keywords.length; i++) {
      if (t.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  function aiFilterNews(items) {
    return new Promise(function (resolve) {
      var list = items.slice(0, 30);
      if (!list.length) { resolve([]); return; }
      var numbered = list.map(function (it, i) { return (i + 1) + '. ' + it.title; }).join('\n');
      zhipuChat([
        { role: 'system', content: '你是人民日报时政编辑兼公务员考试备考专家。用户会给你一批新闻标题列表，请从中挑选对公务员考试（行测常识、申论、面试时政积累）最有价值的中国国内时政要闻，例如：国家政策、法律法规、政府工作报告、重大会议、外交（中国对外交往）、经济、科技、民生、社会治理等。严格排除：娱乐、体育八卦、明星网红、社会花边、以及纯国外新闻（他国内政、战争冲突、外国大选、外国文体等与我国考试无关的内容）。' },
        { role: 'user', content: '请从下面标题中挑选最值得公务员考试考生关注的时政要闻，只输出选中条目的序号（编号），用英文逗号分隔，不要输出其他内容：\n' + numbered }
      ], 2048, 20000).then(function (txt) {
        var m = txt.match(/\d+/g);
        var picked = [];
        if (m) {
          m.forEach(function (n) {
            var idx = parseInt(n, 10) - 1;
            if (idx >= 0 && idx < list.length && picked.length < 10) picked.push(list[idx]);
          });
        }
        resolve(picked.length >= 3 ? picked : list.slice(0, 10));
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
    html += '<p class="muted" style="font-size:13px">将上方默认星期应用到所有「待复盘」错题，已完成的错题不受影响。</p>';
    html += '<button class="btn mt12" data-act="applyWeekdayAll">应用到所有待复盘错题</button>';
    html += '</div>';
    html += '<div class="card">';
    html += '<div class="section-title" style="margin-top:0">关于与更新</div>';
    html += '<p class="muted" style="font-size:13px" id="ver-info">版本：' + esc(remoteVersionText()) + '</p>';
    html += '<button class="btn mt12" data-act="manualUpdate">检查更新</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  function remoteVersionText() {
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersion === 'function') {
        return String(window.AndroidBridge.getAppVersion());
      }
    } catch (e) { /* ignore */ }
    return '1.0';
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

    html += '<div class="field"><span class="label">题目来源</span>' +
      '<input class="input" id="f-source" placeholder="如：2026国考行测真题、粉笔题库、XX模拟卷" value="' + esc(f.source) + '"></div>';

    html += '<div class="field"><span class="label">题干文字 <span class="muted">（可选，截图已含题干可留空）</span></span>' +
      '<textarea class="textarea" id="f-stem" rows="3" placeholder="题目内容（截图已包含题干时可留空）">' + esc(f.stem) + '</textarea></div>';

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

    html += '<div class="field"><span class="label">当时错误思路（防止以后再次踩坑）</span>' +
      '<textarea class="textarea" id="f-wrong" rows="3" placeholder="你当时为什么做错？错误的想法是什么？">' + esc(f.wrongThinking) + '</textarea></div>';

    html += '<div class="field"><span class="label">正确思路（可选，复盘时再补充）</span>' +
      '<textarea class="textarea" id="f-correct" rows="3" placeholder="这道题的正确解题思路">' + esc(f.correctThinking) + '</textarea></div>';

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

  function openDetail(id) {
    var q = findQ(id);
    if (!q) return;
    state.overlay = { type: 'detail', id: id };
    render();
  }

  function optContentHtml(q, i, text) {
    var img = q.optImgs && q.optImgs[i];
    if (img) return '<img class="opt-img" src="' + img + '">';
    var clean = stripOptionPrefix(text);
    return esc(clean || text || '');
  }

  function renderDetail() {
    var q = findQ(state.overlay.id);
    if (!q) { state.overlay = null; render(); return ''; }
    var html = '<div class="overlay">' +
      '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
      '<div class="title">错题详情</div></div>' +
      '<div class="overlay-body">';

    html += '<div class="card">';
    html += '<div class="q-top">' + catTag(q.category) + statusTag(q) + '</div>';
    if (q.source) html += '<p class="muted" style="margin-top:6px">来源：' + esc(q.source) + '</p>';
    if (q.reviewDate) html += '<p class="muted">' + (q.reviewWeekday ? '固定每周' + wdLabel(q.reviewWeekday) + '复盘 · ' : '') + '复盘日：' + fmtDate(q.reviewDate) + '　已复盘 ' + (q.rounds || 0) + ' 次</p>';
    if (q.stem) html += '<p style="font-size:14.5px;white-space:pre-wrap;margin-top:8px">' + esc(q.stem) + '</p>';
    if (q.image) html += '<div class="img-wrap"><img src="' + q.image + '"></div>';
    if (q.options && q.options.length) {
      html += '<div style="margin-top:10px">';
      q.options.forEach(function (opt, i) {
        html += '<div class="opt" style="cursor:default;background:#fff;border:none;padding:4px 0"><span class="key" style="width:22px;height:22px;font-size:12px">' + optionLetters[i] + '</span><span class="txt">' + optContentHtml(q, i, opt) + '</span></div>';
      });
      html += '</div>';
    }
    if (q.answer) {
      html += '<div class="mt12"><span class="answer-pill" id="detail-answer" style="display:none">正确答案 ' + esc(q.answer) + '</span>' +
        '<button class="btn gray sm" id="detail-show-answer">查看正确答案</button></div>';
    }
    html += '</div>';

    html += '<div class="card"><div class="detail-block"><div class="lb">当时的错误思路</div>' +
      '<div class="val">' + (q.wrongThinking ? esc(q.wrongThinking) : '<span class="muted">未填写</span>') + '</div></div>' +
      '<div class="detail-block"><div class="lb">正确思路</div>' +
      '<div class="val">' + (q.correctThinking ? esc(q.correctThinking) : '<span class="muted">尚未填写</span>') + '</div></div></div>';

    if (q.reviewHistory && q.reviewHistory.length) {
      html += '<div class="card"><div class="detail-block"><div class="lb">复盘记录</div>';
      q.reviewHistory.forEach(function (h) {
        html += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0">' +
          '<span>' + h.date + '</span>' +
          '<span style="color:' + (h.correct ? 'var(--ok)' : 'var(--danger)') + ';font-weight:600">' + (h.correct ? '答对' : '答错') + '</span>' +
          '</div>';
      });
      html += '</div></div>';
    }

    html += '<div class="actions">';
    if (q.status === 'pending') {
      html += '<button class="btn" data-act="practice" data-id="' + q.id + '">去复盘</button>';
      html += '<button class="btn gray" dat
