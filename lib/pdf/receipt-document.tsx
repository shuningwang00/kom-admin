import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { BUSINESS } from "@/lib/config";
import { REGISTRATION_FEE_DESCRIPTION } from "@/lib/billing/registration-fee";
import {
  formatInvoiceProduct,
  formatMoney,
  formatSessionDatesDescription,
} from "@/lib/pdf/format";
import { PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import { TABLE_COL } from "@/lib/pdf/table-columns";
import type { BillableSession } from "@/lib/types";

const GREEN = {
  accent: "#16a34a",
  accentDark: "#15803d",
  tintBg: "#f0fdf4",
  tintBorder: "#86efac",
  stripe: "#22c55e",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    padding: 48,
    color: "#171717",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  companyBlock: { flex: 1, paddingRight: 24 },
  companyLine: {
    fontSize: 9,
    color: "#404040",
    marginBottom: 3,
    lineHeight: 1.45,
  },
  logo: { width: 156, height: 46, objectFit: "contain" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  metaColLeft: { flex: 1, paddingRight: 24 },
  metaColRight: {
    width: 188,
    marginLeft: "auto",
    alignSelf: "flex-end",
  },
  blockTitleAccent: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.5,
    color: GREEN.accent,
  },
  paidBadge: {
    fontSize: 9,
    fontWeight: "bold",
    color: GREEN.accent,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  partyName: { fontSize: 10, lineHeight: 1.45 },
  metaDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  metaLabel: { fontSize: 9, color: "#525252" },
  metaValue: { fontSize: 9, textAlign: "right" },
  table: {
    borderWidth: 1,
    borderColor: "#171717",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: GREEN.tintBg,
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  tableRowLast: { borderBottomWidth: 0 },
  colDivider: {
    width: 1,
    backgroundColor: "#171717",
    alignSelf: "stretch",
  },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: "flex-start",
  },
  cellNumeric: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  th: { fontSize: 9, fontWeight: "bold" },
  td: { fontSize: 9 },
  productDesc: { fontSize: 8, color: "#737373", marginTop: 4 },
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  totalsBox: {
    width: 220,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: GREEN.tintBg,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: GREEN.stripe,
  },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 11, fontWeight: "bold", color: GREEN.accent },
  totalValue: { fontSize: 14, fontWeight: "bold", color: GREEN.accent },
});

export type ReceiptLineItem = {
  key: string;
  description: string;
  detail?: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export type ReceiptPdfProps = {
  logoSrc: string;
  receiptNumber: string;
  invoiceNumber: string;
  studentName: string;
  level: string;
  dayLabel: string;
  sessions: BillableSession[];
  sessionCount: number;
  ratePerSession: number;
  registrationFee?: number;
  amount: number;
  paidAt: string;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaDetailRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function ReceiptTableRow({
  item,
  last,
}: {
  item: ReceiptLineItem;
  last: boolean;
}) {
  return (
    <View style={last ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}>
      <View style={[styles.cell, TABLE_COL.product]}>
        <Text style={styles.td}>{item.description}</Text>
        {item.detail ? (
          <Text style={styles.productDesc}>{item.detail}</Text>
        ) : null}
      </View>
      <View style={styles.colDivider} />
      <View style={[styles.cell, styles.cellNumeric, TABLE_COL.qty]}>
        <Text style={styles.td}>{String(item.qty)}</Text>
      </View>
      <View style={styles.colDivider} />
      <View style={[styles.cell, styles.cellNumeric, TABLE_COL.unit]}>
        <Text style={styles.td}>{formatMoney(item.unitPrice)}</Text>
      </View>
      <View style={styles.colDivider} />
      <View style={[styles.cell, styles.cellNumeric, TABLE_COL.amount]}>
        <Text style={styles.td}>{formatMoney(item.amount)}</Text>
      </View>
    </View>
  );
}

export function ReceiptDocument(props: ReceiptPdfProps) {
  const product = formatInvoiceProduct(props.level, props.dayLabel);
  const datesDescription = formatSessionDatesDescription(props.sessions);
  const registrationFee = props.registrationFee ?? 0;
  const tuitionAmount = Math.round((props.amount - registrationFee) * 100) / 100;
  const tuitionUnit =
    props.sessionCount > 0
      ? Math.round((tuitionAmount / props.sessionCount) * 100) / 100
      : props.ratePerSession;

  const lineItems: ReceiptLineItem[] = [];
  if (props.sessionCount > 0) {
    lineItems.push({
      key: "tuition",
      description: product,
      detail: datesDescription || undefined,
      qty: props.sessionCount,
      unitPrice: tuitionUnit,
      amount: tuitionAmount,
    });
  }
  if (registrationFee > 0) {
    lineItems.push({
      key: "registration",
      description: REGISTRATION_FEE_DESCRIPTION,
      qty: 1,
      unitPrice: registrationFee,
      amount: registrationFee,
    });
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            {BUSINESS.addressLines.map((line) => (
              <Text key={line} style={styles.companyLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.companyLine}>{BUSINESS.email}</Text>
            <Text style={styles.companyLine}>{BUSINESS.phone}</Text>
          </View>
          <Image src={props.logoSrc} style={styles.logo} />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaColLeft}>
            <Text style={styles.blockTitleAccent}>RECEIVED FROM</Text>
            <Text style={styles.partyName}>{props.studentName}</Text>
          </View>
          <View style={styles.metaColRight}>
            <Text style={styles.blockTitleAccent}>RECEIPT</Text>
            <Text style={styles.paidBadge}>PAID</Text>
            <MetaRow label="Receipt no." value={props.receiptNumber} />
            <MetaRow label="Paid on" value={props.paidAt} />
            <MetaRow label="Invoice no." value={props.invoiceNumber} />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.cell, TABLE_COL.product]}>
              <Text style={styles.th}>Product</Text>
            </View>
            <View style={styles.colDivider} />
            <View style={[styles.cell, styles.cellNumeric, TABLE_COL.qty]}>
              <Text style={styles.th}>Qty</Text>
            </View>
            <View style={styles.colDivider} />
            <View style={[styles.cell, styles.cellNumeric, TABLE_COL.unit]}>
              <Text style={styles.th}>Unit price</Text>
            </View>
            <View style={styles.colDivider} />
            <View style={[styles.cell, styles.cellNumeric, TABLE_COL.amount]}>
              <Text style={styles.th}>Amount</Text>
            </View>
          </View>
          {lineItems.map((item, index) => (
            <ReceiptTableRow
              key={item.key}
              item={item}
              last={index === lineItems.length - 1}
            />
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRowFinal}>
              <Text style={styles.totalLabel}>Amount received</Text>
              <Text style={styles.totalValue}>{formatMoney(props.amount)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
