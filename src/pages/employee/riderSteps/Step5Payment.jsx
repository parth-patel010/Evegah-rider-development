// Step 5 — Payment & Charges.
//
// Visual layout matches the agreed mockup (Payment Method tiles, Payment
// Summary, Apply Coupon, Charges Breakdown) while preserving the existing
// submission logic (ICICI QR + status polling, receipt PDF, WhatsApp).

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Send } from "lucide-react";

import { useRiderForm } from "../useRiderForm";
import { apiFetch, getPublicConfig } from "../../../config/api";
import { downloadRiderReceiptPdf } from "../../../utils/riderReceiptPdf";
import useAuth from "../../../hooks/useAuth";
import PaymentChargesView, { formatINR } from "../../../components/payment/PaymentChargesView";

// UI method → backend paymentMode.
const METHOD_TO_MODE = {
  upi: "online",
  card: "online",
  wallet: "online",
  cash: "cash",
};

const MODE_TO_METHOD = {
  online: "upi",
  cash: "cash",
  split: "upi",
};

export default function Step5Payment() {
  const { formData, updateForm, resetForm } = useRiderForm();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [formSnapshot, setFormSnapshot] = useState(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppStatus, setWhatsAppStatus] = useState("");
  const [whatsAppFallback, setWhatsAppFallback] = useState(null);

  const [publicConfig, setPublicConfig] = useState({ upiId: null, payeeName: "Evegah" });
  useEffect(() => {
    getPublicConfig().then(setPublicConfig);
  }, []);

  // ----- ICICI / UPI configuration --------------------------------------
  const configuredUpiId = import.meta.env.VITE_EVEGAH_UPI_ID || publicConfig.upiId;
  const defaultUpiId = "temp.evegah@okaxis";
  const payeeName = import.meta.env.VITE_EVEGAH_PAYEE_NAME || publicConfig.payeeName || "Evegah";
  const iciciEnabled =
    String(import.meta.env.VITE_ICICI_ENABLED || "")
      .trim()
      .replace(/^"+|"+$/g, "")
      .toLowerCase() === "true";

  // ----- Local UI state -------------------------------------------------
  const [paymentMethod, setPaymentMethod] = useState(
    () => MODE_TO_METHOD[formData?.paymentMode || ""] || "upi"
  );
  const [methodInput, setMethodInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState(null);
  const [discount, setDiscount] = useState(0);

  // Sync method change back into formData (so existing handlers/effects keep
  // working). UPI/Card/Wallet → online, Cash → cash.
  useEffect(() => {
    const mode = METHOD_TO_MODE[paymentMethod] || "cash";
    const total = Number(formData.totalAmount || 0);
    const next = {
      paymentMode: mode,
      cashAmount: mode === "cash" ? total : 0,
      onlineAmount: mode === "online" ? total : 0,
    };
    // Only patch if something actually changed.
    if (
      formData.paymentMode !== next.paymentMode ||
      Number(formData.cashAmount || 0) !== next.cashAmount ||
      Number(formData.onlineAmount || 0) !== next.onlineAmount
    ) {
      updateForm(next);
    }
  }, [paymentMethod, formData.totalAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Money derivations ----------------------------------------------
  const planAmount = Number(formData.rentalAmount || 0);
  const depositAmount = Number(formData.securityDeposit || 0);
  const accessoriesAmount = useMemo(() => {
    const list = Array.isArray(formData.accessories) ? formData.accessories : [];
    return list.reduce((sum, a) => sum + Number(a?.price || a?.amount || 0), 0);
  }, [formData.accessories]);
  const gstAmount = Number(
    formData.gstAmount != null
      ? formData.gstAmount
      : ((planAmount + accessoriesAmount) * 0.18).toFixed(2)
  );

  const computedTotal = planAmount + depositAmount + accessoriesAmount + gstAmount - Number(discount || 0);
  const totalAmount = Number(formData.totalAmount || computedTotal);

  // Keep formData.totalAmount in sync when our derived total changes.
  useEffect(() => {
    if (Number(formData.totalAmount || 0) !== Number(computedTotal)) {
      updateForm({ totalAmount: Number(computedTotal) });
    }
  }, [computedTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const paymentMode = formData.paymentMode || "cash";
  const cashAmount = Number(formData.cashAmount || 0);
  const onlineAmount = Number(formData.onlineAmount || 0);
  const totalPaid = cashAmount + onlineAmount;

  // For QR generation
  const qrAmount = paymentMode === "online" ? totalAmount : 0;
  const shouldShowQR = paymentMethod === "upi" && qrAmount > 0;

  const [iciciQrData, setIciciQrData] = useState(null);
  const [iciciQrLoading, setIciciQrLoading] = useState(false);
  const [iciciQrError, setIciciQrError] = useState("");
  const lastQrRequestKeyRef = useRef("");

  const iciciMerchantTranId = useMemo(() => {
    const v =
      formData?.iciciMerchantTranId ||
      formData?.merchantTranId ||
      iciciQrData?.merchantTranId ||
      iciciQrData?.merchant_tran_id ||
      null;
    const s = String(v || "").trim();
    return s || null;
  }, [formData?.iciciMerchantTranId, formData?.merchantTranId, iciciQrData]);

  const [iciciTxnStatus, setIciciTxnStatus] = useState("");
  const [iciciTxnError, setIciciTxnError] = useState("");
  const [iciciTxnVerified, setIciciTxnVerified] = useState(false);

  // ----- Method input "verification" ------------------------------------
  // For UPI we treat any "name@handle" pattern as verified. For Card we
  // accept any 12+ digit numeric. Wallet accepts a 10-digit phone. Cash is
  // implicitly verified.
  const methodVerified = useMemo(() => {
    if (paymentMethod === "cash") return true;
    const v = String(methodInput || "").trim();
    if (!v) return false;
    if (paymentMethod === "upi") return /^[\w.-]{2,}@[a-zA-Z]{2,}/.test(v);
    if (paymentMethod === "card") return v.replace(/\D/g, "").length >= 12;
    if (paymentMethod === "wallet") return v.replace(/\D/g, "").length === 10;
    return false;
  }, [paymentMethod, methodInput]);

  // ----- Coupon ---------------------------------------------------------
  const handleApplyCoupon = () => {
    const code = String(couponCode || "").trim().toUpperCase();
    if (!code) {
      setCouponStatus(null);
      setDiscount(0);
      return;
    }
    // Demo coupons. Replace with a real API later.
    if (code === "EVE10") {
      const value = Math.round((planAmount + accessoriesAmount) * 0.1);
      setDiscount(value);
      setCouponStatus({ type: "success", message: `Coupon applied — saved ${formatINR(value)}` });
    } else if (code === "FLAT50") {
      setDiscount(50);
      setCouponStatus({ type: "success", message: "Coupon applied — saved ₹50.00" });
    } else {
      setDiscount(0);
      setCouponStatus({ type: "error", message: "Invalid coupon code." });
    }
  };

  // ----- ICICI QR (only when ICICI is enabled and UPI is selected) ------
  const effectiveUpiId = configuredUpiId || defaultUpiId;
  const upiPayload = useMemo(() => {
    if (!effectiveUpiId || !shouldShowQR || !qrAmount) return "";
    const params = new URLSearchParams({
      pa: effectiveUpiId,
      pn: payeeName,
      am: String(qrAmount),
      cu: "INR",
    });
    return `upi://pay?${params.toString()}`;
  }, [effectiveUpiId, payeeName, qrAmount, shouldShowQR]);

  useEffect(() => {
    if (!iciciEnabled || !shouldShowQR || !qrAmount || !formData.name) {
      setIciciQrData(null);
      setIciciQrError("");
      lastQrRequestKeyRef.current = "";
      return;
    }

    const requestKey = `${String(formData.name).trim().toLowerCase()}|${Number(qrAmount).toFixed(2)}|${paymentMode}`;
    if (lastQrRequestKeyRef.current === requestKey) return;
    lastQrRequestKeyRef.current = requestKey;

    let cancelled = false;
    const generateQr = async () => {
      setIciciQrLoading(true);
      setIciciQrError("");
      try {
        const response = await apiFetch("/api/payments/icici/qr", {
          method: "POST",
          body: {
            amount: qrAmount,
            merchantTranId: `EVG${Date.now()}${Math.random().toString(16).slice(2, 6)}`.slice(0, 35),
            billNumber: `EVG-${Date.now()}`.slice(0, 50),
          },
        });
        if (!cancelled) {
          setIciciQrData(response);
          const nextMerchantTranId = String(response?.merchantTranId || response?.merchant_tran_id || "").trim();
          const nextPaymentTransactionId = String(response?.paymentTransactionId || response?.payment_transaction_id || "").trim();
          updateForm({
            ...(nextMerchantTranId ? { iciciMerchantTranId: nextMerchantTranId, merchantTranId: nextMerchantTranId } : {}),
            ...(nextPaymentTransactionId ? { paymentTransactionId: nextPaymentTransactionId } : {}),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setIciciQrError(String(error?.message || error));
          lastQrRequestKeyRef.current = "";
        }
      } finally {
        if (!cancelled) setIciciQrLoading(false);
      }
    };
    generateQr();
    return () => {
      cancelled = true;
    };
  }, [iciciEnabled, shouldShowQR, qrAmount, formData.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll ICICI status for auto-detection.
  useEffect(() => {
    if (!iciciEnabled || !shouldShowQR) {
      setIciciTxnStatus("");
      setIciciTxnError("");
      setIciciTxnVerified(false);
      return;
    }
    if (!iciciMerchantTranId || completed || paymentMode === "cash") {
      setIciciTxnStatus("");
      setIciciTxnError("");
      setIciciTxnVerified(false);
      return;
    }

    let cancelled = false;
    let intervalId = null;
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      attempts += 1;
      try {
        const decoded = await apiFetch("/api/payments/icici/status", {
          method: "POST",
          body: { merchantTranId: iciciMerchantTranId },
        });
        const raw = String(decoded?.status || decoded?.Status || "").trim();
        const next = raw ? raw.toUpperCase() : "";
        if (!cancelled) {
          setIciciTxnStatus(next);
          setIciciTxnError("");
        }
        if (next === "SUCCESS") {
          if (!cancelled) setIciciTxnVerified(true);
          if (intervalId) window.clearInterval(intervalId);
        } else if (next === "FAILURE" || next === "FAILED" || attempts >= maxAttempts) {
          if (intervalId) window.clearInterval(intervalId);
        }
      } catch (e) {
        if (!cancelled) setIciciTxnError(String(e?.message || e || "Unable to check payment status"));
      }
    };
    poll();
    intervalId = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [iciciEnabled, shouldShowQR, iciciMerchantTranId, completed, paymentMode]);

  // ----- Submission ------------------------------------------------------
  const prepareDocumentForSubmission = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      if (value.upload) return value.upload;
      if (value.url && value.file_name && value.mime_type) {
        return {
          url: value.url,
          file_name: value.file_name,
          mime_type: value.mime_type,
          size_bytes: Number(value.size_bytes ?? 0),
        };
      }
      if (value.dataUrl) {
        const next = { dataUrl: value.dataUrl };
        if (value.name) next.name = value.name;
        return next;
      }
    }
    return null;
  };

  const buildReceiptPayload = (snapshot) => ({
    fullName: snapshot?.fullName || snapshot?.name || "",
    name: snapshot?.name || snapshot?.fullName || "",
    phone: snapshot?.phone || "",
    mobile: snapshot?.mobile || snapshot?.phone || "",
    aadhaar: snapshot?.aadhaar || "",
    dob: snapshot?.dob || null,
    gender: snapshot?.gender || "",
    reference: snapshot?.reference || "",
    permanentAddress: snapshot?.permanentAddress || "",
    temporaryAddress: snapshot?.temporaryAddress || "",
    operationalZone: snapshot?.operationalZone || snapshot?.zone || "",
    agreementAccepted: Boolean(snapshot?.agreementAccepted),
    agreementDate: snapshot?.agreementDate || null,
    issuedByName: snapshot?.issuedByName || null,
    rentalStart: snapshot?.rentalStart || null,
    rentalEnd: snapshot?.rentalEnd || null,
    rentalPackage: snapshot?.rentalPackage || null,
    bikeModel: snapshot?.bikeModel || null,
    bikeId: snapshot?.bikeId || null,
    batteryId: snapshot?.batteryId || null,
    vehicleNumber: snapshot?.vehicleNumber || snapshot?.bikeId || null,
    accessories: Array.isArray(snapshot?.accessories) ? snapshot.accessories : [],
    otherAccessories: snapshot?.otherAccessories || null,
    paymentMode: snapshot?.paymentMode || null,
    rentalAmount: snapshot?.rentalAmount ?? null,
    securityDeposit: snapshot?.securityDeposit ?? null,
    totalAmount: snapshot?.totalAmount ?? null,
    amountPaid: snapshot?.amountPaid ?? snapshot?.paidAmount ?? snapshot?.totalAmount ?? null,
    riderSignature: typeof snapshot?.riderSignature === "string" ? snapshot.riderSignature : null,
  });

  const handleSubmit = async () => {
    setSubmitError("");
    setWhatsAppStatus("");

    if (!methodVerified) {
      setSubmitError("Please verify your payment method before continuing.");
      return;
    }
    if (totalPaid !== totalAmount) {
      // Auto-rebalance once: derive cash/online from the chosen method.
      const mode = METHOD_TO_MODE[paymentMethod] || "cash";
      updateForm({
        cashAmount: mode === "cash" ? totalAmount : 0,
        onlineAmount: mode === "online" ? totalAmount : 0,
      });
    }

    if (iciciEnabled && paymentMode !== "cash") {
      if (!iciciMerchantTranId) {
        setSubmitError("Payment reference not found. Please re-generate the QR and complete payment.");
        return;
      }
      if (!iciciTxnVerified) {
        try {
          const decoded = await apiFetch("/api/payments/icici/status", {
            method: "POST",
            body: { merchantTranId: iciciMerchantTranId },
          });
          const next = String(decoded?.status || decoded?.Status || "").trim().toUpperCase();
          setIciciTxnStatus(next);
          if (next !== "SUCCESS") {
            setSubmitError(`Payment not completed. Current status: ${next || "PENDING"}.`);
            return;
          }
          setIciciTxnVerified(true);
        } catch (e) {
          setSubmitError(String(e?.message || e || "Unable to verify payment. Please try again."));
          return;
        }
      }
    }

    const riderPhotoPayload = prepareDocumentForSubmission(formData.riderPhoto);
    const governmentIdPayload = prepareDocumentForSubmission(formData.governmentId);
    const preRidePayloads = (Array.isArray(formData.preRidePhotos) ? formData.preRidePhotos : [])
      .map(prepareDocumentForSubmission)
      .filter(Boolean);

    const fullName = String(formData.name || "").trim();
    const phoneDigits = String(formData.phone || "").replace(/\D/g, "").slice(0, 10);
    const aadhaarDigits = String(formData.aadhaar || "").replace(/\D/g, "").slice(0, 12);

    if (!fullName) return setSubmitError("Rider name is required.");
    if (phoneDigits.length !== 10) return setSubmitError("Valid 10-digit mobile number is required.");
    if (!formData.rentalStart) return setSubmitError("Rental start date & time is required.");

    setSubmitting(true);
    try {
      const snapshot =
        typeof structuredClone === "function"
          ? structuredClone(formData)
          : JSON.parse(JSON.stringify(formData));

      const merchantTranIdSubmit =
        iciciEnabled && paymentMode !== "cash"
          ? formData?.iciciMerchantTranId ||
            formData?.merchantTranId ||
            iciciQrData?.merchantTranId ||
            iciciQrData?.merchant_tran_id ||
            null
          : null;
      const paymentTransactionIdSubmit =
        iciciEnabled && paymentMode !== "cash"
          ? iciciQrData?.paymentTransactionId || iciciQrData?.payment_transaction_id || null
          : null;

      const startIso = new Date(formData.rentalStart).toISOString();
      const endIso = formData.rentalEnd ? new Date(formData.rentalEnd).toISOString() : null;
      const vehicleNumber = String(formData.vehicleNumber || formData.bikeId || "").trim() || null;

      const registrationResp = await apiFetch("/api/registrations/new-rider", {
        method: "POST",
        body: {
          rider: {
            full_name: fullName,
            mobile: phoneDigits,
            aadhaar: aadhaarDigits || null,
            dob: formData.dob ? String(formData.dob).slice(0, 10) : null,
            gender: formData.gender || null,
            permanent_address: formData.permanentAddress || null,
            temporary_address: formData.temporaryAddress || null,
            reference: formData.reference || null,
            meta: {
              aadhaar_verified: Boolean(formData.aadhaarVerified),
              aadhaar_verification_method: formData.aadhaarVerified ? "otp" : null,
              kyc_mode: formData.kycMode || null,
              kyc_deferred: Boolean(formData.kycDeferred),
            },
          },
          rental: {
            start_time: startIso,
            end_time: endIso,
            rental_package: formData.rentalPackage || null,
            rental_amount: planAmount,
            deposit_amount: depositAmount,
            total_amount: totalAmount,
            payment_mode: paymentMode || null,
            bike_model: formData.bikeModel || null,
            bike_id: formData.bikeId || null,
            battery_id: formData.batteryId || null,
            vehicle_number: vehicleNumber,
            accessories: Array.isArray(formData.accessories) ? formData.accessories : [],
            other_accessories: formData.otherAccessories || null,
            meta: {
              zone: formData.operationalZone || null,
              agreement_accepted: Boolean(formData.agreementAccepted),
              agreement_confirm_info: Boolean(formData.agreementConfirmInfo),
              agreement_accept_terms: Boolean(formData.agreementAcceptTerms),
              agreement_date: formData.agreementDate || null,
              issued_by_name: formData.issuedByName || null,
              employee_uid: user?.uid || null,
              employee_email: user?.email || null,
              ...(merchantTranIdSubmit
                ? { iciciMerchantTranId: merchantTranIdSubmit, merchantTranId: merchantTranIdSubmit }
                : {}),
              ...(paymentTransactionIdSubmit ? { paymentTransactionId: paymentTransactionIdSubmit } : {}),
              payment_method: paymentMethod,
              coupon_code: couponCode && couponStatus?.type === "success" ? couponCode : null,
              discount_applied: Number(discount || 0),
              paymentBreakdown: { cash: cashAmount, online: onlineAmount },
            },
          },
          documents: {
            riderPhoto: riderPhotoPayload,
            governmentId: governmentIdPayload,
            preRidePhotos: preRidePayloads,
            riderSignature: formData.riderSignature || null,
          },
        },
      });

      setRegistration(registrationResp);
      setFormSnapshot(snapshot);
      setCompleted(true);
    } catch (e) {
      setSubmitError(String(e?.message || e || "Unable to complete registration"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = async () => {
    setWhatsAppStatus("");
    setWhatsAppFallback(null);
    try {
      const snapshot = formSnapshot || formData;
      await downloadRiderReceiptPdf({ formData: buildReceiptPayload(snapshot), registration });
    } catch (e) {
      setWhatsAppStatus(e?.message ? `Unable to generate receipt: ${e.message}` : "Unable to generate receipt.");
    }
  };

  const handleSendWhatsApp = async () => {
    setWhatsAppStatus("");
    setWhatsAppFallback(null);
    const snapshot = formSnapshot || formData;
    const phoneDigits = String(snapshot?.phone || "").replace(/\D/g, "").slice(0, 10);
    if (phoneDigits.length !== 10) {
      setWhatsAppStatus("Valid 10-digit mobile number is required.");
      return;
    }
    const receiptPayload = buildReceiptPayload(snapshot);
    setSendingWhatsApp(true);
    try {
      const res = await apiFetch("/api/whatsapp/send-receipt", {
        method: "POST",
        body: { to: phoneDigits, formData: receiptPayload, registration },
      });
      if (res?.sent) {
        setWhatsAppStatus("Receipt sent successfully.");
      } else if (res?.mediaUrl) {
        setWhatsAppFallback({ phoneDigits, mediaUrl: res.mediaUrl });
        setWhatsAppStatus(String(res?.reason || res?.error || "Unable to send via WhatsApp Cloud API."));
      } else {
        setWhatsAppStatus(String(res?.reason || res?.error || "Unable to send receipt on WhatsApp."));
      }
    } catch (e) {
      setWhatsAppStatus(String(e?.message || e || "Unable to send on WhatsApp"));
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleNewRegistration = () => {
    setCompleted(false);
    setRegistration(null);
    setFormSnapshot(null);
    setWhatsAppStatus("");
    setWhatsAppFallback(null);
    resetForm();
    navigate("/employee/new-rider/step-1", { replace: true });
  };

  const openManualWhatsApp = () => {
    if (!whatsAppFallback?.phoneDigits || !whatsAppFallback?.mediaUrl) return;
    const text = encodeURIComponent(`EVegah Receipt (PDF): ${whatsAppFallback.mediaUrl}`);
    window.open(`https://wa.me/91${whatsAppFallback.phoneDigits}?text=${text}`, "_self");
  };

  // ---------------------------------------------------------------------
  // QR slot used inside PaymentChargesView when UPI is selected.
  // ---------------------------------------------------------------------
  const renderQrSlot = () => {
    if (paymentMethod !== "upi" || qrAmount <= 0) return null;
    return (
      <div className="rounded-2xl border border-evegah-border bg-white p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="rounded-xl border border-evegah-border bg-white p-2 grid place-items-center">
          {iciciEnabled ? (
            <>
              {iciciQrLoading ? (
                <div className="h-44 w-44 grid place-items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-evegah-primary" />
                </div>
              ) : iciciQrData?.qrCode ? (
                <img
                  src={
                    iciciQrData.qrCode.startsWith("data:") || iciciQrData.qrCode.startsWith("http")
                      ? iciciQrData.qrCode
                      : `data:image/png;base64,${iciciQrData.qrCode}`
                  }
                  alt="ICICI Payment QR"
                  className="h-44 w-44"
                />
              ) : iciciQrData?.qrString ? (
                <QRCodeCanvas value={iciciQrData.qrString} size={176} />
              ) : (
                <div className="h-44 w-44 grid place-items-center text-xs text-gray-500 text-center px-3">
                  {iciciQrError || "ICICI QR not available"}
                </div>
              )}
            </>
          ) : upiPayload ? (
            <QRCodeCanvas value={upiPayload} size={176} />
          ) : (
            <p className="text-xs text-rose-600 text-center max-w-[176px]">
              UPI is not configured.
            </p>
          )}
        </div>

        <div className="flex-1 min-w-0 text-sm">
          <p className="font-semibold text-evegah-text">Scan to pay {formatINR(qrAmount)}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Open any UPI app (GPay, PhonePe, Paytm) and scan this code.
          </p>
          {iciciEnabled && iciciMerchantTranId ? (
            <p className="text-[11px] text-gray-500 mt-2">
              Status:{" "}
              {iciciTxnVerified ? (
                <span className="text-emerald-600 font-semibold">SUCCESS</span>
              ) : iciciTxnError ? (
                <span className="text-rose-600">{iciciTxnError}</span>
              ) : (
                <span>{iciciTxnStatus || "Waiting…"}</span>
              )}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // Post-submission success state
  // ---------------------------------------------------------------------
  if (completed) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <CheckCircle2 size={20} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Rider registered successfully.</p>
            <p className="text-xs text-emerald-700/90 mt-1">
              You can now download the receipt or send it on WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="inline-flex items-center gap-2 rounded-xl border border-evegah-border bg-white px-4 py-2.5 text-sm font-semibold text-evegah-text hover:bg-gray-50"
          >
            <Download size={14} /> Download Receipt (PDF)
          </button>
          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={sendingWhatsApp}
            className="inline-flex items-center gap-2 rounded-xl bg-evegah-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
          >
            <Send size={14} /> {sendingWhatsApp ? "Sending…" : "Send on WhatsApp"}
          </button>
          <button
            type="button"
            onClick={handleNewRegistration}
            className="inline-flex items-center gap-2 rounded-xl border border-evegah-border bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            New Registration
          </button>
        </div>

        {whatsAppStatus ? (
          <p
            className={`text-sm ${
              whatsAppStatus.toLowerCase().includes("sent") || whatsAppStatus.toLowerCase().includes("opened")
                ? "text-emerald-700"
                : "text-rose-600"
            }`}
          >
            {whatsAppStatus}
          </p>
        ) : null}

        {whatsAppFallback?.mediaUrl ? (
          <div className="rounded-xl border border-evegah-border bg-gray-50 p-3 text-sm text-evegah-text">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-gray-600 break-all">Manual link: {whatsAppFallback.mediaUrl}</span>
              <button
                type="button"
                onClick={openManualWhatsApp}
                className="rounded-xl border border-evegah-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
              >
                Open WhatsApp (manual)
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Pre-submission UI — matches the agreed mockup
  // ---------------------------------------------------------------------
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 -mt-3">
        Collect payment and review applicable charges.
      </p>

      <PaymentChargesView
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        methodInputValue={methodInput}
        onMethodInputChange={setMethodInput}
        methodVerified={methodVerified}
        summary={{
          plan: planAmount,
          deposit: depositAmount,
          accessories: accessoriesAmount,
          gst: gstAmount,
          total: totalAmount,
        }}
        breakdown={{
          plan: formData.rentalPackage
            ? `${formData.rentalPackage.replace(/^./, (c) => c.toUpperCase())} Plan`
            : "Daily Plan",
          vehicle: formData.bikeModel
            ? `Evegah ${formData.bikeModel}`
            : formData.bikeId
            ? formData.bikeId
            : "Evegah E1",
          battery: formData.batteryId ? formData.batteryId : "Evegah 60V 30Ah",
          planRate: formatINR(planAmount),
          expectedDuration: formData.rentalPackage
            ? `1 ${formData.rentalPackage.replace(/s$/, "")}`
            : "1 Day",
        }}
        includes={[
          "Unlimited kms",
          "Battery swap included",
          "Roadside assistance",
          "GST included",
        ]}
        couponCode={couponCode}
        onCouponCodeChange={setCouponCode}
        couponStatus={couponStatus}
        onApplyCoupon={handleApplyCoupon}
        qrSlot={renderQrSlot()}
      />

      {submitError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-2.5">
          {submitError}
        </div>
      ) : null}

      {/* Footer action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-evegah-border">
        <button
          type="button"
          onClick={() => navigate("../step-4")}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-evegah-border bg-white text-evegah-text px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
        >
          <ArrowLeft size={14} /> Previous
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            submitting ||
            !methodVerified ||
            (iciciEnabled && paymentMode !== "cash" && !iciciTxnVerified)
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-evegah-primary text-white px-5 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Complete Registration"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
