import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
if (!process.env.AZURE_VOICELIVE_KEY && !process.env.AZURE_VOICELIVE_API_KEY) {
    // Try root of workspace as fallback or just log
    dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
}

const server = Fastify({
    logger: true
});

server.register(cors, {
    origin: '*' // Strict logic can be added later
});

server.register(websocket);

server.get('/', async (request, reply) => {
    return { status: 'ok', service: 'Amalia API' };
});

import { chatRoutes } from './routes/chat';
import { realtimeRoutes } from './routes/realtime';
server.register(chatRoutes);
server.register(realtimeRoutes);

const start = async () => {
    try {
        const port = 8080;
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on http://localhost:${port}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

start();
