const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<number> {
  const res = await fetch(`${API()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage: ${data.description}`);
  return data.result.message_id as number;
}

export async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption: string
): Promise<number> {
  const res = await fetch(`${API()}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' }),
  });
  const data = await res.json();
  if (!data.ok) {
    return sendTelegramMessage(chatId, caption + '\n\n📎 Photo: ' + photoUrl);
  }
  return data.result.message_id as number;
}

export async function replyTelegramMessage(
  chatId: string,
  replyToMessageId: number,
  text: string
): Promise<void> {
  await fetch(`${API()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyToMessageId }),
  });
}
