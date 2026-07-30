// Business hours guard — reads from config or env
// Outside hours: send "closed" message instead of AI reply

const DEFAULT_HOURS = {
  // 0=Sun … 6=Sat, null means closed all day
  0: { open: '10:00', close: '22:00' }, // Sun
  1: { open: '11:00', close: '22:00' }, // Mon
  2: { open: '11:00', close: '22:00' },
  3: { open: '11:00', close: '22:00' },
  4: { open: '11:00', close: '22:00' },
  5: { open: '11:00', close: '23:00' }, // Fri
  6: { open: '10:00', close: '23:00' }, // Sat
};

function isOpen(now = new Date()) {
  if (process.env.BUSINESS_HOURS_ENABLED === 'false') return true; // disabled → always open
  const day = now.getDay();
  const hours = DEFAULT_HOURS[day];
  if (!hours) return false;

  const [oh, om] = hours.open.split(':').map(Number);
  const [ch, cm] = hours.close.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  const open  = oh * 60 + om;
  const close = ch * 60 + cm;
  return cur >= open && cur < close;
}

function getClosedMessage() {
  const day = new Date().getDay();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const tomorrow = (day + 1) % 7;
  const nextHours = DEFAULT_HOURS[tomorrow];
  const nextOpen = nextHours ? `tomorrow (${days[tomorrow]}) at ${nextHours.open}` : 'soon';
  return `Thank you for your message! 🙏\n\nWe're currently closed. Our team will respond when we reopen ${nextOpen}.\n\nFor urgent matters please call us directly. See you soon! 🍜`;
}

function getTodayScheduleText() {
  const day = new Date().getDay();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const h = DEFAULT_HOURS[day];
  return h ? `${days[day]}: ${h.open} – ${h.close}` : `${days[day]}: Closed`;
}

module.exports = { isOpen, getClosedMessage, getTodayScheduleText };
