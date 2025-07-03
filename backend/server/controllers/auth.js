// server/controllers/auth.js
import { sendWelcomeEmail, sendPasswordResetEmail } from "../helpers/email.js";
import validator from "email-validator";
import User from "../models/user.js";
import { hashPassword, comparePassword } from "../helpers/auth.js";
import { nanoid } from "nanoid";
import jwt from "jsonwebtoken";

export const api = (req, res) => {
  res.send(`The current time is ${new Date().toLocaleDateString()}`);
};

export const login = async (req, res) => {
  // email, password
  // res.json({...req.body, message: "Login success"});
  const { email, password } = req.body;

  // If email is not valid
  if (!validator.validate(email)) {
    return res.json({ error: "A valid email is required" });
  }

  // If email field is empty
  if (!email?.trim()) {
    return res.json({ error: "Email is required" });
  }

  // If password field is empty
  if (!password?.trim()) {
    return res.json({ error: "Password is required" });
  }

  // If password field must be at least 6 characters long
  if (password?.length < 6) {
    return res.json({ error: "Password must be at least 6 characters long" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      try {
        await sendWelcomeEmail(email);
        const createdUser = await User.create({
          email,
          password: await hashPassword(password),
          username: nanoid(6),
        });

        // When creating tokens:
        const token = jwt.sign(
          { _id: createdUser._id },
          process.env.JWT_SECRET,
          {
            // ✅ use createdUser
            expiresIn: "7d",
            algorithm: "HS256",
          }
        );

        createdUser.password = undefined;

        res.json({
          token,
          user: createdUser,
        });
      } catch (err) {
        console.log(err);
        return res.json({
          error: "Invalid email. Please use a valid email address",
        });
      }
    } else {
      // compare password then login
      const match = await comparePassword(password, user.password);

      if (!match) {
        return res.json({ error: "Wrong password" });
      } else {
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        user.password = undefined;

        res.json({
          token,
          user,
        });
      }
    }
  } catch (err) {
    console.log("Login error", err);
    res.json({
      error: "Something went wrong. Try again.",
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      return res.json({
        error:
          "If we find your account, you will receive an email from us shortly",
      });
    } else {
      const password = nanoid(6);
      user.password = await hashPassword(password);
      await user.save();
      // send email
      try {
        await sendPasswordResetEmail(email, password);
        return res.json({
          message: "Please check your email",
        });
      } catch (err) {
        return res.json({
          error:
            "If we find your account, you will receive an email from us shortly",
        });
      }
    }
  } catch (err) {
    console.log(err);
  }
};

export const currentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.password = undefined;
    res.json({ user });
  } catch (error) {
    console.log("Current user error: ", error);
    res.json({
      error: "Something went wrong. Try again.",
    });
  }
};

export const updatePassword = async (req, res) => {
  try {
    let { password } = req.body;

    // trim password
    password = password ? password.trim() : "";

    // password is required if blank
    if (!password?.trim()) {
      return res.json({
        error: "Password is required",
      });
    }

    // password's length must be at least 6 characters long
    if (password.length < 6) {
      return res.json({
        error: "Password must be at least 6 characters long",
      });
    }

    const user = await User.findById(req.user._id);
    const hashedPassword = await hashPassword(password);

    // user.password = hashedPassword;
    // user.save();

    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });
    res.json({ ok: true });
  } catch (error) {
    console.log("update password error: ", error);
    res.json({ error: "Something went wrong. Try again." });
  }
};

export const updateUsername = async (req, res) => {
  try {
    const { username } = req.body;

    // Make sure username is not empty
    if (!username || !username.trim()) {
      return res.json({ error: "Username is required" });
    }

    const trimmedUsername = username.trim();

    // Check if the user name is taken by another user
    const existingUser = await User.findOne({ username: trimmedUsername });
    if (existingUser) {
      return res.json({
        error: "Username is already taken. Try anonther one.",
      });
    }

    // update the username
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        username: trimmedUsername,
      },
      { new: true }
    );

    updatedUser.password = undefined;
    res.json({ updatedUser });
  } catch (error) {
    console.log(error);
    res.json({
      error: "Username is already taken. Try another one.",
    });
  }
};
