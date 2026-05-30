import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { BUSINESS, PAYMENT } from "@/lib/config";
import {
  formatInvoiceProduct,
  formatMoney,
  formatSessionDatesDescription,
} from "@/lib/pdf/format";
import { REGISTRATION_FEE_DESCRIPTION } from "@/lib/billing/registration-fee";
import { PDF_FONT_FAMILY } from "@/lib/pdf/fonts";
import { PaynowCard } from "@/lib/pdf/paynow-card";
import { TABLE_COL } from "@/lib/pdf/table-columns";
import type { BillableSession } from "@/lib/types";

export type InvoiceLineItem = {
  key: string;
  description: string;
  detail?: string;
  qty: number;
  unitPrice: number;
  amount: number;
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
  metaColBillTo: { flex: 1, paddingRight: 24 },
  metaColInvoice: {
    width: 188,
    marginLeft: "auto",
    alignSelf: "flex-end",
  },
  blockTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  blockTitleAccent: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.5,
    color: "#ea580c",
  },
  billToName: { fontSize: 10, lineHeight: 1.45 },
  invoiceMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  invoiceMetaLabel: { fontSize: 9, color: "#525252" },
  invoiceMetaValue: { fontSize: 9, textAlign: "right" },
  table: {
    borderWidth: 1,
    borderColor: "#171717",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#fff7ed",
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "#171717",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
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
    marginBottom: 28,
  },
  totalsBox: {
    width: 220,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff7ed",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#f97316",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalRowLabel: { fontSize: 9, color: "#525252" },
  totalRowValue: { fontSize: 9, color: "#171717" },
  discountValue: { fontSize: 9, color: "#16a34a" },
  totalRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#fdba74",
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: { fontSize: 11, fontWeight: "bold", color: "#ea580c" },
  totalValue: { fontSize: 14, fontWeight: "bold", color: "#ea580c" },
  paymentSection: { marginTop: 4 },
  paymentBlockTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.5,
    color: "#ea580c",
  },
  paymentColumns: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  paymentLeft: { flex: 1, paddingRight: 16 },
  paymentSubTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 5,
    letterSpacing: 0.3,
  },
  bankBlock: { marginTop: 6 },
  paymentLine: {
    fontSize: 9,
    color: "#404040",
    marginBottom: 3,
    lineHeight: 1.45,
  },
});

function InvoiceMetaRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.invoiceMetaRow}>
      <Text style={styles.invoiceMetaLabel}>{label}</Text>
      <Text style={styles.invoiceMetaValue}>{value}</Text>
    </View>
  );
}

export type InvoicePdfProps = {
  logoSrc: string;
  paynowQrPlaceholderSrc: string;
  invoiceNumber: string;
  studentName: string;
  level: string;
  dayLabel: string;
  sessions: BillableSession[];
  sessionCount: number;
  ratePerSession: number;
  registrationFee?: number;
  amount: number;
  /** Full price before discount (optional; shown when discount > 0). */
  subtotal?: number;
  /** Dollars off subtotal (optional). */
  discount?: number;
  issuedAt: string;
  dueAt: string;
};

function TotalsLine({
  label,
  value,
  discount,
}: {
  label: string;
  value: string;
  discount?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalRowLabel}>{label}</Text>
      <Text style={discount ? styles.discountValue : styles.totalRowValue}>
        {value}
      </Text>
    </View>
  );
}

function InvoiceTableRow({
  item,
  last,
}: {
  item: InvoiceLineItem;
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
      <View
        style={[styles.cell, styles.cellNumeric, TABLE_COL.amount]}
      >
        <Text style={styles.td}>{formatMoney(item.amount)}</Text>
      </View>
    </View>
  );
}

export function InvoiceDocument(props: InvoicePdfProps) {
  const product = formatInvoiceProduct(props.level, props.dayLabel);
  const datesDescription = formatSessionDatesDescription(props.sessions);
  const { bank } = PAYMENT;
  const discount = props.discount ?? 0;
  const showDiscount = discount > 0.005;
  const subtotal = props.subtotal ?? props.amount;
  const totalDue = props.amount;
  const registrationFee = props.registrationFee ?? 0;
  const tuitionAmount = Math.round((totalDue - registrationFee) * 100) / 100;
  const tuitionUnit =
    props.sessionCount > 0
      ? Math.round((tuitionAmount / props.sessionCount) * 100) / 100
      : props.ratePerSession;

  const lineItems: InvoiceLineItem[] = [];
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
          <View style={styles.metaColBillTo}>
            <Text style={styles.blockTitleAccent}>BILL TO</Text>
            <Text style={styles.billToName}>{props.studentName}</Text>
          </View>
          <View style={styles.metaColInvoice}>
            <Text style={styles.blockTitleAccent}>INVOICE</Text>
            <InvoiceMetaRow label="Invoice no." value={props.invoiceNumber} />
            <InvoiceMetaRow label="Issue date" value={props.issuedAt} />
            <InvoiceMetaRow label="Due date" value={props.dueAt} />
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
            <InvoiceTableRow
              key={item.key}
              item={item}
              last={index === lineItems.length - 1}
            />
          ))}
        </View>

        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            {showDiscount ? (
              <>
                <TotalsLine label="Subtotal" value={formatMoney(subtotal)} />
                <TotalsLine
                  label="Discount"
                  value={`-${formatMoney(discount)}`}
                  discount
                />
              </>
            ) : null}
            <View
              style={[
                styles.totalRowFinal,
                !showDiscount ? { borderTopWidth: 0, marginTop: 0, paddingTop: 0 } : {},
              ]}
            >
              <Text style={styles.totalLabel}>Total due</Text>
              <Text style={styles.totalValue}>{formatMoney(totalDue)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.paymentBlockTitle}>PAYMENT METHODS</Text>

          <View style={styles.paymentColumns}>
            <View style={styles.paymentLeft}>
              <Text style={styles.paymentSubTitle}>PAYNOW</Text>
              <Text style={styles.paymentLine}>
                PayNow to UEN: {PAYMENT.paynowUen}
              </Text>

              <View style={styles.bankBlock}>
                <Text style={styles.paymentSubTitle}>BANK TRANSFER</Text>
                <Text style={styles.paymentLine}>Bank name: {bank.name}</Text>
                <Text style={styles.paymentLine}>SWIFT / BIC: {bank.swift}</Text>
                <Text style={styles.paymentLine}>
                  Account type: {bank.accountType}
                </Text>
                <Text style={styles.paymentLine}>Branch: {bank.branch}</Text>
                <Text style={styles.paymentLine}>
                  Account name: {bank.accountName}
                </Text>
                <Text style={styles.paymentLine}>
                  Account no.: {bank.accountNumber}
                </Text>
              </View>
            </View>

            <PaynowCard qrPlaceholderSrc={props.paynowQrPlaceholderSrc} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
