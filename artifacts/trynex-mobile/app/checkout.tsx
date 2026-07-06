import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";

const BD_DISTRICTS = [
  "Dhaka","Chittagong","Rajshahi","Khulna","Sylhet","Barisal","Rangpur","Mymensingh",
  "Comilla","Narayanganj","Gazipur","Narsingdi","Munshiganj","Manikganj","Tangail",
  "Faridpur","Sherpur","Jamalpur","Netrokona","Kishorganj","Brahmanbaria","Chandpur",
  "Lakshmipur","Feni","Noakhali","Cox's Bazar","Bandarban","Rangamati","Khagrachhari",
  "Jessore","Satkhira","Bagerhat","Narail","Magura","Jhenaidah","Kushtia","Meherpur",
  "Chuadanga","Pabna","Sirajganj","Bogra","Joypurhat","Chapainawabganj","Naogaon",
  "Natore","Rajshahi","Dinajpur","Thakurgaon","Panchagarh","Nilphamari","Lalmonirhat",
  "Kurigram","Gaibandha","Habiganj","Sunamganj","Moulvibazar","Pirojpur","Bhola",
  "Patuakhali","Barguna","Jhalokathi","Madaripur","Gopalganj","Shariatpur",
];

const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on Delivery", icon: "dollar-sign", desc: "Pay when you receive" },
  { value: "bkash", label: "bKash", icon: "smartphone", desc: "01XXXXXXXXX (Personal)" },
  { value: "nagad", label: "Nagad", icon: "smartphone", desc: "01XXXXXXXXX (Personal)" },
  { value: "bank", label: "Bank Transfer", icon: "credit-card", desc: "Contact us for details" },
];

function formatPrice(p: number) {
  return "৳" + p.toLocaleString("en-BD");
}

