import Link from "next/link";
export default function SiteHeader() {
  return <header className="site-header"><Link className="site-brand" href="/"><div>星杯傳說<small>並肩作戰，共寫傳說</small></div></Link><nav aria-label="網站導覽"><Link href="/">首頁</Link><Link href="/online">多人對戰</Link><Link href="/learn">新手教學</Link><Link href="/rules">遊戲規則</Link><Link href="/cards">卡牌與角色</Link></nav><Link className="header-play" href="/full">單人對電腦 <span>↗</span></Link></header>;
}
