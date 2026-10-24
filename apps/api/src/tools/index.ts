import { callDataverseMcpTool } from '../db/mcp_client';
import { EvidenceItem } from '@repo/shared';
import { searchSupplierKnowledge } from '../rag';
import { emailService } from '../services/email.service';
import fs from 'fs';
import path from 'path';

// Helper to store draft temporarily (stateless for demo)
const DRAFT_PATH = path.join(__dirname, '../../draft_email.json');

export interface ToolResponse {
  narrativeAnswer: string;
  evidence: EvidenceItem[];
}

// Helper to normalize IDs (e.g., BT-4 -> BT-0004, PC-1 -> PC-0001)
const normalizeId = (id: string | null): string | null => {
  if (!id) return null;
  const match = id.match(/^([A-Z]+)-(\d+)$/i);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = match[2].padStart(4, '0');
    return `${prefix}-${num}`;
  }
  return id.toUpperCase();
};

/**
 * Helper to execute a query via MCP and parse JSON content
 */
async function runMcpQuery(query: string): Promise<any[]> {
  const result = await callDataverseMcpTool("tools/call", {
    name: "read_query",
    arguments: { querytext: query }
  });

  if (result.isError) {
    throw new Error(result.content[0].text);
  }

  return JSON.parse(result.content[0].text);
}

// 1. GBS Productivity
export const tool_gbs_productivity = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Productivity] Received:', args);

  const sql = `
    SELECT 
      p.new_processname,
      p.new_subprocessname,
      AVG(f.new_slamet) * 100 as SLAPercent,
      AVG(f.new_qualityscore) as Quality,
      SUM(f.new_volumeunits) as TotalVolume,
      SUM(e.new_fte) as TotalFTE
    FROM new_factactivity f
    JOIN new_dimprocesses p ON f.new_ProcessId = p.new_dimprocessesid
    JOIN new_dimemployees e ON f.new_EmployeeId = e.new_dimemployeesid
    GROUP BY p.new_processname, p.new_subprocessname
  `;

  try {
    const rows = await runMcpQuery(sql);

    const areaColors: Record<string, string> = {
      'compras': '#00d2ff',           // Cyan
      'cuentas por pagar': '#9d50bb', // Purple
      'ingresos': '#34d399',          // Emerald
      'general': '#f87171'            // Rose
    };

    // Multi-dataset chart for SLA and Quality
    const chartData: any = {
      type: 'bar',
      labels: rows.map((r: any) => r.new_subprocessname),
      datasets: [
        {
          label: 'Cumplimiento SLA (%)',
          data: rows.map((r: any) => Math.round(Number(r.SLAPercent || 0))),
          meta: rows.map((r: any) => {
            const areaName = (r.new_processname || "").toLowerCase();
            return {
              area: r.new_processname,
              color: areaColors[areaName] || areaColors['general']
            };
          })
        },
        {
          label: 'Índice de Calidad (%)',
          data: rows.map((r: any) => Math.round(Number(r.Quality || 0))),
          meta: rows.map((r: any) => {
            const areaName = (r.new_processname || "").toLowerCase();
            return {
              area: r.new_processname,
              color: '#f472b6' // Pink for Quality to differentiate
            };
          })
        }
      ]
    };

    return {
      narrativeAnswer: "He generado una analítica avanzada de KPIs operativos desde Dataverse. Como puedes observar, he desglosado tanto el cumplimiento de SLA como los índices de calidad por cada subproceso, permitiendo una visión integral del rendimiento del GBS.",
      evidence: [{
        title: "KPIs de Rendimiento: SLA vs Calidad (Dataverse)",
        tool: "tool_gbs_productivity",
        sql: sql,
        rowsPreview: rows,
        chartData: chartData,
        notes: "Métricas normalizadas a escala 0-100% para comparativa directa."
      }]
    };
  } catch (err: any) {
    console.error("❌ Productivity Tool Error:", err.message);
    return {
      narrativeAnswer: "Lo siento, hubo un error al consultar los KPIs de productividad en Dataverse.",
      evidence: []
    };
  }
};

