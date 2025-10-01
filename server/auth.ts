import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import session from "express-session";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { Express, RequestHandler } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-jwt-key-change-in-production";
const SESSION_SECRET = process.env.SESSION_SECRET || "your-session-secret";

// Load admin credentials from file
function loadAdminCredentials() {
  try {
    const credentialsPath = join(import.meta.dirname, "admin-credentials.json");
    const data = readFileSync(credentialsPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading admin credentials:", error);
    return {};
  }
}

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        console.log('[Auth] Login attempt for email:', email);
        const credentials = loadAdminCredentials();
        const adminCreds = credentials.admin;

        if (!adminCreds || adminCreds.email !== email) {
          console.log('[Auth] Email not found or no admin credentials');
          return done(null, false, { message: "Invalid credentials" });
        }

        console.log('[Auth] Verifying password...');
        const isValidPassword = await bcrypt.compare(password, adminCreds.password);
        if (!isValidPassword) {
          console.log('[Auth] Password verification failed');
          return done(null, false, { message: "Invalid credentials" });
        }

        console.log('[Auth] Password verified, checking database for user...');
        // Get or create user in database
        let user = await storage.getUser(adminCreds.id);
        if (!user) {
          console.log('[Auth] User not found, creating new user...');
          user = await storage.upsertUser({
            id: adminCreds.id,
            email: adminCreds.email,
            firstName: adminCreds.username,
            role: adminCreds.role,
          });
          console.log('[Auth] User created successfully');
        } else {
          console.log('[Auth] User found in database');
        }

        console.log('[Auth] Login successful for user:', user.id);
        return done(null, user);
      } catch (error) {
        console.error('[Auth] ERROR during authentication:', error);
        return done(error);
      }
    }
  )
);

// Configure Passport JWT Strategy
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload: any, done: any) => {
    try {
      const user = await storage.getUser(payload.sub);
      if (user) {
        return done(null, user);
      }
      return done(null, false);
    } catch (error) {
      return done(error, false);
    }
  })
);

// Session configuration
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  let sessionStore;
  if (process.env.DATABASE_URL) {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    console.warn("DATABASE_URL not available, using MemoryStore for sessions");
    sessionStore = undefined;
  }

  return session({
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

// Generate JWT token
export function generateToken(user: any) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Auth middleware - checks JWT token
export const isAuthenticated: RequestHandler = (req: any, res, next) => {
  passport.authenticate("jwt", { session: false }, (err: any, user: any) => {
    if (err || !user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { claims: { sub: user.id }, ...user };
    next();
  })(req, res, next);
};

// Setup authentication
export async function setupAuth(app: Express) {
  app.use(getSession());
  app.use(passport.initialize());

  // Login route
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", { session: false }, (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      const token = generateToken(user);
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          role: user.role,
        },
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req: any, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Get current user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
