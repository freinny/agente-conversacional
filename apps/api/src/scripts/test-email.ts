import { emailService } from '../services/email.service';

async function main() {
    const testRecipient = 'asanchez@intelixs.com'; // Defaulting to an internal email for testing

    console.log(`🚀 Sending test email to ${testRecipient}...`);

    try {
        const result = await emailService.sendEmail(
            testRecipient,
            'Test Email from Amalia',
            '<strong>Hello!</strong> This is a test email from the Amalia integration using Resend.'
        );

        console.log('✅ Email sent successfully!');
        console.log('ID:', result?.id);
    } catch (error) {
        console.error('❌ Failed to send test email:', error);
        process.exit(1);
    }
}

main();
