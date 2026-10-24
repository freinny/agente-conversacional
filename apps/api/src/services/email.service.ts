import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

export class EmailService {
    private resend: Resend;
    private fromEmail: string;

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        this.fromEmail = process.env.FROM_EMAIL || 'noreply@intelixs.com';

        if (!apiKey) {
            throw new Error('RESEND_API_KEY is not defined in environment variables');
        }

        this.resend = new Resend(apiKey);
    }

    /**
     * Sends an email using Resend
     * @param to Recipient email address
     * @param subject Email subject
     * @param html Email body in HTML format
     */
    async sendEmail(to: string, subject: string, html: string) {
        try {
            const { data, error } = await this.resend.emails.send({
                from: `Amalia <${this.fromEmail}>`,
                to: [to],
                subject: subject,
                html: html,
            });

            if (error) {
                console.error('Error sending email:', error);
                throw error;
            }

            return data;
        } catch (err) {
            console.error('Failed to send email:', err);
            throw err;
        }
    }
}

export const emailService = new EmailService();
