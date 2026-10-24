-- Datos TOTALMENTE SINTÉTICOS para la defensa de la tesis de Freinny Moreno.
-- No contienen nóminas, costos, obras, ni personas reales de Echeverría Izquierdo.
-- PostgreSQL/Fabric no interviene en esta demo; SQLite replica un contrato Gold.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

CREATE TABLE departments (
  department_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE projects (
  project_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  planned_end_date TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE employees (
  employee_id INTEGER PRIMARY KEY,
  internal_code TEXT NOT NULL UNIQUE,
  department_id INTEGER NOT NULL REFERENCES departments(department_id),
  role TEXT NOT NULL,
  hire_date TEXT NOT NULL
);
CREATE TABLE workforce_monthly (
  period TEXT NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(employee_id),
  project_id INTEGER REFERENCES projects(project_id),
  fte REAL NOT NULL CHECK (fte >= 0 AND fte <= 1),
  monthly_cost_clp INTEGER NOT NULL CHECK (monthly_cost_clp >= 0),
  PRIMARY KEY(period, employee_id)
);

INSERT INTO departments(department_id, name) VALUES
(1,'Operaciones'),(2,'Ingeniería'),(3,'Prevención de riesgos'),
(4,'Administración'),(5,'Recursos Humanos');

INSERT INTO projects(project_id,code,name,start_date,planned_end_date,status) VALUES
(1,'EISA-DEMO-P01','Edificio Parque Central','2026-01-12','2027-01-12','En ejecución'),
(2,'EISA-DEMO-P02','Ampliación Planta Sur','2026-03-01','2027-02-28','En ejecución'),
(3,'EISA-DEMO-P03','Centro Logístico Norte','2026-05-15','2026-12-15','En ejecución'),
(4,'EISA-DEMO-P04','Obras Viales Oriente','2026-08-01','2027-05-31','En ejecución');

-- Los códigos EMP-xxx son identificadores ficticios sin nombres de trabajadores.
INSERT INTO employees(employee_id,internal_code,department_id,role,hire_date) VALUES
(1,'EMP-001',2,'Ingeniero de proyecto','2025-01-01'),
(2,'EMP-002',2,'Ingeniero de proyecto','2025-01-01'),
(3,'EMP-003',2,'Ingeniero de proyecto','2025-01-01'),
(4,'EMP-004',1,'Supervisor de obra','2025-01-01'),
(5,'EMP-005',1,'Supervisor de obra','2025-01-01'),
(6,'EMP-006',1,'Supervisor de obra','2025-01-01'),
(7,'EMP-007',1,'Técnico de obra','2025-01-01'),
(8,'EMP-008',1,'Técnico de obra','2025-01-01'),
(9,'EMP-009',1,'Técnico de obra','2025-01-01'),
(10,'EMP-010',1,'Técnico de obra','2025-01-01'),
(11,'EMP-011',1,'Técnico de obra','2025-01-01'),
(12,'EMP-012',1,'Técnico de obra','2025-01-01'),
(13,'EMP-013',1,'Técnico de obra','2025-01-01'),
(14,'EMP-014',1,'Técnico de obra','2025-01-01'),
(15,'EMP-015',1,'Técnico de obra','2025-01-01'),
(16,'EMP-016',3,'Prevencionista','2025-01-01'),
(17,'EMP-017',3,'Prevencionista','2025-01-01'),
(18,'EMP-018',3,'Prevencionista','2025-01-01'),
(19,'EMP-019',4,'Administrativo de proyecto','2025-01-01'),
(20,'EMP-020',4,'Administrativo de proyecto','2025-01-01'),
(21,'EMP-021',4,'Administrativo de proyecto','2026-09-01'),
(22,'EMP-022',5,'Analista de RRHH','2026-09-01'),
(23,'EMP-023',5,'Analista de RRHH','2026-10-01'),
(24,'EMP-024',5,'Analista de RRHH','2026-10-01');

-- La asignación se modela en el hecho mensual, no como dato estático del empleado.
-- Una fila equivale a un empleado en un mes; dotación = COUNT(*), FTE = SUM(fte).
-- A los empleados 22-24 se les asigna centro corporativo (project_id NULL).
INSERT INTO workforce_monthly(period,employee_id,project_id,fte,monthly_cost_clp)
SELECT months.period,e.employee_id,
  CASE e.employee_id
    WHEN 1 THEN 1 WHEN 4 THEN 1 WHEN 7 THEN 1 WHEN 8 THEN 1 WHEN 9 THEN 1 WHEN 16 THEN 1 WHEN 19 THEN 1
    WHEN 2 THEN 2 WHEN 5 THEN 2 WHEN 10 THEN 2 WHEN 11 THEN 2 WHEN 12 THEN 2 WHEN 17 THEN 2 WHEN 20 THEN 2
    WHEN 3 THEN 3 WHEN 6 THEN 3 WHEN 13 THEN 3 WHEN 14 THEN 3 WHEN 18 THEN 3
    WHEN 15 THEN 4 WHEN 21 THEN 4
    ELSE NULL
  END,
  1.0,
  CASE e.employee_id
    WHEN 1 THEN 2600000 WHEN 2 THEN 2700000 WHEN 3 THEN 2800000
    WHEN 4 THEN 2100000 WHEN 5 THEN 2150000 WHEN 6 THEN 2200000
    WHEN 7 THEN 1050000 WHEN 8 THEN 1050000 WHEN 9 THEN 1050000
    WHEN 10 THEN 1050000 WHEN 11 THEN 1050000 WHEN 12 THEN 1050000
    WHEN 13 THEN 1050000 WHEN 14 THEN 1050000 WHEN 15 THEN 1050000
    WHEN 16 THEN 1600000 WHEN 17 THEN 1650000 WHEN 18 THEN 1700000
    WHEN 19 THEN 1200000 WHEN 20 THEN 1250000 WHEN 21 THEN 1300000
    WHEN 22 THEN 1400000 WHEN 23 THEN 1450000 WHEN 24 THEN 1500000
  END
FROM employees e
CROSS JOIN (SELECT '2026-08' AS period UNION ALL SELECT '2026-09' UNION ALL SELECT '2026-10') months
WHERE e.hire_date <= date(months.period || '-01','+1 month','-1 day');

-- Vistas Gold sintéticas. La aplicación NL2SQL SOLO consultará estas vistas agregadas.
CREATE VIEW v_gold_resumen_rrhh_mensual AS
SELECT w.period AS periodo,
       COUNT(*) AS dotacion_total,
       ROUND(SUM(w.fte),2) AS fte_total,
       SUM(w.monthly_cost_clp) AS costo_laboral_total_clp,
       SUM(CASE WHEN w.project_id IS NULL THEN 1 ELSE 0 END) AS dotacion_central,
       SUM(CASE WHEN w.project_id IS NOT NULL THEN 1 ELSE 0 END) AS dotacion_en_proyectos
FROM workforce_monthly w GROUP BY w.period;

CREATE VIEW v_gold_personal_proyecto_mensual AS
SELECT w.period AS periodo,
       COALESCE(p.code,'EISA-DEMO-CENTRAL') AS proyecto_codigo,
       COALESCE(p.name,'Administración central (sin proyecto)') AS proyecto_nombre,
       COUNT(*) AS dotacion,
       ROUND(SUM(w.fte),2) AS fte_total,
       SUM(w.monthly_cost_clp) AS costo_laboral_clp
FROM workforce_monthly w
LEFT JOIN projects p ON p.project_id=w.project_id
GROUP BY w.period, COALESCE(p.code,'EISA-DEMO-CENTRAL'), COALESCE(p.name,'Administración central (sin proyecto)');

CREATE VIEW v_gold_dotacion_area_mensual AS
SELECT w.period AS periodo, d.name AS area,
       COUNT(*) AS dotacion,
       ROUND(SUM(w.fte),2) AS fte_total,
       SUM(w.monthly_cost_clp) AS costo_laboral_clp
FROM workforce_monthly w
JOIN employees e ON e.employee_id=w.employee_id
JOIN departments d ON d.department_id=e.department_id
GROUP BY w.period,d.name;

CREATE VIEW v_gold_proyectos AS
SELECT code AS proyecto_codigo, name AS proyecto_nombre,
       start_date AS fecha_inicio,
       planned_end_date AS fecha_fin_planificada,
       CAST(julianday(planned_end_date)-julianday(start_date) AS INTEGER) AS duracion_planificada_dias,
       status AS estado
FROM projects;

CREATE INDEX ix_workforce_period ON workforce_monthly(period);
CREATE INDEX ix_workforce_project_period ON workforce_monthly(project_id,period);
COMMIT;
