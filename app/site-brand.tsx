import Link from 'next/link';
import type { MouseEventHandler } from 'react';

export default function SiteBrand({ onClick }: { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return <Link className="site-brand" href="/" onClick={onClick} aria-label="星杯傳說，返回首頁">
    <div>星杯傳說<small>並肩作戰，共寫傳說</small></div>
  </Link>;
}
