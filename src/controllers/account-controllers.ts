import { RequestHandler } from "express";
import { OAuth2Client } from "google-auth-library";
import { v4 } from "uuid";

import { ApiError } from "@/errors";
import { AccountServices } from "@/services";
import { AccountValidator } from "@/validator";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class AccountController {
  static readonly signIn: RequestHandler = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      AccountValidator.signIn({ email, password });
      const data = await AccountServices.signIn(email, password);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };
  static readonly signUp: RequestHandler = async (req, res, next) => {
    try {
      const account = req.body;
      AccountValidator.signUp(account);
      const createdUser = await AccountServices.singUp(v4(), account);
      res.json(createdUser);
    } catch (err) {
      next(err);
    }
  };
  static readonly signInWithGoogle: RequestHandler = async (req, res, next) => {
    try {
      const { idToken } = req.body;
      if (!idToken) throw new ApiError("idToken is required", 400);

      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) throw new ApiError("Invalid Google token", 401);

      const googleId = payload.sub;
      const email = payload.email!;
      const name = payload.name ?? "";

      const data = await AccountServices.signInWithGoogle(googleId, email, name);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };
}
