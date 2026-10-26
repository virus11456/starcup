import Link from "next/link";
import SiteHeader from "../site-header";
import RulesDictionary from "../rules-dictionary";
export default function Rules() {
  return <div className="knowledge-shell"><SiteHeader /><main className="knowledge-content"><div className="knowledge-heading"><span className="portal-kicker">遊戲規則</span><h1>遊戲規則與裁定查詢</h1></div><div className="scope-banner"><strong>先確認你玩的模式。</strong><br />單人對電腦與多人對戰共用完整角色引擎。以下是基本規則摘要；角色例外與版本差異請查看對應牌面及技能說明。</div><RulesDictionary /><div className="knowledge-links"><Link href="/learn">新手逐步教學 →</Link><Link href="/cards">正式角色與卡牌效果 →</Link><Link href="/online">多人對戰 →</Link></div></main></div>;
}
