# SAP Business One — Table Directory (AAS / Tata Motors Dealership)

## Finance & Accounting

| Table | Purpose |
|---|---|
| `OJDT` / `JDT1` | Journal Entries Header / Rows (JDT1 is the biggest table — always date-filter + NOLOCK) |
| `OACT` | Chart of Accounts (`AcctCode`, `AcctName`, `FormatCode`) |
| `OOCR` | Cost Centres (`DimCode` 4 = staff/DSE salesperson centres; 1, 2 also active) |
| `ODIM` | Cost Centre Dimensions |
| `OPRC` | Cost Centre / Profit Centre codes |
| `OFPR` | Posting Periods (Indian FY Apr–Mar) |
| `OTAX` / `TAX1` | GST tax engine data (huge — date-filter) |
| `OSTC` / `OSTA` | Tax Codes / Tax Rate definitions |
| `OITR` / `ITR1` | Internal Reconciliation Header / Rows (huge) |
| `OBTF` / `BTF1` | Journal Vouchers (batch/template) Header / Rows |
| `OCHO` / `CHO1` | Checks for Payment Header / Rows |
| `OCHH` | Check Register |
| `OBNK` | Bank Statement Rows |
| `ODPS` / `DPS1` | Deposits Header / Rows |
| `OWHT` / `WHT1` | Withholding Tax (TDS/TCS) definitions |

## Business Partners

| Table | Purpose |
|---|---|
| `OCRD` | BP Master — `CardType`: C=Customer, S=Supplier. UDFs: `U_MobNo`, `U_Aadhar`, `U_CRMId`, bank fields. `LicTradNum` = GSTIN |
| `OCRG` | BP Groups (100 Customer, 102 Chassis Customer, 104 Service Customer, 106/107 TML Vehicle/Spares Supplier, 113 Vendors…) |
| `CRD1` | BP Addresses |
| `CRD7` | BP Tax/GST info |
| `CRD8` | BP Bank Accounts |
| `OCPR` | Contact Persons |

## Items & Inventory

| Table | Purpose |
|---|---|
| `OITM` | Item Master — vehicles + spares. UDFs: `U_Model`, `U_Color`, `U_PrdLine`, `U_LOB`, `U_Emission`, homologation fields |
| `OITB` | Item Groups (101–119/132/147–151 = vehicle segments, 120 Spare Part, 121 Lubricant, 123 Accessories, 133 Labour Charges) |
| `OITW` | Item × Warehouse stock levels/costs (huge) |
| `OWHS` | Warehouses (`BPLid` → branch; `*TRNST` = in-transit, `-WS` = workshop, `CV-DEMO` = demo) |
| `OSRN` | Serial Numbers — **`DistNumber` = chassis no**, `MnfSerial` = engine no, `U_PhyStatus` |
| `OITL` / `ITL1` | Serial number transaction log (trace chassis movements) |
| `OIVL` / `OILM` | Inventory valuation / movement logs (huge) |
| `ITM1` | Item Price List rows |
| `OPLN` | Price List Master |

## Inventory Movements

| Table | Purpose |
|---|---|
| `OIGN` / `IGN1` | Goods Receipt Header / Rows (vehicle stock-in) |
| `OIGE` / `IGE1` | Goods Issue Header / Rows |
| `OWTR` / `WTR1` | Inventory (branch-to-branch) Transfer Header / Rows |
| `OSRQ` | Serial number quantity records |

## Sales (AR)

| Table | Purpose |
|---|---|
| `OINV` / `INV1` | **A/R Invoice Header / Rows — THE core sales document** (vehicles billed directly, no delivery step). ~300 UDFs: chassis, financier, schemes, IRN/e-way, DSE/DSM, gate pass links |
| `INV3` | Invoice Freight / Additional Expenses |
| `INV4` | Invoice Tax per line (SGST/CGST/IGST/CESS/TCS) |
| `INV6` / `INV12` | Instalments / Address extension |
| `ORIN` / `RIN1` | A/R Credit Memo Header / Rows |
| `ORDR` / `RDR1` | Sales Orders (marginal use — portal order bookings only) |
| `ODRF` / `DRF1` | Document drafts |
| `ONNM` / `NNM1` | Numbering Series — `NNM1.BPLId` maps series→branch; names encode branch+FY (`CVS-ALI9`, `CVW18-Ag`) |

> ⚠️ `OQUT`, `ODLN`, `ORDN`, `ODPI` exist but are **EMPTY** — never join through them.

## Purchasing (AP)

| Table | Purpose |
|---|---|
| `OPCH` / `PCH1` | A/P Invoice Header / Rows (TML chassis & spares purchases booked directly) |
| `PCH4` | A/P Invoice Tax per line |
| `ORPC` / `RPC1` | A/P Credit Memo Header / Rows |