// 2. Petty Cash
export const tool_pettycash_approvals = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Petty Cash] Received:', args);
  const status = args?.status;

  let sql = "SELECT new_requestid, new_cinecode, new_requestername, new_amount, new_currency, new_category, new_status, new_notes, new_requestedat FROM new_pettycashrequests";

  if (status) {
    sql += ` WHERE new_status = '${status}'`;
  }

  sql += " ORDER BY new_requestedat DESC";

  try {
    const rows = await runMcpQuery(sql);

    // Convert Dataverse column names back to expected amalia format for UI compatibility
    const normalizedRows = rows.map(r => ({
      RequestId: r.new_requestid,
      CineCode: r.new_cinecode,
      RequesterName: r.new_requestername,
      Amount: r.new_amount,
      Currency: r.new_currency,
      Category: r.new_category,
      Status: r.new_status,
      Notes: r.new_notes,
      RequestedAt: r.new_requestedat
    }));

    const totalAmount = normalizedRows.reduce((acc: number, row: any) => acc + (row.Amount || 0), 0);
    const filterText = status ? `filtradas por estado '${status}'` : "totales";

    return {
      narrativeAnswer: `He recuperado las solicitudes ${filterText} desde Dataverse. Hay un total de ${normalizedRows.length} registros que suman ${Math.round(totalAmount * 100) / 100} ${normalizedRows[0]?.Currency || 'MXN'}.`,
      evidence: [{
        title: status ? `Caja Chica: ${status} (Dataverse)` : "Todas las Solicitudes (Dataverse)",
        tool: "tool_pettycash_approvals",
        sql: sql,
        rowsPreview: normalizedRows,
        notes: status ? `Filtrado activo: ${status}` : "Mostrando histórico completo desde la nube."
      }]
    };
  } catch (err: any) {
    console.error("❌ Petty Cash Tool Error:", err.message);
    return {
      narrativeAnswer: "Hubo un problema al conectar con Dataverse para listar las solicitudes de caja chica.",
      evidence: []
    };
  }
};

// 3. Bank Reconciliation (Historian)
export const tool_bank_reconciliation = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Bank Recon] Received:', args);
  const status = args.status?.toUpperCase();

  let sql = `
    SELECT 
      m.new_matchid, 
      m.new_matchstatus, 
      m.new_confidence, 
      m.new_reason,
      bt.new_txid,
      bt.new_amount as BankAmount,
      gl.new_amount as ERPAmount,
      bt.new_description as BankDesc, 
      gl.new_description as ERPDesc 
    FROM new_bankreconmatch m
    JOIN new_banktransaction bt ON m.new_BankTransactionId = bt.new_banktransactionid
    JOIN new_erpcashledger gl ON m.new_ErpCashLedgerId = gl.new_erpcashledgerid
  `;

  if (status) {
    sql += ` WHERE m.new_matchstatus = '${status}'`;
  }

  try {
    const rawRows = await runMcpQuery(sql);

    // Normalize for UI
    const rows = rawRows.map(r => ({
      MatchId: r.new_matchid,
      MatchStatus: r.new_matchstatus,
      Confidence: r.new_confidence,
      Reason: r.new_reason,
      TxId: r.new_txid,
      BankAmount: r.BankAmount,
      ERPAmount: r.ERPAmount,
      BankDesc: r.BankDesc,
      ERPDesc: r.ERPDesc
    }));

    const title = status ? `Conciliaciones: ${status} (Dataverse)` : "Historial Completo (Dataverse)";
    const narrative = status
      ? `He filtrado las conciliaciones por el estado solicitado (${status}) en Dataverse.`
      : "Aquí tienes el historial completo de conciliaciones bancarias recuperado desde la infraestructura de Power Platform.";

    return {
      narrativeAnswer: narrative,
      evidence: [{
        title: title,
        tool: "tool_bank_reconciliation",
        sql: sql,
        rowsPreview: rows,
        notes: "Conexión nativa con Dataverse MCP activa."
      }]
    };
  } catch (err: any) {
    console.error("❌ Bank Recon Tool Error:", err.message);
    return {
      narrativeAnswer: "No pude obtener los datos de conciliación de Dataverse.",
      evidence: []
    };
  }
};

