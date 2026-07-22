API Documentation
Integrate secure password reset into any platform — email link or OTP, your choice.

How It Works
ResetAPI is a password-reset-as-a-service API. It handles sending emails, verifying tokens/OTPs, and hashing the new password. It does not touch your database — it returns a hashedPassword that you store in your own system.

Email Link Flow

1
Your backend calls POST /api/password-reset/request with the user's email and your projectId
2
ResetAPI sends a secure reset link to that email
3
User clicks the link and sets a new password on the ResetAPI-hosted /reset-password page
4
Configure a webhook in your dashboard to receive a reset_completed event — it will contain the email so you can fetch the hashedPassword from your audit logs via the API
5
Alternatively, use the OTP flow for a simpler setup where hashedPassword is returned directly
6
On next login: hash entered password with PBKDF2-SHA512 using your project salt and compare
OTP Flow

1
Your backend calls POST /api/password-reset/request-otp with the user's email
2
ResetAPI sends a 6-digit code (expires in 10 minutes)
3
User enters the code in your app's UI
4
Your backend calls POST /api/password-reset/verify-otp with the code + new password
5
ResetAPI returns { hashedPassword } — store it in your database
Quick Start
1
Register

Create a free account at /register.

2
Create a project

From your dashboard, create a project for each app (e.g. Nomads Club, Revors Eats). Each project gets its own API key and password salt.

3
Copy your credentials

Save your API key, Project ID, and Password Salt from the project card — the API key is shown once only.

4
Call the API from your backend

POST to /api/password-reset/request-otp or /request with the user's email and your projectId as clientId.

5
Receive hashedPassword

After the user completes the reset, you receive a hashedPassword. Store it in your DB.

6
Verify on login

Hash the entered password with PBKDF2-SHA512 using your project's salt and compare to the stored hash.

Authentication
All requests require your project API key as a Bearer token, plus your projectId passed as clientId in the request body. Each project has its own API key — scoped to that project's audit logs, rate limits, and webhooks.

Authorization: Bearer reset_your_project_api_key
Never expose your API key in frontend code. All ResetAPI calls must be made from your backend server.
API Endpoints
Request Password Reset (Email Link)
POST
/api/password-reset/request
// Request body
{
  "email": "user@yourdomain.com",
  "clientId": "proj_your_project_id"
}

// Response 200
{
  "success": true,
  "message": "Password reset email sent successfully"
}
Verify Token
POST
/api/password-reset/verify
// Request body
{
  "email": "user@yourdomain.com",
  "token": "token_from_email_link",
  "clientId": "proj_your_project_id"
}

// Response 200
{
  "success": true,
  "jwt": "eyJhbGci...",
  "email": "user@yourdomain.com"
}
Reset Password
POST
/api/password-reset/reset
// Request body
{
  "email": "user@yourdomain.com",
  "token": "jwt_from_verify",
  "password": "NewPassword@123",
  "confirmPassword": "NewPassword@123",
  "clientId": "proj_your_project_id"
}

// Response 200
{
  "success": true,
  "message": "Password reset successfully",
  "hashedPassword": "7e4af048fe16bbd30e67..."
}
OTP Flow
Use when you want an in-app code input instead of an email link redirect.

Request OTP
POST
/api/password-reset/request-otp
// Request body
{
  "email": "user@yourdomain.com",
  "clientId": "proj_your_project_id"
}

// Response 200
{
  "success": true,
  "message": "OTP sent to email"
}
Verify OTP + Reset Password
POST
/api/password-reset/verify-otp
// Request body
{
  "email": "user@yourdomain.com",
  "clientId": "proj_your_project_id",
  "otp": "257018",
  "password": "NewPassword@123",
  "confirmPassword": "NewPassword@123"
}

// Response 200
{
  "success": true,
  "message": "Password reset successfully",
  "hashedPassword": "7e4af048fe16bbd30e67..."
}
Password Hashing
The hashedPassword uses PBKDF2-HMAC-SHA512, 100,000 iterations, 64-byte output. Each project has its own unique salt shown in your dashboard — use it as RESET_API_SALT in your app.

Node.js / TypeScript

import crypto from 'crypto';

const SALT = process.env.RESET_API_SALT || 'default-salt';

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 100000, 64, 'sha512').toString('hex');
}

// On login
function verifyLogin(entered: string, storedHash: string): boolean {
  return hashPassword(entered) === storedHash;
}
Python

import hashlib, os

SALT = os.getenv('RESET_API_SALT', 'default-salt')

def hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac('sha512', password.encode(), SALT.encode(), 100000, 64).hex()

def verify_login(entered: str, stored_hash: str) -> bool:
    return hash_password(entered) == stored_hash
PHP

<?php
$SALT = getenv('RESET_API_SALT') ?: 'default-salt';

function hashPassword(string $password): string {
    global $SALT;
    return hash_pbkdf2('sha512', $password, $SALT, 100000, 128);
}

function verifyLogin(string $entered, string $stored): bool {
    return hashPassword($entered) === $stored;
}
Each project has its own salt — find it in your dashboard under the project card. Use it as RESET_API_SALT in your app. Different projects = different salts = isolated security.
Integration Guide
Full backend examples — pick your language.

Node.js (Express) — OTP Flow

import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const API_KEY   = process.env.RESET_API_KEY;
const CLIENT_ID = process.env.RESET_PROJECT_ID;
const API_BASE  = 'https://reset.chambudigital.co.ke';
const SALT      = process.env.RESET_API_SALT || 'default-salt';

const hash = (p) => crypto.pbkdf2Sync(p, SALT, 100000, 64, 'sha512').toString('hex');
const headers = { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' };

// Trigger OTP
app.post('/forgot-password', async (req, res) => {
  await fetch(API_BASE + '/api/password-reset/request-otp', {
    method: 'POST', headers,
    body: JSON.stringify({ email: req.body.email, clientId: CLIENT_ID }),
  });
  res.json({ message: 'Check your email for a 6-digit code.' });
});

// Verify OTP + store new password
app.post('/reset-password', async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;
  const r = await fetch(API_BASE + '/api/password-reset/verify-otp', {
    method: 'POST', headers,
    body: JSON.stringify({ email, clientId: CLIENT_ID, otp, password, confirmPassword }),
  });
  const data = await r.json();
  if (!data.success) return res.status(400).json({ error: data.error });

  // Save to YOUR database
  await db.users.update({ email }, { passwordHash: data.hashedPassword });
  res.json({ message: 'Password updated.' });
});

// Login verification
app.post('/login', async (req, res) => {
  const user = await db.users.findOne({ email: req.body.email });
  if (!user || hash(req.body.password) !== user.passwordHash)
    return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token: issueToken(user) });
});
Python (Flask) — Email Link Flow

from flask import Flask, request, jsonify
import requests, hashlib, os

app = Flask(__name__)
API_KEY   = os.getenv('RESET_API_KEY')
CLIENT_ID = os.getenv('RESET_PROJECT_ID')
API_BASE  = 'https://reset.chambudigital.co.ke'
SALT      = os.getenv('RESET_API_SALT', 'default-salt')
HEADERS   = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}

def hash_pw(p): return hashlib.pbkdf2_hmac('sha512', p.encode(), SALT.encode(), 100000, 64).hex()

@app.route('/forgot-password', methods=['POST'])
def forgot():
    requests.post(f'{API_BASE}/api/password-reset/request',
        headers=HEADERS, json={'email': request.json['email'], 'clientId': CLIENT_ID})
    return jsonify({'message': 'Reset link sent.'})

@app.route('/webhooks/reset', methods=['POST'])
def webhook():
    # Called by ResetAPI when reset completes
    # Fetch audit log to get hashedPassword, or handle in verify-otp flow
    return '', 200

@app.route('/login', methods=['POST'])
def login():
    user = db.users.find_one({'email': request.json['email']})
    if not user or hash_pw(request.json['password']) != user['passwordHash']:
        return jsonify({'error': 'Invalid credentials'}), 401
    return jsonify({'token': issue_token(user)})
Webhooks
Register a webhook URL in your dashboard. ResetAPI sends a signed POST to your URL on every event.

reset_requested
Email link reset triggered

reset_completed
Password reset via link

reset_failed
Token invalid or expired

otp_requested
OTP sent to email

otp_verified
OTP verified, password reset

// Webhook payload
{
  "event": "reset_completed",
  "clientId": "proj_your_project_id",
  "email": "user@yourdomain.com",
  "timestamp": "2025-06-04T10:30:00.000Z"
}

// Signature header
X-ResetAPI-Signature: sha256=abc123...
Verify signature (Node.js)

import crypto from 'crypto';

function verifyWebhook(rawBody: string, signature: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
Error Handling
All errors return JSON with an error field.

400
Bad Request — validation failed or missing fields
401
Unauthorized — missing or invalid API key
403
Forbidden — clientId mismatch
409
Conflict — email already registered
429
Too Many Requests — 5 resets/min per email
500
Internal Server Error