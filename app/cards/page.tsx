import SiteHeader from "../site-header";
import Compendium from "../compendium";
export default function Cards() {
  return <div className="knowledge-shell"><SiteHeader /><main className="knowledge-content"><div className="knowledge-heading"><span className="portal-kicker">THE STAR ARCHIVE</span><h1>每張牌，都有它的力量。</h1><p>搜尋正式角色、技能、牌型與 150 張實體牌的屬性。繁體與簡體關鍵字皆可使用。</p></div><Compendium /></main></div>;
}