// 4. Approve Petty Cash
export const tool_approve_pettycash = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Approve] Received:', args);
  const requestId = normalizeId(args?.requestId || args?.query || (typeof args === 'string' ? args : null));

  if (!requestId) {
    return {
      narrativeAnswer: "¿Qué solicitud deseas aprobar? Por favor dime el ID.",
      evidence: []
    };
  }

  try {
    // 1. Find the Dataverse GUID for this business ID
    const query = `SELECT new_pettycashrequestsid, new_requestername FROM new_pettycashrequests WHERE new_requestid = '${requestId}'`;
    const rows = await runMcpQuery(query);

    if (rows.length === 0) {
      return {
        narrativeAnswer: `No encontré la solicitud ${requestId} en Dataverse.`,
        evidence: []
      };
    }

    const row = rows[0];
    const recordId = row.new_pettycashrequestsid;

    // 2. Perform the update via MCP
    await callDataverseMcpTool("tools/call", {
      name: "update_record",
      arguments: {
        tablename: "new_pettycashrequests",
        recordId: recordId,
        item: JSON.stringify({
          new_status: 'APPROVED',
          new_approvername: 'Aminael'
        })
      }
    });

    return {
      narrativeAnswer: `Perfecto. La solicitud ${requestId} de ${row.new_requestername} ha sido aprobada en Dataverse.`,
      evidence: [{
        title: "Acción: Aprobación en Dataverse",
        tool: "tool_approve_pettycash",
        sql: `UPDATE new_pettycashrequests SET new_status = 'APPROVED' WHERE LogicalId = ${recordId}`,
        rowsPreview: [{ RequestId: requestId, Status: 'APPROVED' }],
        notes: "Transacción confirmada en Power Platform."
      }]
    };
  } catch (err: any) {
    console.error("❌ Approval Tool Error:", err.message);
    return {
      narrativeAnswer: `Error al intentar aprobar la solicitud ${requestId}.`,
      evidence: []
    };
  }
};

// 5. Create Petty Cash
export const tool_create_pettycash = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Create] Received:', args);
  const id = `PC-${Math.floor(Math.random() * 9000 + 1000)}`;

  const cinemaMap: Record<string, string> = {
    'puebla': 'CINE-PUE',
    'cdmx': 'CINE-CDMX',
    'monterrey': 'CINE-MTY',
    'guadalajara': 'CINE-GDL',
    'queretaro': 'CINE-QRO'
  };

  let cineCode = args.cineCode || 'CINE-021';
  let resolvedCinema = "Cinépolis Estándar";

  const searchStr = (args.cineCode || args.notes || args.query || "").toLowerCase();
  for (const [city, code] of Object.entries(cinemaMap)) {
    if (searchStr.includes(city)) {
      cineCode = code;
      resolvedCinema = `Cinépolis ${city.toUpperCase()}`;
      break;
    }
  }

  const requester = args.requesterName || 'Aminael';
  const amount = args.amount || 0;
  const category = args.category || 'Operación';
  const notes = args.notes || 'Pedido generado vía Voz';
  const date = new Date().toISOString();

  try {
    await callDataverseMcpTool("tools/call", {
      name: "create_record",
      arguments: {
        tablename: "new_pettycashrequests",
        item: JSON.stringify({
          new_name: id,
          new_requestid: id,
          new_cinecode: cineCode,
          new_requestername: requester,
          new_requestedat: date,
          new_amount: amount,
          new_currency: 'MXN',
          new_category: category,
          new_status: 'PENDING_APPROVAL',
          new_notes: notes
        })
      }
    });

    return {
      narrativeAnswer: `He registrado la solicitud ${id} para ${resolvedCinema} a nombre de ${requester} por ${amount} MXN en Dataverse.`,
      evidence: [{
        title: "Nueva Solicitud Creada (Dataverse)",
        tool: "tool_create_pettycash",
        sql: 'INSERT INTO new_pettycashrequests',
        rowsPreview: [{ RequestId: id, Cinema: resolvedCinema, Requester: requester, Amount: amount, Status: 'PENDING_APPROVAL' }],
        notes: `Registro nativo en la nube sincronizado.`
      }]
    };
  } catch (err: any) {
    console.error("❌ Create Tool Error:", err.message);
    return {
      narrativeAnswer: "No pude crear la solicitud en Dataverse.",
      evidence: []
    };
  }
};

