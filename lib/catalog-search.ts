// Search aliases only; printed source text remains unchanged.
const traditional = "風劍聖滅虛靈術師戰獵槍騎墜巫異寶藥煉禱詠神創臨終末鑄龍鬥獸喚劫穢傭貪婪貓陰陽賢封印擊傷療癒盾彈閃電響應轉劍斬血紅藍護斷奪惡覺隱慾癡食無級強擇棄張點屬勢鎖將體態開關後時選擁餘傳淨凍氣歸墮";
const simplified = "风剑圣灭虚灵术师战猎枪骑坠巫异宝药炼祷咏神创临终末铸龙斗兽唤劫秽佣贪婪猫阴阳贤封印击伤疗愈盾弹闪电响应转剑斩血红蓝护断夺恶觉隐欲痴食无级强择弃张点属势锁将体态开关后时选拥余传净冻气归堕";
const aliases = new Map(Array.from(traditional, (char, i) => [char, simplified[i]]));
export const normalizeSearch = (value: string) => Array.from(value.normalize("NFKC").toLowerCase(), c => aliases.get(c) || c).join("").replace(/\s+/g, " ").trim();
export const matchesCatalog = (text: string, query: string) => normalizeSearch(query).split(" ").every(word => normalizeSearch(text).includes(word));
