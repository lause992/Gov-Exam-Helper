/* ===== xcapp units module: 常见单位换算 ===== */
(function () {
  'use strict';
  var NS = window.XCAPP = window.XCAPP || {};
  var esc = NS.utils.esc;

  NS.units = {
    LIST: [
      { key: 'length', name: '长度', items: [
        ['1 千米(km)', '1000 米(m)'],
        ['1 米(m)', '10 分米(dm) = 100 厘米(cm)'],
        ['1 分米(dm)', '10 厘米(cm)'],
        ['1 厘米(cm)', '10 毫米(mm)'],
        ['1 毫米(mm)', '1000 微米(μm)'],
        ['1 里', '500 米(m)'],
        ['1 英里(mi)', '≈ 1.609 千米(km)'],
        ['1 英尺(ft)', '30.48 厘米(cm)'],
        ['1 英寸(in)', '2.54 厘米(cm)'],
        ['1 海里', '1852 米(m)'],
        ['1 光年', '≈ 9.46 万亿千米']
      ] },
      { key: 'area', name: '面积', items: [
        ['1 平方千米(km²)', '100 公顷 = 1000000 平方米'],
        ['1 公顷', '10000 平方米(m²) = 15 亩'],
        ['1 亩', '≈ 666.7 平方米(m²)'],
        ['1 平方米(m²)', '100 平方分米 = 10000 平方厘米'],
        ['1 平方分米(dm²)', '100 平方厘米(cm²)'],
        ['1 平方厘米(cm²)', '100 平方毫米(mm²)']
      ] },
      { key: 'volume', name: '体积容量', items: [
        ['1 立方米(m³)', '1000 立方分米(dm³) = 1000 升'],
        ['1 升(L)', '1000 毫升(mL) = 1 立方分米'],
        ['1 毫升(mL)', '1 立方厘米(cm³)'],
        ['1 立方米(m³)', '1000 升(L)'],
        ['1 加仑(美)', '≈ 3.785 升(L)']
      ] },
      { key: 'mass', name: '重量', items: [
        ['1 吨(t)', '1000 千克(kg) = 1000000 克(g)'],
        ['1 千克(kg)', '1000 克(g) = 2 斤'],
        ['1 公斤', '1 千克(kg)'],
        ['1 斤', '500 克(g) = 10 两'],
        ['1 两', '50 克(g)'],
        ['1 磅(lb)', '≈ 454 克(g)'],
        ['1 盎司(oz)', '≈ 28.35 克(g)'],
        ['1 克拉', '200 毫克(mg)']
      ] },
      { key: 'temp', name: '温度', items: [
        ['℃ 换算 ℉', '℉ = ℃ × 9/5 + 32'],
        ['℉ 换算 ℃', '℃ = (℉ - 32) × 5/9'],
        ['℃ 换算 K', 'K = ℃ + 273.15'],
        ['0℃', '32℉ · 273.15K · 结冰点'],
        ['100℃', '212℉ · 373.15K · 沸点']
      ] },
      { key: 'time', name: '时间', items: [
        ['1 世纪', '100 年'],
        ['1 年', '365 天（闰年 366 天）'],
        ['1 天', '24 小时(h)'],
        ['1 小时(h)', '60 分钟(min) = 3600 秒(s)'],
        ['1 分钟(min)', '60 秒(s)'],
        ['1 周', '7 天'],
        ['1 季度', '3 个月'],
        ['1 刻钟', '15 分钟']
      ] },
      { key: 'speed', name: '速度', items: [
        ['1 米/秒(m/s)', '3.6 千米/小时(km/h)'],
        ['1 千米/小时(km/h)', '≈ 0.278 米/秒(m/s)'],
        ['1 节(kn)', '1 海里/小时 ≈ 1.852 千米/小时'],
        ['1 马赫', '≈ 1225 千米/小时（音速）'],
        ['光速', '≈ 3 × 10⁸ 米/秒']
      ] },
      { key: 'storage', name: '数据存储', items: [
        ['1 字节(B)', '8 位(bit)'],
        ['1 KB', '1024 字节(B)'],
        ['1 MB', '1024 KB'],
        ['1 GB', '1024 MB'],
        ['1 TB', '1024 GB']
      ] }
    ],

    render: function (state, curKey) {
      var list = NS.units.LIST;
      var html = '<div class="overlay">' +
        '<div class="overlay-head"><span class="back" data-act="closeOverlay">&times;</span>' +
        '<div class="title">常见单位换算</div></div>' +
        '<div class="overlay-body">';
      html += '<div class="chips" style="margin-bottom:10px">' +
        list.map(function (u) {
          return '<span class="chip' + (curKey === u.key ? ' active' : '') + '" data-act="unitTab" data-cat="' + u.key + '">' + u.name + '</span>';
        }).join('') + '</div>';
      var cur = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].key === curKey) { cur = list[i]; break; }
      }
      if (!cur) cur = list[0];
      html += '<div class="card">';
      html += '<div class="unit-title">' + cur.name + '</div>';
      cur.items.forEach(function (it) {
        html += '<div class="unit-row"><span class="ua">' + esc(it[0]) + '</span><span class="ueq">=</span><span class="ub">' + esc(it[1]) + '</span></div>';
      });
      html += '</div>';
      html += '</div></div>';
      return html;
    }
  };
})();