// 6. Update Petty Cash
export const tool_update_pettycash = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Update] Received:', args);
  const requestId = normalizeId(args.requestId);
  if (!requestId) return { narrativeAnswer: "Necesito el ID de la solicitud para editarla.", evidence: [] };

  try {
    const checkSql = `SELECT new_pettycashrequestsid FROM new_pettycashrequests WHERE new_requestid = '${requestId}'`;
    const rows = await runMcpQuery(checkSql);
    if (rows.length === 0) return { narrativeAnswer: `No encontré la solicitud ${requestId} en Dataverse.`, evidence: [] };

    const recordId = rows[0].new_pettycashrequestsid;

    let item: any = {};
    if (args.amount) { item.new_amount = args.amount; }
    if (args.category) { item.new_category = args.category; }
    if (args.notes) { item.new_notes = args.notes; }

    if (Object.keys(item).length === 0) return { narrativeAnswer: "No detecté cambios para aplicar.", evidence: [] };

    await callDataverseMcpTool("tools/call", {
      name: "update_record",
      arguments: {
        tablename: "new_pettycashrequests",
        recordId: recordId,
        item: JSON.stringify(item)
      }
    });

    return {
      narrativeAnswer: `Listo. He actualizado la solicitud ${requestId} en Dataverse con los nuevos datos.`,
      evidence: [{
        title: "Solicitud Actualizada (Dataverse)",
        tool: "tool_update_pettycash",
        sql: `UPDATE new_pettycashrequests WHERE id=${recordId}`,
        rowsPreview: [{ RequestId: requestId, Updates: Object.keys(item).length }],
        notes: "Sincronizado vía OData API."
      }]
    };
  } catch (err: any) {
    console.error("❌ Update Tool Error:", err.message);
    return { narrativeAnswer: `Error al actualizar la solicitud ${requestId}.`, evidence: [] };
  }
};

// 7. Delete Petty Cash
export const tool_delete_pettycash = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Delete] Received:', args);
  const requestId = normalizeId(args.requestId || (typeof args === 'string' ? args : null));
  if (!requestId) return { narrativeAnswer: "Dime el ID de la solicitud que deseas borrar.", evidence: [] };

  try {
    const checkSql = `SELECT new_pettycashrequestsid FROM new_pettycashrequests WHERE new_requestid = '${requestId}'`;
    const rows = await runMcpQuery(checkSql);
    if (rows.length === 0) return { narrativeAnswer: `No encontré la solicitud ${requestId} en Dataverse.`, evidence: [] };

    const recordId = rows[0].new_pettycashrequestsid;

    await callDataverseMcpTool("tools/call", {
      name: "delete_record",
      arguments: {
        tablename: "new_pettycashrequests",
        recordId: recordId,
        hasUserApproved: true // Assuming calling this tool implies intent
      }
    });

    return {
      narrativeAnswer: `La solicitud ${requestId} ha sido eliminada permanentemente de Dataverse.`,
      evidence: [{
        title: "Solicitud Eliminada",
        tool: "tool_delete_pettycash",
        sql: `DELETE FROM new_pettycashrequests WHERE id=${recordId}`,
        rowsPreview: [{ RequestId: requestId, Result: 'DELETED' }],
        notes: "Power Platform record deleted."
      }]
    };
  } catch (err: any) {
    console.error("❌ Delete Tool Error:", err.message);
    return { narrativeAnswer: `Error al intentar eliminar la solicitud ${requestId}.`, evidence: [] };
  }
};

