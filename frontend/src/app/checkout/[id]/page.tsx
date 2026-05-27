'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

import { API_URL } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(720); // 12:00 in seconds
  const [isCashfreeLoaded, setIsCashfreeLoaded] = useState(false);
  const [qrLoadError, setQrLoadError] = useState(false);

  // Payment Data State
  const [paymentData, setPaymentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentDetails();
  }, [params.id]);

  useEffect(() => {
    if (paymentData?.name) {
      document.title = `${paymentData.name} - Checkout`;
    }
  }, [paymentData]);

  useEffect(() => {
    if (!params.id || !API_URL) return;

    console.log('[Checkout] Initializing Socket.IO connection...');
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

      // Check if this update is for the current payment ID
      const targetOrderId = data.order_id || data.payment_id;
      if (targetOrderId === params.id) {
        if (data.type === 'PAYMENT_PAID') {
          console.log('[Checkout] Payment paid event received for current order! Updating status to Success.');
          setPaymentData((prev: any) => {
            if (!prev) return prev;

            // Trigger redirect if return_url exists
            const returnUrl = prev.return_url;
            if (returnUrl) {
              const finalUrl = returnUrl.replace('{order_id}', params.id as string);
              setTimeout(() => {
                window.location.href = finalUrl;
              }, 2000);
            }

            return {
              ...prev,
              status: 'Success'
            };
          });
        } else if (data.type === 'PAYMENT_FAILED') {
          console.log('[Checkout] Payment failed event received! Updating status to Failed.');
          setPaymentData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'Failed'
            };
          });
        } else if (data.type === 'PAYMENT_PENDING' || data.type === 'UTR_SUBMITTED') {
          console.log('[Checkout] Payment pending/submitted event received! Updating status to Pending.');
          setPaymentData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: 'Pending'
            };
          });
        }
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Checkout] Socket connection error:', error);
    });

    return () => {
      console.log('[Checkout] Disconnecting Socket.IO...');
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

    // Use payment creation timestamp as the start time
    const creationTime = paymentData.creation_timestamp * 1000; // Convert to milliseconds
    const expiryTime = creationTime + 12 * 60 * 1000; // 12 minutes from creation

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

  const cashfreeInitialized = React.useRef(false);

  useEffect(() => {
    if (isCashfreeLoaded && (window as any).Cashfree && paymentData?.payment_session_id) {
      if (cashfreeInitialized.current) return;
      
      const mountElement = document.getElementById("mount-here");
      if (!mountElement) return;

      try {
        const cashfree = (window as any).Cashfree({
          mode: paymentData.cf_environment || "sandbox"
        });

        const upiQr = cashfree.create('upiQr', {
          values: {
            size: "210px" // Matched to container size for perfect clarity
          }
        });
        
        upiQr.on('loaderror', function (data: any) {
          console.log("Cashfree Load Error:", data.error);
          setQrLoadError(true);
        });

        upiQr.mount("#mount-here");
        cashfreeInitialized.current = true;

        upiQr.on('ready', function (d: any) {
          console.log("Cashfree QR Ready");
        });

        // Trigger cashfree.pay to load the dynamic QR code inside the mounted container
        cashfree.pay({
          paymentMethod: upiQr,
          paymentSessionId: paymentData.payment_session_id
        }).then((res: any) => {
          console.log("Cashfree pay response:", res);
        }).catch((err: any) => {
          console.warn("Cashfree pay error:", err);
          setQrLoadError(true);
        });

      } catch (err) {
        console.warn("Cashfree initialization failed:", err);
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
    const val = e.target.value.replace(/\D/g, ''); // Remove non-numeric
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
        // setShowToast(true); // Removed as per request
        const submittedUtr = utrValue;
        setUtrValue('');

        // Update local state to trigger the Success Screen immediately
        setPaymentData((prev: any) => ({
          ...prev,
          utr_id: submittedUtr,
          status: 'Pending'
        }));

        // Redirect after a short delay to show the success toast
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
      // Removed fallback success toast as per request
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

  // Success Screen
  if (paymentData.status === 'Paid' || paymentData.status === 'Success' || (paymentData.utr_id && paymentData.status !== 'Failed' && paymentData.status !== 'Pending')) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2 border-4 border-green-100">
            <CheckCircle className="w-10 h-10 text-green-500 animate-bounce" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-secondary tracking-tight">Payment Successful!</h2>
            <p className="text-sm text-muted mt-2 px-4 leading-relaxed font-medium">
              Your payment for <span className="font-bold text-secondary">{paymentData.name}</span> has been successfully processed.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
            <div className="flex justify-between text-[10px] font-black px-2">
              <span className="text-muted uppercase tracking-widest">Amount</span>
              <span className="text-secondary">{paymentData.amount}</span>
            </div>
            {paymentData.utr_id && (
              <div className="flex justify-between text-[10px] font-black px-2">
                <span className="text-muted uppercase tracking-widest">UTR ID</span>
                <span className="text-secondary tracking-[0.1em]">{paymentData.utr_id}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] font-black px-2 items-center">
              <span className="text-muted uppercase tracking-widest">Status</span>
              <span className="text-green-600 uppercase tracking-widest bg-green-100/50 px-3 py-1 rounded-full border border-green-200/50">Success</span>
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
              className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] hover:shadow-primary/20"
            >
              Continue to Merchant
            </button>
          </div>
          <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em] animate-pulse">Redirecting you...</p>
        </div>
      </div>
    );
  }

  // Pending Screen
  if (paymentData.status === 'Pending') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2 border-4 border-amber-100">
            <Clock className="w-10 h-10 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-secondary tracking-tight">Payment Pending</h2>
            <p className="text-sm text-muted mt-2 px-4 leading-relaxed font-medium">
              Your payment for <span className="font-bold text-secondary">{paymentData.name}</span> is currently pending and awaiting verification.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
            <div className="flex justify-between text-[10px] font-black px-2">
              <span className="text-muted uppercase tracking-widest">Amount</span>
              <span className="text-secondary">{paymentData.amount}</span>
            </div>
            {paymentData.utr_id && (
              <div className="flex justify-between text-[10px] font-black px-2">
                <span className="text-muted uppercase tracking-widest">UTR ID</span>
                <span className="text-secondary tracking-[0.1em]">{paymentData.utr_id}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] font-black px-2 items-center">
              <span className="text-muted uppercase tracking-widest">Status</span>
              <span className="text-amber-600 uppercase tracking-widest bg-amber-100/50 px-3 py-1 rounded-full border border-amber-200/50">Processing</span>
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
              className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] hover:shadow-primary/20"
            >
              Continue to Merchant
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Failed Screen
  if (paymentData.status === 'Failed') {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2 border-4 border-red-100">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-secondary tracking-tight">Payment Failed</h2>
            <p className="text-sm text-muted mt-2 px-4 leading-relaxed font-medium">
              The payment attempt for <span className="font-bold text-secondary">{paymentData.name}</span> has failed or was declined.
            </p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
            <div className="flex justify-between text-[10px] font-black px-2">
              <span className="text-muted uppercase tracking-widest">Amount</span>
              <span className="text-secondary">{paymentData.amount}</span>
            </div>
            <div className="flex justify-between text-[10px] font-black px-2 items-center">
              <span className="text-muted uppercase tracking-widest">Status</span>
              <span className="text-red-600 uppercase tracking-widest bg-red-100/50 px-3 py-1 rounded-full border border-red-200/50">Declined</span>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              onClick={() => {
                setPaymentData((prev: any) => ({
                  ...prev,
                  status: 'Active'
                }));
              }}
              className="flex-1 py-4 bg-slate-100 text-secondary rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-[0.98]"
            >
              Retry
            </button>
            <button
              onClick={() => {
                if (paymentData.return_url) {
                  window.location.href = paymentData.return_url.replace('{order_id}', params.id as string);
                } else {
                  router.push('/merchant/payments');
                }
              }}
              className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const payerName = paymentData.name;
  const amount = paymentData.amount.replace('₹', '');

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-12 sm:py-20 p-4 sm:p-8 relative overflow-y-auto w-full">
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
        className="absolute top-4 left-4 sm:top-8 sm:left-8 flex items-center gap-2 text-muted hover:text-secondary transition-colors font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] z-20 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-100 sm:bg-transparent sm:border-0 sm:p-0"
      >
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 h-4" />
        <span className="hidden sm:inline">Back to Payment Page</span>
        <span className="sm:hidden">Back</span>
      </button>

      <div className="w-full max-w-[340px] sm:max-w-[380px] bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
        <div className="p-5 space-y-5">
          <div className="text-center py-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] mb-1">Amount Payable</p>
            <h2 className="text-2xl font-bold text-secondary tracking-tight">₹{amount}</h2>
          </div>

          <div className="bg-slate-50 rounded-[1.5rem] border border-slate-100 p-4 sm:p-6 space-y-4 text-center">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-black text-muted uppercase tracking-[0.15em]">Scan & Pay</span>
              <div className={`flex items-center gap-1.5 text-[10px] font-black ${timeLeft > 0 ? 'text-primary bg-white border-blue-100' : 'text-red-500 bg-red-50 border-red-100'} px-3 py-1 rounded-full border shadow-sm transition-colors`}>
                <Clock className="w-3.5 h-3.5" /> {timeLeft > 0 ? formatTime(timeLeft) : 'EXPIRED'}
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-inner border border-slate-200 aspect-square flex items-center justify-center mx-auto w-full max-w-[240px] overflow-hidden group">
              {timeLeft > 0 ? (
                paymentData.cf_upi_link ? (
                  <img
                    src={paymentData.cf_upi_link}
                    alt="Official Cashfree QR"
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (paymentData.payment_session_id && !qrLoadError) ? (
                  <div id="mount-here" className="w-full h-full flex items-center justify-center"></div>
                ) : (
                  <img
                    src={paymentData.qr_link || `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(`upi://pay?pa=nexify@okicici&pn=${encodeURIComponent(paymentData.merchant_name || payerName)}&am=${amount.replace(/,/g, '')}&cu=INR&tn=${encodeURIComponent(`Payment for ${payerName}`)}`)}`}
                    alt="Payment QR"
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )
              ) : (
                <div className="flex flex-col items-center gap-2 animate-pulse">
                  <AlertCircle className="w-12 h-12 text-red-400" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Expired</span>
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
                <div className="relative pt-2">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 bg-white text-[9px] font-black text-muted uppercase tracking-[0.1em] z-10 whitespace-nowrap border border-slate-100 rounded-full shadow-sm">
                    Manual Verification
                  </div>
                  <input
                    type="text"
                    value={utrValue}
                    onChange={handleUtrChange}
                    placeholder="Enter 12-digit UTR"
                    disabled={timeLeft === 0}
                    className={`w-full px-4 py-3.5 bg-white border ${utrError ? 'border-red-500 ring-1 ring-red-100' : 'border-slate-200'} rounded-xl text-xs font-bold text-secondary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all text-center tracking-[0.15em] placeholder:text-slate-300 placeholder:tracking-normal ${timeLeft === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                  />
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

        {/* Footer Removed */}
      </div>
    </div>
  );
}
