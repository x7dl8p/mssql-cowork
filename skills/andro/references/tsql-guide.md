# T-SQL Guide — Andro MCP Query Tool Quirks (SQL Server 2019)

The dialect is standard **T-SQL**, but the `run_query` tool is restricted. These are the rules that actually caused errors or matter in practice.

## Tool restrictions (run_query)

| Rule | Detail |
|---|---|
| SELECT / WITH only | `INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, EXEC, TRUNCATE, MERGE` are blocked. No temp tables (`#t`), no variables (`DECLARE`), no multi-statement batches |
| Auto TOP | If `TOP` is absent, the server injects `TOP 100`. Always write your own `TOP n` (and `limit` param) — max 1000 rows |
| One resultset | One query per call. Combine probes with `UNION ALL` or scalar subqueries: `SELECT (SELECT COUNT(*) FROM X) a, (SELECT COUNT(*) FROM Y) b` |
| Errors are fatal, not partial | An invalid column fails the whole call — verify columns with `inspect_schema`/`CUFD` before writing long queries |
| explain_query | Returns plan only, never data — use to sanity-check big-table queries first |

## Naming & quoting

- Custom UDT names start with `@` — **must be bracketed**: `SELECT * FROM [@GIS_GATEPASS]`. Unbracketed `@GIS_...` parses as a variable and fails.
- `Sheet2$` and similar also need brackets: `[Sheet2$]`.
- UDF columns are `U_*` (e.g. `U_ChassisNo`); confirm exact alias in `CUFD` — guessing alias names is the #1 cause of "Invalid column name" errors (e.g. OSRN uses `DistNumber`, not `IntrSerial`; OADM has no `SystemCurr`).
- Reserved words as columns (`User`, `Type`, `Name`) → bracket them: `[User]`.

## Dates

- Server stores datetimes; `DocDate` etc. return ISO (`2026-06-10T00:00:00.000Z`).
- Filter with unambiguous literals: `DocDate >= '2025-04-01' AND DocDate < '2026-04-01'` (Indian FY). Avoid `BETWEEN` on datetime.
- Useful: `EOMONTH()`, `DATEFROMPARTS()`, `FORMAT(DocDate,'MMM yy')` (FORMAT is slow on big sets — prefer `YEAR()`/`MONTH()` grouping).

## Numbers stored as text (custom tables)

Many custom/integration columns are `nvarchar` holding numbers (`@GIS_TRN1.U_DebitAmt/U_CreditAmt`, `ChassisPayment.Amount`, most `JCDetail` columns, many `U_*` "B"-type look-alikes stored as A-type).
- Always: `TRY_CAST(col AS NUMERIC(19,2))` before SUM/AVG — plain `CAST` dies on blanks/garbage.
- NULL-safety on real numerics: `ISNULL(col,0)`.

## Performance rules

- `WITH (NOLOCK)` + mandatory date filter on: `JDT1`, `OJDT`, `OITW`, `TAX1`, `OATC/ATC1`, `INV1/INV4`, `ITR1`, `OIVL/OILM`, `OINV`, `[@GIS_GATEPASS]`, `[@GIS_TRN1]`.
- Explicit column lists; no `SELECT *` in final queries.
- Aggregate in SQL, not post-processing; one CTE chain beats multiple round-trips.

## Semantic rules (this DB)

- `CANCELED = 'N'` on every transactional header (OINV, OPCH, ORIN, ORPC, ORCT, OVPM, OWTR, OIGN, OIGE…).
- Header↔rows join on `DocEntry` only; `DocNum` is display-only.
- No physical FKs — all joins logical (`BPLId→OBPL`, `CardCode→OCRD`, `ItemCode→OITM`, `Series→NNM1`).
- Empty tables (never join): ODLN, ORDN, OQUT, OPOR, OPDN, ORPD, OPQT, ODPI, ODPO.
- Exclude `A***` audit tables and `ODRF` drafts from business numbers.
- Open-doc balance: `DocStatus='O'` and `DocTotal - PaidToDate`.

## Tested patterns

```sql
-- Active users (licences)
SELECT COUNT(*) AS LicensedUsers FROM OUSR
WHERE Locked='N' AND USER_CODE NOT IN ('B1i','Support','AlertSvc','Workflow','EDsUser')
```

```sql
-- Sales by branch, one month
SELECT TOP 30 B.BPLName, COUNT(*) AS Invoices, SUM(ISNULL(T0.DocTotal,0)) AS TotalValue
FROM OINV T0 WITH (NOLOCK)
JOIN OBPL B ON B.BPLId = T0.BPLId
WHERE T0.CANCELED='N' AND T0.DocDate >= '2026-05-01' AND T0.DocDate < '2026-06-01'
GROUP BY B.BPLName ORDER BY TotalValue DESC
```

```sql
-- Custom table with @ name + text-number cast
SELECT TOP 100 T0.U_ChassisNo, TRY_CAST(T0.U_DebitAmt AS NUMERIC(19,2)) AS DebitAmt
FROM [@GIS_TRN1] T0 WITH (NOLOCK)
WHERE T0.U_PostDate >= '2026-04-01'
```

```sql
-- UDF discovery instead of guessing
SELECT AliasID, Descr, TypeID FROM CUFD WHERE TableID = 'OINV' ORDER BY FieldID
```

```sql
-- Multi-count probe in one call
SELECT (SELECT COUNT(*) FROM ORDR) AS SO, (SELECT COUNT(*) FROM ODLN) AS DLN
```