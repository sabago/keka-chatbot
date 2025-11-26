# Testing Guide for Keka Chatbot

## Prerequisites
- Node.js 18+ installed (you have 16.19.0, which may cause warnings but should work)
- npm installed

## Step-by-Step Testing Instructions

### 1. Generate the Document Index (Optional but Recommended)

```bash
npm run crawl
```

This creates `backend/data/docs.index.json` with stub content for retrieval.

### 2. Start the Backend Server

Open a terminal and run:

```bash
cd backend
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:3001
📋 Health check: http://localhost:3001/api/health
💬 Chat endpoint: http://localhost:3001/api/chat
📞 Handoff endpoint: http://localhost:3001/api/handoff/request
```

**Test the backend directly:**
```bash
# Health check
curl http://localhost:3001/api/health

# Test chat endpoint
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "start",
    "session_id": "123e4567-e89b-12d3-a456-426614174000",
    "session_data": {}
  }'
```

### 3. Start the Frontend (In a New Terminal)

```bash
cd frontend
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### 4. Open the Chatbot in Your Browser

Navigate to **http://localhost:5173**

## 🧪 Test Scenarios

### Test 1: Home Screen
- **Expected**: See 7 buttons including "✅ Start Intake / Request Care"
- **Expected**: See disclaimer at bottom

### Test 2: Start Intake Flow
1. Click **"✅ Start Intake / Request Care"**
2. **Expected**: Prompted to choose Email or Phone
3. Click **"📧 Email"**
4. **Expected**: Asked to enter email address
5. Type: `test@example.com`
6. **Expected**: Asked "Is this care request for you or a loved one?"
7. Click **"For Me"**
8. **Expected**: Asked for care setting
9. Click **"🏠 In-Home"**
10. **Expected**: Success message with confirmation

### Test 3: FAQ Navigation
1. Click **"🏥 Therapy & Rehabilitation"**
2. **Expected**: See 4 question buttons
3. Click **"What types of therapy do you provide?"**
4. **Expected**: See answer with link card and resolution check
5. Click **"Yes ✅"**
6. **Expected**: Confirmation message

### Test 4: PHI Guard
1. Type or click a message containing: `My diagnosis is diabetes`
2. **Expected**: Warning message about not sharing medical details
3. **Expected**: "Back to Home" button appears

### Test 5: All Categories
Test each of the 7 categories:
- ✅ Start Intake / Request Care
- 🏥 Therapy & Rehabilitation  
- 🩺 Home Care & Staffing
- 💼 Business & Agency Support
- 💻 Access, Insurance & Billing
- 🛠️ Equipment & Home Safety
- 🌍 Community & E-Commerce

Each should show relevant questions and answers.

### Test 6: Link Validation
- Click any link card in the responses
- **Expected**: Links should open to kekarehabservices.com URLs only
- **Expected**: Links open in new tab

### Test 7: Contact Flow from Resolution
1. Navigate to any FAQ answer
2. Click **"No — Contact me 📞"**
3. **Expected**: Prompted to choose contact method
4. Complete the intake flow

## 📊 Backend Logs

Watch the backend terminal for logs:
- All logs are in JSON format
- **No raw user input** should appear
- Only event types like `chat_message_received`, `phi_detected`, etc.
- IP addresses are hashed

## 🔍 Verify HIPAA Compliance

### Check 1: PHI Keywords Blocked
Try these messages - all should be rejected:
- "My SSN is 123-45-6789"
- "I was diagnosed with cancer"
- "My medication is metformin"
- "My date of birth is 01/01/1980"

### Check 2: URL Allow-list
Only these domains should work in link cards:
- ✅ kekarehabservices.com
- ✅ www.kekarehabservices.com
- ❌ Any other domain should be blocked

### Check 3: Response Validation
All bot responses must have:
- Text ≤ 450 characters
- ≤ 5 buttons
- ≤ 5 link cards
- Valid next_state value

### Check 4: Logging
Check `backend` terminal - logs should show:
```json
{"timestamp":"...","level":"info","event_type":"chat_message_received","session_id":"...","ip_hash":"...","message_length":5}
```
- ✅ No actual message content
- ✅ IP is hashed
- ✅ Only event metadata

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check if port 3001 is in use
lsof -i :3001
# Kill if needed
kill -9 <PID>
```

### Frontend won't start
```bash
# Check if port 5173 is in use
lsof -i :5173
# Kill if needed
kill -9 <PID>
```

### CORS errors
- Verify `.env` has correct FRONTEND_URL
- Restart backend after changing .env

### TypeScript errors
- Run `npm install` in both backend and frontend
- The warnings about Node 16 are okay for testing

## 📝 Manual API Testing with Postman/Insomnia

### Test /api/chat
```
POST http://localhost:3001/api/chat
Content-Type: application/json

{
  "message": "start",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_data": {}
}
```

### Test /api/handoff/request
```
POST http://localhost:3001/api/handoff/request
Content-Type: application/json

{
  "contact_type": "email",
  "contact_value": "test@example.com",
  "care_for": "self",
  "care_setting": "in_home",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## ✅ Success Criteria

Your implementation is working if:
1. ✅ Home screen shows all 7 buttons
2. ✅ "Start Intake" immediately asks for contact info
3. ✅ PHI keywords are rejected with safe message
4. ✅ All FAQ categories load correctly
5. ✅ Resolution checks appear after FAQ answers
6. ✅ Contact capture validates email/phone format
7. ✅ Links only open to kekarehabservices.com
8. ✅ Backend logs contain no raw user input

## 🎉 Next Steps

Once testing is complete:
1. Run the crawl script with real website content
2. Integrate HIPAA-compliant embedding service
3. Connect to production database
4. Deploy to production environment
