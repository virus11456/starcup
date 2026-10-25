export function roomFailure(error) {
  const message = String(error?.message || '');
  if (/Exceeded allowed rows (?:written|read) in Durable Objects free tier/i.test(message)) {
    return { status: 429, error: '多人服務今日的免費資料庫額度已用完，將於下一個台灣時間早上 8 點重置。單人模式仍可遊玩。' };
  }
  return { status: Number(error?.status) || 500, error: error?.status ? message : '房間服務暫時無法連線，請稍後重試。' };
}