export default function CheckoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { items, subtotal, clearCart } = useCart();

  const [step, setStep] = useState<"details" | "payment" | "confirm" | "success">("details");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("Dhaka");
  const [thana, setThana] = useState("");
  const [notes, setNotes] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState("cod");

  const [createdOrder, setCreatedOrder] = useState<{ orderNumber: string; id: number } | null>(null);

  const shipping = subtotal > 1500 ? 0 : 60;
  const total = Math.max(0, subtotal + shipping - promoDiscount);

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await api.validatePromo(promoInput.trim(), total, email);
      if (res.valid) {
        setPromoApplied(res.code);
        setPromoDiscount(res.discount ?? 0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      setPromoError(err.message || "Invalid promo code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPromoLoading(false);
    }
  };

  const validateStep1 = () => {
    if (!name.trim()) { Alert.alert("Missing Info", "Please enter your full name"); return false; }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 10) { Alert.alert("Missing Info", "Please enter a valid phone number"); return false; }
    if (!address.trim()) { Alert.alert("Missing Info", "Please enter your delivery address"); return false; }
    return true;
  };

  const placeOrder = async () => {
    if (!validateStep1()) return;
    setLoading(true);
    try {
      const orderItems = items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        size: i.size,
        color: i.color,
        price: i.product.discountPrice ?? i.product.price,
        customNote: i.customNote,
      }));

      const res = await api.createOrder({
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        shippingAddress: address.trim(),
        shippingCity: thana.trim() || undefined,
        shippingDistrict: district,
        paymentMethod,
        notes: notes.trim() || undefined,
        promoCode: promoApplied || undefined,
        items: orderItems,
        subtotal,
        shippingCost: shipping,
        total,
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        source: "mobile",
      });

      setCreatedOrder({ orderNumber: res.order.orderNumber, id: res.order.id });
      clearCart();
      setStep("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Order Failed", err.message || "Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  if (step === "success" && createdOrder) {
    return (
      <View style={[styles.successContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="check-circle" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>Order Placed! 🎉</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Your order <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>#{createdOrder.orderNumber}</Text> has been placed successfully.
        </Text>
        <View style={[styles.successCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.successCardTitle, { color: colors.foreground }]}>What happens next?</Text>
          <View style={styles.successStep}>
            <Feather name="phone" size={16} color={colors.primary} />
            <Text style={[styles.successStepText, { color: colors.mutedForeground }]}>We'll call/SMS you within 2 hours to confirm</Text>
          </View>
          <View style={styles.successStep}>
            <Feather name="package" size={16} color={colors.primary} />
            <Text style={[styles.successStepText, { color: colors.mutedForeground }]}>Production starts after confirmation</Text>
          </View>
          <View style={styles.successStep}>
            <Feather name="truck" size={16} color={colors.primary} />
            <Text style={[styles.successStepText, { color: colors.mutedForeground }]}>Delivered within 24-48 hours</Text>
          </View>
        </View>
        <Pressable
          style={[styles.trackBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            router.replace("/(tabs)/orders");
          }}
        >
          <Feather name="map-pin" size={18} color="#fff" />
          <Text style={styles.trackBtnText}>Track My Order</Text>
        </Pressable>
        <Pressable
          style={[styles.homeBtn, { borderColor: colors.border }]}
          onPress={() => router.replace("/(tabs)/")}
        >
          <Text style={[styles.homeBtnText, { color: colors.foreground }]}>Continue Shopping</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: isWeb ? 20 : insets.top + 8, backgroundColor: colors.navy }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.stepBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {(["details", "payment", "confirm"] as const).map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, {
                backgroundColor: step === s ? colors.primary : (["details", "payment", "confirm"].indexOf(step) > i ? colors.primary : colors.border),
              }]}>
                <Text style={styles.stepDotText}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepLabel, { color: step === s ? colors.primary : colors.mutedForeground }]}>
                {s === "details" ? "Info" : s === "payment" ? "Payment" : "Review"}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {step === "details" && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Delivery Details</Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Full Name *</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ahmed Hasan"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Phone Number *</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="01XXXXXXXXX"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                returnKeyType="next"
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email (optional)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Street Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={address}
                onChangeText={setAddress}
                placeholder="House, Road, Area..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={2}
                returnKeyType="next"
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>District *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                  {["Dhaka", "Chittagong", "Rajshahi", "Sylhet", "Khulna", "Barisal", "Rangpur", "Mymensingh"].map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setDistrict(d)}
                      style={[styles.districtChip, {
                        backgroundColor: district === d ? colors.primary : colors.card,
                        borderColor: district === d ? colors.primary : colors.border,
                      }]}
                    >
                      <Text style={[styles.districtChipText, { color: district === d ? "#fff" : colors.foreground }]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={district}
                onChangeText={setDistrict}
                placeholder="Or type district..."
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Thana / Area</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={thana}
                onChangeText={setThana}
                placeholder="Thana or area name"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Order Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any special instructions..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={2}
              />

              <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>Promo / Referral Code</Text>
              <View style={styles.promoRow}>
                <TextInput
                  style={[styles.promoInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={promoInput}
                  onChangeText={setPromoInput}
                  placeholder="Enter code"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="characters"
                  editable={!promoApplied}
                />
                {promoApplied ? (
                  <Pressable
                    onPress={() => { setPromoApplied(null); setPromoDiscount(0); setPromoInput(""); setPromoError(null); }}
                    style={[styles.promoBtn, { backgroundColor: "#EF4444" }]}
                  >
                    <Feather name="x" size={16} color="#fff" />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={applyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    style={[styles.promoBtn, { backgroundColor: colors.primary, opacity: promoLoading || !promoInput.trim() ? 0.5 : 1 }]}
                  >
                    {promoLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.promoBtnText}>Apply</Text>
                    )}
                  </Pressable>
                )}
              </View>
              {promoApplied && (
                <Text style={{ color: "#22C55E", fontSize: 13, marginTop: 4, fontFamily: "Inter_600SemiBold" }}>
                  ✓ {promoApplied} — {formatPrice(promoDiscount)} off
                </Text>
              )}
              {promoError && (
                <Text style={{ color: "#EF4444", fontSize: 13, marginTop: 4, fontFamily: "Inter_400Regular" }}>{promoError}</Text>
              )}
            </View>
          )}

          {step === "payment" && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Payment Method</Text>
              {PAYMENT_METHODS.map((m) => (
                <Pressable
                  key={m.value}
                  onPress={() => { setPaymentMethod(m.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  style={[styles.paymentOption, {
                    backgroundColor: colors.card,
                    borderColor: paymentMethod === m.value ? colors.primary : colors.border,
                    borderWidth: paymentMethod === m.value ? 2 : 1,
                  }]}
                >
                  <View style={[styles.paymentIcon, { backgroundColor: paymentMethod === m.value ? colors.primary + "20" : colors.background }]}>
                    <Feather name={m.icon as any} size={20} color={paymentMethod === m.value ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentLabel, { color: colors.foreground }]}>{m.label}</Text>
                    <Text style={[styles.paymentDesc, { color: colors.mutedForeground }]}>{m.desc}</Text>
                  </View>
                  {paymentMethod === m.value && (
                    <Feather name="check-circle" size={20} color={colors.primary} />
                  )}
                </Pressable>
              ))}

              {paymentMethod !== "cod" && (
                <View style={[styles.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                  <Feather name="info" size={16} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.foreground }]}>
                    {paymentMethod === "bkash"
                      ? "Send payment to: 01903426915 (bKash Personal). Include your name in the reference."
                      : paymentMethod === "nagad"
                      ? "Send payment to: 01903426915 (Nagad Personal). Include your name in the reference."
                      : "Our team will contact you with bank details after order confirmation."}
                  </Text>
                </View>
              )}
            </View>
          )}

          {step === "confirm" && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Order Summary</Text>

              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Name</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Phone</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{phone}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Address</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground, flex: 1, textAlign: "right" }]}>{address}, {thana ? thana + ", " : ""}{district}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Payment</Text>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}</Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>Items ({items.length})</Text>
              {items.map((item) => (
                <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, { color: colors.foreground }]}>{item.product.name}</Text>
                    <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                      {[item.size, item.color].filter(Boolean).join(" · ")} × {item.quantity}
                    </Text>
                  </View>
                  <Text style={[styles.itemPrice, { color: colors.foreground }]}>
                    {formatPrice((item.product.discountPrice ?? item.product.price) * item.quantity)}
                  </Text>
                </View>
              ))}

              <View style={[styles.totalsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                  <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatPrice(subtotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Shipping</Text>
                  <Text style={[styles.totalValue, { color: shipping === 0 ? "#22C55E" : colors.foreground }]}>
                    {shipping === 0 ? "FREE" : formatPrice(shipping)}
                  </Text>
                </View>
                {promoDiscount > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: "#22C55E" }]}>Promo ({promoApplied})</Text>
                    <Text style={[styles.totalValue, { color: "#22C55E" }]}>-{formatPrice(promoDiscount)}</Text>
                  </View>
                )}
                <View style={[styles.totalRow, styles.grandTotal, { borderTopColor: colors.border }]}>
                  <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total</Text>
                  <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{formatPrice(total)}</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: isWeb ? 20 : insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {step !== "details" && (
            <Pressable
              onPress={() => setStep(step === "confirm" ? "payment" : "details")}
              style={[styles.backStepBtn, { borderColor: colors.border }]}
            >
              <Feather name="arrow-left" size={18} color={colors.foreground} />
              <Text style={[styles.backStepText, { color: colors.foreground }]}>Back</Text>
            </Pressable>
          )}

          {step === "details" && (
            <Pressable
              onPress={() => {
                if (!validateStep1()) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStep("payment");
              }}
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.nextBtnText}>Continue to Payment</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
          )}

          {step === "payment" && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setStep("confirm");
              }}
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.nextBtnText}>Review Order</Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
          )}

          {step === "confirm" && (
            <Pressable
              onPress={placeOrder}
              disabled={loading}
              style={[styles.nextBtn, { backgroundColor: "#22C55E", opacity: loading ? 0.7 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={styles.nextBtnText}>Place Order — {formatPrice(total)}</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  stepBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepDotText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  section: { padding: 16, gap: 4 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12, marginTop: 4 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  textArea: { minHeight: 72, textAlignVertical: "top", paddingTop: 10 },
  districtChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  districtChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  promoRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
  },
  promoBtn: {
    width: 72,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  promoBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  paymentIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  paymentLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  paymentDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoBox: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 8, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  summaryCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.07)" },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", maxWidth: "60%" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, gap: 8 },
  itemName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  itemMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  itemPrice: { fontSize: 14, fontFamily: "Inter_700Bold" },
  totalsCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  grandTotal: { borderTopWidth: 1, marginTop: 2 },
  grandTotalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  grandTotalValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
  },
  backStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  backStepText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  successIcon: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  successCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12, marginTop: 4 },
  successCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  successStep: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  successStepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    justifyContent: "center",
    marginTop: 8,
  },
  trackBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  homeBtn: {
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
    alignItems: "center",
  },
  homeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
