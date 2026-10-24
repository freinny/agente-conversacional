import { FastifyInstance } from 'fastify';
import { ChatRequest, ChatResponse } from '@repo/shared';
import fs from 'fs';
import path from 'path';
import {
    tool_gbs_productivity,
    tool_pettycash_approvals,
    tool_bank_reconciliation,
    tool_draft_email,
    tool_send_email,
    tool_supplier_rag
} from '../tools';

const DRAFT_PATH = path.join(__dirname, '../../draft_email.json');

export async function chatRoutes(server: FastifyInstance) {
    server.post<{ Body: any; Reply: ChatResponse }>('/api/chat', async (request, reply) => {
        const body = request.body as any;
        const { userText, isPublic } = body;
        const lowerText = (userText || "").toLowerCase();

        // PUBLIC LAYER: Restricted to RAG only
        if (isPublic) {
            console.log('[API] 🛡️ Public restricted access triggered');
            const toolResult = await tool_supplier_rag({ query: userText });
            return reply.send({
                assistantText: toolResult.narrativeAnswer,
                evidence: toolResult.evidence,
                audio: { ttsText: toolResult.narrativeAnswer }
            });
        }

        // AUTHENTICATED LAYER: Full functionality
        let toolResult;

        if (lowerText.match(/(productividad|sla|metricas|gbs|retrabajo|calidad)/)) {
            toolResult = await tool_gbs_productivity(userText);
        }
        else if (lowerText.match(/(caja chica|solicitudes|tickets|aprobar)/)) {
            toolResult = await tool_pettycash_approvals(userText);
        }
        else if (lowerText.match(/(conciliacion|banco|diferencias|matches|leasing|deposito)/)) {
            toolResult = await tool_bank_reconciliation(userText);
        }
        else if (lowerText.match(/(redact|escrib|borrador|mail|email|correo)/) && !lowerText.match(/(envi|mand)/)) {
            // Very simple heuristic: if it mentions email but NOT sending, it's a draft
            toolResult = await tool_draft_email({ body: userText });
        }
        else if (lowerText.match(/(envi|mand)/) && lowerText.match(/(mail|email|correo|si|claro|adelante|procede)/)) {
            toolResult = await tool_send_email({});
        }
        else {
            // Fallback
            return reply.send({
                assistantText: "Solo puedo ayudarte con: Productividad GBS, Caja Chica, Conciliación Bancaria y envío de Correos. ¿En qué te ayudo?",
                evidence: []
            });
        }

        // Construct response
        // For TTS Text, we use the same narrative answer
        return reply.send({
            assistantText: toolResult.narrativeAnswer,
            evidence: toolResult.evidence,
            audio: {
                ttsText: toolResult.narrativeAnswer
            }
        });
    });

    // New Endpoint: Update Draft from UI
    server.post('/api/email/update-draft', async (request, reply) => {
        try {
            const { to, subject, body } = request.body as any;
            const draft = { to, subject, body };
            fs.writeFileSync(DRAFT_PATH, JSON.stringify(draft));
            return reply.send({ success: true });
        } catch (err) {
            console.error('Error updating draft:', err);
            return reply.status(500).send({ error: 'Failed to update draft' });
        }
    });

    // New Endpoint: Send Email from UI
    server.post('/api/email/send', async (request, reply) => {
        try {
            const args = request.body as any;
            const toolResult = await tool_send_email(args);
            return reply.send(toolResult);
        } catch (err) {
            console.error('Error sending email from UI:', err);
            return reply.status(500).send({ error: 'Failed to send email' });
        }
    });
}
