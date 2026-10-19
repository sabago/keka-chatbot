# WordPress Embedding Guide for Keka Chatbot

This guide shows you how to add the Keka HIPAA-compliant chatbot to your WordPress website. Visitors see a round chat bubble in the bottom-right corner of every page. The chat opens **only** when they click the bubble, or a "Chat with us" button you add. It never opens on its own.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Upgrading from the Old iframe Snippet](#upgrading-from-the-old-iframe-snippet)
3. [Method 1: WordPress Plugin (Easiest)](#method-1-wordpress-plugin-easiest)
4. [Method 2: Theme Footer](#method-2-theme-footer)
5. [Method 3: Code Snippets (PHP)](#method-3-code-snippets-php)
6. [Adding Your Own "Chat with us" Button](#adding-your-own-chat-with-us-button)
7. [Testing & Troubleshooting](#testing--troubleshooting)
8. [How It Works](#how-it-works)
9. [Security & Privacy](#security--privacy)

---

## Quick Start

**What you'll add to your site footer:**
```html
<!-- Keka Chatbot -->
<script src="https://keka-chatbot-production.up.railway.app/embed.js" async></script>
```

**Result:** a chat bubble appears in the bottom-right corner on every page. When a visitor clicks it, the chat panel opens. On phones the panel opens full-screen.

---

## Upgrading from the Old iframe Snippet

Earlier versions of this guide used an `<iframe src="https://keka-chatbot-production.up.railway.app" style="position: fixed; ... width: 400px; height: 600px; ...">` snippet. That snippet always showed the chat panel open, and it covered a 400×600 area of the page.

To upgrade:
1. Find where the old `<iframe ...>` snippet was added. It could be in a header/footer plugin, `footer.php`, Code Snippets, a Custom HTML block, or Google Tag Manager.
2. **Delete the whole iframe snippet.** Don't keep it next to the new one, or two chatbots will show.
3. Paste the new `<script>` line in its place.
4. Clear your WordPress and CDN caches (see [Troubleshooting](#issue-1-chatbot-doesnt-appear)).

---

## Method 1: WordPress Plugin (Easiest)

### Recommended Plugin: "WPCode" (formerly "Insert Headers and Footers")

1. Go to **Plugins > Add New**
2. Search for "WPCode" (or "Insert Headers and Footers")
3. Click **Install Now**, then **Activate**
4. Go to **Code Snippets > Header & Footer** (or **Settings > Insert Headers and Footers**)
5. In the **Footer** section, paste:
   ```html
   <!-- Keka Chatbot -->
   <script src="https://keka-chatbot-production.up.railway.app/embed.js" async></script>
   ```
6. Click **Save**

**Pros:** no code editing, survives theme updates, easy to turn off.

---

## Method 2: Theme Footer

Use a child theme so theme updates don't overwrite your change.

1. Go to **Appearance > Theme File Editor**
2. Select **Theme Footer (footer.php)**
3. Paste the snippet just **before** the closing `</body>` tag:
   ```html
   <!-- Keka Chatbot -->
   <script src="https://keka-chatbot-production.up.railway.app/embed.js" async></script>
   ```
4. Click **Update File**

---

## Method 3: Code Snippets (PHP)

Use this if you want PHP control, such as showing the chatbot on only some pages.

1. Install and activate the **Code Snippets** plugin
2. Go to **Snippets > Add New** and name it "Keka Chatbot"
3. Paste:

```php
<?php
/**
 * Load the Keka chatbot bubble on the front end
 */
function keka_chatbot_embed() {
    // Examples of limiting where it shows:
    // if (!is_front_page()) return;
    // if (is_page(array(123, 456))) return;
    ?>
    <script src="https://keka-chatbot-production.up.railway.app/embed.js" async></script>
    <?php
}
add_action('wp_footer', 'keka_chatbot_embed');
```

4. Set **Run snippet everywhere** (front end only), then **Save Changes and Activate**

---

## Adding Your Own "Chat with us" Button

The floating bubble is always available. You can also open the chat from any button or link on your pages:

**Elementor Button widget:** set the button's **Link** to `#keka-chat`.

**Gutenberg Button block / any link:** set the URL to `#keka-chat`.

**Custom HTML:**
```html
<a href="#keka-chat">Chat with us</a>

<!-- or any element with data-keka-chat -->
<button type="button" data-keka-chat>Questions? Chat with us</button>
```

**JavaScript** (advanced):
```js
window.KekaChat.open();
```

Clicking one of these opens the chat panel. The page doesn't jump or scroll, and `#keka-chat` isn't added to the address bar.

> Note: visiting a URL that ends in `#keka-chat` does **not** open the chat automatically. It opens only on a click.

---

## Testing & Troubleshooting

### Testing Checklist

- [ ] Only the chat bubble shows when a page loads (the panel is closed)
- [ ] Page content near the bottom-right corner can still be clicked
- [ ] Clicking the bubble opens the panel
- [ ] The **X** button and the **Esc** key close the panel back to the bubble
- [ ] "Chat with us" links (`#keka-chat`) open the panel
- [ ] Going to another page shows the bubble closed again
- [ ] All service category buttons are visible
- [ ] "Start Intake" flow works (email/phone collection)
- [ ] PHI detection works (try typing "my SSN is 123-45-6789")
- [ ] On a phone, the panel opens full-screen and closes back to the bubble

### Issue 1: Chatbot Doesn't Appear

1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear WordPress cache:
   - WP Super Cache: **Settings > WP Super Cache > Delete Cache**
   - W3 Total Cache: **Performance > Dashboard > Empty All Caches**
   - WP Rocket: **Settings > WP Rocket > Clear Cache**
   - LiteSpeed / Hostinger: **LiteSpeed Cache > Toolbox > Purge All**
3. If you use an "optimize/delay/combine JavaScript" feature (WP Rocket, LiteSpeed, Autoptimize), exclude `embed.js` from it
4. Check the browser console (F12 > Console) for errors

### Issue 2: Two Chatbots, or a Large Blank Box

The old iframe snippet is still on the page. Remove it (see [Upgrading](#upgrading-from-the-old-iframe-snippet)).

### Issue 3: Chatbot Appears Behind Other Elements

The chatbot uses the highest practical `z-index`. If a theme element still covers it, that element is probably using `position: fixed` with a huge z-index. Lower that element's z-index in your theme CSS.

### Issue 4: "frame-ancestors" CSP Error

**Error Message:**
```
Framing 'https://keka-chatbot-production.up.railway.app/' violates the following Content Security Policy directive: "frame-ancestors ...". The request has been blocked.
```

The chatbot only allows these sites to embed it: `kekarehabservices.com` and `www.kekarehabservices.com`. To add another domain, set `ALLOWED_EMBED_DOMAINS` in Railway (comma-separated, replaces the defaults):
```
ALLOWED_EMBED_DOMAINS=kekarehabservices.com,www.kekarehabservices.com,newsite.com
```
Then redeploy.

### Issue 5: "Connection Failed" Error

1. Check the service is live: `https://keka-chatbot-production.up.railway.app/api/health`
   should return `{"status":"ok","timestamp":"..."}`
2. Check the Railway dashboard for deployment status and logs

---

## How It Works

`embed.js` is a small script (a few KB) served by the chatbot backend. It:

1. Adds a small transparent iframe in the bottom-right corner, sized to fit only the chat bubble
2. Grows the iframe to the panel size (400×650, or full-screen on phones) when the visitor opens the chat
3. Shrinks it back to the bubble when they close it
4. Listens for clicks on `#keka-chat` links / `data-keka-chat` elements and tells the chat to open

The chat starts a new conversation (and counts a session in analytics) only when it's opened. Page views where nobody opens the chat aren't counted.

---

## Security & Privacy

1. **Isolation:** the chat UI still runs inside an iframe on the chatbot's own domain
   - It can't read WordPress cookies, session data, or page content
   - What visitors type stays inside the iframe and is never shared with the WordPress page
2. **Minimal messages:** the only messages exchanged between the page and the chat are "open" and "opened/closed". They carry no user data.
3. **Embedding allowlist:** CSP `frame-ancestors` limits which sites can embed the chat
4. **HIPAA safeguards:** PHI detection, privacy-preserving logging (hashed IPs, no raw input)

### If Your WordPress Site Has a Strict CSP

Allow the script and the frame:
```
Content-Security-Policy: script-src 'self' https://keka-chatbot-production.up.railway.app; frame-src 'self' https://keka-chatbot-production.up.railway.app;
```

### HTTPS

Your WordPress site must use HTTPS, or browsers will block the chatbot (mixed content). Use a plugin like "Really Simple SSL" if needed.

---

**Last Updated**: 2026-10-19
**Production URL**: https://keka-chatbot-production.up.railway.app
