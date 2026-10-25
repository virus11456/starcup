import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, safeAccessNext, validAccessToken } from "@/lib/site-access";
import styles from "./access.module.css";

export const metadata: Metadata = { title: "進入星杯傳說", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccessPage({ searchParams }: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeAccessNext(params.next);
  const unlocked = validAccessToken((await cookies()).get(ACCESS_COOKIE)?.value);
  const error = params.error === "password" ? "密碼不正確，請再試一次。"
    : params.error === "rate" ? "嘗試次數過多，請於 15 分鐘後再試。" : "";
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="access-title">
        <div className={styles.emblem} aria-hidden="true">✦</div>
        <p className={styles.eyebrow}>星杯傳說</p>
        <h1 id="access-title">{unlocked ? "歡迎回到牌桌" : "冒險，從這裡開始"}</h1>
        <p className={styles.intro}>{unlocked ? "這個瀏覽器已通過驗證。" : "輸入網站密碼，進入星杯的世界。"}</p>
        {unlocked ? <>
          <a className={styles.primary} href={next}>進入網站 <span aria-hidden="true">↗</span></a>
          <form action="/api/access" method="post"><input type="hidden" name="action" value="lock" /><button className={styles.lock}>重新鎖定網站</button></form>
        </> : <form action="/api/access" method="post" className={styles.form}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="site-password">網站密碼</label>
          <input id="site-password" name="password" type="password" autoComplete="current-password" required maxLength={256} placeholder="請輸入密碼" aria-describedby={error ? "access-error" : undefined} aria-invalid={!!error} />
          {error && <p id="access-error" className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.primary}>進入網站 <span aria-hidden="true">↗</span></button>
        </form>}
        <p className={styles.note}>並肩作戰，共寫傳說</p>
      </section>
    </main>
  );
}
