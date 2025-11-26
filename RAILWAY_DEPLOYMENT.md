# Railway Deployment Guide

This guide walks you through deploying the Keka Chatbot to Railway with PostgreSQL database.

## Prerequisites

- Railway account (sign up at https://railway.app/)
- GitHub repository with your code pushed
- Credit card for Railway (free trial available)

## Architecture

**Single Service Deployment:**
- Backend serves both API endpoints and frontend static files
- PostgreSQL database for persistent handoff storage
- Automatic HTTPS with Railway domain
- Single domain, no CORS issues

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to https://railway.app/
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select your repository: `keka/chatbot`

### 2. Add PostgreSQL Database

1. In your Railway project dashboard, click **"New"**
2. Select **"Database"**
3. Choose **"PostgreSQL"**
4. Railway will automatically:
   - Create the database
   - Generate a `DATABASE_URL` environment variable
   - Link it to your service

### 3. Configure Environment Variables

In your Railway project, go to **Variables** tab and add:

#### Required Variables

```bash
NODE_ENV=production
LOG_LEVEL=warn
HASH_SALT=<generate-32-character-random-string>
```

**Generate HASH_SALT:**
```bash
# On Mac/Linux:
openssl rand -hex 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Optional Variables (Email/SMS Notifications)

If you want to enable email notifications via AWS SES:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
SES_FROM_EMAIL=noreply@kekarehabservices.com
HANDOFF_EMAIL=admin@kekarehabservices.com
```

If you want to enable SMS notifications via AWS SNS:

```bash
HANDOFF_PHONE=+1234567890
```

**Note:** Railway automatically sets:
- `PORT` - Auto-assigned by Railway
- `DATABASE_URL` - Set by PostgreSQL plugin

### 4. Deploy

Railway will automatically deploy when you push to your GitHub repository.

**Manual Deploy:**
1. Go to your service in Railway dashboard
2. Click **"Deploy"** ’ **"Deploy Now"**

**Build Process:**
The `railway.json` file configures:
- Build command: `npm install && npm run build -w backend`
- Start command: `npm start -w backend`

### 5. Monitor Deployment

1. Click on your service in Railway dashboard
2. Go to **"Deployments"** tab
3. Watch the build logs

**Expected logs:**
```
=€ Server running on http://localhost:<port>
=Ë Health check: http://localhost:<port>/api/health
=¬ Chat endpoint: http://localhost:<port>/api/chat
=Þ Handoff endpoint: http://localhost:<port>/api/handoff/request
 Database initialized
```

### 6. Get Your Deployment URL

1. Go to **"Settings"** tab in your service
2. Under **"Domains"**, you'll see your Railway domain
3. Example: `https://keka-chatbot-production.up.railway.app`

**Test your deployment:**
```bash
# Health check
curl https://your-app.railway.app/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Embedding in WordPress

Once deployed, you have several options to embed the chatbot in WordPress:

### Option A: iframe Embed (Easiest)

Add this HTML to a WordPress page or widget:

```html
<iframe
  src="https://your-app.railway.app"
  style="position: fixed; bottom: 20px; right: 20px; width: 400px; height: 600px; border: none; z-index: 9999; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
  title="Keka Support Chat">
</iframe>
```

**Advantages:**
- Simple to implement
- No code changes needed
- Easy to update

**Disadvantages:**
- Fixed size
- Cannot access parent page context

### Option B: Popup Button

Add this to WordPress:

```html
<button
  onclick="window.open('https://your-app.railway.app', 'KekaChatbot', 'width=400,height=600,popup=yes')"
  style="position: fixed; bottom: 20px; right: 20px; background: #0066cc; color: white; border: none; padding: 15px 20px; border-radius: 50px; cursor: pointer; font-size: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); z-index: 9999;">
  =¬ Chat with Keka
</button>
```

**Advantages:**
- Full functionality
- No iframe limitations
- Professional appearance

**Disadvantages:**
- Popup blockers may interfere
- Opens in separate window

### Option C: Custom Domain (Optional)

To use your own domain instead of Railway's:

1. In Railway dashboard, go to **Settings** ’ **Domains**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `chat.kekarehabservices.com`)
4. Add the CNAME record to your DNS provider:
   - Name: `chat` (or your subdomain)
   - Value: Your Railway domain
   - TTL: 3600
5. Wait for DNS propagation (5-30 minutes)

## Database Management

### Access Database

1. In Railway project, click on **PostgreSQL** service
2. Go to **"Data"** tab to view tables
3. Or connect via `psql`:

```bash
# Get DATABASE_URL from Railway Variables tab
psql "postgresql://user:password@host:port/database"
```

### Query Handoffs

```sql
-- View all handoff requests
SELECT * FROM handoffs ORDER BY created_at DESC LIMIT 10;

-- Count by contact type
SELECT contact_type, COUNT(*) FROM handoffs GROUP BY contact_type;

-- View recent requests
SELECT id, contact_name, contact_type, contact_value, created_at
FROM handoffs
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Backup Database

Railway provides automatic backups. To export manually:

```bash
# Export to SQL file
pg_dump "$DATABASE_URL" > backup.sql

# Restore from backup
psql "$DATABASE_URL" < backup.sql
```

## Monitoring & Logs

### View Logs

1. Go to your service in Railway dashboard
2. Click **"Logs"** tab
3. Filter by log level or search terms

**Key log events to monitor:**
- `server_started` - Server initialized
- `database_initialization_complete` - Database ready
- `handoff_request_created` - New contact request
- `handoff_saved_to_database` - Request saved successfully
- `phi_detected` - PHI keyword detected (security alert)

### Metrics

Railway provides built-in metrics:
- CPU usage
- Memory usage
- Network traffic
- Request count

Access these in the **"Metrics"** tab.

## Troubleshooting

### Database Connection Fails

**Error:** `DATABASE_URL is required for database connection`

**Solution:**
1. Verify PostgreSQL service is running
2. Check that `DATABASE_URL` variable exists in **Variables** tab
3. Redeploy the service

### Build Fails

**Error:** `npm ERR! code ELIFECYCLE`

**Solution:**
1. Check build logs in Railway dashboard
2. Verify `package.json` scripts are correct
3. Try building locally: `npm run build -w backend`

### Frontend Not Loading

**Error:** 404 or blank page

**Solution:**
1. Verify `NODE_ENV=production` is set
2. Check that build copied frontend to `backend/dist/public/`
3. View server logs for static file serving errors

### Database Not Initializing

**Warning:** `  DATABASE_URL not set - using file storage fallback`

**Solution:**
1. Ensure PostgreSQL service is linked to your app
2. Restart the deployment
3. Check logs for `database_initialization_started`

## Cost Estimate

**Railway Hobby Plan:**
- Starter: $5/month (500 hours)
- Pro: $20/month (unlimited hours)

**PostgreSQL Database:**
- Free tier: 512MB storage
- Paid: $5/month for 1GB

**Expected Total:**
- Development/Testing: ~$5-10/month
- Production: ~$15-25/month

## Security Checklist

Before going live, verify:

- [ ] `NODE_ENV=production` is set
- [ ] `HASH_SALT` is random and secure (32+ characters)
- [ ] Database uses SSL (automatic on Railway)
- [ ] HTTPS is enabled (automatic on Railway)
- [ ] Email/SMS credentials are secure
- [ ] PHI detection is working (test with keywords)
- [ ] Rate limiting is active
- [ ] Logs don't contain PII

## Next Steps After Deployment

1. **Test the chatbot:**
   - Visit your Railway URL
   - Test all conversation flows
   - Submit a handoff request
   - Verify database stores data

2. **Configure custom domain** (optional):
   - Set up DNS records
   - Update WordPress embed code

3. **Set up monitoring:**
   - Configure Railway alerts
   - Monitor log events
   - Check database usage

4. **Enable notifications:**
   - Configure AWS SES/SNS
   - Test email/SMS delivery
   - Verify handoff team receives alerts

5. **WordPress integration:**
   - Add iframe or button to pages
   - Test from WordPress site
   - Adjust styling as needed

## Support Resources

- **Railway Docs:** https://docs.railway.app/
- **Railway Discord:** https://discord.gg/railway
- **Project Issues:** https://github.com/keka/chatbot/issues

## Deployment Checklist

- [ ] Push code to GitHub
- [ ] Create Railway project
- [ ] Add PostgreSQL database
- [ ] Configure environment variables
- [ ] Deploy service
- [ ] Verify database initialized
- [ ] Test health endpoint
- [ ] Test chatbot functionality
- [ ] Test handoff submission
- [ ] Query database for handoff record
- [ ] Configure custom domain (optional)
- [ ] Embed in WordPress
- [ ] Test from WordPress
- [ ] Set up monitoring alerts
- [ ] Configure notification services

---

**<‰ Congratulations!** Your Keka Chatbot is now deployed to production.
