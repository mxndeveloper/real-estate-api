// server/routes/auth.js
import express from "express";
import * as auth from "../controllers/auth.js";
import { requireSignin } from "../middlewares/auth.js";

const router = express.Router();

// login register workflow
// 1. check valid email format and password
// 2. check if user already exists in database
// 3. if not, send welcome email to ensure email is valid
// 4. if valid, create user, send token and user info
// 5. if user already existed, compare password
// 6. if valid, generate the send jwt token and user info

// routes
router.get("/", auth.api);
router.post("/login", auth.login);
router.post("/forgot-password", auth.forgotPassword);
router.get("/current-user", requireSignin, auth.currentUser);
router.put("/update-password", requireSignin, auth.updatePassword);
router.put("/update-username", requireSignin, auth.updateUsername);

export default router;
