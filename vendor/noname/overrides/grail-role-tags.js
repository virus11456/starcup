/* GPL-3.0: editorial playstyle hints based on the pinned character skills and
 * characterIntro. These are not official classes, factions or rule changes.
 * Keep explicit mappings: a name containing "魔" does not make a caster. */
const labels = { battle: '戰鬥', mage: '法師', support: '輔助', control: '控場', guard: '守護', resource: '資源' };
const roles = {
  fengZhiJianSheng: ['battle'], kuangZhanShi: ['battle'], shenJianShou: ['battle', 'control'],
  fengYinShi: ['mage', 'control'], anShaZhe: ['battle'], shengNv: ['support', 'guard'],
  tianShi: ['support', 'guard'], moFaShaoNv: ['mage'], moJianShi: ['battle'],
  shengQiangQiShi: ['battle'], yuanSuShi: ['mage'], maoXianJia: ['support', 'resource'],
  wenYiFaShi: ['mage'], zhongCaiZhe: ['mage'], shenGuan: ['support', 'guard'],
  qiDaoShi: ['support', 'resource'], xianZhe: ['mage', 'support'], lingFuShi: ['mage', 'control'],
  jianDi: ['battle'], geDouJia: ['battle'], yongZhe: ['battle'],
  lingHunShuShi: ['mage', 'support'], xueZhiWuNv: ['mage'], dieWuZhe: ['mage', 'support'],
  nvWuShen: ['battle', 'guard'], moGong: ['battle', 'mage'], hongLianQiShi: ['battle'],
  yingLingRenXing: ['mage', 'battle'], moQiang: ['battle'], cangYanMoNv: ['mage', 'control'],
  yinYouShiRen: ['support', 'mage'], jingLingSheShou: ['battle'], yinYangShi: ['battle', 'mage'],
  xueSeJianLing: ['battle'], yueZhiNvShen: ['support', 'guard'], shouLingWuShi: ['battle'],
  shengGong: ['mage', 'support'], zhanDouFaShi: ['battle', 'mage'], xingZhuiNvWu: ['mage', 'support'],
  shengTingJianChaShi: ['support', 'guard'], lieWuRen: ['battle', 'control'], shengDianQiShi: ['battle', 'guard'],
  jinGuiZhiNv: ['mage', 'resource'], nvPuZhang: ['battle', 'control'], jieJieShi: ['support', 'control'],
  shenMiXueZhe: ['mage', 'battle'], ranWuZhe: ['battle'], shiShenZhe: ['battle', 'control'],
  zhuLvZhe: ['battle', 'control'], hongYiZhuJiao: ['support', 'guard'], jiLuZhe: ['battle', 'resource'],
  chuanJiaoShi: ['support', 'resource'], yiJiaoTu: ['support', 'control'], jianZhiMoNv: ['battle'],
  tanLanShaoNv: ['mage', 'resource'], lingXiZhiChao: ['mage', 'control'], youJiShi: ['battle'],
  zhouFuShi: ['mage', 'control'], yuanChuZhiGong: ['mage', 'support'], daoDanLuoLi: ['mage', 'control'],
  luoLiFanZhang: ['battle'], jianXiZhiPian: ['mage'], daiDuoShaoNv: ['support', 'guard'],
  jiDuShaoNv: ['battle', 'mage'], jianZhiZi: ['battle'], moGongEX: ['battle', 'control'],
  sheng_zhongCaiZhe: ['battle', 'support'], baoShiShaoNv: ['support', 'guard'],
};

export function roleProfile(id) {
  const key = String(id || '').replace(/^(san|si)_/, '');
  const tags = Object.hasOwn(roles, key) ? roles[key] : null;
  return tags ? { primary: tags[0], labels: tags.map(tag => labels[tag]) } : null;
}

// Native character packs encode a half star as hp/maxHp (3/4 => 3.5).
// This is their existing difficulty scale, not a new balance/strength rating.
export function roleDifficulty(info) {
  const low = Number(info?.hp), high = Number(info?.maxHp);
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 1 || high > 5 || high < low || high - low > 1) return null;
  return (low + high) / 2;
}

export function decorateRoleButton(node, id, info) {
  const profile = roleProfile(id);
  let badge = node.querySelector('.grail-role-tag');
  if (!profile) { badge?.remove(); delete node.dataset.grailRole; delete node.dataset.grailDifficulty; return; }
  if (!badge) {
    badge = node.ownerDocument.createElement('span');
    badge.className = 'grail-role-tag';
    node.append(badge);
  }
  node.dataset.grailRole = profile.primary;
  const label = node.ownerDocument.createElement('span');
  label.className = 'grail-role-label'; label.textContent = profile.labels.join('／');
  badge.replaceChildren(label);
  const stars = roleDifficulty(info);
  if (stars !== null) {
    node.dataset.grailDifficulty = String(stars);
    const difficulty = node.ownerDocument.createElement('span');
    difficulty.className = 'grail-role-difficulty';
    difficulty.setAttribute('aria-label', '上手難度 ' + stars + ' 星，滿分 5 星');
    const track = node.ownerDocument.createElement('span');
    track.className = 'grail-role-stars'; track.textContent = '★★★★★';
    track.setAttribute('aria-hidden', 'true');
    track.style.setProperty('--grail-star-fill', (stars / 5 * 100) + '%');
    const value = node.ownerDocument.createElement('span'); value.textContent = String(stars);
    value.setAttribute('aria-hidden', 'true');
    difficulty.append(track, value); badge.append(difficulty);
  } else delete node.dataset.grailDifficulty;
  badge.title = '定位參考：' + profile.labels.join('、') + (stars !== null ? '。上手難度 ' + stars + '／5 星（沿用原引擎；非強度評分）' : '') + '。實際效果請查看技能說明。';
}

export function addRoleLegend(arena) {
  if (!arena?.classList.contains('choose-character')) return;
  for (const dialog of arena.querySelectorAll('.dialog')) {
    const buttons = dialog.querySelector('.buttons:has(.button.character[data-grail-role])');
    if (!buttons || dialog.querySelector('.grail-role-legend')) continue;
    const legend = arena.ownerDocument.createElement('p');
    legend.className = 'grail-role-legend';
    legend.textContent = '定位參考：戰鬥／法師／輔助。上手難度 ★ 越多越需要熟悉技能，保留原引擎半星；星等不是強度。';
    buttons.before(legend);
  }
}