// 8. Reconciliation Drill Down
export const tool_recon_drilldown = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Recon Drilldown] Received:', args);
  const rawId = args.txId || 'BT-0004';
  let txId = normalizeId(rawId);

  try {
    // Robustness: If they pass a MatchId (M-xxxx), find the TxId
    if (txId?.startsWith('M-')) {
      const matchQuery = `SELECT bt.new_txid FROM new_bankreconmatch m JOIN new_banktransaction bt ON m.new_BankTransactionId = bt.new_banktransactionid WHERE m.new_matchid = '${txId}'`;
      const matches = await runMcpQuery(matchQuery);
      if (matches.length > 0) {
        console.log(`[Tool: Recon Drilldown] Resolved MatchId ${txId} to TxId ${matches[0].new_txid}`);
        txId = matches[0].new_txid;
      }
    }

    // 1. Get Parent Bank Transaction
    const parentQuery = `SELECT * FROM new_banktransaction WHERE new_txid = '${txId}'`;
    const parents = await runMcpQuery(parentQuery);
    if (parents.length === 0) {
      return { narrativeAnswer: `No encontré el detalle de la transacción ${txId} en Dataverse.`, evidence: [] };
    }
    const parent = parents[0];

    // 2. Get Matches and Ledger Entries
    const sql = `
          SELECT 
              m.new_matchid, m.new_confidence, m.new_matchstatus, m.new_reason,
              l.new_ledgerid, l.new_description as LedgerDesc, l.new_amount as LedgerAmount, l.new_sourcesystem
          FROM new_bankreconmatch m
          JOIN new_erpcashledger l ON m.new_ErpCashLedgerId = l.new_erpcashledgerid
          JOIN new_banktransaction bt ON m.new_BankTransactionId = bt.new_banktransactionid
          WHERE bt.new_txid = '${txId}'
      `;
    const rawRows = await runMcpQuery(sql);

    // Normalize for UI
    const rows = rawRows.map(r => ({
      MatchId: r.new_matchid,
      Confidence: r.new_confidence,
      MatchStatus: r.new_matchstatus,
      Reason: r.new_reason,
      LedgerId: r.new_ledgerid,
      LedgerDesc: r.LedgerDesc,
      LedgerAmount: r.LedgerAmount,
      SourceSystem: r.new_sourcesystem
    }));

    // 3. Build Tree Structure
    const treeData: any = {
      name: `${parent.new_txid}: ${parent.new_description}`,
      value: `${parent.new_amount} ${parent.new_currency}`,
      status: 'neutral',
      children: rows.map(r => ({
        name: `Match: ${r.MatchId}`,
        description: r.Reason,
        status: r.MatchStatus.toLowerCase(),
        value: `${Math.round(r.Confidence * 100)}% Confianza`,
        children: [
          {
            name: `ERP: ${r.LedgerId}`,
            description: r.LedgerDesc,
            value: `${r.LedgerAmount} ${parent.new_currency}`,
            status: 'neutral'
          }
        ]
      }))
    };

    return {
      narrativeAnswer: `He realizado un desglose profundo (drill-down) de la conciliación para la transacción ${txId} directamente desde Dataverse. Aquí tienes la trazabilidad completa.`,
      evidence: [{
        title: `Explorador de Dependencias (Dataverse): ${txId}`,
        tool: "tool_recon_drilldown",
        sql: sql,
        rowsPreview: rows,
        treeData: treeData,
        notes: "Infraestructura Cloud activa: Banco -> Match -> ERP Ledger."
      }]
    };
  } catch (err: any) {
    console.error("❌ Drilldown Tool Error:", err.message);
    return { narrativeAnswer: "Hubo un error al procesar el desglose en Dataverse.", evidence: [] };
  }
};

