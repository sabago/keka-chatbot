# WordPress Embedding Guide for Keka Chatbot

This guide shows you how to embed the Keka HIPAA-compliant chatbot on your WordPress website using an iframe. The chatbot will appear as a fixed widget in the bottom-right corner of your pages.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Method 1: Theme Footer (Sitewide - Recommended)](#method-1-theme-footer-sitewide---recommended)
3. [Method 2: WordPress Plugin (Easiest)](#method-2-wordpress-plugin-easiest)
4. [Method 3: Custom Code Plugin](#method-3-custom-code-plugin)
5. [Method 4: Individual Pages Only](#method-4-individual-pages-only)
6. [Customization Options](#customization-options)
7. [Testing & Troubleshooting](#testing--troubleshooting)
8. [Mobile Responsiveness](#mobile-responsiveness)
9. [Security & Privacy](#security--privacy)

---

## Quick Start

**What you'll embed:**
```html
<iframe
  src="https://keka-chatbot-production.up.railway.app"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
  title="Keka Support Chat">
</iframe>
```

**Result:** A chat widget appears in the bottom-right corner on every page of your site.

---

## Method 1: Theme Footer (Sitewide - Recommended)

### Best For:
- Making the chatbot visible on ALL pages sitewide
- Users comfortable editing theme files
- Maximum control over implementation

### Prerequisites:
- Access to WordPress Admin Dashboard
- Permission to edit theme files
- Basic understanding of HTML

### Step-by-Step Instructions:

#### Step 1: Create a Child Theme (Recommended)

**Why?** Editing your main theme directly means updates will overwrite your changes. A child theme protects your customizations.

1. Log into your WordPress Admin Dashboard
2. Go to **Appearance > Theme File Editor**
3. If you don't have a child theme:
   - Go to **Appearance > Themes > Add New**
   - Search for "Child Theme Configurator" plugin
   - Install and activate it
   - Go to **Tools > Child Themes**
   - Create a child theme for your current theme

#### Step 2: Edit the Footer File

1. Go to **Appearance > Theme File Editor**
2. **Important Warning:** WordPress will show a warning about editing theme files. Proceed carefully.
3. In the right sidebar, select **Theme Footer (footer.php)**
4. Scroll to the bottom of the file
5. Find the closing `</body>` tag (usually near the end)
6. **Paste the following code BEFORE the `</body>` tag:**

```html
<!-- Keka Chatbot Widget -->
<iframe
  src="https://keka-chatbot-production.up.railway.app"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
  title="Keka Support Chat"
  loading="lazy">
</iframe>
<!-- End Keka Chatbot Widget -->
```

7. Click **Update File**

#### Step 3: Verify

1. Visit any page on your website
2. The chatbot widget should appear in the bottom-right corner
3. Click it to test functionality

### Pros:
- ✅ Appears on all pages automatically
- ✅ Loads with the page (no plugin overhead)
- ✅ Full control over placement
- ✅ Survives plugin deactivations

### Cons:
- ❌ Requires editing theme files
- ❌ Can be overwritten by theme updates (use child theme!)
- ❌ Requires basic HTML knowledge

---

## Method 2: WordPress Plugin (Easiest)

### Best For:
- Users who want to avoid editing code
- Quick setup without technical knowledge
- Easy to enable/disable

### Recommended Plugin: "Insert Headers and Footers"

#### Step 1: Install the Plugin

1. Go to **Plugins > Add New**
2. Search for "Insert Headers and Footers" (by WPBeginner)
3. Click **Install Now**
4. Click **Activate**

#### Step 2: Add the Chatbot Code

1. Go to **Settings > Insert Headers and Footers**
2. Scroll to the **Scripts in Footer** section
3. Paste the following code:

```html
<!-- Keka Chatbot Widget -->
<iframe
  src="https://keka-chatbot-production.up.railway.app"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
  title="Keka Support Chat"
  loading="lazy">
</iframe>
<!-- End Keka Chatbot Widget -->
```

4. Click **Save**

#### Step 3: Verify

1. Visit your website
2. The chatbot should appear on all pages

### Pros:
- ✅ No code editing required
- ✅ User-friendly interface
- ✅ Easy to remove/disable
- ✅ Works with any theme
- ✅ Survives theme updates

### Cons:
- ❌ Adds another plugin (minimal overhead)
- ❌ Requires plugin to stay active

### Alternative Plugins:

**Option A: "Head, Footer and Post Injections"**
- More features but slightly more complex
- Allows per-page control

**Option B: "Code Snippets"**
- For users comfortable with PHP
- More powerful but requires coding knowledge

---

## Method 3: Custom Code Plugin

### Best For:
- Advanced users who want PHP control
- Conditional display (show on certain pages only)
- Integration with WordPress hooks

### Using "Code Snippets" Plugin

#### Step 1: Install Code Snippets

1. Go to **Plugins > Add New**
2. Search for "Code Snippets"
3. Install and activate

#### Step 2: Create a New Snippet

1. Go to **Snippets > Add New**
2. Give it a name: "Keka Chatbot Embed"
3. Paste the following PHP code:

```php
<?php
/**
 * Embed Keka Chatbot on all pages
 */
function keka_chatbot_embed() {
    ?>
    <!-- Keka Chatbot Widget -->
    <iframe
      src="https://keka-chatbot-production.up.railway.app"
      style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
      title="Keka Support Chat"
      loading="lazy">
    </iframe>
    <!-- End Keka Chatbot Widget -->
    <?php
}
add_action('wp_footer', 'keka_chatbot_embed');
```

4. Set **Run snippet everywhere** (or customize)
5. Click **Save Changes and Activate**

### Advanced: Conditional Display

To show the chatbot only on specific pages, modify the function:

```php
function keka_chatbot_embed() {
    // Only show on homepage
    if (is_front_page()) {
        ?>
        <!-- Keka Chatbot Widget -->
        <iframe
          src="https://keka-chatbot-production.up.railway.app"
          style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
          title="Keka Support Chat"
          loading="lazy">
        </iframe>
        <?php
    }

    // To show on specific page IDs:
    // if (is_page(array(123, 456, 789))) { ... }

    // To exclude admin and login pages:
    // if (!is_admin() && !is_page('login')) { ... }
}
```

### Pros:
- ✅ Powerful conditional logic
- ✅ Clean code management
- ✅ Easy to modify/disable
- ✅ No theme file editing

### Cons:
- ❌ Requires basic PHP knowledge
- ❌ Another plugin dependency

---

## Method 4: Individual Pages Only

### Best For:
- Testing before sitewide deployment
- Showing chatbot on specific pages/posts only
- Landing pages or contact pages

### Step-by-Step:

1. Edit any Page or Post in WordPress
2. Click the **(+)** button to add a new block
3. Search for "Custom HTML" block
4. Add the Custom HTML block
5. Paste the iframe code:

```html
<iframe
  src="https://keka-chatbot-production.up.railway.app"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
  title="Keka Support Chat"
  loading="lazy">
</iframe>
```

6. Click **Update** or **Publish**

### Pros:
- ✅ No code or plugin required
- ✅ Perfect for testing
- ✅ Page-specific control

### Cons:
- ❌ Not sitewide (must add to each page manually)
- ❌ Can be accidentally deleted during editing

---

## Customization Options

### Position Adjustments

**Bottom-Left Corner:**
```html
style="position: fixed; bottom: 20px; left: 20px; width: 400px; height: 600px; ..."
```

**Top-Right Corner:**
```html
style="position: fixed; top: 20px; right: 20px; width: 400px; height: 600px; ..."
```

**Centered on Page:**
```html
style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 600px; ..."
```

### Size Adjustments

**Larger Widget:**
```html
width: 500px; height: 700px;
```

**Smaller Widget (Mobile-Friendly):**
```html
width: 350px; height: 500px;
```

**Full Screen on Mobile (Advanced):**
```html
<style>
  #keka-chatbot {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    height: 600px;
    border: none;
    z-index: 9999;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  @media (max-width: 768px) {
    #keka-chatbot {
      width: 100vw;
      height: 100vh;
      bottom: 0;
      right: 0;
      border-radius: 0;
    }
  }
</style>

<iframe
  id="keka-chatbot"
  src="https://keka-chatbot-production.up.railway.app"
  title="Keka Support Chat"
  loading="lazy">
</iframe>
```

### Z-Index Conflicts

If the chatbot appears behind other elements:

1. Increase the `z-index` value:
```html
z-index: 99999;
```

2. Common WordPress theme z-index values:
   - Navigation menus: 1000-2000
   - Popups/Modals: 9000-10000
   - Admin bar: 99999

3. Set your chatbot z-index **higher** than other elements

### Shadow and Border Customization

**No Shadow:**
```html
box-shadow: none;
```

**Softer Shadow:**
```html
box-shadow: 0 4px 12px rgba(0,0,0,0.1);
```

**Border Instead of Shadow:**
```html
box-shadow: none; border: 2px solid #0066cc;
```

---

## Testing & Troubleshooting

### Testing Checklist

- [ ] Chatbot appears in the bottom-right corner
- [ ] Clicking the chat bubble opens the panel
- [ ] All 7 service category buttons are visible
- [ ] FAQ questions load and display answers
- [ ] Links in answers open in new tabs
- [ ] "Start Intake" flow works (email/phone collection)
- [ ] PHI detection works (try typing "my SSN is 123-45-6789")
- [ ] Mobile responsiveness (test on phone)
- [ ] Chatbot doesn't overlap important page content

### Common Issues

#### Issue 1: Chatbot Doesn't Appear

**Possible Causes:**
- Code not saved properly
- Caching plugin preventing update
- JavaScript conflicts

**Solutions:**
1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear WordPress cache:
   - If using WP Super Cache: **Settings > WP Super Cache > Delete Cache**
   - If using W3 Total Cache: **Performance > Dashboard > Empty All Caches**
   - If using WP Rocket: **Settings > WP Rocket > Clear Cache**
3. Disable caching temporarily to test
4. Check browser console for errors (F12 > Console tab)

#### Issue 2: Chatbot Appears Behind Other Elements

**Solution:**
Increase the `z-index` value in the iframe style:
```html
z-index: 99999;
```

#### Issue 3: Chatbot Overlaps Important Content

**Solutions:**

**Option A: Adjust Position**
```html
bottom: 80px; right: 30px;
```

**Option B: Add Padding to Your Content**
Add this CSS to your theme:
```css
body {
  padding-bottom: 650px;
}

@media (min-width: 768px) {
  body {
    padding-bottom: 0;
    padding-right: 420px;
  }
}
```

**Option C: Hide on Specific Pages**
Using Code Snippets plugin:
```php
function keka_chatbot_embed() {
    // Don't show on checkout or cart pages
    if (is_checkout() || is_cart()) {
        return;
    }
    // ... rest of code
}
```

#### Issue 4: "Connection Failed" Error

**Possible Causes:**
- Railway deployment is down
- Backend API issue
- CORS configuration problem

**Solutions:**
1. Check if production site is live: Visit `https://keka-chatbot-production.up.railway.app/api/health`
   - Should return: `{"status":"ok","timestamp":"..."}`
2. Check Railway dashboard for deployment status
3. Review backend logs for errors
4. Verify environment variables are set correctly

#### Issue 5: "frame-ancestors" CSP Error (CRITICAL)

**Error Message:**
```
Framing 'https://keka-chatbot-production.up.railway.app/' violates the following Content Security Policy directive: "frame-ancestors 'self'". The request has been blocked.
```

**What This Means:**
The chatbot's Content Security Policy (CSP) is blocking your WordPress site from embedding it in an iframe. By default, the chatbot only allows embedding on its own domain.

**Solution:**
The backend code has been updated to allow embedding on `kekarehabservices.com` by default. After deploying the updated code, the error will resolve.

**If you need to embed on a different domain:**

1. Set the `ALLOWED_EMBED_DOMAINS` environment variable in Railway:
   ```
   ALLOWED_EMBED_DOMAINS=https://yoursite.com,https://www.yoursite.com
   ```

2. Deploy the changes:
   - Go to Railway dashboard
   - Select your project
   - Go to **Variables** tab
   - Add `ALLOWED_EMBED_DOMAINS` with your domains (comma-separated)
   - Save and redeploy

3. Clear your browser cache and test again

**Note:** This fix is already included in the codebase. You just need to redeploy to Railway for it to take effect.

#### Issue 6: Slow Loading

**Solutions:**

**Option A: Add `loading="lazy"` Attribute**
```html
<iframe ... loading="lazy">
```

**Option B: Delay Loading Until Page Load**
```html
<script>
window.addEventListener('load', function() {
  var iframe = document.createElement('iframe');
  iframe.src = 'https://keka-chatbot-production.up.railway.app';
  iframe.style = 'position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);';
  iframe.title = 'Keka Support Chat';
  document.body.appendChild(iframe);
});
</script>
```

---

## Mobile Responsiveness

### Default Behavior

The iframe is fixed-size (400×600px), which works on tablets but may be too large on phones.

### Recommended Mobile Optimization

Add this code for better mobile experience:

```html
<style>
  #keka-chatbot-iframe {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    height: 600px;
    border: none;
    z-index: 9999;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  /* Mobile: Smaller widget */
  @media (max-width: 768px) {
    #keka-chatbot-iframe {
      width: 90vw;
      max-width: 350px;
      height: 500px;
      bottom: 10px;
      right: 10px;
    }
  }

  /* Small phones: Even smaller */
  @media (max-width: 480px) {
    #keka-chatbot-iframe {
      width: calc(100vw - 20px);
      height: 450px;
      bottom: 10px;
      right: 10px;
    }
  }
</style>

<iframe
  id="keka-chatbot-iframe"
  src="https://keka-chatbot-production.up.railway.app"
  title="Keka Support Chat"
  loading="lazy">
</iframe>
```

### Testing Mobile Display

**Method 1: Browser Dev Tools**
1. Press F12 to open Developer Tools
2. Click the device toggle icon (or Ctrl+Shift+M)
3. Select different device sizes (iPhone, iPad, etc.)
4. Test chatbot appearance and functionality

**Method 2: Real Device Testing**
1. Open your website on your phone
2. Verify chatbot doesn't cover critical content
3. Test all interactions (buttons, input, scrolling)

---

## Security & Privacy

### Why iframe is Secure

The iframe approach provides several security benefits:

1. **Isolation**: The chatbot runs in a separate browsing context
   - Cannot access WordPress cookies or session data
   - Cannot read or modify WordPress page content
   - Cannot execute scripts on the parent page

2. **CORS Protection**: Backend enforces Cross-Origin Resource Sharing
   - Only specified domains can make API requests
   - Prevents unauthorized data access

3. **No Direct Database Access**: WordPress database is completely isolated from the chatbot

4. **HIPAA Compliance**: The chatbot is designed with HIPAA requirements in mind
   - PHI detection prevents sensitive information submission
   - Privacy-preserving logging (hashed IPs, no raw input)
   - No long-term storage of user messages

### Content Security Policy (CSP)

If your WordPress site has strict CSP headers, you may need to allow the iframe:

Add to your `.htaccess` or security plugin:
```
Content-Security-Policy: frame-src 'self' https://keka-chatbot-production.up.railway.app;
```

Or using a plugin like "HTTP Headers" by Dimitar Ivanov:
1. Install and activate "HTTP Headers"
2. Go to **Settings > HTTP Headers**
3. Add header: `Content-Security-Policy`
4. Value: `frame-src 'self' https://keka-chatbot-production.up.railway.app`

### SSL/HTTPS Considerations

**Important**: The chatbot uses HTTPS (`https://keka-chatbot-production.up.railway.app`).

If your WordPress site uses HTTP (not HTTPS), modern browsers will block the iframe (mixed content error).

**Solution**: Ensure your WordPress site uses HTTPS. Use a plugin like "Really Simple SSL" to enable HTTPS.

---

## Performance Considerations

### Impact on Page Load Speed

**Good News**: The iframe loads independently and won't block your page rendering.

**Optimization Tips**:

1. **Use `loading="lazy"`** (already included in examples above)
   - Delays iframe load until user scrolls near it
   - Improves initial page load time

2. **Defer Loading Until User Interaction**
   - Only load chatbot when user clicks a trigger button
   - Advanced implementation (requires custom JavaScript)

3. **Monitor Performance**
   - Use Google PageSpeed Insights
   - Use GTmetrix to check impact
   - The iframe typically adds 50-100KB to page weight

### Caching Compatibility

The chatbot works with all major WordPress caching plugins:
- ✅ WP Super Cache
- ✅ W3 Total Cache
- ✅ WP Rocket
- ✅ LiteSpeed Cache
- ✅ Cloudflare

The iframe is static HTML and will be cached normally.

---

## Next Steps

1. **Choose Your Method**: Pick the embedding method that best fits your needs
2. **Add the Code**: Follow the step-by-step instructions
3. **Test Thoroughly**: Use the testing checklist above
4. **Customize** (Optional): Adjust position, size, or mobile behavior
5. **Monitor**: Check analytics for chatbot usage (weekly email reports)

## Need Help?

- **Technical Issues**: Check the [Debugging Guide](./DEBUGGING.md)
- **Customization**: See [Architecture Documentation](./ARCHITECTURE.md)
- **Security Questions**: Review [Security Guidelines](./CLAUDE.md#critical-knowledge-hipaa--security)

---

**Last Updated**: 2024-02-16
**Chatbot Version**: 1.0.0
**Production URL**: https://keka-chatbot-production.up.railway.app