> ⚠️ `OPOR`, `OPDN`, `ORPD`, `OPQT`, `ODPO` are **EMPTY** — no PO/GRPO flow here.

## Payments

| Table | Purpose |
|---|---|
| `ORCT` / `RCT1` / `RCT2` / `RCT4` | Incoming Payments Header / Cheques / Invoices paid / GL rows |
| `OVPM` / `VPM1` / `VPM2` / `VPM4` | Outgoing Payments Header / Cheques / Docs paid / GL rows |

## System & Admin

| Table | Purpose |
|---|---|
| `OADM` | Company settings (currency INR) |
| `OUSR` | User Master — **source for "active users / licences"**: `Locked='N'` minus system accounts (B1i, Support, AlertSvc, Workflow, EDsUser) |
| `USR3` / `USR5` | User permissions (NOT licences — don't count from these) |
| `OBPL` | Branch Master — 27 branches; prefixes: CVS/CVW (CV sales/workshop), PVS/PVW, PCW/PCD, HO, AAS-Logistics |
| `OUDO` | Custom object (UDO) registry |
| `CUFD` | **UDF dictionary** — look up any `U_*` field meaning here (`TableID`, `AliasID`, `Descr`) |
| `OATC` / `ATC1` | Attachments (huge — ignore unless asked) |
| `OSLP` | Sales Employees — **unused** (1 row); salesperson = Dim-4 cost centre or `U_DSE*` UDFs |
| `A***` (AITM, ACRD, ADOC, AJDT…) | Audit/history copies — exclude from business queries |

## Custom — GIS Dealer Portal Add-on

| Table | Purpose |
|---|---|
| `@GIS_GATEPASS` | **Workshop gate pass** (vehicle exit after service): job no, invoice, customer, chassis, credit-limit checks, `U_Approved` |
| `@GIS_GPAPR` / `@GIS_GPAPR1` | Gate pass approvals header / lines |
| `@GIS_GPSALE` | **Sales gate pass** (sold-vehicle delivery exit): invoice link, chassis, IRN, insurance/e-way attachments |
| `@GIS_OSAL` / `@GIS_SAL1` | **Sales Letter** (RTO registration letter) header / vehicle homologation lines (chassis, engine, axles, weights) |
| `@GIS_OTRN` / `@GIS_TRN1` | **TML reconciliation** statement import header / lines (debit/credit, chassis, GST splits) — NOT gate pass lines |
| `@GIS_OILD` | Portal processing/error log — NOT business data |
| `@GIS_OPLS` / `@GIS_PLS1` | Vehicle price list setup header / lines |
| `@GIS_OEPOD` / `@GIS_EPOD1` | Electronic Proof of Delivery |
| `@GIS_OLRT` / `@GIS_LRT1` | Loyalty receipts |
| `@GIS_OFT` / `@GIS_FTLOG1` | Inter-branch fund transfers + log |
| `@GIS_OCRL` / `@GIS_CRL1` | Customer credit limits |
| `@GIS_USER` | Portal logins (⚠️ plaintext passwords — never display) |
| `@GIS_PORTALBRANCH` | Portal ↔ branch mapping |
| `@GIS_ODSM` | Dealer Sales Manager master |
| `@GIS_LOB` / `@GIS_OMDL` | Line-of-business / vehicle model masters |
| `@GIS_ORTO` / `@GIS_OINS` | RTO rate list / Insurance rate list |
| `@GIS_VCSP` | Weekly channel sales program |
| `@ESPL_MD_CHASISMAS` | Chassis master upload (chassis ↔ supplier invoice ↔ amount) |
| `@BZ_*` | BZ add-on (PV side): car configurator, offers/schemes, insurance posting, incentives (`@BZ_OCSD` = deal sheets) |

## Custom — Integration Tables (no @ prefix)

| Table | Purpose |
|---|---|
| `JCHeader` / `JCDetail` | Workshop **job-card invoice staging from Tata CRM-DMS** (chassis, job card no, labour/parts; columns are nvarchar — CAST before maths) |
| `ChassisPayment` | Chassis-wise payment application (chassis ↔ OINV ↔ payment doc; `Amount` is nvarchar) |
| `WebSalesInvoice` | Portal → SBO posting log (`Success`/`Error`) |
| `GST_Report_*` / `GSTR2_Report_*` | GSTR-1/2 return staging (B2B, B2CS, B2CL, HSN, DOCS, CDNR, CDNUR) |
| `CLEARDATELOG`, `ChassisTemp`, `Sheet2$`, `TableLength`, `AccHeader/AccDetail` | Scratch/import artifacts — ignore |