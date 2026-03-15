import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  static async sendResetPasswordEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}(auth)/reset-password?token=${token}`;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Reset your password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}">Reset my password</a>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });
  }
}
