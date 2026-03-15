import { Account } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

import { getPrismaClient } from "@/configs";
import { ApiError } from "@/errors";

import { EmailService } from "./email-service";

export class AccountServices {
  static async singUp(userId: string, account: Account) {
    const accountExistUsername = await getPrismaClient().account.findFirst({ where: { OR: [{ username: account.username }, { email: account.email }] } });

    if (accountExistUsername) {
      const isEmailExisting = account.email === accountExistUsername.email;
      throw new ApiError((isEmailExisting ? "Email" : "Username") + "=" + (isEmailExisting ? account.email : account.username) + " is already used", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(account.password, salt);
    const parsedAccount: Account = { ...account, id: userId, password: hashedPassword };

    const createdAccount = await getPrismaClient().account.create({
      data: { ...parsedAccount },
    });
    createdAccount.password = undefined;
    return createdAccount;
  }

  static async signIn(email: string, password: string) {
    const account = await getPrismaClient().account.findFirst({ where: { email } });

    if (!account) throw new ApiError(`Account with email=${email} not found`, 404);

    const validPassword = await bcrypt.compare(password, account.password);
    if (!validPassword) throw new ApiError(`Bad password`, 400);
    const token = jwt.sign({ id: account.id, username: account.username, email: account.email }, process.env.JWT_SECRET, { expiresIn: "10h" });
    account.password = undefined;
    return { token, account: account };
  }

  static async signInWithGoogle(googleId: string, email: string, name: string) {
    let account = await getPrismaClient().account.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (!account) {
      const username = await AccountServices._generateUniqueUsername(name || email.split("@")[0]);

      account = await getPrismaClient().account.create({
        data: {
          username,
          email,
          googleId,
          provider: "google",
          password: null,
        },
      });
    } else if (!account.googleId) {
      account = await getPrismaClient().account.update({
        where: { id: account.id },
        data: { googleId, provider: "google" },
      });
    }

    const token = jwt.sign({ id: account.id, username: account.username, email: account.email }, process.env.JWT_SECRET, { expiresIn: "10h" });
    account.password = undefined;
    return { token, account };
  }

  static async getOneById(accountId: string) {
    return await getPrismaClient().account.findUnique({ where: { id: accountId } });
  }

  private static async _generateUniqueUsername(base: string): Promise<string> {
    const cleaned = base.replace(/\s+/g, "_").toLowerCase();
    let username = cleaned;
    let i = 1;
    while (await getPrismaClient().account.findUnique({ where: { username } })) {
      username = `${cleaned}_${i++}`;
    }
    return username;
  }

  static async forgotPassword(email: string) {
    const account = await getPrismaClient().account.findFirst({ where: { email } });

    if (!account) return;

    const token = require("crypto").randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h

    await getPrismaClient().account.update({
      where: { id: account.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: expiresAt,
      },
    });

    await EmailService.sendResetPasswordEmail(account.email, token);
  }

  static async resetPassword(token: string, newPassword: string) {
    const account = await getPrismaClient().account.findFirst({
      where: { resetPasswordToken: token },
    });

    if (!account) throw new ApiError("Invalid or expired token", 400);

    if (!account.resetPasswordExpiresAt || account.resetPasswordExpiresAt < new Date()) {
      throw new ApiError("Token has expired", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await getPrismaClient().account.update({
      where: { id: account.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });
  }
}
