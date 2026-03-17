import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendPasswordResetEmail = async (toEmail: string, resetLink: string): Promise<void> => {
    await transporter.sendMail({
        from: process.env.SMTP_FROM ?? 'Journada <noreply@journada.app>',
        to: toEmail,
        subject: 'Reset your Journada password',
        text: `You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
        html: `
            <p>You requested a password reset for your Journada account.</p>
            <p>
                <a href="${resetLink}" style="background:#c27c3e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                    Reset Password
                </a>
            </p>
            <p>This link expires in <strong>1 hour</strong>.</p>
            <p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p>
        `,
    });
};
