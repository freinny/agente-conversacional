import { db } from './db';

const schemaAndSeed = `
-- GBS: Sitios
CREATE TABLE IF NOT EXISTS dim_sites (
  SiteKey INTEGER PRIMARY KEY,
  SiteName TEXT NOT NULL,
  Country TEXT NOT NULL
);

-- GBS: Empleados
CREATE TABLE IF NOT EXISTS dim_employees (
  EmployeeKey INTEGER PRIMARY KEY,
  EmployeeId TEXT NOT NULL,
  EmployeeName TEXT NOT NULL,
  Role TEXT NOT NULL,
  Team TEXT NOT NULL,
  SiteKey INTEGER NOT NULL,
  FTE REAL NOT NULL,
  FOREIGN KEY (SiteKey) REFERENCES dim_sites(SiteKey)
);

-- GBS: Procesos
CREATE TABLE IF NOT EXISTS dim_processes (
  ProcessKey INTEGER PRIMARY KEY,
  ProcessName TEXT NOT NULL,
  SubprocessName TEXT NOT NULL
);

-- GBS: Actividades (hechos)
CREATE TABLE IF NOT EXISTS fact_activity (
  ActivityId TEXT PRIMARY KEY,
  ActivityDate TEXT NOT NULL,          -- YYYY-MM-DD
  EmployeeKey INTEGER NOT NULL,
  ProcessKey INTEGER NOT NULL,
  HandleTimeMin REAL NOT NULL,
  QueueTimeMin REAL NOT NULL,
  CycleTimeMin REAL NOT NULL,
  SLATargetMin REAL NOT NULL,
  SLAMet INTEGER NOT NULL,             -- 0/1
  ReworkFlag INTEGER NOT NULL,          -- 0/1
  ErrorFlag INTEGER NOT NULL,           -- 0/1
  QualityScore REAL NOT NULL,
  VolumeUnits INTEGER NOT NULL,
  AutomationAssisted INTEGER NOT NULL,  -- 0/1
  FOREIGN KEY (EmployeeKey) REFERENCES dim_employees(EmployeeKey),
  FOREIGN KEY (ProcessKey) REFERENCES dim_processes(ProcessKey)
);

CREATE INDEX IF NOT EXISTS idx_fact_activity_date ON fact_activity(ActivityDate);
CREATE INDEX IF NOT EXISTS idx_fact_activity_process ON fact_activity(ProcessKey);
CREATE INDEX IF NOT EXISTS idx_fact_activity_employee ON fact_activity(EmployeeKey);

-- Seed demo (GBS)
INSERT OR IGNORE INTO dim_sites (SiteKey, SiteName, Country) VALUES
(1,'CDMX - Corporativo','MX'),
(2,'Guadalajara - SSC','MX'),
(3,'Monterrey - SSC','MX');

INSERT OR IGNORE INTO dim_employees (EmployeeKey, EmployeeId, EmployeeName, Role, Team, SiteKey, FTE) VALUES
(1,'E0001','Ana García','Analista','AP',2,1.0),
(2,'E0002','Luis Hernández','Analista Sr','AP',2,1.0),
(3,'E0003','Sofía Martínez','Analista','Revenue',3,0.5),
(4,'E0004','Diego López','Coordinador','Procurement',1,1.0);

INSERT OR IGNORE INTO dim_processes (ProcessKey, ProcessName, SubprocessName) VALUES
(10,'Cuentas por Pagar','Registro de facturas'),
(11,'Cuentas por Pagar','Conciliación y aclaraciones'),
(20,'Compras','Validación de requisiciones'),
(41,'Ingresos','Conciliación de depósitos');

-- actividades (muestra pequeña; en seed real pon 200-2000 filas)
INSERT OR IGNORE INTO fact_activity VALUES
('A1001','2025-12-01',1,10,18,12,30,60,1,0,0,97,5,0),
('A1002','2025-12-01',2,10,14,10,24,60,1,0,0,98,6,1),
('A1003','2025-12-02',1,11,28,40,68,240,1,1,0,90,2,0),
('A1004','2025-12-02',3,41,22,90,112,480,1,0,0,95,3,0),
('A1005','2025-12-03',4,20,35,15,50,120,0,1,1,82,1,0);


-- 2.2 Caja chica (pedidos por aprobar)

CREATE TABLE IF NOT EXISTS pettycash_requests (
  RequestId TEXT PRIMARY KEY,
  CineCode TEXT NOT NULL,
  RequesterName TEXT NOT NULL,
  RequestedAt TEXT NOT NULL,     -- ISO datetime
  Amount REAL NOT NULL,
  Currency TEXT NOT NULL,
  Category TEXT NOT NULL,
  Status TEXT NOT NULL,          -- PENDING_APPROVAL | APPROVED | REJECTED | PAID
  ApproverName TEXT,
  Notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pettycash_status ON pettycash_requests(Status);
CREATE INDEX IF NOT EXISTS idx_pettycash_cine ON pettycash_requests(CineCode);

-- Seed demo (Caja chica)
INSERT OR IGNORE INTO pettycash_requests VALUES
('PC-0001','CINE-021','María Rojas','2025-12-10T09:12:00',120.50,'MXN','Mantenimiento','PENDING_APPROVAL',NULL,'Cambio de focos'),
('PC-0002','CINE-105','Jorge Pérez','2025-12-11T14:40:00',560.00,'MXN','Operación','PENDING_APPROVAL',NULL,'Compra insumos urgentes'),
('PC-0003','CINE-033','Laura Cruz','2025-12-05T10:01:00',80.00,'MXN','Limpieza','APPROVED','Aminael','Aprobado para compra'),
('PC-0004','CINE-021','Iván Torres','2025-12-01T08:33:00',950.00,'MXN','Seguridad','REJECTED','Aminael','Monto excede política');

-- 2.3 Conciliación bancaria
CREATE TABLE IF NOT EXISTS bank_transactions (
  TxId TEXT PRIMARY KEY,
  BankAccount TEXT NOT NULL,
  TxDate TEXT NOT NULL,          -- YYYY-MM-DD
  Description TEXT NOT NULL,
  Amount REAL NOT NULL,
  Currency TEXT NOT NULL,
  Direction TEXT NOT NULL        -- IN | OUT
);

CREATE TABLE IF NOT EXISTS erp_cash_ledger (
  LedgerId TEXT PRIMARY KEY,
  SourceSystem TEXT NOT NULL,    -- e.g., PeopleSoft
  DocRef TEXT NOT NULL,
  PostingDate TEXT NOT NULL,     -- YYYY-MM-DD
  Description TEXT NOT NULL,
  Amount REAL NOT NULL,
  Currency TEXT NOT NULL,
  Direction TEXT NOT NULL        -- IN | OUT
);

CREATE TABLE IF NOT EXISTS bank_recon_matches (
  MatchId TEXT PRIMARY KEY,
  TxId TEXT NOT NULL,
  LedgerId TEXT NOT NULL,
  MatchStatus TEXT NOT NULL,     -- MATCHED | PENDING | EXCEPTION
  Confidence REAL NOT NULL,      -- 0..1
  Reason TEXT,
  FOREIGN KEY (TxId) REFERENCES bank_transactions(TxId),
  FOREIGN KEY (LedgerId) REFERENCES erp_cash_ledger(LedgerId)
);

CREATE INDEX IF NOT EXISTS idx_bank_date ON bank_transactions(TxDate);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON erp_cash_ledger(PostingDate);
CREATE INDEX IF NOT EXISTS idx_match_status ON bank_recon_matches(MatchStatus);

-- Seed demo (Conciliación)
INSERT OR IGNORE INTO bank_transactions VALUES
('BT-0001','MX-001','2025-12-12','DEPÓSITO TAQUILLA CINE-021',15000,'MXN','IN'),
('BT-0002','MX-001','2025-12-12','DEPÓSITO TAQUILLA CINE-105',22000,'MXN','IN'),
('BT-0003','MX-001','2025-12-13','COMISIÓN BANCARIA',-120,'MXN','OUT'),
('BT-0004','MX-001','2025-12-14','DEPÓSITO CONSOLIDADO SEMANAL',55000,'MXN','IN');

INSERT OR IGNORE INTO erp_cash_ledger VALUES
('GL-9001','PeopleSoft','DEP-021-20251212','2025-12-12','Depósito cine 021',15000,'MXN','IN'),
('GL-9002','PeopleSoft','DEP-105-20251212','2025-12-12','Depósito cine 105',21950,'MXN','IN'),
('GL-9003','PeopleSoft','FEE-20251213','2025-12-13','Comisión bancaria',-120,'MXN','OUT'),
('GL-9004','PeopleSoft','DOC-A-20251214','2025-12-14','Venta Dulcería Sem 50',30000,'MXN','IN'),
('GL-9005','PeopleSoft','DOC-B-20251214','2025-12-14','Venta Boletos Sem 50',25000,'MXN','IN');

INSERT OR IGNORE INTO bank_recon_matches VALUES
('M-0001','BT-0001','GL-9001','MATCHED',0.99,'Monto y fecha exactos'),
('M-0002','BT-0002','GL-9002','EXCEPTION',0.72,'Diferencia de 50 MXN (posible ajuste)'),
('M-0003','BT-0003','GL-9003','MATCHED',0.98,'Descripción y monto coinciden'),
('M-0004','BT-0004','GL-9004','MATCHED',0.95,'Parte de consolidado semanal'),
('M-0005','BT-0004','GL-9005','MATCHED',0.95,'Parte de consolidado semanal');
`;

console.log('Seeding database...');
db.exec(schemaAndSeed);
console.log('Database seeded successfully.');
