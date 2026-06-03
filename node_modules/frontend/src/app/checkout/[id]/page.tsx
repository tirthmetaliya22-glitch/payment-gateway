'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  QrCode,
  User,
  ShieldCheck,
  Smartphone,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { API_URL } from '@/lib/api';

const USER_QR_BASE64 = "data:image/png;base64,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";
const USER_QR_LINK = "https://payments-test.cashfree.com/pgbillpayuiapi/simulator/5114928318299?txnId=5114928318299&amount=5.00&pa=cashfree@testbank&pn=Cashfree&tr=5114928318299&am=5.00&cu=INR&mode=00&purpose=00&mc=5732&tn=Cashfree%20Simulator%20Payment";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(720); // 12:00 in seconds
  const [isCashfreeLoaded, setIsCashfreeLoaded] = useState(false);

  // Payment Data State
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate a unique 12-digit UPI transaction reference for Cashfree simulator to ensure the Submit button works correctly
  const [numericTxnId] = useState(() => {
    const part1 = Math.floor(100000 + Math.random() * 900000);
    const part2 = Math.floor(100000 + Math.random() * 900000);
    return `${part1}${part2}`;
  });

  const cleanAmountNum = paymentData ? parseFloat(paymentData.amount.replace(/[^0-9.]/g, '')) : NaN;
  const amountVal = isNaN(cleanAmountNum) ? "5.00" : cleanAmountNum.toFixed(2);
  const dynamicQrLink = `https://payments-test.cashfree.com/pgbillpayuiapi/simulator/${numericTxnId}?txnId=${numericTxnId}&amount=${amountVal}&pa=cashfree@testbank&pn=Cashfree&tr=${numericTxnId}&am=${amountVal}&cu=INR&mode=00&purpose=00&mc=5732&tn=${encodeURIComponent("Payment " + (paymentData?.id || ""))}`;

  useEffect(() => {
    fetchPaymentDetails();
  }, [params.id]);

  useEffect(() => {
    if (paymentData?.name) {
      document.title = `${paymentData.name} - Checkout`;
    }
  }, [paymentData]);

  // Socket.IO real-time payment status updates
  useEffect(() => {
    if (!params.id || !API_URL) return;

    const socket = io(API_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Checkout] Socket connected successfully');
    });

    socket.on('payment_update', (data: any) => {
      console.log('[Checkout] Received real-time update:', data);

      if (data.type === 'PAYMENT_PAID' && data.order_id === params.id) {
        console.log('[Checkout] Payment paid event received for current order!');

        setPaymentData((prev: any) => {
          if (!prev) return prev;

          const returnUrl = prev.return_url;
          if (returnUrl) {
            const finalUrl = returnUrl.replace('{order_id}', params.id as string);
            setTimeout(() => {
              window.location.href = finalUrl;
            }, 2000);
          }

          return {
            ...prev,
            status: data.status || 'Success'
          };
        });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Checkout] Socket connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [params.id]);

  const fetchPaymentDetails = async () => {
    if (!params.id) return;
    try {
      const res = await fetch(`${API_URL}/checkout/${params.id}`);
      if (!res.ok) throw new Error("Payment link not found");
      const data = await res.json();
      setPaymentData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load Cashfree SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => setIsCashfreeLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (!params.id || !paymentData?.creation_timestamp) return;

    const creationTime = paymentData.creation_timestamp * 1000;
    const expiryTime = creationTime + 12 * 60 * 1000;

    let timer: NodeJS.Timeout;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
      }
    };

    updateTimer();
    timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [params.id, paymentData?.creation_timestamp]);

  useEffect(() => {
    if (isCashfreeLoaded && (window as any).Cashfree && paymentData && paymentData.payment_session_id) {
      try {
        const cashfree = (window as any).Cashfree({
          mode: paymentData.cf_environment || "sandbox",
          paymentSessionId: paymentData.payment_session_id
        });

        const upiQr = cashfree.create('upiQr', {
          values: {
            size: "210px"
          }
        });
        upiQr.on('loaderror', function (data: any) {
          console.log("Cashfree Load Error:", data.error);
        });

        upiQr.mount("#mount-here");

        upiQr.on('ready', function (d: any) {
          console.log("Cashfree QR Ready:", upiQr.data().value);
        });
      } catch (err) {
        console.error("Cashfree initialization failed:", err);
      }
    }
  }, [isCashfreeLoaded, paymentData]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [utrValue, setUtrValue] = useState('');
  const [utrError, setUtrError] = useState(false);

  const handleUtrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 12) {
      setUtrValue(val);
      setUtrError(false);
    }
  };

  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleVerify = async () => {
    if (utrValue.length !== 12) {
      setUtrError(true);
      return;
    }

    setIsSubmittingUtr(true);
    try {
      const res = await fetch(`${API_URL}/merchant/verify-utr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr: utrValue, payment_id: params.id })
      });

      if (res.ok) {
        setShowToast(true);
        const submittedUtr = utrValue;
        setUtrValue('');

        setPaymentData((prev: any) => ({
          ...prev,
          utr_id: submittedUtr,
          status: 'Pending'
        }));

        const returnUrl = paymentData.return_url;
        if (returnUrl) {
          const finalUrl = returnUrl.replace('{order_id}', params.id as string);
          setTimeout(() => {
            window.location.href = finalUrl;
          }, 2000);
        } else {
          setTimeout(() => setShowToast(false), 3000);
        }
      } else {
        alert("Verification failed. Please try again.");
      }
    } catch (err) {
      console.error("UTR Verification Error:", err);
      setUtrValue('');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-sm font-bold text-muted">Loading Secure Checkout...</p>
      </div>
    );
  }

  if (error || !paymentData) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-secondary mb-2">Invalid Link</h2>
          <p className="text-sm text-muted mb-6">This payment link has expired or doesn't exist.</p>
          <button onClick={() => router.push('/')} className="w-full py-3 bg-primary text-white rounded-xl font-bold">Return Home</button>
        </div>
      </div>
    );
  }

  // If already paid or UTR submitted, show success page
  if (paymentData.utr_id || paymentData.status === 'Paid' || paymentData.status === 'Success') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[340px] bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2 border-4 border-green-100">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-secondary tracking-tight">Payment Received!</h2>
            <p className="text-sm text-muted mt-2 px-4 leading-relaxed">
              Your payment for <span className="font-bold text-secondary">{paymentData.name}</span> has been successfully submitted for verification.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between text-xs font-bold px-2">
              <span className="text-muted uppercase">Amount</span>
              <span className="text-secondary">{paymentData.amount}</span>
            </div>
            <div className="flex justify-between text-xs font-bold px-2">
              <span className="text-muted uppercase">UTR ID</span>
              <span className="text-secondary tracking-widest">{paymentData.utr_id}</span>
            </div>
            <div className="flex justify-between text-xs font-bold px-2">
              <span className="text-muted uppercase">Status</span>
              <span className="text-green-600 uppercase tracking-widest bg-green-100 px-2 py-0.5 rounded text-[10px]">Processing</span>
            </div>
          </div>
          <div className="pt-4">
            <button
              onClick={() => {
                if (paymentData.return_url) {
                  window.location.href = paymentData.return_url.replace('{order_id}', params.id as string);
                } else {
                  router.push('/merchant/payments');
                }
              }}
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]"
            >
              Continue to Merchant
            </button>
          </div>
          <p className="text-[10px] text-muted font-medium">Redirecting you in a few seconds...</p>
        </div>
      </div>
    );
  }

  const payerName = paymentData.name;
  const displayNum = parseFloat(paymentData.amount.replace(/[^0-9.]/g, ''));
  const amount = isNaN(displayNum) ? "5.00" : displayNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-8 relative">
      {/* Full-Page Verification Loader */}
      {isSubmittingUtr && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white/10 p-8 rounded-[2rem] border border-white/20 flex flex-col items-center gap-4 text-center max-w-xs shadow-2xl">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Verifying Payment</p>
              <p className="text-[10px] text-white/70 mt-1 leading-relaxed">
                Please wait while we securely verify your 12-digit UTR transaction...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold">UTR Verified & Saved Successfully!</span>
          </div>
        </div>
      )}

      <button
        onClick={() => router.push('/merchant/payments')}
        className="absolute top-8 left-8 flex items-center gap-2 text-muted hover:text-secondary transition-colors font-bold text-xs uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Payment Page
      </button>

      <div className="w-full max-w-[340px] bg-white rounded-[1.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">

        <div className="p-5 space-y-5">
          <div className="text-center py-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-1">Amount Payable</p>
            <h2 className="text-2xl font-bold text-secondary tracking-tight">₹{amount}</h2>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-border p-5 space-y-4 text-center">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Scan & Pay</span>
              <div className={`flex items-center gap-1 text-[9px] font-bold ${timeLeft > 0 ? 'text-primary bg-white border-blue-100' : 'text-red-500 bg-red-50 border-red-100'} px-2 py-0.5 rounded-full border`}>
                <Clock className="w-3 h-3" /> {timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}
              </div>
            </div>

            {/* High-Fidelity Scan-Ready QR */}
            <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 aspect-square flex items-center justify-center mx-auto w-[230px] overflow-hidden">
              {timeLeft > 0 ? (
                paymentData.payment_session_id ? (
                  <div id="mount-here" className="w-full h-full flex items-center justify-center"></div>
                ) : (
                  <a
                    href={dynamicQrLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-full block cursor-pointer"
                  >
                    <img
                      src={USER_QR_BASE64}
                      alt="Payment QR"
                      className="w-full h-full object-contain hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                    />
                  </a>
                )
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                  <span className="text-xs font-black text-red-500 uppercase tracking-[0.2em]">Expired</span>
                </div>
              )}
            </div>

            <div className="text-center space-y-4">
              <p className={`text-[9px] font-bold px-4 leading-relaxed ${timeLeft > 0 ? 'text-muted' : 'text-red-500'}`}>
                {timeLeft > 0
                  ? "Scan the QR code using any UPI app like GPay, PhonePe, or Paytm"
                  : "This payment link has expired. Please contact the merchant for a new link."}
              </p>

              <div className="pt-2 px-4 space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={utrValue}
                    onChange={handleUtrChange}
                    placeholder="Enter 12-digit UTR"
                    disabled={timeLeft === 0}
                    className={`w-full px-4 py-2.5 bg-white border ${utrError ? 'border-red-500 ring-1 ring-red-100' : 'border-slate-200'} rounded-lg text-[10px] font-bold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-center tracking-widest placeholder:text-slate-300 placeholder:tracking-normal ${timeLeft === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                  />
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 bg-slate-50 text-[8px] font-bold text-muted uppercase tracking-tighter">
                    Manual Verification
                  </div>
                </div>
                <button
                  onClick={handleVerify}
                  disabled={isSubmittingUtr || timeLeft === 0}
                  className="w-full py-2.5 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed"
                >
                  {isSubmittingUtr ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Submit <ShieldCheck className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                {utrError && <p className="text-[8px] text-red-500 font-bold">Please enter a valid 12-digit numeric UTR</p>}
                {!utrError && timeLeft > 0 && <p className="text-[8px] text-muted">Enter the 12-digit UTR after completing payment</p>}
                {timeLeft === 0 && <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest">Payment no longer possible</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
