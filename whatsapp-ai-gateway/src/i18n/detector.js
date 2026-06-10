/**
 * Language Detector
 *
 * Auto-detects the user's language from message text.
 * Uses character-set heuristics and common word patterns.
 *
 * Supported: English (en), Spanish (es), Vietnamese (vi), French (fr)
 *
 * Usage:
 *   const lang = detect(text)  // returns 'en' | 'es' | 'vi' | 'fr'
 */

const LANG_CONFIGS = {
  vi: {
    // Vietnamese has: ư, ơ, ạ, ă, đ, etc. and no "th" as separate word in English
    chars: /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i,
    words: ['cảm ơn','xin chào','vui lòng','nhập','số','cửa hàng','tôi','bạn','không','có','cho','được','là','nào','mấy','giờ','ngày','lần','gửi','nhận','theo','bắt đầu','kết thúc','lưu','xóa','sửa','xem','trả lời','chọn','mục','hết','thiếu','ngoài phạm vi','nhiệt độ','kiểm tra','nhắc nhở','lịch sử','trạng thái','hệ thống','cần','muốn','hay','và','ở','của','với','đã','đang','sẽ','để','từ','ra','vào','trong','trên','dưới','này','kia','nọ','đó','đúng','sai','nhanh','chậm','nóng','lạnh','mới','cũ','tốt','xấu','hôm nay','ngày mai','hôm qua','tuần','tháng','năm','giúp','trợ giúp','giúp đỡ','tiếng việt','việt nam','việt'],
    boost: 3,
  },
  es: {
    chars: /[áéíóúüñ¿¡]/i,
    words: ['hola','gracias','buenos','cómo','está','tengo','quiero','puedo','necesito','por favor','muy','bien','mal','si','no','qué','cuál','dónde','cuándo','quién','algo','nada','todo','más','menos','también','tengo','está','tienda','tiempo','día','semana','mes','año','hora','minuto','registro','contar','guardar','cancelar','editar','ver','responder','cambiar','cerrar','abrir','empezar','terminar','confirmar','número','valor','cantidad','rango','fuera','adentro','dentro','afuera','temperatura','control','recordatorio','alerta','estado','sistema','hablas','español','castellano','ayuda','comando','menú','final','cancelar','sí','días','buenas','buenos','días','tardes','noches','gracias','por favor','español','castellano'],
    boost: 3,
  },
  fr: {
    chars: /[àâäçéèêëîïôöùûüÿœæ]/i,
    words: ['bonjour','bonsoir','merci','bon','mauvais','oui','non','peut','pouvez','vouloir','voulons','besoin','pourquoi','comment','quand','où','quel','quelle','qui','que','quoi','très','bien','mal','plus','moins','aussi','avec','sans','pour','dans','sur','sous','entre','vers','chez','magasin','jour','semaine','mois','année','heure','minute','enregistrer','compter','sauvegarder','annuler','modifier','voir','répondre','changer','fermer','ouvrir','commencer','terminer','confirmer','nombre','valeur','quantité','plage','hors','dedans','dehors','température','contrôle','rappel','alerte','état','système','parle','français','aide','commande','menu','fin','hors plage','chaud','froid','bien','ok','voilà','s’il','vous','plaît','aidez','aider','je','tu','il','elle','nous','vous','ils','elles','mon','ton','son','ma','ta','sa','mes','tes','ses','notre','votre','leurs','ce','cette','ces','être','avoir','faire','aller','venir','voir','savoir','pouvoir','vouloir','devoir','falloir','manger','boire','travail','famille','maison','école','ville','pays','monde','aujourd','demain','hier','maintenant','toujours','jamais','parfois','souvent','beaucoup','peu','trop','assez','voici'],
    boost: 3,
  },
  en: {
    chars: null, // catch-all — English has no diacritics beyond basic ASCII
    words: ['the','is','it','a','an','and','or','but','in','on','at','to','for','of','with','by','from','as','be','are','was','were','have','has','had','do','does','did','will','would','can','could','should','would','this','that','these','those','i','you','he','she','we','they','what','where','when','how','why','which','who','not','ok','yes','no','please','thank','thanks','hi','hello','store','item','value','number','count','save','edit','cancel','confirm','status','help','menu','end','close','open','start','stop','next','back','first','last','all','some','any','many','few','more','less','good','bad','pass','fail','range','target','out','above','below','inside','outside','please','now','then','later','soon','today','yesterday','tomorrow','week','month','year','hour','minute','second','speak','english','language'],
    boost: 1,
  },
};

const MIN_WORD_SCORE = 2;

function detect(text) {
  if (!text || typeof text !== 'string') return 'en';

  const normalized = text.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const scores = { en: 0, es: 0, vi: 0, fr: 0 };

  for (const [lang, cfg] of Object.entries(LANG_CONFIGS)) {
    // Check character set (strongest signal)
    if (cfg.chars && cfg.chars.test(normalized)) {
      scores[lang] += 10;
    }

    // Check keyword matches
    for (const word of words) {
      if (cfg.words.some(kw => word.includes(kw))) {
        scores[lang] += cfg.boost;
      }
    }
  }

  // Pick the winner
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return winner[1] >= MIN_WORD_SCORE ? winner[0] : 'en';
}

/**
 * Detect language AND store it in a session context.
 * Updates lang property in session object if provided.
 */
function detectAndTag(text, session) {
  const lang = detect(text);
  if (session && typeof session === 'object') {
    session.lang = lang;
  }
  return lang;
}

/**
 * Pre-seeded language for known store groups.
 * Useful when group language is consistent (e.g. Spanish-speaking staff).
 * Falls back to detection if no override is set.
 *
 * Environment variable: STORE_GROUP_LANGUAGES=chatId1:vi,chatId2:es
 */
function getGroupLanguage(chatId) {
  const env = process.env.STORE_GROUP_LANGUAGES || '';
  for (const part of env.split(',').map(s => s.trim()).filter(Boolean)) {
    const [id, lang] = part.split(':').map(s => s.trim());
    if (id === chatId && ['en', 'es', 'vi', 'fr'].includes(lang)) {
      return lang;
    }
  }
  return null; // null = use auto-detection
}

/**
 * Language detection with confidence score (for dashboard / memory).
 */
function detectWithConfidence(text) {
  if (!text || typeof text !== 'string') return { lang: 'en', confidence: 0, scores: {} };

  const normalized = text.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const scores = { en: 0, es: 0, vi: 0, fr: 0 };

  for (const [lang, cfg] of Object.entries(LANG_CONFIGS)) {
    if (cfg.chars && cfg.chars.test(normalized)) {
      scores[lang] += 10;
    }
    for (const word of words) {
      if (cfg.words.some(kw => word.includes(kw))) {
        scores[lang] += cfg.boost;
      }
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [winnerLang, winnerScore] = sorted[0];
  const [, runnerUpScore] = sorted[1] || ['en', 0];

  if (winnerScore < MIN_WORD_SCORE) {
    return { lang: 'en', confidence: 0, scores };
  }
  // Confidence: 0..1, computed from winner-vs-runnerup gap
  const confidence = Math.min(1, winnerScore / 20);
  return { lang: winnerLang, confidence: Math.max(0.5, confidence), scores };
}

module.exports = { detect, detectAndTag, detectWithConfidence, getGroupLanguage, LANG_CONFIGS };
