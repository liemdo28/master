module.exports = {
  whatsapp: require('../whatsapp/reply-service'),
  telegram: require('../telegram/telegram-forwarder'),
  yolink: (() => {
    try { return require('./yolink/yolink-poller'); } catch (_) { return null; }
  })(),
};
