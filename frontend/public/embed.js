/**
 * Keka Chatbot embed loader.
 *
 * Add to the host site (e.g. WordPress footer):
 *   <script src="https://keka-chatbot-production.up.railway.app/embed.js" async></script>
 *
 * Shows only the chat bubble until the visitor clicks it. Any link to
 * "#keka-chat", any element with a data-keka-chat attribute, or
 * window.KekaChat.open() also opens the chat. It never opens on its own.
 */
(function () {
  if (document.getElementById('keka-chat-frame')) return;

  var script = document.currentScript;
  var CHAT_ORIGIN = new URL(script ? script.src : window.location.href).origin;
  var MOBILE_QUERY = window.matchMedia('(max-width: 640px)');

  var isOpen = false;

  var iframe = document.createElement('iframe');
  iframe.id = 'keka-chat-frame';
  iframe.title = 'Keka Support Chat';
  iframe.src = CHAT_ORIGIN + '/';
  iframe.setAttribute('allowtransparency', 'true');

  var BASE_STYLE = {
    position: 'fixed',
    border: '0',
    margin: '0',
    padding: '0',
    background: 'transparent',
    colorScheme: 'normal', // prevents an opaque backdrop in dark mode
    zIndex: '2147483000',
    maxWidth: '100vw',
    maxHeight: '100vh',
  };

  // Closed: just enough room for the 64px launcher (24px inset) plus hover/shadow
  var CLOSED_STYLE = {
    width: '100px',
    height: '100px',
    bottom: '0',
    right: '0',
    borderRadius: '0',
    boxShadow: 'none',
  };

  var OPEN_DESKTOP_STYLE = {
    width: '400px',
    height: 'min(650px, calc(100vh - 40px))',
    bottom: '20px',
    right: '20px',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  };

  var OPEN_MOBILE_STYLE = {
    width: '100vw',
    height: '100dvh',
    bottom: '0',
    right: '0',
    borderRadius: '0',
    boxShadow: 'none',
  };

  function applyStyle(style) {
    for (var key in style) iframe.style[key] = style[key];
  }

  function applySize() {
    if (!isOpen) applyStyle(CLOSED_STYLE);
    else applyStyle(MOBILE_QUERY.matches ? OPEN_MOBILE_STYLE : OPEN_DESKTOP_STYLE);
  }

  function open() {
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage({ source: 'keka-chat-host', type: 'open' }, CHAT_ORIGIN);
  }

  // The chat app reports its open/closed state; resize the frame to match
  window.addEventListener('message', function (event) {
    if (event.origin !== CHAT_ORIGIN || event.source !== iframe.contentWindow) return;
    var data = event.data;
    if (!data || data.source !== 'keka-chat' || data.type !== 'state') return;
    isOpen = data.open === true;
    applySize();
  });

  if (MOBILE_QUERY.addEventListener) MOBILE_QUERY.addEventListener('change', applySize);
  else if (MOBILE_QUERY.addListener) MOBILE_QUERY.addListener(applySize);

  // Host-page buttons/links that open the chat
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var trigger = target.closest('a[href$="#keka-chat"], [data-keka-chat]');
    if (!trigger) return;
    event.preventDefault();
    open();
  }, true);

  window.KekaChat = { open: open };

  applyStyle(BASE_STYLE);
  applySize();

  function mount() {
    document.body.appendChild(iframe);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
