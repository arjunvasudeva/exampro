import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Extend session interface to include requestedRole
declare module "express-session" {
  interface SessionData {
    requestedRole?: string;
  }
}

// REPLIT_DOMAINS is now optional - we'll build callback URLs dynamically per request

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Production guard: Require DATABASE_URL in production
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production for session persistence. Please configure a PostgreSQL database.");
  }
  
  // Use PostgreSQL store if DATABASE_URL is available, otherwise fallback to MemoryStore
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
    // Fallback to MemoryStore for development when DATABASE_URL is not available
    console.warn("DATABASE_URL not available, using MemoryStore for sessions");
    sessionStore = undefined; // Use default MemoryStore
  }
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
  requestedRole?: string
) {
  const userData = {
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  };

  // Set role if specifically requested (either for new users or role updates)
  if (requestedRole === 'admin' || requestedRole === 'student') {
    (userData as any).role = requestedRole;
  }

  await storage.upsertUser(userData);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    // Note: req is not available in verify function, so we'll handle role in callback
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Register a single strategy with a working callback URL
  const defaultHost = process.env.REPLIT_DOMAINS?.split(',')[0] || 
                     (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.repl.co` : 'localhost:5000');
  const strategy = new Strategy(
    {
      name: "replitauth",
      config,
      scope: "openid email profile offline_access",
      callbackURL: `https://${defaultHost}/api/callback`,
    },
    verify,
  );
  passport.use(strategy);

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Store the requested role in session for use after authentication
    const requestedRole = req.query.role as string;
    if (requestedRole === 'admin' || requestedRole === 'student') {
      req.session.requestedRole = requestedRole;
    }
    
    passport.authenticate("replitauth", {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate("replitauth", {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    }, async (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.redirect("/api/login");
      
      // Handle role assignment after successful authentication
      const requestedRole = req.session.requestedRole;
      if (requestedRole && user) {
        const claims = (user as any).claims;
        if (claims) {
          await upsertUser(claims, requestedRole);
        }
        delete req.session.requestedRole; // Clean up
      }
      
      req.logIn(user, (err) => {
        if (err) return next(err);
        res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
