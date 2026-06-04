import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { BUSINESS } from "@/lib/config";
import { formatMoney } from "@/lib/pdf/format";
import { PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import { buildPdfLineItems, buildMultiStudentPdfItems } from "@/lib/pdf/db-invoice-document";
import type { StoredLineItem } from "@/lib/billing/invoice-db";

const AMOUNT_COL_WIDTH = 76;

export type DbReceiptPdfProps = {
  logoSrc: string;
  receiptNumber: string;
  invoiceNumber: string;
  contactName: string;
  studentNames: string[];
  students: Array<{ name: string; lineItems: StoredLineItem[] }>;
  totalPaid: number;
  paidAt: string;
};

const GREEN = { accent: "#16a34a", tintBg: "#f0fdf4", stripe: "#22c55e", divider: "#bbf7d0" };

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 10, padding: 48, color: "#171717" },
  stripe: { height: 5, backgroundColor: GREEN.stripe, marginBottom: 28, borderRadius: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  companyBlock: { flex: 1, paddingRight: 24 },
  companyLine: { fontSize: 8.5, color: "#525252", marginBottom: 2.5, lineHeight: 1.4 },
  logo: { width: 140, height: 42, objectFit: "contain" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  metaColLeft: { flex: 1, paddingRight: 24 },
  metaColRight: { width: 180 },
  blockLabel: { fontSize: 7.5, fontWeight: "bold", letterSpacing: 1, color: GREEN.accent, marginBottom: 6, textTransform: "uppercase" },
  partyName: { fontSize: 10, lineHeight: 1.5 },
  partySub: { fontSize: 9, color: "#525252", lineHeight: 1.4 },

  metaGrid: { flexDirection: "row", marginBottom: 4 },
  metaGridLabel: { width: 68, fontSize: 8.5, color: "#737373" },
  metaGridValue: { flex: 1, fontSize: 8.5, textAlign: "right" },

  // Table
  table: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: GREEN.tintBg, borderBottomWidth: 1, borderBottomColor: "#bbf7d0" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  tableRowLast: { borderBottomWidth: 0 },
  tableRowSection: { flexDirection: "row", backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#e4e4e7" },
  colDivider: { width: 1, backgroundColor: "#e4e4e7" },
  cellDesc: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  cellAmt: { width: AMOUNT_COL_WIDTH, paddingVertical: 8, paddingHorizontal: 10, alignItems: "flex-end", justifyContent: "center" },
  th: { fontSize: 8, fontWeight: "bold", color: "#525252", letterSpacing: 0.3 },
  td: { fontSize: 9, color: "#171717" },
  tdSub: { fontSize: 8, color: "#737373", marginTop: 2 },
  tdSection: { fontSize: 8.5, fontWeight: "bold", color: "#525252" },

  // Totals
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalsBox: { width: 210, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: GREEN.tintBg, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: GREEN.accent },
  totalFinalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 11, fontWeight: "bold", color: GREEN.accent },
  totalValue: { fontSize: 13, fontWeight: "bold", color: GREEN.accent },

  thankYou: { marginTop: 28, fontSize: 8.5, color: "#737373", textAlign: "center" },
});

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaGrid}>
      <Text style={styles.metaGridLabel}>{label}</Text>
      <Text style={styles.metaGridValue}>{value}</Text>
    </View>
  );
}

export function DbReceiptDocument(props: DbReceiptPdfProps) {
  const multiStudent = props.students.length > 1;

  const tuitionStudents = props.students.map((s) => ({
    name: s.name,
    lineItems: s.lineItems.filter((l) => l.type === "tuition" || l.type === "registration_fee"),
  }));

  const pdfItems = multiStudent
    ? buildMultiStudentPdfItems(tuitionStudents)
    : buildPdfLineItems(tuitionStudents[0]?.lineItems ?? []);

  const studentNamesStr = props.studentNames.join(", ");
  const showStudentNames = studentNamesStr && studentNamesStr !== props.contactName;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.stripe} />

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

        {/* Received from + Receipt meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaColLeft}>
            <Text style={styles.blockLabel}>Payment received from</Text>
            <Text style={styles.partyName}>{props.contactName || studentNamesStr}</Text>
            {showStudentNames && (
              <Text style={styles.partySub}>{studentNamesStr}</Text>
            )}
          </View>
          <View style={styles.metaColRight}>
            <Text style={styles.blockLabel}>Receipt</Text>
            <MetaRow label="Receipt no." value={props.receiptNumber} />
            <MetaRow label="Paid on" value={props.paidAt} />
            <MetaRow label="Invoice no." value={props.invoiceNumber} />
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.cellDesc}><Text style={styles.th}>Description</Text></View>
            <View style={styles.colDivider} />
            <View style={styles.cellAmt}><Text style={styles.th}>Amount</Text></View>
          </View>
          {pdfItems.map((item, i) => {
            if (item.isHeader) {
              return (
                <View key={item.key} style={styles.tableRowSection}>
                  <View style={styles.cellDesc}>
                    <Text style={styles.tdSection}>{item.description}</Text>
                  </View>
                </View>
              );
            }
            const rowStyle = i === pdfItems.length - 1 ? [styles.tableRow, styles.tableRowLast] : styles.tableRow;
            return (
              <View key={item.key} style={rowStyle}>
                <View style={styles.cellDesc}>
                  <Text style={styles.td}>{item.description}</Text>
                  {item.detail ? <Text style={styles.tdSub}>{item.detail}</Text> : null}
                </View>
                <View style={styles.colDivider} />
                <View style={styles.cellAmt}>
                  <Text style={[styles.td, item.amount < 0 ? { color: "#16a34a" } : {}]}>
                    {item.amount < 0 ? `−${formatMoney(-item.amount)}` : formatMoney(item.amount)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalFinalRow}>
              <Text style={styles.totalLabel}>Amount paid</Text>
              <Text style={styles.totalValue}>{formatMoney(props.totalPaid)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.thankYou}>Thank you for your payment!</Text>
      </Page>
    </Document>
  );
}
