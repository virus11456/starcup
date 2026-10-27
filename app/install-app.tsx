"use client";

import { useEffect, useRef, useState } from 'react';
import styles from './install-app.module.css';

import { requestPwaInstall, type InstallPrompt } from '@/lib/pwa-install';

export default function InstallApp() {
  const pending = useRef<InstallPrompt | null>(null);
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(display.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const ready = (event: Event) => {
      event.preventDefault();
      pending.current = event as InstallPrompt;
      setAvailable(true);
    };
    const complete = () => {
      pending.current = null;
      setAvailable(false);
      setInstalled(true);
    };
    update();
    display.addEventListener('change', update);
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', complete);
    return () => {
      display.removeEventListener('change', update);
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', complete);
      pending.current = null;
    };
  }, []);

  async function install() {
    const event = pending.current;
    if (!event) return;
    pending.current = null; // Browser prompts can only be used once.
    setAvailable(false);
    try {
      const outcome = await requestPwaInstall(event);
      setMessage(outcome === 'accepted' ? '已接受安裝，請依瀏覽器提示完成。'
        : outcome === 'dismissed' ? '已取消安裝，仍可直接在網站遊玩。'
          : '瀏覽器已收到安裝要求，請查看畫面提示或下方安裝方式。');
    } catch {
      setMessage('請使用下方的瀏覽器選單步驟加入主畫面。');
    }
  }

  if (installed) return null;
  return <section id="install-app" className={styles.card} aria-labelledby="install-heading">
    <img src="/app-icons/icon-192.png" width="48" height="48" alt="" />
    <div className={styles.content}>
      <h2 id="install-heading">把星杯放到主畫面</h2>
      <p>下次點圖示就能開啟。遊玩仍需要網路連線。</p>
      <details>
        <summary>iPhone／iPad、Android、電腦安裝步驟</summary>
        <ol>
          <li><strong>iPhone／iPad：</strong>用 Safari 開啟本站，從「分享」選單選擇「加入主畫面」；若出現「作為網頁 App 打開」，請開啟後加入。</li>
          <li><strong>Android：</strong>用 Chrome 開啟本站，從選單選擇「安裝應用程式」或「新增至主畫面」。選項名稱可能因版本而異。</li>
          <li><strong>電腦：</strong>在 Chrome 或 Edge 的網址列／選單尋找「安裝」。沒有安裝選項時，仍可直接在瀏覽器遊玩。</li>
        </ol>
        <p>安裝後請在開局前從主畫面開啟，必要時重新輸入網站密碼。邀請好友可在多人房間分享連結，或請朋友在主畫面版輸入房間碼。</p>
        <p>進行中的牌局請留在原本的視窗；切換到主畫面版不會搬移原視窗的座位。</p>
      </details>
      {available && <button type="button" className={styles.install} onClick={install}>安裝星杯傳說</button>}
      <p role="status" className={styles.status}>{message}</p>
    </div>
  </section>;
}
