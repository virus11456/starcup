import Link from "next/link";
import SiteBrand from './site-brand';
export default function SiteHeader() {
  return <header className="site-header"><SiteBrand /><nav aria-label="網站導覽"><Link href="/">首頁</Link><Link href="/online">多人對戰</Link><Link href="/learn">新手教學</Link><Link href="/rules">遊戲規則</Link><Link href="/cards">卡牌與角色</Link></nav><Link className="header-play" href="/full">單人對電腦 <span>↗</span></Link></header>;
}
