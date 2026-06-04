import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { BUSINESS, PAYMENT } from "@/lib/config";
import { formatMoney } from "@/lib/pdf/format";
import { PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import { PaynowCard } from "@/lib/pdf/paynow-card";
import type { StoredLineItem } from "@/lib/billing/invoice-db";

const AMOUNT_COL_WIDTH = 76;

export type DbInvoicePdfProps = {
  logoSrc: string;
  paynowQrPlaceholderSrc: string;
  invoiceNumber: string;
  contactName: string;
  studentNames: string[];
  students: Array<{ name: string; lineItems: StoredLineItem[] }>;
  subtotal: number;
  discountAmount: number;
  balanceForward: number;
  creditApplied: number;
  totalDue: number;
  issuedAt: string;
  dueAt: string;
  remarks?: string;
};

type PdfLineItem = {
  key: string;
  description: string;
  detail?: string;
  amount: number;
  isMeta?: boolean;
  isHeader?: boolean;
};

/** One row per lesson, matching the INV preview style. */
export function buildPdfLineItems(lineItems: StoredLineItem[]): PdfLineItem[] {
  const result: PdfLineItem[] = [];

  for (const item of lineItems) {
    if (item.type === "tuition") {
      const detail = item.detail || item.sessionDate || "";
      result.push({
        key: item.id,
        description: item.classLabel,
        detail: detail || undefined,
        amount: parseFloat(item.amount),
      });
    } else if (item.type === "registration_fee") {
      result.push({
        key: item.id,
        description: item.description || "Registration and Material Fee",
        amount: parseFloat(item.amount),
      });
    } else if (item.type === "balance_forward") {
      result.push({ key: item.id, description: "Balance forward", amount: parseFloat(item.amount), isMeta: true });
    } else if (item.type === "credit") {
      result.push({ key: item.id, description: item.description || "Credit applied", amount: parseFloat(item.amount), isMeta: true });
    } else if (item.type === "discount") {
      result.push({ key: item.id, description: item.description || "Discount", amount: parseFloat(item.amount), isMeta: true });
    }
  }

  return result;
}

/** Build PDF items with per-student section headers (used when invoice covers multiple students). */
export function buildMultiStudentPdfItems(
  students: Array<{ name: string; lineItems: StoredLineItem[] }>,
): PdfLineItem[] {
  const result: PdfLineItem[] = [];

  const allLineItems = students.flatMap((s) => s.lineItems);
  const metaItems = allLineItems.filter((l) => l.type === "balance_forward" || l.type === "credit" || l.type === "discount");

  for (const s of students) {
    const tuitionItems = s.lineItems.filter((l) => l.type === "tuition" || l.type === "registration_fee");
    if (tuitionItems.length === 0) continue;

    result.push({ key: `header:${s.name}`, description: s.name, amount: 0, isHeader: true });
    result.push(...buildPdfLineItems(tuitionItems));
  }

  for (const item of metaItems) {
    if (item.type === "balance_forward") {
      result.push({ key: item.id, description: "Balance forward", amount: parseFloat(item.amount), isMeta: true });
    } else if (item.type === "credit") {
      result.push({ key: item.id, description: item.description || "Credit applied", amount: parseFloat(item.amount), isMeta: true });
    } else if (item.type === "discount") {
      result.push({ key: item.id, description: item.description || "Discount", amount: parseFloat(item.amount), isMeta: true });
    }
  }

  return result;
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 10, padding: 48, color: "#171717" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  companyBlock: { flex: 1, paddingRight: 24 },
  companyLine: { fontSize: 8.5, color: "#525252", marginBottom: 2.5, lineHeight: 1.4 },
  logo: { width: 140, height: 42, objectFit: "contain" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  metaColBillTo: { flex: 1, paddingRight: 24 },
  metaColInvoice: { width: 180 },
  blockLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1, color: "#ea580c", marginBottom: 6, textTransform: "uppercase" },
  billToName: { fontSize: 10, lineHeight: 1.5 },
  billToSub: { fontSize: 9, color: "#525252", lineHeight: 1.4 },

  metaGrid: { flexDirection: "row", marginBottom: 4 },
  metaGridLabel: { width: 68, fontSize: 8.5, color: "#737373" },
  metaGridValue: { flex: 1, fontSize: 8.5, textAlign: "right" },

  // Table
  table: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  tableRowLast: { borderBottomWidth: 0 },
  tableRowSection: { flexDirection: "row", backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  colDivider: { width: 1, backgroundColor: "#e4e4e7" },
  cellDesc: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  cellAmt: { width: AMOUNT_COL_WIDTH, paddingVertical: 8, paddingHorizontal: 10, alignItems: "flex-end", justifyContent: "center" },
  th: { fontSize: 8, fontWeight: "bold", color: "#525252", letterSpacing: 0.3 },
  td: { fontSize: 9, color: "#171717" },
  tdSub: { fontSize: 8, color: "#737373", marginTop: 2 },
  tdMeta: { fontSize: 9, color: "#525252" },
  tdSection: { fontSize: 8.5, fontWeight: "bold", color: "#525252" },

  // Totals
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12, marginBottom: 24 },
  totalsBox: { width: 210, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#fff7ed", borderRadius: 4, borderLeftWidth: 3, borderLeftColor: "#f97316" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalRowLabel: { fontSize: 8.5, color: "#737373" },
  totalRowValue: { fontSize: 8.5, color: "#171717" },
  totalRowAccent: { fontSize: 8.5, color: "#16a34a" },
  totalDivider: { borderTopWidth: 1, borderTopColor: "#fed7aa", marginTop: 6, paddingTop: 8 },
  totalFinalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 11, fontWeight: "bold", color: "#ea580c" },
  totalValue: { fontSize: 13, fontWeight: "bold", color: "#ea580c" },

  // Payment section
  paymentSection: { marginTop: 4 },
  paymentBlockLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1, color: "#ea580c", marginBottom: 8, textTransform: "uppercase" },
  paymentColumns: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  paymentLeft: { flex: 1, paddingRight: 16 },
  paymentSubLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 0.5, color: "#171717", marginBottom: 4, textTransform: "uppercase" },
  bankBlock: { marginTop: 10 },
  paymentLine: { fontSize: 8.5, color: "#404040", marginBottom: 2.5, lineHeight: 1.4 },
  remarksBlock: { marginBottom: 14 },
  remarksText: { fontSize: 8.5, color: "#525252", lineHeight: 1.5 },
});

function InvoiceMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaGrid}>
      <Text style={styles.metaGridLabel}>{label}</Text>
      <Text style={styles.metaGridValue}>{value}</Text>
    </View>
  );
}

function TotalsLine({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalRowLabel}>{label}</Text>
      <Text style={accent ? styles.totalRowAccent : styles.totalRowValue}>{value}</Text>
    </View>
  );
}

function TableRow({ item, last }: { item: PdfLineItem; last: boolean }) {
  if (item.isHeader) {
    return (
      <View style={styles.tableRowSection}>
        <View style={styles.cellDesc}>
          <Text style={styles.tdSection}>{item.description}</Text>
        </View>
      </View>
    );
  }

  const rowStyle = last ? [styles.tableRow, styles.tableRowLast] : styles.tableRow;
  const isNeg = item.amount < 0;

  return (
    <View style={rowStyle}>
      <View style={styles.cellDesc}>
        <Text style={item.isMeta ? styles.tdMeta : styles.td}>{item.description}</Text>
        {item.detail ? <Text style={styles.tdSub}>{item.detail}</Text> : null}
      </View>
      <View style={styles.colDivider} />
      <View style={styles.cellAmt}>
        <Text style={[styles.td, isNeg ? { color: "#16a34a" } : {}]}>
          {isNeg ? `−${formatMoney(-item.amount)}` : formatMoney(item.amount)}
        </Text>
      </View>
    </View>
  );
}

