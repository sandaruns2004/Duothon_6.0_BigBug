# Deep Analysis: Resend OTP Button Non-Functional

> **Date**: 2026-08-06  
> **Status**: 🔴 BROKEN  
> **Component**: Next.js Client (`verify-otp/page.tsx`) & Auth Service API

## 1. Description of the Flaw
On the **Multi-Factor Verification** screen, the user is presented with a countdown timer (60s) and a "Resend Code" button. When the countdown reaches zero, the user can click this button.

However, the "Resend Code" button is completely non-functional. It only resets the visual countdown timer to 60 seconds and clears the error state, but **does not make any API call to the backend to generate or dispatch a new OTP**.

## 2. Root Cause Analysis

### Client-Side Missing Implementation
In `client/src/app/verify-otp/page.tsx` (Lines 75-78), the function bound to the "Resend Code" button is implemented as follows:
```typescript
const handleResend = () => {
  setCountdown(60);
  setError('');
};
```
As seen above, the function lacks any asynchronous API call to actually request a new OTP.

### Backend Missing Endpoint
Furthermore, the auth-service API is missing the required route to support this functionality. The current routes available in `services/auth-service/src/routes/auth.routes.js` are:
- `POST /api/auth/register`
- `POST /api/auth/login` (generates the initial OTP)
- `POST /api/auth/verify-otp`
- `POST /api/auth/refresh`

Because `POST /api/auth/login` is the only endpoint that generates an OTP, and it requires the user's plain-text password, the frontend cannot silently request a new OTP using only the `email` or `userId`.

## 3. Impact
- **Severe UX Degradation**: If an OTP expires (TTL is 5 minutes in Redis) or the email fails to deliver, the user cannot request a new one from the verification screen.
- **Deceptive UI**: The user is led to believe a new code was sent because the 60-second countdown resets, causing them to wait for an email that will never arrive.
- **Workaround Required**: The only way for a user to receive a new OTP is to manually navigate back to the `/login` page and re-enter their email and password.

## 4. Remediation Plan

To properly implement the "Resend OTP" functionality, changes must be made to both the backend and frontend.

### Step 1: Implement Backend Endpoint (`auth-service`)
Create a new endpoint `POST /api/auth/resend-otp` in `auth.controller.js`:
1. Accept `email` or `userId` in the request body.
2. Validate that the user exists.
3. Generate a new 6-digit numeric OTP using `generateNumericOtp()`.
4. Hash the OTP and store it in Redis (`aegisvault:otp:{userId}`) with a 5-minute TTL.
5. Dispatch the OTP email via the notification service's `/internal/email` endpoint.
6. Return `{ success: true, message: "OTP resent successfully" }`.

### Step 2: Update Frontend API Wrapper (`client/src/lib/api.ts`)
Add the new endpoint to the `authApi` object:
```typescript
export const authApi = {
  // ... existing methods
  resendOtp: (data: Record<string, unknown>) => api.post('/api/auth/resend-otp', data),
};
```

### Step 3: Wire up the Frontend Button (`verify-otp/page.tsx`)
Update `handleResend` to be asynchronous and call the new API:
```typescript
const handleResend = async () => {
  setError('');
  try {
    const res = await authApi.resendOtp({ email, userId });
    if (res.data?.success) {
      setCountdown(60);
      // Optional: show a success toast "New code sent"
    }
  } catch (err) {
    setError('Failed to resend OTP. Please try again.');
  }
};
```
