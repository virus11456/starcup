import Link from "next/link";
export default function SiteHeader() {
  return <header className="site-header"><Link className="site-brand" href="/"><span>✦</span><div>星杯傳說<small>ASTERIATED GRAIL</small></div></Link><nav aria-label="網站導覽"><Link href="/">對戰大廳</Link><Link href="/learn">新手教學</Link><Link href="/rules">遊戲規則</Link><Link href="/cards">卡牌與角色</Link></nav><Link className="header-play" href="/full">開始冒險 <span>↗</span></Link></header>;
}
