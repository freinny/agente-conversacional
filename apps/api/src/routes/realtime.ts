import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import * as tools from '../tools';

export async function realtimeRoutes(fastify: FastifyInstance) {
    // @ts-ignore - fastify-websocket types can be tricky
    fastify.get('/api/realtime', { websocket: true }, (connection: any, req: any) => {
        fastify.log.info('Client connected to realtime proxy');

        const socket = connection.socket || connection;

        const AZURE_KEY = process.env.AZURE_VOICELIVE_API_KEY;
        const AZURE_MODEL = process.env.AZURE_VOICELIVE_MODEL;
        const AZURE_VOICE = process.env.AZURE_VOICELIVE_VOICE || 'es-MX-DaliaNeural';

        if (!AZURE_KEY) {
            fastify.log.error('Azure Realtime credentials missing. Check root .env file.');
            if (socket && typeof socket.send === 'function') {
                socket.send(JSON.stringify({ type: 'error', message: 'Credentials missing on server' }));
                socket.close?.(1011, 'Credentials missing');
            }
            return;
        }

        const cleanEndpoint = "wss://proj-speakia2-resource.cognitiveservices.azure.com";
        const wsUrl = `${cleanEndpoint}/voice-live/realtime?api-version=2025-05-01-preview&model=${AZURE_MODEL}`;

        fastify.log.info(`Summoning Lisa via VoiceLive: ${wsUrl}`);

        const azureWs = new WebSocket(wsUrl, {
            headers: {
                'api-key': AZURE_KEY
            }
        });

        const messageQueue: any[] = [];
        let isAzureOpen = false;

        azureWs.on('unexpected-response', (req, res) => {
            fastify.log.error(`Azure Handshake Failed: ${res.statusCode} ${res.statusMessage}`);
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                fastify.log.error(`Azure Error Body: ${body}`);
                socket.send(JSON.stringify({ type: 'error', message: `Azure Rejected: ${res.statusMessage}` }));
            });
        });

        azureWs.on('open', () => {
            fastify.log.info('Connected to Azure VoiceLive');
            isAzureOpen = true;

            const sessionUpdate = {
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio', 'avatar', 'animation'],
                    instructions: `Eres Amalia, una colaboradora virtual del futuro en Cinépolis. 
Responde de forma amable, profesional y concisa en español. 
Tienes acceso a herramientas para consultar productividad de GBS, aprobaciones de caja chica, conciliación bancaria y una base de conocimientos para proveedores externos (Manuales y Políticas Oficiales). 

Al presentarte, menciona que puedes ayudar con la consulta de lineamientos y manuales oficiales para proveedores.

CAPACIDAD RAG (CONSULTORA DE PROVEEDORES):
Si el usuario pregunta sobre políticas de pago, requisitos de facturación, plazos, rechazos de facturas o cualquier tema relacionado con proveedores externos, DEBES usar 'tool_supplier_rag'.
Menciona siempre que la información proviene de los lineamientos oficiales de Cinépolis.

REGLAS DE INTEGRIDAD DE DATOS (CRÍTICO):
1. **Veracidad Absoluta**: Utiliza ÚNICAMENTE los datos retornados por las herramientas (tool_output). 
2. **Prohibido Inventar**: Bajo ninguna circunstancia inventes IDs de solicitud, montos, nombres o porcentajes que no aparezcan en el resultado de la función.
3. **Manejo de Vacíos**: Si una consulta no devuelve resultados o la base de datos está vacía para ese criterio, responde honestamente: "No logré encontrar información sobre [X] en este momento".
4. **Respuesta Basada en Evidencia**: Si el usuario te pide un detalle que no está en la tabla de evidencia, no lo supongas. Di que no tienes ese detalle específico.
5. **Cruce de Datos**: Al referirte a un ID (ej. PC-0001), asegúrate de que sea exactamente el ID que aparece en la herramienta.
6. **Mapeo de Cines**: Puedes recibir nombres de ciudades (Puebla, CDMX, Monterrey, Guadalajara, Querétaro). El sistema resolverá automáticamente sus códigos (CINE-PUE, CINE-CDMX, etc.).
7. **Identidad**: El usuario actual es siempre Aminael. 
8. **Consulta de Caja Chica**: Por defecto, al consultar caja chica, muestra TODAS las solicitudes. Si el usuario pide explícitamente "las pendientes", filtra por status='PENDING_APPROVAL'. Si pide "las aprobadas", filtra por status='APPROVED'.
9. **Visualización Activa**: Tienes la capacidad de generar gráficos comparativos de barras. Cuando el usuario pida comparativas o análisis visual, menciona la gráfica en el panel.
10. **Diferenciación de Conciliación**: 
    - Usa 'tool_bank_reconciliation' para una **vista general** o para buscar anomalías/excepciones. Si el usuario pide el "histórico" o "todas las conciliaciones", llama a esta herramienta SIN el parámetro status. Si pide "excepciones", úsala con status='EXCEPTION'.
    - Usa 'tool_recon_drilldown' para un **análisis profundo, desglose, drill down, árbol de dependencias, rastreo o auditoría técnica** de una transacción específica. Actívalo con frases como "¿Cómo se concilió?", "Desglósame la transacción", "Muéstrame el árbol de [ID]" o simplemente "Drill down de [ID]".
11. **GESTIÓN DE CORREOS (NUEVO)**:
    - Cuando el usuario pida redactar, escribir o enviar un correo, usa siempre 'tool_draft_email' PRIMERO. 
    - El borrador se mostrará en el panel de evidencias para que el usuario lo revise.
    - Solo después de que el usuario confirme (diciendo "envíalo", "procede", "sí", etc.), usa 'tool_send_email'.
    - Si el usuario proporciona destinatario, asunto y cuerpo de una vez, aún así usa el borrador primero para confirmación visual.
12. **Consistencia de Datos (CRÍTICO)**: Siempre que llames a una herramienta, recibirás una respuesta narrativa Y los datos técnicos. Debes usar los datos técnicos para confirmar los hechos antes de hablar. 
12. **Manejo de Respuestas**: Si los datos técnicos (rowsPreview o treeData) están presentes, úsalos para validar la narrativa. Si los datos están presentes pero la narrativa indica que no hay, confía en los datos. No digas que la información no está disponible si ves datos en la herramienta.
13. **Identificación de IDs**: En conciliación bancaria, el ID de transacción comienza con 'BT-' y el ID de match comienza con 'M-'. Para desgloses profundos, prefiere siempre el ID 'BT-'. Si el usuario pide un drill down de 'BT-0004', asegúrate de pasar exactamente 'BT-0004'.
14. **BRAVEDAD VERBAL (CRÍTICO)**: No leas listas de montos, IDs o nombres uno por uno. Di cuántos registros encontraste y refiérete al panel visual (ej: "He encontrado 5 registros pendientes, los puedes ver detallados en el panel"). Solo lee detalles específicos si el usuario te lo pide explícitamente.`,
                    voice: {
                        name: AZURE_VOICE.split(':')[0],
                        type: 'azure-standard',
                        temperature: 0.8
                    },
                    input_audio_format: 'pcm16',
                    output_audio_format: 'pcm16',
                    input_audio_sampling_rate: 24000,
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500
                    },
                    tools: [
                        {
                            type: 'function',
                            name: 'tool_gbs_productivity',
                            description: 'Consulta el reporte de productividad de GBS, incluyendo SLA, Calidad, Rework y tasa de Automatización por subproceso.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: { type: 'string', description: 'El texto de la consulta del usuario' }
                                }
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_pettycash_approvals',
                            description: 'Consulta solicitudes de caja chica. Puede listar todas o filtrar por estado (ej: PENDING_APPROVAL, APPROVED).',
                            parameters: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string', description: 'Opcional. El estado por el cual filtrar (ej: PENDING_APPROVAL, APPROVED).' }
                                }
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_bank_reconciliation',
                            description: 'HISTORIADOR/LISTADO: Consulta conciliaciones. Soporta filtrar por status (MATCHED, EXCEPTION, PENDING) para auditoría.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string', description: 'Opcional. Filtrar por: MATCHED, EXCEPTION, PENDING. Si se omite, devuelve el histórico completo.' }
                                }
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_recon_drilldown',
                            description: 'ANÁLISIS PROFUNDO / DRILL DOWN / AUDITORÍA: Explica técnicamente cómo se concilió una transacción mostrando el Árbol de Dependencias. Úsalo para frases como "¿Cómo se concilió?", "desglose", "rastrear", "ver detalles internos" o "drilldown".',
                            parameters: {
                                type: 'object',
                                properties: {
                                    txId: { type: 'string', description: 'Opcional. ID de la transacción (ej: BT-0004). Úsalo si el usuario pide ver el "desglose" o "cómo se concilió".' }
                                }
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_approve_pettycash',
                            description: 'Aprueba una solicitud de caja chica específica usando su ID (RequestId).',
                            parameters: {
                                type: 'object',
                                properties: {
                                    requestId: { type: 'string', description: 'El ID de la solicitud a aprobar, ej: PC-0001' }
                                },
                                required: ['requestId']
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_create_pettycash',
                            description: 'Crea una nueva solicitud de caja chica.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    requesterName: { type: 'string', description: 'Nombre de quien solicita' },
                                    amount: { type: 'number', description: 'Monto en MXN' },
                                    category: { type: 'string', description: 'Categoría (Operación, Mantenimiento, Limpieza, etc.)' },
                                    notes: { type: 'string', description: 'Justificación o notas del pedido' },
                                    cineCode: { type: 'string', description: 'Código del cine, ej: CINE-021' }
                                },
                                required: ['amount', 'category']
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_update_pettycash',
                            description: 'Edita una solicitud de caja chica existente.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    requestId: { type: 'string', description: 'ID de la solicitud a editar' },
                                    amount: { type: 'number', description: 'Nuevo monto' },
                                    category: { type: 'string', description: 'Nueva categoría' },
                                    notes: { type: 'string', description: 'Nuevas notas' }
                                },
                                required: ['requestId']
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_delete_pettycash',
                            description: 'Elimina una solicitud de caja chica del sistema.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    requestId: { type: 'string', description: 'ID de la solicitud a eliminar' }
                                },
                                required: ['requestId']
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_supplier_rag',
                            description: 'Busca información en la base de conocimientos para proveedores (RAG). Úsalo para responder sobre políticas de pago, requisitos, plazos, rechazos de facturas y procesos para proveedores externos.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: { type: 'string', description: 'La pregunta o tema sobre proveedores externos' }
                                },
                                required: ['query']
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_draft_email',
                            description: 'Prepara un borrador de correo electrónico pero NO lo envía. El borrador aparecerá en el panel para confirmación del usuario.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    to: { type: 'string', description: 'Correo del destinatario' },
                                    subject: { type: 'string', description: 'Asunto del correo' },
                                    body: { type: 'string', description: 'Cuerpo del mensaje (acepta HTML básico)' }
                                },
                                required: ['to', 'subject', 'body']
                            }
                        },
                        {
                            type: 'function',
                            name: 'tool_send_email',
                            description: 'Envía el correo electrónico redactado previamente. Úsalo solo después de que el usuario confirme el borrador.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    to: { type: 'string', description: 'Opcional. Destinatario (usa el del borrador si se omite)' },
                                    subject: { type: 'string', description: 'Opcional. Asunto (usa el del borrador si se omite)' },
                                    body: { type: 'string', description: 'Opcional. Cuerpo (usa el del borrador si se omite)' }
                                }
                            }
                        }
                    ],
                    tool_choice: 'auto',
                    avatar: {
                        character: 'lisa',
                        style: 'casual-sitting',
                        customized: false,
                        video: {
                            resolution: { width: 1280, height: 720 },
                            bitrate: 2000000
                        }
                    },
                    animation: {
                        model_name: "default",
                        outputs: ["blendshapes", "viseme_id"]
                    },
                    input_audio_echo_cancellation: { type: 'server_echo_cancellation' },
                    input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' }
                }
            };
            azureWs.send(JSON.stringify(sessionUpdate));

            while (messageQueue.length > 0) {
                const msg = messageQueue.shift();
                azureWs.send(msg);
            }
        });

        azureWs.on('message', async (rawData) => {
            const data = JSON.parse(rawData.toString());

            if (data.type === 'error') {
                fastify.log.error('Azure Realtime Error: ' + JSON.stringify(data.error || data));
            }

            if (data.type === 'response.done') {
                const outputItems = data.response?.output || [];
                for (const item of outputItems) {
                    if (item.type === 'function_call') {
                        const { name, arguments: args, call_id } = item;
                        fastify.log.info(`Executing tool: ${name}`);

                        // Notify client UI that a tool is being accessed
                        console.log(`[Proxy] Sending tool_call.start for: ${name}`);
                        socket.send(JSON.stringify({ type: 'tool_call.start', tool: name }));

                        try {
                            const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
                            const toolFunc = (tools as any)[name];

                            if (toolFunc) {
                                // Await the async tool response from Dataverse MCP
                                const result = await toolFunc(parsedArgs);

                                azureWs.send(JSON.stringify({
                                    type: 'conversation.item.create',
                                    item: {
                                        type: 'function_call_output',
                                        call_id: call_id,
                                        output: JSON.stringify({
                                            narrative: result.narrativeAnswer,
                                            data: result.evidence[0]?.treeData || result.evidence[0]?.rowsPreview || "No technical data found",
                                            fullEvidence: result.evidence
                                        })
                                    }
                                }));

                                azureWs.send(JSON.stringify({
                                    type: 'response.create',
                                    response: { modalities: ['text', 'audio'] }
                                }));

                                socket.send(JSON.stringify({
                                    type: 'evidence',
                                    evidence: result.evidence
                                }));
                            }
                        } catch (err: any) {
                            fastify.log.error(`Tool execution failed: ${err.message}`);
                        }
                    }
                }
            }

            if (data.type === 'session.updated' && data.session?.avatar?.ice_servers) {
                socket.send(JSON.stringify({
                    type: 'session.ice_servers',
                    ice_servers: data.session.avatar.ice_servers
                }));
            }

            if (data.type === 'session.avatar.connecting' && data.server_sdp) {
                let sdp = data.server_sdp;
                if (!sdp.startsWith('v=0')) {
                    try {
                        const decoded = Buffer.from(sdp, 'base64').toString();
                        const payload = JSON.parse(decoded);
                        sdp = payload.sdp || sdp;
                    } catch (e) { }
                }

                socket.send(JSON.stringify({
                    type: 'session.avatar.answer',
                    sdp: sdp
                }));
                return;
            }

            if (socket.readyState === WebSocket.OPEN) {
                socket.send(rawData.toString());
            }
        });

        socket.on('message', (rawData: any) => {
            const message = JSON.parse(rawData.toString());
            let toSend: any = rawData.toString();

            if (message.type === 'session.avatar.offer') {
                const sdpWrapper = JSON.stringify({ type: 'offer', sdp: message.sdp });
                const sdpBase64 = Buffer.from(sdpWrapper).toString('base64');
                toSend = JSON.stringify({
                    type: 'session.avatar.connect',
                    client_sdp: sdpBase64,
                    rtc_configuration: { bundle_policy: 'max-bundle' }
                });
            }

            if (isAzureOpen && azureWs.readyState === WebSocket.OPEN) {
                azureWs.send(toSend);
            } else {
                messageQueue.push(toSend);
            }
        });

        azureWs.on('close', () => {
            fastify.log.info('Azure WebSocket closed');
            socket.close();
        });

        socket.on('close', () => {
            azureWs.close();
        });

        azureWs.on('error', (err) => {
            fastify.log.error('Azure WebSocket Error: ' + err.message);
        });

        socket.on('error', (err: any) => {
            fastify.log.error('Client WebSocket Error: ' + err.message);
        });
    });
}