export function DbInvoiceDocument(props: DbInvoicePdfProps) {
  const { bank } = PAYMENT;

  const multiStudent = props.students.length > 1;
  const pdfItems = multiStudent
    ? buildMultiStudentPdfItems(props.students)
    : buildPdfLineItems(props.students[0]?.lineItems ?? []);

  const showDiscount = props.discountAmount > 0.005;
  const showBalance = props.balanceForward > 0.005;
  const showCredit = props.creditApplied > 0.005;
  const showTotalsBreakdown = showDiscount || showBalance || showCredit;

  const studentNamesStr = props.studentNames.join(", ");
  const showStudentNames = studentNamesStr && studentNamesStr !== props.contactName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            {BUSINESS.addressLines.map((line) => (
              <Text key={line} style={styles.companyLine}>{line}</Text>
            ))}
            <Text style={styles.companyLine}>{BUSINESS.email}</Text>
            <Text style={styles.companyLine}>{BUSINESS.phone}</Text>
          </View>
          <Image src={props.logoSrc} style={styles.logo} />
        </View>

        {/* Bill-to + Invoice meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaColBillTo}>
            <Text style={styles.blockLabel}>Bill to</Text>
            <Text style={styles.billToName}>{props.contactName || studentNamesStr}</Text>
            {showStudentNames && (
              <Text style={styles.billToSub}>{studentNamesStr}</Text>
            )}
          </View>
          <View style={styles.metaColInvoice}>
            <Text style={styles.blockLabel}>Invoice</Text>
            <InvoiceMetaRow label="Invoice no." value={props.invoiceNumber} />
            <InvoiceMetaRow label="Issue date" value={props.issuedAt} />
            <InvoiceMetaRow label="Due date" value={props.dueAt} />
          </View>
        </View>

        {props.remarks ? (
          <View style={styles.remarksBlock}>
            <Text style={styles.remarksText}>{props.remarks}</Text>
          </View>
        ) : null}

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.cellDesc}><Text style={styles.th}>Description</Text></View>
            <View style={styles.colDivider} />
            <View style={styles.cellAmt}><Text style={styles.th}>Amount</Text></View>
          </View>
          {pdfItems.map((item, i) => (
            <TableRow key={item.key} item={item} last={i === pdfItems.length - 1} />
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            {showDiscount && <TotalsLine label="Subtotal" value={formatMoney(props.subtotal)} />}
            {showDiscount && <TotalsLine label="Discount" value={`−${formatMoney(props.discountAmount)}`} accent />}
            {showBalance && <TotalsLine label="Balance forward" value={formatMoney(props.balanceForward)} />}
            {showCredit && <TotalsLine label="Credit applied" value={`−${formatMoney(props.creditApplied)}`} accent />}
            <View style={showTotalsBreakdown ? styles.totalDivider : undefined}>
              <View style={styles.totalFinalRow}>
                <Text style={styles.totalLabel}>Total due</Text>
                <Text style={styles.totalValue}>{formatMoney(props.totalDue)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment section */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentBlockLabel}>Payment methods</Text>
          <View style={styles.paymentColumns}>
            <View style={styles.paymentLeft}>
              <Text style={styles.paymentSubLabel}>PayNow</Text>
              <Text style={styles.paymentLine}>UEN: {PAYMENT.paynowUen}</Text>
              <View style={styles.bankBlock}>
                <Text style={styles.paymentSubLabel}>Bank transfer</Text>
                <Text style={styles.paymentLine}>Bank: {bank.name}</Text>
                <Text style={styles.paymentLine}>SWIFT/BIC: {bank.swift}</Text>
                <Text style={styles.paymentLine}>Account type: {bank.accountType}</Text>
                <Text style={styles.paymentLine}>Branch: {bank.branch}</Text>
                <Text style={styles.paymentLine}>Account name: {bank.accountName}</Text>
                <Text style={styles.paymentLine}>Account no.: {bank.accountNumber}</Text>
              </View>
            </View>
            <PaynowCard qrPlaceholderSrc={props.paynowQrPlaceholderSrc} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
