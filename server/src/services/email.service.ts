import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendMail = (emailOptions: EmailOptions) => {
  try {
    const { to, subject, text, html } = emailOptions;

    const mailPayload: any = {
      from: process.env.EMAIL,
      subject,
      to,
    };

    if (text) mailPayload.text = text;
    if (html) mailPayload.html = html;

    transporter.sendMail(mailPayload);
  } catch (error) {
    console.log(error);
  }
};

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}
