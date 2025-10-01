# Admin Login Credentials

For demo purposes, use these credentials to login:

**Email:** admin@secureexam.com  
**Password:** admin123

---

## Important Notes

- This is a demo configuration stored in `server/admin-credentials.json`
- For production deployment, replace this with a proper database-backed authentication system
- The password is bcrypt hashed in the credentials file for security

## Authentication System

The application now uses standard **Passport.js + JWT** authentication instead of Replit Auth. This means:

✅ **Works on any platform** (Render, Heroku, AWS, etc.)  
✅ **No vendor lock-in**  
✅ **Simple email/password login**  
✅ **JWT tokens for session management**

## How to Update Admin Credentials

1. Generate a new bcrypt hash for your password:
   ```javascript
   const bcrypt = require('bcrypt');
   const password = 'your-new-password';
   const hash = await bcrypt.hash(password, 10);
   console.log(hash);
   ```

2. Update `server/admin-credentials.json` with the new hash

3. Restart the server