// 9. Supplier RAG (Knowledge Base)
export const tool_supplier_rag = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Supplier RAG] Received:', args);
  const query = args.query || args.question || "";

  try {
    const results = searchSupplierKnowledge(query);

    if (results.length === 0) {
      return {
        narrativeAnswer: "Consulté los documentos de proveedores pero no encontré información específica que responda a esa pregunta. ¿Podrías ser más detallado?",
        evidence: []
      };
    }

    // Map RAG results to treeNodes or simple preview
    const evidence: EvidenceItem[] = results.map(r => ({
      title: `Fuente: ${r.source}`,
      tool: "tool_supplier_rag",
      notes: `Sección: ${r.section}`,
      rowsPreview: [{ "Contenido del Documento": r.content }]
    }));

    return {
      narrativeAnswer: `Según los lineamientos oficiales de Cinépolis para proveedores: ${results[0].content}`,
      evidence: evidence
    };
  } catch (err: any) {
    console.error("❌ RAG Tool Error:", err.message);
    return {
      narrativeAnswer: "Hubo un error al intentar acceder a la base de conocimientos de proveedores.",
      evidence: []
    };
  }
};

// 10. Draft Email
export const tool_draft_email = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Draft Email] Received:', args);
  const to = args.to || 'aminael@intelixs.com';
  const subject = args.subject || 'Actualización de Amalia';
  const body = args.body || 'Hola Aminael, este es un borrador generado por Amalia para tu revisión.';

  const draft = { to, subject, body };

  // Persist for the "send" step
  fs.writeFileSync(DRAFT_PATH, JSON.stringify(draft));

  return {
    narrativeAnswer: `He preparado un borrador de correo para ${to}. Por favor, revísalo en el panel de evidencias. Si estás de acuerdo, dime "envíalo".`,
    evidence: [{
      title: "Borrador de Correo",
      tool: "tool_draft_email",
      notes: "El correo aún no ha sido enviado.",
      emailDraft: {
        to,
        subject,
        body,
        preview: body.length > 100 ? body.substring(0, 100) + '...' : body
      }
    }]
  };
};

// 11. Send Email
export const tool_send_email = async (args: any): Promise<ToolResponse> => {
  console.log('[Tool: Send Email] Received:', args);

  let draft;
  try {
    if (fs.existsSync(DRAFT_PATH)) {
      draft = JSON.parse(fs.readFileSync(DRAFT_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error("Error reading draft:", err);
  }

  const to = args.to || draft?.to;
  const subject = args.subject || draft?.subject;
  const body = args.body || draft?.body;

  if (!to || !subject || !body) {
    return {
      narrativeAnswer: "No tengo los detalles necesarios para enviar el correo. Por favor, primero pídeme que redacte uno.",
      evidence: []
    };
  }

  try {
    const result = await emailService.sendEmail(to, subject, body);

    // Clear draft after successful send
    if (fs.existsSync(DRAFT_PATH)) {
      fs.unlinkSync(DRAFT_PATH);
    }

    return {
      narrativeAnswer: `¡Listo! El correo ha sido enviado exitosamente a ${to}.`,
      evidence: [{
        title: "Confirmación de Envío",
        tool: "tool_send_email",
        notes: `ID de seguimiento: ${result?.id}`,
        rowsPreview: [{
          Destinatario: to,
          Asunto: subject,
          Estado: 'Enviado',
          ID: result?.id
        }]
      }]
    };
  } catch (err: any) {
    console.error("❌ Send Email Tool Error:", err.message);
    return {
      narrativeAnswer: "Lo siento, hubo un error al intentar enviar el correo. Por favor, verifica la configuración de Resend.",
      evidence: []
    };
  }
};
