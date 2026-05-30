import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

/** PayNow brand purple (matches logo). */
export const PAYNOW_PURPLE = "#60228C";

const styles = StyleSheet.create({
  card: {
    width: 112,
    borderWidth: 2,
    borderColor: PAYNOW_PURPLE,
    borderRadius: 6,
  },
  header: {
    backgroundColor: PAYNOW_PURPLE,
    paddingVertical: 6,
    alignItems: "center",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  headerText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  body: {
    backgroundColor: "#ffffff",
    padding: 6,
    alignItems: "center",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  qr: {
    width: 96,
    height: 96,
  },
});

export function PaynowCard({ qrPlaceholderSrc }: { qrPlaceholderSrc: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>PAYNOW</Text>
      </View>
      <View style={styles.body}>
        <Image src={qrPlaceholderSrc} style={styles.qr} />
      </View>
    </View>
  );
}
