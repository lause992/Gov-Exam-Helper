ed ? ' gray' : '') + '" data-act="toggleSaveNews" data-title="' + esc(title) + '" data-source="' + esc(o.source || '人民日报') + '" data-time="' + esc(o.time || '') + '">' + (isSaved ? '★ 已收藏' : '☆ 收藏') + '</button>' +
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
    var keywords = ['明星','演员','综艺','电影','电视剧','歌曲','音乐','恋情','结婚','离' + '婚','出' + '轨',
      '偶像','选秀','网红','直播','带货','真人秀','脱口秀','喜剧','相声','小品','魔术','舞蹈',
      '偶像团体','创造营','青春有你','快乐大本营','天天向上','我是歌手','奔跑吧','极限挑战',
      '爸爸去哪儿','中国好声音','梦想的声音','蒙面歌王','跨界歌王','声临其境','演员的诞生',
      '这！就是街舞','热血街舞团','乘风破浪的姐姐','披荆斩棘的哥哥','脱口秀大会','吐槽大会',
      '奇葩说','中国达人秀','达人秀','舞林大会','笑傲江湖','相声有新人','欢乐喜剧人',
      '我为喜剧狂','今夜百乐门','我就是演员','演员请就位','热搜','爆','沸','热',
      '恋情','官宣','分手','怀孕','产子','婚礼','离' + '婚','出' + '轨','出' + '轨',
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
        { role: 'system
