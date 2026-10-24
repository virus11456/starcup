import Link from "next/link";
import SiteHeader from "../site-header";
import RulesDictionary from "../rules-dictionary";
export default function Rules() {
  return <div className="knowledge-shell"><SiteHeader /><main className="knowledge-content"><div className="knowledge-heading"><span className="portal-kicker">遊戲規則</span><h1>遊戲規則與裁定查詢</h1></div><div className="scope-banner"><strong>先確認你玩的模式。</strong><br />核心多人：簡化結算，角色圖片不提供技能效果。完整擴充：正式角色技能可用，目前單人對電腦。以下問答標明核心版實作範圍；完整角色技能可在圖鑑查閱。</div><RulesDictionary /><div className="knowledge-links"><Link href="/learn">新手逐步教學 →</Link><Link href="/cards">正式角色與卡牌效果 →</Link></div></main></div>;
}
