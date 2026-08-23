/* ===== modules/idiom.js =====
 * 词语 / 成语查询与积累：AI 查词、JSON 修复与解析、结果渲染、收藏管理。
 * 对外暴露 XCAPP.idiom
 * 依赖：state.js、storage.js、core.js
 */
(function () {
  "use strict";
  var NS = (window.XCAPP = window.XCAPP || {});

  // === 共享依赖别名（加载时可用） ===
  var $ = NS.utils.$,
    $all = NS.utils.$all,
    esc = NS.utils.esc,
    stripMd = NS.utils.stripMd;
  var pad = NS.utils.pad,
    todayStr = NS.utils.todayStr,
    addDays = NS.utils.addDays;
  var fmtDate = NS.utils.fmtDate,
    nextWeekdayDate = NS.utils.nextWeekdayDate,
    wdLabel = NS.utils.wdLabel;
  var stripOptionPrefix = NS.utils.stripOptionPrefix,
    fmtSize = NS.utils.fmtSize;
  var toast = NS.utils.toast,
    confirmDialog = NS.utils.confirmDialog,
    uid = NS.utils.uid;
  var storageSet = NS.storage.set,
    storageGet = NS.storage.get,
    storageDel = NS.storage.del;
  var nativeDataStore = NS.storage.nativeDataStore;
  var isNative = NS.bridge.isNative,
    nativeCall = NS.bridge.call;
  var compressImage = NS.bridge.compressImage,
    prepareOcrImage = NS.bridge.prepareOcrImage;
  var state = NS.state,
    IS_NODE = NS.IS_NODE;
  var CATEGORIES = NS.consts.CATEGORIES,
    SUBCATEGORIES = NS.consts.SUBCATEGORIES;
  var CAT_COLORS = NS.consts.CAT_COLORS,
    REVIEW_OPTIONS = NS.consts.REVIEW_OPTIONS;
  var optionLetters = NS.consts.optionLetters,
    STORAGE_KEY = NS.consts.STORAGE_KEY;
  var NAV_TABS = NS.consts.NAV_TABS,
    HOME_SUB_TABS = NS.consts.HOME_SUB_TABS,
    UNIT_LIST = NS.consts.UNIT_LIST;
  var save = NS.store.save,
    load = NS.store.load,
    findQ = NS.store.findQ;
  var saveSources = NS.store.saveSources,
    saveSettings = NS.store.saveSettings;
  var saveCalcHistory = NS.store.saveCalcHistory,
    saveIdioms = NS.store.saveIdioms,
    saveAiHistory = NS.store.saveAiHistory;
  var saveCompareCache = NS.store.saveCompareCache,
    saveNewsSaved = NS.store.saveNewsSaved;
  var saveNewsSummaries = NS.store.saveNewsSummaries,
    saveSummaries = NS.store.saveSummaries;
  var compressQuestionsImages = NS.store.compressQuestionsImages,
    markImgDirty = NS.store.markImgDirty;
  var imgKey = NS.store.imgKey,
    qImagesPayload = NS.store.qImagesPayload,
    persistDirtyImages = NS.store.persistDirtyImages;

  // === 跨模块引用（运行时通过 NS 解析，避免加载顺序耦合） ===
  function render() {
    return NS.shell.render();
  }
  function renderHeader() {
    return NS.shell.renderHeader();
  }
  function catTag(a, b, c) {
    return NS.shell.catTag(a, b, c);
  }
  function statusTag(q) {
    return NS.shell.statusTag(q);
  }
  function fetchAiAnswer(q, h) {
    return NS.ai.fetchAiAnswer(q, h);
  }
  function zhipuChat(messages, maxTokens, timeoutMs) {
    return NS.ai.zhipuChat(messages, maxTokens, timeoutMs);
  }
  function mdRender(text) {
    return NS.ai.mdRender(text);
  }
  function typeInto(el, text, done) {
    return NS.ai.typeInto(el, text, done);
  }

  // === 模块代码（从 app.js 提取，保持原样） ===
  var FALLBACK_IDIOMS = [
    {
      name: "马到成功",
      pinyin: "mǎ dào chéng gōng",
      meaning: "形容工作刚开始就取得成功。",
      provenance: "元·无名氏《小尉迟》第二折",
      example: "祝各位考生马到成功！",
    },
    {
      name: "一心一意",
      pinyin: "yī xīn yī yì",
      meaning: "只有一个心眼儿，没有别的考虑。形容做事专心致志。",
      provenance: "《三国志·魏志·杜恕传》",
      example: "他做事一心一意，从不分心。",
    },
    {
      name: "一鼓作气",
      pinyin: "yī gǔ zuò qì",
      meaning: "比喻趁劲头大的时候鼓起干劲，一口气把工作做完。",
      provenance: "《左传·庄公十年》",
      example: "我们要一鼓作气，趁热打铁。",
    },
    {
      name: "水滴石穿",
      pinyin: "shuǐ dī shí chuān",
      meaning: "比喻只要坚持不懈，细微之力也能做出很难办的事。",
      provenance: "宋·罗大经《鹤林玉露》",
      example: "学习贵在坚持，水滴石穿。",
    },
    {
      name: "持之以恒",
      pinyin: "chí zhī yǐ héng",
      meaning: "长久地坚持下去。",
      provenance: "清·曾国藩《家训喻纪泽》",
      example: "学习要持之以恒，不能三天打鱼两天晒网。",
    },
    {
      name: "胸有成竹",
      pinyin: "xiōng yǒu chéng zhú",
      meaning: "比喻做事之前已经有了主意和把握。",
      provenance: "宋·苏轼《文与可画筼筜谷偃竹记》",
      example: "他考试时胸有成竹，毫不紧张。",
    },
    {
      name: "按部就班",
      pinyin: "àn bù jiù bān",
      meaning: "指按照一定的步骤、顺序进行。也指按老规矩办事，缺乏创新精神。",
      provenance: "晋·陆机《文赋》",
      example: "做事要按部就班，稳扎稳打。",
    },
    {
      name: "不遗余力",
      pinyin: "bù yí yú lì",
      meaning: "把全部力量都使出来，一点不保留。",
      provenance: "《战国策·赵策三》",
      example: "他为了备考不遗余力。",
    },
    {
      name: "独辟蹊径",
      pinyin: "dú pì xī jìng",
      meaning: "自己开辟一条路。比喻独创一种新风格或者新方法。",
      provenance: "清·叶燮《原诗》",
      example: "这篇文章独辟蹊径，令人耳目一新。",
    },
    {
      name: "废寝忘食",
      pinyin: "fèi qǐn wàng shí",
      meaning: "顾不上睡觉，忘记了吃饭。形容非常专心努力。",
      provenance: "《列子·开瑞篇》",
      example: "他复习备考废寝忘食。",
    },
    {
      name: "各抒己见",
      pinyin: "gè shū jǐ jiàn",
      meaning: "各人充分发表自己的意见。",
      provenance: "清·李汝珍《镜花缘》",
      example: "讨论会上大家各抒己见。",
    },
    {
      name: "画蛇添足",
      pinyin: "huà shé tiān zú",
      meaning: "比喻做了多余的事，非但无益，反而不合适。",
      provenance: "《战国策·齐策二》",
      example: "文章结尾再补一段反而画蛇添足。",
    },
    {
      name: "精益求精",
      pinyin: "jīng yì qiú jīng",
      meaning: "好了还求更好。",
      provenance: "《论语·学而》",
      example: "他对每个知识点都精益求精。",
    },
    {
      name: "开卷有益",
      pinyin: "kāi juàn yǒu yì",
      meaning: "打开书本阅读，就会有益处。",
      provenance: "宋·王辟之《渑水燕谈录》",
      example: "多读书总是开卷有益的。",
    },
    {
      name: "量力而行",
      pinyin: "liàng lì ér xíng",
      meaning: "按照自己力量的大小去做，不要勉强。",
      provenance: "《左传·昭公十五年》",
      example: "定目标要量力而行。",
    },
    {
      name: "名列前茅",
      pinyin: "míng liè qián máo",
      meaning: "比喻名次列在前面。",
      provenance: "《左传·宣公十二年》",
      example: "他在班级考试中名列前茅。",
    },
    {
      name: "南辕北辙",
      pinyin: "nán yuán běi zhé",
      meaning: "比喻行动和目的正好相反。",
      provenance: "《战国策·魏策四》",
      example: "方向错了，再努力也是南辕北辙。",
    },
    {
      name: "破釜沉舟",
      pinyin: "pò fǔ chén zhōu",
      meaning: "比喻下决心不顾一切地干到底。",
      provenance: "《史记·项羽本纪》",
      example: "备考最后阶段要有破釜沉舟的决心。",
    },
    {
      name: "锲而不舍",
      pinyin: "qiè ér bù shě",
      meaning: "比喻有恒心，有毅力，坚持不懈。",
      provenance: "《荀子·劝学》",
      example: "锲而不舍，金石可镂。",
    },
    {
      name: "融会贯通",
      pinyin: "róng huì guàn tōng",
      meaning: "把各方面的知识或道理融合贯穿起来，从而得到全面透彻的理解。",
      provenance: "宋·朱熹《朱子全书》",
      example: "学习要融会贯通，不能死记硬背。",
    },
    {
      name: "事半功倍",
      pinyin: "shì bàn gōng bèi",
      meaning: "指做事得法，因而费力小，收效大。",
      provenance: "《孟子·公孙丑上》",
      example: "掌握方法才能事半功倍。",
    },
    {
      name: "守株待兔",
      pinyin: "shǒu zhū dài tù",
      meaning: "比喻死守狭隘经验，不知变通，或抱着侥幸心理妄想不劳而获。",
      provenance: "《韩非子·五蠹》",
      example: "不能守株待兔，要主动出击。",
    },
    {
      name: "脱颖而出",
      pinyin: "tuō yǐng ér chū",
      meaning: "比喻人的才能全部显露出来。",
      provenance: "《史记·平原君虞卿列传》",
      example: "他在面试中脱颖而出。",
    },
    {
      name: "温故知新",
      pinyin: "wēn gù zhī xīn",
      meaning: "温习旧的知识，能有新的体会和发现。",
      provenance: "《论语·为政》",
      example: "温故知新是复习的好方法。",
    },
    {
      name: "循序渐进",
      pinyin: "xún xù jiàn jìn",
      meaning: "指学习工作等按照一定的步骤逐渐深入或提高。",
      provenance: "《论语·宪问》",
      example: "学习要循序渐进，打好基础。",
    },
    {
      name: "一针见血",
      pinyin: "yī zhēn jiàn xiě",
      meaning: "比喻说话直截了当，切中要害。",
      provenance: "晋·陈寿《三国志》",
      example: "老师的点评一针见血。",
    },
    {
      name: "凿壁偷光",
      pinyin: "záo bì tōu guāng",
      meaning: "形容家贫而读书刻苦。",
      provenance: "《西京杂记》卷二",
      example: "他凿壁偷光般刻苦学习。",
    },
    {
      name: "专心致志",
      pinyin: "zhuān xīn zhì zhì",
      meaning: "把心思全放在上面，一心一意。",
      provenance: "《孟子·告子上》",
      example: "上课要专心致志听讲。",
    },
    {
      name: "未雨绸缪",
      pinyin: "wèi yǔ chóu móu",
      meaning: "比喻事先做好准备。",
      provenance: "《诗经·豳风·鸱鸮》",
      example: "备考要未雨绸缪，提前规划。",
    },
    {
      name: "一丝不苟",
      pinyin: "yī sī bù gǒu",
      meaning: "形容办事认真细致，一点儿不马虎。",
      provenance: "清·吴敬梓《儒林外史》",
      example: "审题时要一丝不苟。",
    },
    {
      name: "寸积铢累",
      pinyin: "cùn jī zhū lěi",
      meaning: "一寸一铢地积累起来。形容一点一滴地积累。",
      provenance: "宋·李纲《上渊圣皇帝实封言事奏状》",
      example: "词汇量要靠平时寸积铢累。",
    },
    {
      name: "相辅相成",
      pinyin: "xiāng fǔ xiāng chéng",
      meaning: "两件事物互相配合，互相补充，缺一不可。",
      provenance: "清·梁启超《初归国演说辞》",
      example: "实践与理论相辅相成，缺一不可。",
    },
    {
      name: "按图索骥",
      pinyin: "àn tú suǒ jì",
      meaning: "按照图像去寻找好马。比喻按线索去寻找；也比喻办事机械死板。",
      provenance: "明·杨慎《艺林伐山》",
      example: "不能按图索骥，要灵活变通。",
    },
    {
      name: "抱残守缺",
      pinyin: "bào cán shǒu quē",
      meaning: "抱着残缺陈旧的东西不放。形容思想保守，不求改进。",
      provenance: "《汉书·刘歆传》",
      example: "要敢于创新，不能抱残守缺。",
    },
    {
      name: "标新立异",
      pinyin: "biāo xīn lì yì",
      meaning: "提出新奇的主张，表示与众不同。有时含贬义。",
      provenance: "南朝宋·刘义庆《世说新语·文学》",
      example: "他总爱标新立异，吸引眼球。",
    },
    {
      name: "层出不穷",
      pinyin: "céng chū bù qióng",
      meaning: "接连不断地出现，没有穷尽。",
      provenance: "清·纪昀《阅微草堂笔记》",
      example: "新题型层出不穷，要多加练习。",
    },
    {
      name: "出类拔萃",
      pinyin: "chū lèi bá cuì",
      meaning: "超出同类之上，多指人的品德才能。",
      provenance: "《孟子·公孙丑上》",
      example: "他在众多考生中出类拔萃。",
    },
    {
      name: "沧海一粟",
      pinyin: "cāng hǎi yī sù",
      meaning: "大海里的一粒谷子。比喻非常渺小。",
      provenance: "宋·苏轼《赤壁赋》",
      example: "个人的力量不过是沧海一粟。",
    },
    {
      name: "大相径庭",
      pinyin: "dà xiāng jìng tíng",
      meaning: "比喻彼此相差很远，大不相同。",
      provenance: "《庄子·逍遥游》",
      example: "两人的观点大相径庭。",
    },
    {
      name: "得陇望蜀",
      pinyin: "dé lǒng wàng shǔ",
      meaning: "比喻贪得无厌，得寸进尺。",
      provenance: "《后汉书·岑彭传》",
      example: "做人不能得陇望蜀。",
    },
    {
      name: "东山再起",
      pinyin: "dōng shān zài qǐ",
      meaning: "比喻失势后重新恢复地位或再次崛起。",
      provenance: "《晋书·谢安传》",
      example: "失败并不可怕，还可东山再起。",
    },
    {
      name: "独树一帜",
      pinyin: "dú shù yī zhì",
      meaning: "单独树立起一面旗帜。比喻自成一家。",
      provenance: "清·袁枚《随园诗话》",
      example: "他的答题风格独树一帜。",
    },
    {
      name: "耳目一新",
      pinyin: "ěr mù yī xīn",
      meaning: "听到的看到的都换了样子。形容面貌焕然一新。",
      provenance: "清·李渔《闲情偶寄》",
      example: "新版教材让人耳目一新。",
    },
    {
      name: "方兴未艾",
      pinyin: "fāng xīng wèi ài",
      meaning: "事物正在发展，尚未达到止境。",
      provenance: "宋·陈亮《上孝宗皇帝书》",
      example: "网络直播行业方兴未艾。",
    },
    {
      name: "釜底抽薪",
      pinyin: "fǔ dǐ chōu xīn",
      meaning: "从锅底抽掉柴火。比喻从根本上解决问题。",
      provenance: "《吕氏春秋·尽数》",
      example: "要釜底抽薪，从源头治理。",
    },
    {
      name: "刚愎自用",
      pinyin: "gāng bì zì yòng",
      meaning: "固执己见，自以为是。",
      provenance: "《左传·宣公十二年》",
      example: "领导不能刚愎自用，要集思广益。",
    },
    {
      name: "高瞻远瞩",
      pinyin: "gāo zhān yuǎn zhǔ",
      meaning: "站得高，看得远。比喻眼光远大。",
      provenance: "汉·王充《论衡·别通篇》",
      example: "做决策要高瞻远瞩。",
    },
    {
      name: "功亏一篑",
      pinyin: "gōng kuī yī kuì",
      meaning: "堆九仞高的山只差一筐土。比喻做事只差最后一点没能完成。",
      provenance: "《尚书·旅獒》",
      example: "越是最后关头越要坚持，否则功亏一篑。",
    },
    {
      name: "孤注一掷",
      pinyin: "gū zhù yī zhì",
      meaning: "把所有的钱一次押上去。比喻在危急时用尽所有力量作最后一次冒险。",
      provenance: "《宋史·寇准传》",
      example: "备考不能靠孤注一掷，要稳扎稳打。",
    },
    {
      name: "顾此失彼",
      pinyin: "gù cǐ shī bǐ",
      meaning: "顾了这个，丢了那个。形容无法全面照顾。",
      provenance: "明·冯梦龙《东周列国志》",
      example: "工作太多，难免顾此失彼。",
    },
    {
      name: "故步自封",
      pinyin: "gù bù zì fēng",
      meaning: "比喻守着老一套，不求进步。",
      provenance: "《汉书·叙传》",
      example: "不能故步自封，要不断学习。",
    },
    {
      name: "瓜熟蒂落",
      pinyin: "guā shú dì luò",
      meaning: "瓜熟透了，瓜蒂自然脱落。比喻条件具备时机成熟，事情自然成功。",
      provenance: "清·翟灏《通俗编·草木》",
      example: "复习充分了，成绩自然瓜熟蒂落。",
    },
    {
      name: "冠冕堂皇",
      pinyin: "guān miǎn táng huáng",
      meaning: "形容外表庄严体面的样子，多含贬义。",
      provenance: "清·李宝嘉《官场现形记》",
      example: "他说得冠冕堂皇，实际另有目的。",
    },
    {
      name: "光怪陆离",
      pinyin: "guāng guài lù lí",
      meaning: "形容奇形怪状，五颜六色，现象奇异。",
      provenance: "战国楚·屈原《离骚》",
      example: "展会上各种展品光怪陆离。",
    },
    {
      name: "讳莫如深",
      pinyin: "huì mò rú shēn",
      meaning: "把事情隐瞒得很紧，唯恐别人知道。",
      provenance: "《谷梁传·庄公三十二年》",
      example: "他对此事讳莫如深，只字不提。",
    },
    {
      name: "见贤思齐",
      pinyin: "jiàn xián sī qí",
      meaning: "见到德才兼备的人就要向他看齐。",
      provenance: "《论语·里仁》",
      example: "要向优秀的人学习，见贤思齐。",
    },
    {
      name: "矫枉过正",
      pinyin: "jiǎo wǎng guò zhèng",
      meaning: "纠正偏差做得过了头，反而超出合理范围。",
      provenance: "《后汉书·仲长统传》",
      example: "整顿要适度，不能矫枉过正。",
    },
    {
      name: "截然不同",
      pinyin: "jié rán bù tóng",
      meaning: "界限分明，完全不一样。",
      provenance: "清·梁启超《论国家思想》",
      example: "两人的性格截然不同。",
    },
    {
      name: "竭泽而渔",
      pinyin: "jié zé ér yú",
      meaning: "排干湖水捉鱼。比喻只顾眼前利益，不顾长远打算。",
      provenance: "《吕氏春秋·义赏》",
      example: "开发资源不能竭泽而渔。",
    },
    {
      name: "津津有味",
      pinyin: "jīn jīn yǒu wèi",
      meaning: "形容兴趣浓厚，很有滋味。",
      provenance: "明·朱之瑜《朱舜水集》",
      example: "他看书看得津津有味。",
    },
    {
      name: "锦上添花",
      pinyin: "jǐn shàng tiān huā",
      meaning: "在锦上再绣花。比喻好上加好，美上加美。",
      provenance: "宋·黄庭坚《了了庵颂》",
      example: "品牌知名度高，宣传只是锦上添花。",
    },
    {
      name: "尽善尽美",
      pinyin: "jìn shàn jìn měi",
      meaning: "形容事物完美无缺。",
      provenance: "《论语·八佾》",
      example: "任何方案都难做到尽善尽美。",
    },
    {
      name: "居安思危",
      pinyin: "jū ān sī wēi",
      meaning: "处在安乐的环境中要想到可能有的危险。",
      provenance: "《左传·襄公十一年》",
      example: "企业要居安思危，未雨绸缪。",
    },
    {
      name: "举世闻名",
      pinyin: "jǔ shì wén míng",
      meaning: "全世界都知道。形容非常著名。",
      provenance: "《庄子·逍遥游》",
      example: "这座古城举世闻名。",
    },
    {
      name: "举一反三",
      pinyin: "jǔ yī fǎn sān",
      meaning: "比喻善于类推，能由此及彼，触类旁通。",
      provenance: "《论语·述而》",
      example: "做题要举一反三，掌握方法。",
    },
    {
      name: "刻舟求剑",
      pinyin: "kè zhōu qiú jiàn",
      meaning: "比喻拘泥成例，不知变通。",
      provenance: "《吕氏春秋·察今》",
      example: "情况变了，不能刻舟求剑。",
    },
    {
      name: "空穴来风",
      pinyin: "kōng xué lái fēng",
      meaning:
        "有了洞穴才进风。比喻消息和传说不是完全没有原因的，现多指毫无根据。",
      provenance: "战国楚·宋玉《风赋》",
      example: "此事空穴来风，不可轻信。",
    },
    {
      name: "口若悬河",
      pinyin: "kǒu ruò xuán hé",
      meaning: "说话像瀑布流泻一样滔滔不绝。形容能言善辩。",
      provenance: "南朝宋·刘义庆《世说新语·赏誉》",
      example: "他演讲时口若悬河。",
    },
    {
      name: "脍炙人口",
      pinyin: "kuài zhì rén kǒu",
      meaning: "比喻好的诗文或事物，人人都称赞。",
      provenance: "五代·王定保《唐摭言》",
      example: "这篇名作脍炙人口。",
    },
    {
      name: "滥竽充数",
      pinyin: "làn yú chōng shù",
      meaning:
        "比喻没有真才实学的人混在行家里面充数，或拿不好的东西混在好的里面充数。",
      provenance: "《韩非子·内储说上》",
      example: "要凭真本事，不能滥竽充数。",
    },
    {
      name: "老生常谈",
      pinyin: "lǎo shēng cháng tán",
      meaning: "老书生经常说的话。比喻人们听惯了的没有新鲜意思的话。",
      provenance: "《三国志·魏志·管辂传》",
      example: "这些话虽是老生常谈，却句句在理。",
    },
    {
      name: "乐不思蜀",
      pinyin: "lè bù sī shǔ",
      meaning: "比喻在新环境中得到乐趣，不再想回到原来环境中去。",
      provenance: "《三国志·蜀志·后主传》",
      example: "他玩得乐不思蜀，忘了学习。",
    },
    {
      name: "理直气壮",
      pinyin: "lǐ zhí qì zhuàng",
      meaning: "理由充分，说话气势就壮。",
      provenance: "明·冯梦龙《醒世恒言》",
      example: "他理直气壮地反驳了对方。",
    },
    {
      name: "力挽狂澜",
      pinyin: "lì wǎn kuáng lán",
      meaning: "比喻尽力挽回危险的局势。",
      provenance: "唐·韩愈《进学解》",
      example: "危急时刻他力挽狂澜。",
    },
    {
      name: "淋漓尽致",
      pinyin: "lín lí jìn zhì",
      meaning: "形容文章或说话表达得非常充分、透彻。",
      provenance: "明·李贽《读孙武子发凡》",
      example: "文章把人物心理刻画得淋漓尽致。",
    },
    {
      name: "鳞次栉比",
      pinyin: "lín cì zhì bǐ",
      meaning: "像鱼鳞和梳子齿那样有次序地排列着。多形容房屋排列得很密很整齐。",
      provenance: "《诗经·周颂·良耜》",
      example: "两岸高楼鳞次栉比。",
    },
    {
      name: "流连忘返",
      pinyin: "liú lián wàng fǎn",
      meaning: "留恋不止，忘了回去。",
      provenance: "《孟子·梁惠王下》",
      example: "这里的景色令人流连忘返。",
    },
    {
      name: "马首是瞻",
      pinyin: "mǎ shǒu shì zhān",
      meaning: "原指作战时士卒看着主将的马头行事。后比喻服从指挥或乐于追随。",
      provenance: "《左传·襄公十四年》",
      example: "全体员工以他为马首是瞻。",
    },
    {
      name: "墨守成规",
      pinyin: "mò shǒu chéng guī",
      meaning: "指思想保守，守着老规矩不肯改变。",
      provenance: "《战国策·齐策六》",
      example: "管理要创新，不能墨守成规。",
    },
    {
      name: "目中无人",
      pinyin: "mù zhōng wú rén",
      meaning: "眼里没有别人。形容骄傲自大，看不起人。",
      provenance: "明·冯梦龙《东周列国志》",
      example: "他取得一点成绩就目中无人。",
    },
    {
      name: "沐猴而冠",
      pinyin: "mù hóu ér guàn",
      meaning: "猕猴戴帽子。比喻装扮得像人，实际却虚有其表。",
      provenance: "《史记·项羽本纪》",
      example: "他不过是沐猴而冠，并无真才实学。",
    },
    {
      name: "难能可贵",
      pinyin: "nán néng kě guì",
      meaning: "不容易做到的事居然能做到，非常可贵。",
      provenance: "宋·苏轼《与谢民师推官书》",
      example: "他坚持自学成才，难能可贵。",
    },
    {
      name: "能屈能伸",
      pinyin: "néng qū néng shēn",
      meaning: "能弯曲也能伸直。指人在失意时能忍耐，得志时能大干一番。",
      provenance: "《易·系辞下》",
      example: "做人要能屈能伸，拿得起放得下。",
    },
    {
      name: "弄巧成拙",
      pinyin: "nòng qiǎo chéng zhuō",
      meaning: "本想耍弄聪明，结果反而做了蠢事。",
      provenance: "宋·黄庭坚《拙轩颂》",
      example: "他自作聪明，反而弄巧成拙。",
    },
    {
      name: "抛砖引玉",
      pinyin: "pāo zhuān yǐn yù",
      meaning: "比喻用粗浅的、不成熟的意见引出别人高明的意见。",
      provenance: "宋·释道原《景德传灯录》",
      example: "我先发言，算是抛砖引玉。",
    },
    {
      name: "披星戴月",
      pinyin: "pī xīng dài yuè",
      meaning: "身披星星，头戴月亮。形容连夜奔波或早出晚归，十分辛苦。",
      provenance: "元·无名氏《冤家债主》",
      example: "他披星戴月地赶路赴考。",
    },
    {
      name: "蓬荜生辉",
      pinyin: "péng bì shēng huī",
      meaning: "使寒门增添光辉。多用作宾客来到家里时的客套话。",
      provenance: "元·秦简夫《剪发待宾》",
      example: "您大驾光临，令寒舍蓬荜生辉。",
    },
    {
      name: "平易近人",
      pinyin: "píng yì jìn rén",
      meaning: "态度谦逊和蔼，使人容易接近。也形容文字深入浅出。",
      provenance: "《史记·鲁周公世家》",
      example: "这位领导平易近人，没有架子。",
    },
    {
      name: "扑朔迷离",
      pinyin: "pū shuò mí lí",
      meaning: "形容事情错综复杂，难以辨别清楚。",
      provenance: "《木兰诗》",
      example: "案件扑朔迷离，一时难以定论。",
    },
    {
      name: "杞人忧天",
      pinyin: "qǐ rén yōu tiān",
      meaning: "比喻不必要的或缺乏根据的忧虑和担心。",
      provenance: "《列子·天瑞》",
      example: "别杞人忧天，船到桥头自然直。",
    },
    {
      name: "千钧一发",
      pinyin: "qiān jūn yī fà",
      meaning: "比喻情况万分危急。",
      provenance: "《汉书·枚乘传》",
      example: "千钧一发之际，他果断出手。",
    },
    {
      name: "前车之鉴",
      pinyin: "qián chē zhī jiàn",
      meaning: "前面翻车的教训。比喻先前的失败可以作为以后的教训。",
      provenance: "《汉书·贾谊传》",
      example: "别人的失败要引为前车之鉴。",
    },
    {
      name: "潜移默化",
      pinyin: "qián yí mò huà",
      meaning: "人的思想或性格在不知不觉中受到影响而发生变化。",
      provenance: "北齐·颜之推《颜氏家训》",
      example: "家庭环境对孩子有潜移默化的影响。",
    },
    {
      name: "浅尝辄止",
      pinyin: "qiǎn cháng zhé zhǐ",
      meaning: "略微尝试一下就停下来。指不深入钻研。",
      provenance: "清·彭养鸥《黑籍冤魂》",
      example: "学习不能浅尝辄止，要深入研究。",
    },
    {
      name: "强弩之末",
      pinyin: "qiáng nǔ zhī mò",
      meaning: "比喻强大的力量已经衰弱，起不了什么作用。",
      provenance: "《史记·韩长孺列传》",
      example: "敌军已是强弩之末，不足为惧。",
    },
    {
      name: "巧夺天工",
      pinyin: "qiǎo duó tiān gōng",
      meaning: "人工的精巧胜过天然。形容技艺十分巧妙。",
      provenance: "元·赵孟頫《赠放烟火者》",
      example: "这些手工艺品巧夺天工。",
    },
    {
      name: "轻描淡写",
      pinyin: "qīng miáo dàn xiě",
      meaning: "原指绘画时用浅淡的颜色轻轻描绘。现多指把重要问题轻轻带过。",
      provenance: "清·吴敬梓《儒林外史》",
      example: "他对自己的失误轻描淡写。",
    },
    {
      name: "情有独钟",
      pinyin: "qíng yǒu dú zhōng",
      meaning: "指在某一事物上感情特别专注。",
      provenance: "宋·朱熹《中庸章句集注》",
      example: "他对古典文学情有独钟。",
    },
    {
      name: "穷兵黩武",
      pinyin: "qióng bīng dú wǔ",
      meaning: "随意使用武力，不断发动侵略战争。",
      provenance: "《三国志·吴志·陆抗传》",
      example: "统治者穷兵黩武，民不聊生。",
    },
    {
      name: "曲高和寡",
      pinyin: "qǔ gāo hè guǎ",
      meaning:
        "曲调高雅，能跟着唱的人就少。比喻言论或作品不通俗，能了解的人很少。",
      provenance: "战国楚·宋玉《对楚王问》",
      example: "他的文章曲高和寡，读者不多。",
    },
    {
      name: "全力以赴",
      pinyin: "quán lì yǐ fù",
      meaning: "把全部力量都投入进去。",
      provenance: "清·赵尔巽《清史稿》",
      example: "备考最后阶段要全力以赴。",
    },
    {
      name: "忍俊不禁",
      pinyin: "rěn jùn bù jīn",
      meaning: "忍不住要发笑。",
      provenance: "唐·赵璘《因话录》",
      example: "他讲的笑话让大家忍俊不禁。",
    },
    {
      name: "任重道远",
      pinyin: "rèn zhòng dào yuǎn",
      meaning: "担子很重，路程很远。比喻责任重大，要经历长期的奋斗。",
      provenance: "《论语·泰伯》",
      example: "教育改革任重道远。",
    },
    {
      name: "如虎添翼",
      pinyin: "rú hǔ tiān yì",
      meaning: "好像老虎长上了翅膀。比喻强有力的人得到帮助后变得更加强大。",
      provenance: "三国蜀·诸葛亮《心书·兵机》",
      example: "引进了人才，公司如虎添翼。",
    },
    {
      name: "如鱼得水",
      pinyin: "rú yú dé shuǐ",
      meaning: "好像鱼得到水一样。比喻得到跟自己十分投合的人或很合适的环境。",
      provenance: "《三国志·蜀志·诸葛亮传》",
      example: "他进了研究所，如鱼得水。",
    },
    {
      name: "孺子可教",
      pinyin: "rú zǐ kě jiào",
      meaning: "小孩子是可以教诲的。后形容年轻人有出息，可以造就。",
      provenance: "《史记·留侯世家》",
      example: "老师夸他孺子可教。",
    },
    {
      name: "三顾茅庐",
      pinyin: "sān gù máo lú",
      meaning: "比喻真心诚意，一再邀请、拜访有专长的贤人。",
      provenance: "《三国志·蜀志·诸葛亮传》",
      example: "他三顾茅庐，终于请来了专家。",
    },
    {
      name: "赏心悦目",
      pinyin: "shǎng xīn yuè mù",
      meaning: "看了使人感到心情舒畅、愉快。",
      provenance: "清·李渔《闲情偶寄》",
      example: "公园景色赏心悦目。",
    },
    {
      name: "舍本逐末",
      pinyin: "shě běn zhú mò",
      meaning: "抛弃根本的、主要的，而去追求枝节的、次要的。比喻轻重倒置。",
      provenance: "《汉书·食货志》",
      example: "复习不能舍本逐末，忽视基础。",
    },
    {
      name: "身临其境",
      pinyin: "shēn lín qí jìng",
      meaning: "亲身面临那种境地。",
      provenance: "明·冯梦龙《警世通言》",
      example: "读到这段，仿佛身临其境。",
    },
    {
      name: "审时度势",
      pinyin: "shěn shí duó shì",
      meaning: "观察分析时势，估计情况的变化。",
      provenance: "清·洪仁玕《资政新篇》",
      example: "要审时度势，抓住机遇。",
    },
    {
      name: "拾人牙慧",
      pinyin: "shí rén yá huì",
      meaning: "拾取别人的一言半语当作自己的话。比喻窃取别人的语言和文字。",
      provenance: "南朝宋·刘义庆《世说新语·文学》",
      example: "写论文不能拾人牙慧。",
    },
    {
      name: "首屈一指",
      pinyin: "shǒu qū yī zhǐ",
      meaning: "扳指头计算，首先弯下大拇指。表示第一。",
      provenance: "清·李宝嘉《官场现形记》",
      example: "他在这个领域首屈一指。",
    },
    {
      name: "束手无策",
      pinyin: "shù shǒu wú cè",
      meaning: "遇到问题，就像手被捆住一样，一点办法也没有。",
      provenance: "宋·王柏《鲁斋集》",
      example: "面对突发状况，他束手无策。",
    },
    {
      name: "熟视无睹",
      pinyin: "shú shì wú dǔ",
      meaning: "经常看见，却像没看见一样。形容对眼前的事物漫不经心。",
      provenance: "晋·刘琨《请诛石勒表》",
      example: "对存在的问题不能熟视无睹。",
    },
    {
      name: "水到渠成",
      pinyin: "shuǐ dào qú chéng",
      meaning: "水流到的地方自然形成一条水道。比喻条件成熟，事情自然会成功。",
      provenance: "宋·苏轼《答秦太虚书》",
      example: "基础打牢了，成绩自然水到渠成。",
    },
    {
      name: "瞬息万变",
      pinyin: "shùn xī wàn biàn",
      meaning: "在极短的时间内就有很多变化。形容变化很多很快。",
      provenance: "清·吴趼人《痛史》",
      example: "市场行情瞬息万变。",
    },
    {
      name: "司空见惯",
      pinyin: "sī kōng jiàn guàn",
      meaning: "某事常见，不足为奇。",
      provenance: "唐·孟棨《本事诗·情感》",
      example: "这种景象他早已司空见惯。",
    },
    {
      name: "四面楚歌",
      pinyin: "sì miàn chǔ gē",
      meaning: "比喻陷入四面受敌、孤立无援的境地。",
      provenance: "《史记·项羽本纪》",
      example: "公司陷入四面楚歌的困境。",
    },
    {
      name: "随波逐流",
      pinyin: "suí bō zhú liú",
      meaning:
        "随着波浪起伏，跟着流水漂荡。比喻没有坚定的立场，只能随着别人走。",
      provenance: "《史记·屈原贾生列传》",
      example: "做人要有主见，不能随波逐流。",
    },
    {
      name: "谈笑风生",
      pinyin: "tán xiào fēng shēng",
      meaning: "形容谈话时有说有笑，兴致勃勃，气氛活跃。",
      provenance: "宋·辛弃疾《念奴娇·赠夏成玉》",
      example: "聚会上大家谈笑风生。",
    },
    {
      name: "叹为观止",
      pinyin: "tàn wéi guān zhǐ",
      meaning: "指赞美所见到的事物好到了极点。",
      provenance: "《左传·襄公二十九年》",
      example: "他的书法令人叹为观止。",
    },
    {
      name: "天衣无缝",
      pinyin: "tiān yī wú fèng",
      meaning: "比喻事物周密完善，找不出破绽。",
      provenance: "五代·牛峤《灵怪录·郭翰》",
      example: "他的解释天衣无缝，无懈可击。",
    },
    {
      name: "同舟共济",
      pinyin: "tóng zhōu gòng jì",
      meaning: "比喻团结互助，同心协力，战胜困难。",
      provenance: "《孙子·九地》",
      example: "大家同舟共济，共渡难关。",
    },
    {
      name: "投鼠忌器",
      pinyin: "tóu shǔ jì qì",
      meaning:
        "想用东西打老鼠，又怕打坏了近旁的器物。比喻做事有顾忌，不敢放手干。",
      provenance: "《汉书·贾谊传》",
      example: "他做事投鼠忌器，放不开手脚。",
    },
    {
      name: "图穷匕见",
      pinyin: "tú qióng bǐ xiàn",
      meaning: "比喻事情发展到最后，真相或本意显露了出来。",
      provenance: "《战国策·燕策三》",
      example: "谈判到最后，对方才图穷匕见。",
    },
    {
      name: "万籁俱寂",
      pinyin: "wàn lài jù jì",
      meaning: "形容周围环境非常安静，一点声响都没有。",
      provenance: "唐·常建《题破山寺后禅院》",
      example: "深夜的校园万籁俱寂。",
    },
    {
      name: "望尘莫及",
      pinyin: "wàng chén mò jí",
      meaning: "望见前面骑马的人走过扬起的尘土而不能赶上。比喻远远落在后面。",
      provenance: "《庄子·田子方》",
      example: "他的水平让我望尘莫及。",
    },
    {
      name: "望梅止渴",
      pinyin: "wàng méi zhǐ kě",
      meaning: "比喻愿望无法实现，用空想安慰自己。",
      provenance: "南朝宋·刘义庆《世说新语·假谲》",
      example: "画饼充饥终究是望梅止渴。",
    },
    {
      name: "危言耸听",
      pinyin: "wēi yán sǒng tīng",
      meaning: "故意说些夸大的吓人的话，使人惊疑震动。",
      provenance: "宋·吕祖谦《东莱博议》",
      example: "他危言耸听，制造恐慌。",
    },
    {
      name: "文过饰非",
      pinyin: "wén guò shì fēi",
      meaning: "用漂亮的言词掩饰自己的过失和错误。",
      provenance: "《论语·子张》",
      example: "犯了错要承认，不能文过饰非。",
    },
    {
      name: "闻鸡起舞",
      pinyin: "wén jī qǐ wǔ",
      meaning: "听到鸡叫就起来舞剑。比喻有志报国的人及时奋起。",
      provenance: "《晋书·祖逖传》",
      example: "他闻鸡起舞，苦练基本功。",
    },
    {
      name: "卧薪尝胆",
      pinyin: "wò xīn cháng dǎn",
      meaning: "形容人刻苦自励，发愤图强。",
      provenance: "《史记·越王勾践世家》",
      example: "落后不可怕，关键要卧薪尝胆。",
    },
    {
      name: "物极必反",
      pinyin: "wù jí bì fǎn",
      meaning: "事物发展到极点，就会向相反的方向转化。",
      provenance: "《吕氏春秋·博志》",
      example: "凡事过犹不及，物极必反。",
    },
    {
      name: "喜闻乐见",
      pinyin: "xǐ wén lè jiàn",
      meaning: "喜欢听，乐意看。形容很受欢迎。",
      provenance: "清·李渔《闲情偶寄》",
      example: "这种形式群众喜闻乐见。",
    },
    {
      name: "相得益彰",
      pinyin: "xiāng dé yì zhāng",
      meaning: "指两个人或两件事物互相配合，双方的能力和作用更能显示出来。",
      provenance: "汉·王褒《圣主得贤臣颂》",
      example: "文理结合，相得益彰。",
    },
    {
      name: "想入非非",
      pinyin: "xiǎng rù fēi fēi",
      meaning: "思想进入虚幻境界，完全脱离实际；又指胡思乱想。",
      provenance: "清·李宝嘉《官场现形记》",
      example: "别想入非非，要脚踏实地。",
    },
    {
      name: "削足适履",
      pinyin: "xuē zú shì lǚ",
      meaning:
        "鞋小脚大，把脚削去一块来凑和鞋的大小。比喻不合理地迁就现成条件。",
      provenance: "《淮南子·说林训》",
      example: "不能为了考试而削足适履。",
    },
    {
      name: "小心翼翼",
      pinyin: "xiǎo xīn yì yì",
      meaning: "形容言行举动十分谨慎，丝毫不敢疏忽大意。",
      provenance: "《诗经·大雅·大明》",
      example: "他小心翼翼地端着杯子。",
    },
    {
      name: "笑里藏刀",
      pinyin: "xiào lǐ cáng dāo",
      meaning: "比喻外表和气而内心阴险。",
      provenance: "《旧唐书·李义府传》",
      example: "要提防这种笑里藏刀的人。",
    },
    {
      name: "心旷神怡",
      pinyin: "xīn kuàng shén yí",
      meaning: "心境开阔，精神愉快。",
      provenance: "宋·范仲淹《岳阳楼记》",
      example: "登高远眺，令人心旷神怡。",
    },
    {
      name: "欣欣向荣",
      pinyin: "xīn xīn xiàng róng",
      meaning: "形容草木长得茂盛。比喻事业蓬勃发展，兴旺昌盛。",
      provenance: "晋·陶渊明《归去来兮辞》",
      example: "公司业务欣欣向荣。",
    },
    {
      name: "兴高采烈",
      pinyin: "xìng gāo cǎi liè",
      meaning: "形容兴致高昂，情绪热烈。",
      provenance: "南朝梁·刘勰《文心雕龙》",
      example: "大家兴高采烈地讨论着。",
    },
    {
      name: "形形色色",
      pinyin: "xíng xíng sè sè",
      meaning: "形容事物种类繁多，各式各样。",
      provenance: "《列子·天瑞》",
      example: "市场上商品形形色色。",
    },
    {
      name: "虚张声势",
      pinyin: "xū zhāng shēng shì",
      meaning: "假装出强大的气势。指假造声势，借以吓人。",
      provenance: "唐·韩愈《论淮西事宜状》",
      example: "他不过是虚张声势，别怕。",
    },
    {
      name: "栩栩如生",
      pinyin: "xǔ xǔ rú shēng",
      meaning: "形容画作、雕塑中的艺术形象等生动逼真，就像活的一样。",
      provenance: "《庄子·齐物论》",
      example: "画中的老虎栩栩如生。",
    },
    {
      name: "悬梁刺股",
      pinyin: "xuán liáng cì gǔ",
      meaning: "形容刻苦学习。",
      provenance: "《战国策·秦策一》",
      example: "古人悬梁刺股，今人更应刻苦。",
    },
    {
      name: "学富五车",
      pinyin: "xué fù wǔ chē",
      meaning: "形容读书多，学识丰富。",
      provenance: "《庄子·天下》",
      example: "他学富五车，知识渊博。",
    },
    {
      name: "循规蹈矩",
      pinyin: "xún guī dǎo jǔ",
      meaning: "原指遵守规矩，不轻举妄动。现多指拘守旧准则，不敢稍做变动。",
      provenance: "宋·朱熹《答或人》",
      example: "他做事循规蹈矩，从不越界。",
    },
    {
      name: "揠苗助长",
      pinyin: "yà miáo zhù zhǎng",
      meaning: "比喻违反事物发展的客观规律，急于求成，反而坏事。",
      provenance: "《孟子·公孙丑上》",
      example: "教育孩子不能揠苗助长。",
    },
    {
      name: "言简意赅",
      pinyin: "yán jiǎn yì gāi",
      meaning: "形容说话写文章简明扼要。",
      provenance: "宋·张端义《贵耳集》",
      example: "他的回答言简意赅，切中要害。",
    },
    {
      name: "偃旗息鼓",
      pinyin: "yǎn qí xī gǔ",
      meaning: "放倒旗子，停止敲鼓。比喻停止战斗或停止做某事。",
      provenance: "《三国志·蜀志·赵云传》",
      example: "双方偃旗息鼓，暂告停战。",
    },
    {
      name: "一蹴而就",
      pinyin: "yī cù ér jiù",
      meaning: "踏一步就成功。比喻事情轻而易举，一下子就成功。",
      provenance: "宋·苏洵《上田枢密书》",
      example: "成功不会一蹴而就。",
    },
    {
      name: "一鸣惊人",
      pinyin: "yī míng jīng rén",
      meaning: "比喻平时没有突出的表现，一下子做出惊人的成绩。",
      provenance: "《史记·滑稽列传》",
      example: "他一鸣惊人，考上了名校。",
    },
    {
      name: "一诺千金",
      pinyin: "yī nuò qiān jīn",
      meaning: "许下的一个诺言有千金的价值。比喻说话算数，极有信用。",
      provenance: "《史记·季布栾布列传》",
      example: "他说话一诺千金。",
    },
    {
      name: "一视同仁",
      pinyin: "yī shì tóng rén",
      meaning: "对人同样看待，不分厚薄。",
      provenance: "唐·韩愈《原人》",
      example: "老师对每个学生一视同仁。",
    },
    {
      name: "一意孤行",
      pinyin: "yī yì gū xíng",
      meaning: "不接受别人的劝告，顽固地按照自己的主观想法去做。",
      provenance: "《史记·酷吏列传》",
      example: "他固执己见，一意孤行。",
    },
    {
      name: "贻笑大方",
      pinyin: "yí xiào dà fāng",
      meaning: "指让内行的人笑话。",
      provenance: "《庄子·秋水》",
      example: "不懂装懂，只会贻笑大方。",
    },
    {
      name: "以卵击石",
      pinyin: "yǐ luǎn jī shí",
      meaning: "拿蛋去碰石头。比喻不估计自己的力量，自取灭亡。",
      provenance: "《墨子·贵义》",
      example: "盲目冒进无异于以卵击石。",
    },
    {
      name: "异曲同工",
      pinyin: "yì qǔ tóng gōng",
      meaning: "不同的曲调演得同样好。比喻做法不同而都巧妙地达到目的。",
      provenance: "唐·韩愈《进学解》",
      example: "两人的方案异曲同工。",
    },
    {
      name: "因地制宜",
      pinyin: "yīn dì zhì yí",
      meaning: "根据各地的具体情况，制定适宜的办法。",
      provenance: "汉·赵晔《吴越春秋·阖闾内传》",
      example: "发展农业要因地制宜。",
    },
    {
      name: "因势利导",
      pinyin: "yīn shì lì dǎo",
      meaning: "顺着事情发展的趋势，向有利于实现目的的方向加以引导。",
      provenance: "《史记·孙子吴起列传》",
      example: "对学生要因势利导，循循善诱。",
    },
    {
      name: "迎刃而解",
      pinyin: "yíng rèn ér jiě",
      meaning: "比喻处理事情、解决问题很顺利。",
      provenance: "《晋书·杜预传》",
      example: "抓住关键，问题迎刃而解。",
    },
    {
      name: "忧心忡忡",
      pinyin: "yōu xīn chōng chōng",
      meaning: "形容心事重重，非常忧愁。",
      provenance: "《诗经·召南·草虫》",
      example: "他对考试结果忧心忡忡。",
    },
    {
      name: "游刃有余",
      pinyin: "yóu rèn yǒu yú",
      meaning: "比喻技术熟练，经验丰富，解决问题毫不费力。",
      provenance: "《庄子·养生主》",
      example: "这类题目他早已游刃有余。",
    },
    {
      name: "有口皆碑",
      pinyin: "yǒu kǒu jiē bēi",
      meaning: "所有人的嘴都是记功的碑。比喻人人称赞。",
      provenance: "宋·释普济《五灯会元》",
      example: "这家老店有口皆碑。",
    },
    {
      name: "有条不紊",
      pinyin: "yǒu tiáo bù wěn",
      meaning: "形容有条有理，一点不乱。",
      provenance: "《尚书·盘庚上》",
      example: "他做事有条不紊。",
    },
    {
      name: "有勇无谋",
      pinyin: "yǒu yǒng wú móu",
      meaning: "只有勇气，没有计谋。指做事只凭猛力而不讲策略。",
      provenance: "《三国演义》",
      example: "他做事有勇无谋，容易吃亏。",
    },
    {
      name: "与日俱增",
      pinyin: "yǔ rì jù zēng",
      meaning: "随着时间的推移而不断增长。",
      provenance: "清·李宝嘉《官场现形记》",
      example: "他的压力与日俱增。",
    },
    {
      name: "源远流长",
      pinyin: "yuán yuǎn liú cháng",
      meaning: "河流的源头很远，水流很长。比喻历史悠久，根底深厚。",
      provenance: "唐·白居易《海州刺史裴君夫人李氏墓志铭》",
      example: "中华文化源远流长。",
    },
    {
      name: "越俎代庖",
      pinyin: "yuè zǔ dài páo",
      meaning: "比喻超出自己职务范围去处理别人所管的事。",
      provenance: "《庄子·逍遥游》",
      example: "父母不要越俎代庖，替孩子做决定。",
    },
    {
      name: "运筹帷幄",
      pinyin: "yùn chóu wéi wò",
      meaning: "指在帐幕中谋划军机。常指在后方决定作战方案。",
      provenance: "《史记·高祖本纪》",
      example: "他运筹帷幄，决胜千里。",
    },
    {
      name: "再接再厉",
      pinyin: "zài jiē zài lì",
      meaning: "比喻继续努力，再加一把劲。",
      provenance: "唐·韩愈《斗鸡联句》",
      example: "希望大家再接再厉，再创佳绩。",
    },
    {
      name: "责无旁贷",
      pinyin: "zé wú páng dài",
      meaning: "自己应尽的责任，不能推卸给旁人。",
      provenance: "清·文康《儿女英雄传》",
      example: "保护环境，人人责无旁贷。",
    },
    {
      name: "崭露头角",
      pinyin: "zhǎn lù tóu jiǎo",
      meaning: "比喻突出地显露出才能和本领。",
      provenance: "唐·韩愈《柳子厚墓志铭》",
      example: "他在大赛中崭露头角。",
    },
    {
      name: "张冠李戴",
      pinyin: "zhāng guān lǐ dài",
      meaning: "把姓张的帽子戴到姓李的头上。比喻认错了对象，弄错了事实。",
      provenance: "明·田艺蘅《留青日札》",
      example: "他张冠李戴，把两件事混为一谈。",
    },
    {
      name: "朝三暮四",
      pinyin: "zhāo sān mù sì",
      meaning: "比喻办事反复无常，经常变卦。",
      provenance: "《庄子·齐物论》",
      example: "他朝三暮四，计划总在变。",
    },
    {
      name: "振聋发聩",
      pinyin: "zhèn lóng fā kuì",
      meaning:
        "发出很大的响声，使耳聋的人也能听见。比喻用语言文字唤醒糊涂麻木的人。",
      provenance: "清·袁枚《随园诗话补遗》",
      example: "这番话振聋发聩，发人深省。",
    },
    {
      name: "知难而进",
      pinyin: "zhī nán ér jìn",
      meaning: "迎着困难上，不退缩。",
      provenance: "汉·桓宽《盐铁论》",
      example: "越是困难越要知难而进。",
    },
    {
      name: "纸上谈兵",
      pinyin: "zhǐ shàng tán bīng",
      meaning: "在纸面上谈论打仗。比喻空谈理论，不能解决实际问题。",
      provenance: "《史记·廉颇蔺相如列传》",
      example: "纸上谈兵不如亲身实践。",
    },
    {
      name: "只争朝夕",
      pinyin: "zhǐ zhēng zhāo xī",
      meaning: "形容抓紧时间，力争在最短的时间内达到目的。",
      provenance: "明·徐复祚《投梭记》",
      example: "备考要只争朝夕，抓紧时间。",
    },
    {
      name: "指鹿为马",
      pinyin: "zhǐ lù wéi mǎ",
      meaning: "比喻故意颠倒黑白，混淆是非。",
      provenance: "《史记·秦始皇本纪》",
      example: "他指鹿为马，混淆视听。",
    },
    {
      name: "志同道合",
      pinyin: "zhì tóng dào hé",
      meaning: "志向相同，意见相合。",
      provenance: "《三国志·魏志·陈思王植传》",
      example: "我们志同道合，一拍即合。",
    },
    {
      name: "众志成城",
      pinyin: "zhòng zhì chéng chéng",
      meaning:
        "万众一心，像坚固的城墙一样不可摧毁。比喻大家团结一致，力量无比强大。",
      provenance: "《国语·周语下》",
      example: "大家众志成城，共克时艰。",
    },
    {
      name: "周而复始",
      pinyin: "zhōu ér fù shǐ",
      meaning: "转了一圈又一圈，不断循环。",
      provenance: "《汉书·礼乐志》",
      example: "四季周而复始，循环往复。",
    },
    {
      name: "自相矛盾",
      pinyin: "zì xiāng máo dùn",
      meaning: "比喻自己的言行前后互相抵触。",
      provenance: "《韩非子·难一》",
      example: "他的说法自相矛盾。",
    },
    {
      name: "左右逢源",
      pinyin: "zuǒ yòu féng yuán",
      meaning: "比喻做事得心应手，非常顺利。现多用来比喻为人圆滑，善于投机。",
      provenance: "《孟子·离娄下》",
      example: "他在复杂的人际关系中左右逢源。",
    },
    {
      name: "作茧自缚",
      pinyin: "zuò jiǎn zì fù",
      meaning: "蚕吐丝作茧，把自己裹在里面。比喻自己使自己陷入困境。",
      provenance: "唐·白居易《江州赴忠州至江陵已来舟中示舍弟五十韵》",
      example: "他立下过多规矩，反而作茧自缚。",
    },
    {
      name: "坐井观天",
      pinyin: "zuò jǐng guān tiān",
      meaning: "坐在井底看天。比喻眼界小，见识少。",
      provenance: "唐·韩愈《原道》",
      example: "要多走出去看看，不能坐井观天。",
    },
  ];

  function fetchIdiom(word) {
    return new Promise(function (resolve) {
      var prompt =
        '请你帮我查"' +
        word +
        '"的意思、读音和出处，以及使用语境，并自动找出它的近义词，逐一辨析（辨析内容包括感情色彩、应用语境、意思差别）。' +
        '注意：如果"' +
        word +
        '"是词语（两个字），近义词必须也是词语（两个字）；如果"' +
        word +
        '"是成语（四个字），近义词必须也是成语（四个字），绝不能混用。近义词至少找出 3 个，必须互不相同、不能重复，且绝不能包含查询词"' +
        word +
        '"本身。' +
        "请严格按以下 JSON 格式输出，不要输出 JSON 以外的任何内容。注意：所有字段的值必须是普通字符串，禁止嵌套对象；provenance（出处）必须简短，一句话以内；discrimination 字段用换行符 \\n 分隔每一条，第一条必须列出近义词，随后再逐条辨析。" +
        '{"name":"' +
        word +
        '","pinyin":"读音","meaning":"释义","provenance":"出处","example":"例句","discrimination":"近义词：某词、某词、某词\\n感情色彩：…\\n应用语境：…\\n与近义词【某词】对比…\\n与近义词【某词】对比…"}';
      zhipuChat(
        [
          {
            role: "system",
            content:
              "你是资深语文老师，擅长词语与成语讲解。只输出 JSON，不要输出任何其他文字。",
          },
          { role: "user", content: prompt },
        ],
        2048,
        25000,
      )
        .then(function (txt) {
          var res = parseAiIdiom(txt, word);
          if (res) {
            resolve(res);
            return;
          }
          fallbackIdiom(word).then(resolve);
        })
        .catch(function () {
          fallbackIdiom(word).then(resolve);
        });
    });
  }

  function repairJson(s) {
    return s
      .replace(/("(?:[^"\\]|\\.)*"\s*:\s*)("|[\{\[\d\-tfnu"]|\$)/g, "$1$2")
      .replace(
        /("(?:[^"\\]|\\.)*"\s*:\s*)([^"\s\{\}\[\],][^\{\}\[\],]*?)(\s*[,\}])/g,
        function (m, k, v, tail) {
          return k + '"' + v.replace(/"/g, '\\"').trim() + '"' + tail;
        },
      );
  }

  function extractIdiomText(t, word) {
    function field(name) {
      var re = new RegExp(
        '"' + name + '"[\\s\\n]*:[\\s\\n]*"([\\s\\S]*?)"\\s*[,}]',
      );
      var m = t.match(re);
      return m ? m[1] : "";
    }
    function discText() {
      var m = t.match(/"disc(?:rimination)?"[\s\n]*:[^\n{]*\{/);
      if (m) {
        var idx = t.indexOf("{", m.index);
        var depth = 0,
          i = idx;
        for (; i < t.length; i++) {
          if (t[i] === "{") depth++;
          else if (t[i] === "}") {
            depth--;
            if (depth === 0) break;
          }
        }
        var inner = t.slice(idx + 1, i);
        return inner
          .split(/\n/)
          .map(function (l) {
            var p = l
              .trim()
              .match(/^"?([^":\n]{1,12})"?[\s\n]*[:：][\s\n]*(.*)$/);
            return p ? p[1] + "：" + p[2].replace(/^"|"$|,$/g, "") : "";
          })
          .filter(Boolean);
      }
      var m2 = t.match(
        /"disc(?:rimination)?"[\s\n]*:[\s\n]*"([\s\S]*?)"([,\s}]|$)/,
      );
      if (m2)
        return m2[1]
          .split(/\\n|\n/)
          .map(function (l) {
            return l.trim();
          })
          .filter(Boolean);
      return [];
    }
    return {
      name: field("name") || word,
      pinyin: field("pinyin"),
      meaning: field("meaning"),
      provenance: field("provenance"),
      example: field("example"),
      discLines: discText(),
    };
  }

  function parseAiIdiom(txt, word) {
    var t = String(txt || "").replace(/```json|```/g, "");
    var m = t.match(/\{[\s\S]*\}/);
    if (!m) return null;
    function cap(s, n) {
      s = String(s || "").trim();
      return s.length > n ? s.slice(0, n) + "…" : s;
    }
    var d = null;
    try {
      d = JSON.parse(m[0]);
    } catch (e) {
      try {
        d = JSON.parse(repairJson(m[0]));
      } catch (e2) {
        d = null;
      }
    }
    if (!d || !(d.meaning || d.name)) {
      var ex = extractIdiomText(t, word);
      if (!ex.meaning && !ex.name) return null;
      var res = {
        name: ex.name,
        pinyin: ex.pinyin,
        meaning: cap(ex.meaning, 300),
        provenance: cap(ex.provenance, 120),
        example: cap(ex.example, 120),
        extra: { type: "word" },
      };
      if (ex.discLines.length) {
        res.extra.discLines = ex.discLines;
      }
      return res;
    }
    var disc = d.discrimination || d.disc;
    var lines = [];
    if (disc) {
      if (typeof disc === "object") {
        Object.keys(disc).forEach(function (k) {
          var v = disc[k];
          if (v && typeof v === "object") {
            Object.keys(v).forEach(function (k2) {
              lines.push(k2 + "：" + String(v[k2]));
            });
          } else if (v) {
            lines.push(k + "：" + String(v));
          }
        });
      } else {
        lines = String(disc)
          .split(/\n/)
          .map(function (l) {
            return l.trim();
          })
          .filter(Boolean);
      }
    }
    if (!lines.length) lines = [];
    var res = {
      name: d.name || word,
      pinyin: d.pinyin || "",
      meaning: cap(d.meaning || "", 300),
      provenance: cap(d.provenance || "", 120),
      example: cap(d.example || "", 120),
      extra: { type: "word" },
    };
    if (lines.length) {
      res.extra.discLines = lines;
    }
    return res;
  }

  function fallbackIdiom(word) {
    return new Promise(function (resolve) {
      var found = null;
      for (var i = 0; i < FALLBACK_IDIOMS.length; i++) {
        if (FALLBACK_IDIOMS[i].name === word) {
          found = FALLBACK_IDIOMS[i];
          break;
        }
      }
      if (!found) {
        for (var j = 0; j < FALLBACK_IDIOMS.length; j++) {
          if (FALLBACK_IDIOMS[j].name.indexOf(word) >= 0) {
            found = FALLBACK_IDIOMS[j];
            break;
          }
        }
      }
      if (found) {
        resolve({
          name: found.name,
          pinyin: found.pinyin || "",
          meaning: found.meaning || "",
          provenance: found.provenance || "",
          example: found.example || "",
          extra: { type: "idiom" },
        });
      } else {
        resolve({
          name: word,
          pinyin: "",
          meaning: "未查询到该词语或成语的释义，请检查输入是否正确。",
          provenance: "",
          example: "",
          extra: { type: "word" },
        });
      }
    });
  }

  function updateIdiomResultBox(mode) {
    var box = $("#idiom-result-box");
    if (!box) return;
    if (mode === "querying") {
      box.innerHTML = '<p class="muted mt12">查询中…</p>';
    } else if (mode) {
      box.innerHTML = renderIdiomResult(mode);
    }
  }

  function updateProofreadBox(status, text) {
    var box = $("#proofread-box");
    if (!box) return;
    if (status === "loading") {
      box.innerHTML = '<p class="muted mt8">AI 校对中…</p>';
    } else if (status === "result") {
      box.innerHTML = '<div class="proofread-result"></div>';
      var pEl = box.firstChild;
      if (pEl) typeInto(pEl, text, null);
    } else if (status === "error") {
      box.innerHTML =
        '<p class="muted mt8" style="color:#c0392b">' + esc(text) + "</p>";
    }
  }

  function renderIdiomResult(r) {
    if (!r) return "";
    var saved = state.idiom.saved.some(function (s) {
      return s.name === r.name;
    });
    var html = '<div class="idiom-result card">';
    html +=
      '<div class="idiom-name">' +
      esc(r.name) +
      (r.extra && r.extra.cx
        ? '<span class="tag" style="background:#8a93a6;vertical-align:middle;margin-left:8px">' +
          esc(r.extra.cx) +
          "</span>"
        : "") +
      "</div>";
    if (r.meaning)
      html +=
        '<div class="idiom-block"><div class="lb">释义</div><div class="val">' +
        esc(r.meaning) +
        "</div></div>";
    if (r.myMeaning)
      html +=
        '<div class="idiom-block"><div class="lb">我的释义</div><div class="val">' +
        esc(r.myMeaning) +
        "</div></div>";
    if (r.provenance)
      html +=
        '<div class="idiom-block"><div class="lb">出处</div><div class="val">' +
        esc(r.provenance) +
        "</div></div>";
    if (r.example)
      html +=
        '<div class="idiom-block"><div class="lb">例句</div><div class="val">' +
        esc(r.example) +
        "</div></div>";
    if (r.extra && r.extra.discLines && r.extra.discLines.length) {
      html += '<div class="idiom-block"><div class="lb">近义词辨析</div>';
      r.extra.discLines.forEach(function (line) {
        html +=
          '<div class="val">' + esc(line.replace(/^[-*•]\s*/, "")) + "</div>";
      });
      html += "</div>";
    }
    if (r.extra && r.extra.tongyi)
      html +=
        '<div class="idiom-block"><div class="lb">同义词</div><div class="val">' +
        esc(r.extra.tongyi) +
        "</div></div>";
    if (r.extra && r.extra.fanyi)
      html +=
        '<div class="idiom-block"><div class="lb">反义词</div><div class="val">' +
        esc(r.extra.fanyi) +
        "</div></div>";
    if (r.extra && r.extra.yufa)
      html +=
        '<div class="idiom-block"><div class="lb">语法</div><div class="val">' +
        esc(r.extra.yufa) +
        "</div></div>";
    html += '<div class="idiom-block">';
    html += '<div class="lb">我的释义</div>';
    html +=
      '<textarea class="textarea" id="my-meaning" rows="2" placeholder="写下你对这个词语的理解，可交给 AI 校对…"></textarea>';
    html +=
      '<div class="btn-row" style="margin-top:8px">' +
      '<button class="btn gray" data-act="proofreadMeaning"' +
      (state.idiom.proof.loading ? " disabled" : "") +
      ">交给 AI 校对</button>" +
      "</div>";
    html += '<div id="proofread-box">';
    if (state.idiom.proof.loading) {
      html += '<p class="muted mt8">AI 校对中…</p>';
    } else if (state.idiom.proof.text) {
      html +=
        '<div class="proofread-result">' +
        mdRender(state.idiom.proof.text) +
        "</div>";
    }
    html += "</div>";
    html += "</div>";
    html +=
      '<div class="btn-row" style="margin-top:10px">' +
      (saved
        ? '<button class="btn gray" data-act="unsaveIdiom" data-key="' +
          esc(r.name) +
          '">已收藏</button>'
        : '<button class="btn" data-act="saveIdiom" data-key="' +
          esc(r.name) +
          '">收藏</button>') +
      "</div>";
    html += "</div>";
    return html;
  }

  function renderIdiom() {
    var it = state.idiom;
    var html = '<div class="idiom-page">';
    html += '<div class="section-title">词语查询</div><div class="card">';
    html +=
      '<div style="display:flex;gap:8px;margin-bottom:10px">' +
      '<input class="input" id="idiom-input" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="输入词语或成语，如：谱写、马到成功" value="' +
      esc(state.idiom.input || "") +
      '" style="flex:1">' +
      '<button class="btn ai-send-btn" data-act="queryIdiom">查询</button>' +
      "</div>";
    html +=
      '<div class="btn-row">' +
      '<button class="btn gray" data-act="randomIdiom">随机一个成语</button>' +
      "</div>";
    html += "</div>";
    html += '<div id="idiom-result-box">';
    if (it.loading) {
      html += '<p class="muted mt12">查询中…</p>';
    } else if (it.result) {
      html += renderIdiomResult(it.result);
    }
    html += "</div>";

    html += '<div id="idiom-saved-box">';
    html += renderIdiomSavedBox();
    html += "</div>";
    html += "</div>";
    return html;
  }

  function renderIdiomSavedBox() {
    var it = state.idiom;
    if (!it.saved.length) {
      return '<div class="section-title">我的积累</div><div class="card"><p class="muted">收藏的词语和成语会显示在这里，方便随时复习。</p></div>';
    }
    var html =
      '<div class="section-title">我的积累（' +
      it.saved.length +
      '）</div><div class="card">';
    it.saved.forEach(function (s) {
      var brief = String(s.meaning || "").replace(/\n+/g, " ");
      if (brief.length > 40) brief = brief.slice(0, 40) + "…";
      html +=
        '<div class="idiom-saved" data-act="openIdiomSaved" data-key="' +
        esc(s.name) +
        '">' +
        '<div class="idiom-saved-name">' +
        esc(s.name) +
        "</div>" +
        '<div class="idiom-saved-mean">' +
        esc(brief) +
        "</div>";
      if (s.myMeaning)
        html +=
          '<div class="idiom-saved-my">我的释义：' +
          esc(s.myMeaning) +
          "</div>";
      html +=
        '<button class="btn danger sm" data-act="unsaveIdiom" data-key="' +
        esc(s.name) +
        '" style="margin-top:6px">移除</button>' +
        "</div>";
    });
    html +=
      '<button class="btn danger sm mt12" data-act="clearIdioms">清空收藏</button>';
    html += "</div>";
    return html;
  }

  function updateIdiomSavedBox() {
    var box = $("#idiom-saved-box");
    if (box) box.innerHTML = renderIdiomSavedBox();
  }

  function refreshIdiomSaveBtn() {
    var box = $("#idiom-result-box");
    if (!box) return;
    var r = state.idiom.result;
    var saved =
      r &&
      state.idiom.saved.some(function (s) {
        return s.name === r.name;
      });
    var btn = box.querySelector(
      '[data-act="saveIdiom"], [data-act="unsaveIdiom"]',
    );
    if (!btn) return;
    btn.setAttribute("data-act", saved ? "unsaveIdiom" : "saveIdiom");
    btn.textContent = saved ? "已收藏" : "收藏";
    btn.className = saved ? "btn gray" : "btn";
  }

  // === 对外暴露 ===
  NS.idiom = {
    fetchIdiom: fetchIdiom,
    repairJson: repairJson,
    extractIdiomText: extractIdiomText,
    parseAiIdiom: parseAiIdiom,
    fallbackIdiom: fallbackIdiom,
    updateIdiomResultBox: updateIdiomResultBox,
    updateProofreadBox: updateProofreadBox,
    renderIdiomResult: renderIdiomResult,
    renderIdiom: renderIdiom,
    renderIdiomSavedBox: renderIdiomSavedBox,
    updateIdiomSavedBox: updateIdiomSavedBox,
    refreshIdiomSaveBtn: refreshIdiomSaveBtn,
    FALLBACK_IDIOMS: FALLBACK_IDIOMS,
  };
})();
