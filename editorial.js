'use strict';
const BASE_URLS = Object.freeze({
  stores: 'https://winproducts.io/winning-stores',
  products: 'https://winproducts.io/winning-products',
  ads: 'https://winproducts.io/winning-creatives',
  tips: 'https://winproducts.io/winning-stores'
});
const SLOTS = Object.freeze([
  { kind: 'linked', time: '12:30' },
  { kind: 'plain', time: '19:30' }
]);
const MAX_LENGTH = 280;
const URL_RE = /https?:\/\/[^\s]+/gi;
const strip = v => String(v ?? '').trim();
function urls(text) { return strip(text).match(URL_RE) || []; }
function isWinproductsLink(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'winproducts.io' && Object.values(BASE_URLS).some(p => u.pathname === new URL(p).pathname); }
  catch { return false; }
}
function validatePost(post) {
  if (!post || typeof post !== 'object') throw new Error('Gönderi nesnesi eksik');
  if (!['linked','plain'].includes(post.kind)) throw new Error(`Geçersiz tür: ${post.kind}`);
  const text = strip(post.text);
  if (!text || text.length > MAX_LENGTH) throw new Error(`Tweet uzunluğu geçersiz (${text.length}): ${post.id}`);
  const links = urls(text);
  if (post.kind === 'linked') {
    if (links.length !== 1 || !isWinproductsLink(links[0])) throw new Error(`URL'li tweet tam 1 WinProducts bağlantısı içermeli: ${post.id}`);
  } else if (links.length !== 0) throw new Error(`URL'siz tweette bağlantı yasak: ${post.id}`);
  if (/\b(?:kesin satış|garanti kazanç|kesin kâr|herkes zengin)\b/i.test(text)) throw new Error(`Kesin kazanç iddiası: ${post.id}`);
  return true;
}
function istanbulDate(now) {
  const d = new Date(now);
  if (Number.isNaN(d.getTime())) throw new Error('Geçersiz zaman');
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}
function dateDiff(start, end) { return Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000); }
function dayId(date) { return date.replace(/-/g, ''); }
function scheduleIso(date, time) { return `${date}T${time}:00+03:00`; }
function addTracking(url, date, category) {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'x');
  u.searchParams.set('utm_medium', 'organic');
  u.searchParams.set('utm_campaign', 'wp-' + date.replace(/-/g,''));
  u.searchParams.set('utm_content', category);
  return u.toString();
}
function planDay(date, startDate, bank) {
  const index = dateDiff(startDate,date);
  if (index < 0) return [];
  if (index >= bank.length) throw new Error(`İçerik havuzu tükendi (${bank.length} gün). Yeni özgün içerik ekleyin; eski tweetler tekrarlanmayacak.`);
  const pair=bank[index];
  if (!pair || !BASE_URLS[pair.category]) throw new Error(`İçerik türü geçersiz: ${index}`);
  const link=addTracking(BASE_URLS[pair.category],date,pair.category);
  const posts=[
    {id:`${dayId(date)}-URL`,kind:'linked',category:pair.category,schedule_at:scheduleIso(date,SLOTS[0].time),text:`${strip(pair.linked)}\n\n${link}`},
    {id:`${dayId(date)}-NOURL`,kind:'plain',category:pair.category,schedule_at:scheduleIso(date,SLOTS[1].time),text:strip(pair.plain)}
  ];
  posts.forEach(validatePost);
  return posts;
}
module.exports={BASE_URLS,SLOTS,MAX_LENGTH,urls,validatePost,istanbulDate,dateDiff,planDay};
