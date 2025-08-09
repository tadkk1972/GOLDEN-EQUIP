
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";

// --- API INITIALIZATION ---
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

// --- MOCK DATA, CONSTANTS & TYPES ---
const BASE_GOLD_PRICE_ETB = 7950.25;
const LOAN_TO_VALUE_RATIO = 0.5;
const LOAN_COMMISSION_RATE = 0.05;
const REFERRAL_BONUS_GRAMS = 0.1;
const APP_URL = "https://goldendigitalgold.pro.et";

type ModalType = 'transfer' | 'withdraw' | 'loan_choice' | 'loan_self' | 'admin_user_detail' | 'manual_payment' | null;
type ViewType = 'home' | 'profile' | 'admin';
type AuthViewType = 'login' | 'terms';
type NotificationInfo = { id: number; message: string; type: 'success' | 'error' };
type PaymentDetails = { etb: number; grams: number } | null;
type ChatMessage = { sender: 'user' | 'ai'; text: string; };

interface Transaction {
  id: string;
  date: string;
  type: 'conversion' | 'transfer_in' | 'transfer_out' | 'withdrawal' | 'loan' | 'guarantee_provided' | 'loan_repayment' | 'referral_bonus';
  amountGrams: number;
  amountETB?: number;
  from?: string;
  to?: string;
  status: 'completed' | 'pending' | 'failed';
  userId: string;
}

interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: 'user' | 'admin';
  goldBalance: number;
  etbBalance: number;
  guaranteedGrams: number;
  referralCode: string;
  joinDate: string;
}

interface AdminUserSummary {
  summary: string;
  key_observations: string[];
  potential_risks: string[];
}

const INITIAL_USERS: Record<string, User> = {
  "usr_1": { id: "usr_1", name: "Abebe Bikila", phone: "+251912345678", email: "abebe@example.com", role: "user", goldBalance: 5.75, etbBalance: 12000, guaranteedGrams: 0.5, referralCode: "GOLDENAB24", joinDate: "2023-08-15" },
  "usr_2": { id: "usr_2", name: "Fatuma Roba", phone: "+251923456789", email: "fatuma@example.com", role: "user", goldBalance: 12.25, etbBalance: 5500, guaranteedGrams: 0, referralCode: "FATUMA88", joinDate: "2023-01-20" },
  "usr_3": { id: "usr_3", name: "Admin User", phone: "+251900000000", email: "admin@goldendigital.pro.et", role: "admin", goldBalance: 0, etbBalance: 1000000, guaranteedGrams: 0, referralCode: "ADMINPRO", joinDate: "2022-11-01" },
};

const INITIAL_TRANSACTIONS: Transaction[] = [
    { id: "tx_1", date: "2024-07-22T10:00:00Z", type: 'conversion', amountGrams: 2.5, amountETB: 19875.63, status: 'completed', userId: 'usr_1' },
    { id: "tx_2", date: "2024-07-21T15:30:00Z", type: 'transfer_out', amountGrams: 1.0, to: 'Fatuma Roba', from:'Abebe Bikila', status: 'completed', userId: 'usr_1' },
    { id: "tx_3", date: "2024-07-21T15:30:00Z", type: 'transfer_in', amountGrams: 1.0, from: 'Abebe Bikila', to: 'Fatuma Roba', status: 'completed', userId: 'usr_2' },
    { id: "tx_4", date: "2024-07-20T09:00:00Z", type: 'loan', amountGrams: 1.5, amountETB: 5887.5, status: 'completed', userId: 'usr_2' },
    { id: "tx_5", date: "2024-07-23T11:00:00Z", type: 'conversion', amountGrams: 0.5, amountETB: 3975.13, status: 'pending', userId: 'usr_1' },
    { id: "tx_6", date: "2024-07-18T12:00:00Z", type: 'guarantee_provided', amountGrams: 0.5, to: 'Friend Account', status: 'completed', userId: 'usr_1'},
    { id: "tx_7", date: "2024-07-24T09:00:00Z", type: 'withdrawal', amountGrams: 2.0, status: 'pending', userId: 'usr_2'},
];

const TESTIMONIALS = [
    { quote: "Golden Digital Gold has revolutionized how I save. It's simple, secure, and I love watching my savings grow in gold!", author: "Hanna G." },
    { quote: "The loan feature is a lifesaver. I got the cash I needed quickly using my gold savings as collateral, all within the app.", author: "Samuel T." },
];

// --- HELPER & HOOKS ---
const formatCurrency = (amount: number, currency = 'ETB') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount).replace('ETB', '').trim() + ' ETB';
const formatGrams = (amount: number) => `${amount.toFixed(4)} g`;
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });
    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(`Error saving to localStorage key "${key}":`, error);
        }
    };
    return [storedValue, setValue];
}


// --- CORE UI COMPONENTS ---
const SkeletonLoader = ({ className }: { className: string }) => <div className={`skeleton-loader ${className}`} />;

const ToastNotification = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);
    const icon = type === 'success' ? 'check_circle' : 'error';
    return (
        <div className={`notification toast-${type}`} role="alert">
            <span className="material-icon">{icon}</span>
            <p>{message}</p>
            <button onClick={onClose} className="close-toast-button" aria-label="Close notification"><span className="material-icon">close</span></button>
        </div>
    );
};

// --- MODAL COMPONENTS ---
const Modal = ({ children, onClose, wide }: { children: React.ReactNode, onClose: () => void, wide?: boolean }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className={`modal-content ${wide ? 'modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ManualPaymentModal = ({ paymentDetails, onClose, onConfirm }: { paymentDetails: PaymentDetails, onClose: () => void, onConfirm: () => void }) => {
    const [isVerifying, setIsVerifying] = useState(false);
    if (!paymentDetails) return null;
    const handleConfirm = () => {
        setIsVerifying(true);
        setTimeout(() => {
            setIsVerifying(false);
            onConfirm();
        }, 2000);
    };
    if (isVerifying) return <div className="verification-overlay"><div className="spinner"></div><p>Verifying your payment...</p><span>This may take a moment.</span></div>;
    return (
        <Modal onClose={onClose}>
            <div className="modal-header"><h2><span className="material-icon">payment</span>Manual Payment</h2><button onClick={onClose} className="close-button" aria-label="Close"><span className="material-icon">close</span></button></div>
            <div className="modal-body manual-payment-content">
                <div className="payment-instructions"><p>To complete your purchase, please transfer the exact amount to one of our accounts:</p><div className="payment-amount-box">{formatCurrency(paymentDetails.etb)}</div></div>
                <div className="payment-account-info"><p><strong>Bank:</strong> Commercial Bank of Ethiopia</p><p><strong>Account Name:</strong> Golden Digital Gold PLC</p><p><strong>Account Number:</strong> 1000123456789</p></div>
                <div><p className="payment-methods-title">We also accept:</p><div className="payment-methods-grid"><span className="payment-method">Telebirr</span><span className="payment-method">CBE Birr</span></div></div>
                <p className="payment-note">Your account will be credited with <strong>{formatGrams(paymentDetails.grams)}</strong> of gold once payment is confirmed.</p>
                <button onClick={handleConfirm} className="modal-button send-verification-button"><span className="material-icon">send</span>I have sent the money</button>
            </div>
        </Modal>
    );
};

const TransferModal = ({ user, onClose, onTransfer, onShowToast, users }: { user: User, onClose: () => void, onTransfer: (recipientId: string, amount: number) => void, onShowToast: (message: string, type: 'success' | 'error') => void, users: Record<string, User> }) => {
    const [recipientIdentifier, setRecipientIdentifier] = useState('');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');

    const handleTransfer = () => {
        setError('');
        const gramAmount = parseFloat(amount);
        if (!recipientIdentifier || !gramAmount || gramAmount <= 0) {
            setError('Please fill in all fields.');
            return;
        }
        if (gramAmount > user.goldBalance) {
            setError('Insufficient gold balance.');
            return;
        }
        const recipient = Object.values(users).find(u => (u.phone === recipientIdentifier || u.email === recipientIdentifier) && u.id !== user.id);
        if (!recipient) {
            setError('Recipient not found.');
            return;
        }
        onTransfer(recipient.id, gramAmount);
    };

    return (
        <Modal onClose={onClose}>
            <div className="modal-header"><h2><span className="material-icon">send</span>Transfer Gold</h2><button onClick={onClose} className="close-button" aria-label="Close"><span className="material-icon">close</span></button></div>
            <div className="modal-body">
                <div className="input-group"><label>Recipient's Phone or Email</label><input type="text" className="input-field" value={recipientIdentifier} onChange={e => setRecipientIdentifier(e.target.value)} placeholder="e.g., +2519... or user@example.com" /></div>
                <div className="input-group"><label>Amount (Grams)</label><input type="number" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max: ${formatGrams(user.goldBalance)}`} /></div>
                {error && <p className="form-error">{error}</p>}
                <button onClick={handleTransfer} className="modal-button" disabled={!recipientIdentifier || !amount}>Confirm Transfer</button>
            </div>
        </Modal>
    );
};

const WithdrawModal = ({ user, onClose, onWithdraw }: { user: User, onClose: () => void, onWithdraw: (amount: number) => void }) => {
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');

    const handleWithdraw = () => {
        setError('');
        const gramAmount = parseFloat(amount);
        if (!gramAmount || gramAmount <= 0) {
            setError('Please enter a valid amount.');
            return;
        }
        if (gramAmount > user.goldBalance) {
            setError('Insufficient gold balance for withdrawal.');
            return;
        }
        onWithdraw(gramAmount);
    };

    return (
        <Modal onClose={onClose}>
            <div className="modal-header"><h2><span className="material-icon">file_download</span>Request Withdrawal</h2><button onClick={onClose} className="close-button" aria-label="Close"><span className="material-icon">close</span></button></div>
            <div className="modal-body">
                <p className="modal-info-text">Withdrawals are processed as ETB to your linked bank account. This will create a pending request for admin approval.</p>
                <div className="input-group"><label>Amount to Withdraw (Grams)</label><input type="number" className="input-field" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max: ${formatGrams(user.goldBalance)}`} /></div>
                {error && <p className="form-error">{error}</p>}
                <button onClick={handleWithdraw} className="modal-button" disabled={!amount}>Submit Request</button>
            </div>
        </Modal>
    );
};

const LoanChoiceModal = ({ onClose, onSelect }: { onClose: () => void, onSelect: (type: ModalType) => void }) => (
    <Modal onClose={onClose}>
        <div className="modal-header"><h2><span className="material-icon">account_balance</span>Apply for a Loan</h2><button onClick={onClose} className="close-button" aria-label="Close"><span className="material-icon">close</span></button></div>
        <div className="modal-body">
            <p className="modal-info-text">Choose your loan type. You can get an instant loan against your own gold or request someone to be your guarantor.</p>
            <button onClick={() => onSelect('loan_self')} className="modal-button"><span className="material-icon">diamond</span>Use My Gold as Collateral</button>
            <button className="modal-button" disabled>Find a Guarantor (Coming Soon)</button>
        </div>
    </Modal>
);

const LoanSelfModal = ({ user, livePrice, onClose, onLoan }: { user: User, livePrice: number, onClose: () => void, onLoan: (gramAmount: number, etbAmount: number) => void }) => {
    const [etbAmount, setEtbAmount] = useState('');
    const [error, setError] = useState('');
    const maxLoanableETB = user.goldBalance * livePrice * LOAN_TO_VALUE_RATIO;
    const requiredCollateralGrams = etbAmount ? (parseFloat(etbAmount) / livePrice) / LOAN_TO_VALUE_RATIO : 0;

    const handleLoan = () => {
        setError('');
        const loanETB = parseFloat(etbAmount);
        if (!loanETB || loanETB <= 0) { setError('Please enter a valid amount.'); return; }
        if (loanETB > maxLoanableETB) { setError('Requested amount exceeds the maximum allowed.'); return; }
        onLoan(requiredCollateralGrams, loanETB);
    };

    return (
        <Modal onClose={onClose}>
            <div className="modal-header"><h2><span className="material-icon">diamond</span>Self-Collateralized Loan</h2><button onClick={onClose} className="close-button" aria-label="Close"><span className="material-icon">close</span></button></div>
            <div className="modal-body">
                <div className="loan-summary-box">
                    <span>Max Loanable Amount</span>
                    <strong>{formatCurrency(maxLoanableETB)}</strong>
                </div>
                <div className="input-group">
                    <label>Loan Amount (ETB)</label>
                    <input type="number" className="input-field" value={etbAmount} onChange={e => setEtbAmount(e.target.value)} placeholder={`e.g., 5000`} />
                </div>
                {etbAmount && parseFloat(etbAmount) > 0 && (
                    <div className="loan-collateral-info">
                        <p>This will require <strong>{formatGrams(requiredCollateralGrams)}</strong> of your gold as collateral.</p>
                        <p>A {LOAN_COMMISSION_RATE * 100}% commission ({formatCurrency(parseFloat(etbAmount) * LOAN_COMMISSION_RATE)}) will be deducted.</p>
                        <p>You will receive: <strong>{formatCurrency(parseFloat(etbAmount) * (1 - LOAN_COMMISSION_RATE))}</strong></p>
                    </div>
                )}
                {error && <p className="form-error">{error}</p>}
                <button onClick={handleLoan} className="modal-button" disabled={!etbAmount || parseFloat(etbAmount) <= 0}>Confirm Loan</button>
            </div>
        </Modal>
    );
};

// --- DASHBOARD CARD COMPONENTS ---
const LivePriceCard = ({ livePrice }: { livePrice: number }) => (<div className="card live-price-card"><div className="live-price"><div className="price-display"><div className="live-indicator"></div><span>Live Gold Price</span></div><strong>{formatCurrency(livePrice)}/g</strong></div></div>);
const BalanceCard = ({ user }: { user: User | null }) => {
    if (!user) return <div className="card balance-card"><SkeletonLoader className="h-40 w-60" /><SkeletonLoader className="h-24 w-40" /></div>;
    const goldValue = user.goldBalance * BASE_GOLD_PRICE_ETB;
    return (
        <div className="card balance-card">
            <div className="balance-main"><h2>Total Gold Value</h2><p className="balance-primary">{formatCurrency(goldValue)}</p><p className="balance-secondary">{formatGrams(user.goldBalance)}</p></div>
            <div className="balance-details">
                <div><span>Cash Balance</span><p>{formatCurrency(user.etbBalance)}</p></div>
                <div><span>Guaranteed</span><p>{formatGrams(user.guaranteedGrams)}</p></div>
            </div>
        </div>
    );
};
const ActionButtons = ({ onAction }: { onAction: (type: ModalType) => void }) => (
    <div className="card action-buttons">
        <button onClick={() => onAction('transfer')}><span className="material-icon">send</span> Transfer</button>
        <button onClick={() => onAction('withdraw')}><span className="material-icon">file_download</span> Withdraw</button>
        <button onClick={() => onAction('loan_choice')}><span className="material-icon">account_balance</span> Loan</button>
    </div>
);

const BuyGoldForm = ({ livePrice, onNewTransaction, onShowToast }: { livePrice: number, onNewTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'userId'>) => void, onShowToast: (message: string, type: 'success' | 'error') => void }) => {
    const [etbAmount, setEtbAmount] = useState('');
    const [gramAmount, setGramAmount] = useState('');
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetails>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const handleEtbChange = (e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value; setEtbAmount(value); setGramAmount(value ? (parseFloat(value) / livePrice).toFixed(4) : ''); };
    const handleGramChange = (e: React.ChangeEvent<HTMLInputElement>) => { const value = e.target.value; setGramAmount(value); setEtbAmount(value ? (parseFloat(value) * livePrice).toFixed(2) : ''); };
    const handleBuyGold = () => { const etb = parseFloat(etbAmount); const grams = parseFloat(gramAmount); if (etb > 0 && grams > 0) { setPaymentDetails({ etb, grams }); setShowPaymentModal(true); } };
    const handleManualPaymentConfirm = () => { if (!paymentDetails) return; const newTx = { type: 'conversion' as const, amountGrams: paymentDetails.grams, amountETB: paymentDetails.etb, status: 'pending' as const, }; onNewTransaction(newTx); setShowPaymentModal(false); setPaymentDetails(null); setEtbAmount(''); setGramAmount(''); onShowToast('Purchase request received. Your balance will be updated upon verification.', 'success'); };
    return (
        <>
            <div className="card conversion-form"><h3><span className="material-icon">currency_exchange</span> Buy Digital Gold</h3>
                <div className="buy-gold-form">
                    <div className="input-group"><label>You Pay (ETB)</label><div className="input-wrapper"><span className="input-currency">ETB</span><input id="etb-input" type="number" className="input-field" placeholder="0.00" value={etbAmount} onChange={handleEtbChange} /></div></div>
                    <div className="input-group"><label>You Get (Gold)</label><div className="input-wrapper"><span className="input-currency">g</span><input id="gram-input" type="number" className="input-field" placeholder="0.0000" value={gramAmount} onChange={handleGramChange} /></div></div>
                    {gramAmount && (<div className="conversion-preview"><span>You'll receive approximately</span><p>{formatGrams(parseFloat(gramAmount))}</p></div>)}
                    <button className="convert-button" onClick={handleBuyGold} disabled={!etbAmount || !gramAmount || parseFloat(etbAmount) <= 0}>Buy Gold</button>
                </div>
            </div>
            {showPaymentModal && paymentDetails && (<ManualPaymentModal paymentDetails={paymentDetails} onClose={() => setShowPaymentModal(false)} onConfirm={handleManualPaymentConfirm} />)}
        </>
    );
};

const TransactionHistory = ({ transactions, loading, onShowAll, title = "Recent Transactions", limit = 5 }: { transactions: Transaction[], loading: boolean, onShowAll: () => void, title?: string, limit?: number }) => {
    const getIcon = (type: Transaction['type']) => { switch (type) { case 'conversion': return { icon: 'currency_exchange' }; case 'transfer_in': return { icon: 'arrow_downward' }; case 'transfer_out': return { icon: 'arrow_upward' }; case 'withdrawal': return { icon: 'file_download' }; case 'loan': return { icon: 'account_balance' }; case 'guarantee_provided': return { icon: 'security' }; default: return { icon: 'receipt_long' }; } };
    const getDescription = (tx: Transaction) => { switch (tx.type) { case 'conversion': return tx.status === 'pending' ? 'Gold Purchase (Pending)' : 'Gold Purchase'; case 'transfer_in': return `Received from ${tx.from}`; case 'transfer_out': return `Sent to ${tx.to}`; case 'withdrawal': return tx.status === 'pending' ? 'Withdrawal (Pending)' : 'Withdrawal'; case 'loan': return 'Loan Disbursed'; case 'guarantee_provided': return `Guarantee for ${tx.to}`; default: return 'Transaction'; } };
    const getAmount = (tx: Transaction) => { const sign = ['transfer_out', 'withdrawal', 'loan', 'guarantee_provided'].includes(tx.type) ? '-' : '+'; const amount = formatGrams(tx.amountGrams); const statusClass = tx.status === 'pending' ? 'tx-status-pending' : `tx-status-completed`; const typeClass = `tx-type-${tx.type}`; return <span className={`amount-gold ${typeClass} ${statusClass}`}>{sign} {amount}</span>; };
    return (
        <div className="card transaction-history">
            <div className="card-header"><h3><span className="material-icon">history</span> {title}</h3><button className="view-all-button" onClick={onShowAll}>View All</button></div>
            {loading ? <ul className="transaction-list">{[...Array(3)].map((_, i) => <li key={i} className="transaction-item"><SkeletonLoader className="tx-icon h-40" /><div className="transaction-details"><SkeletonLoader className="h-16 w-full" /><SkeletonLoader className="h-16 w-full mt-1" /></div></li>)}</ul> : transactions.length === 0 ? <div className="empty-history"><span className="material-icon">receipt_long</span><p>No transactions yet</p><span>Your recent activity will appear here.</span></div> : <ul className="transaction-list">{transactions.slice(0, limit).map(tx => (<li key={tx.id} className={`transaction-item tx-status-${tx.status}`}><div className={`tx-icon tx-type-${tx.type}`}><span className="material-icon">{getIcon(tx.type).icon}</span></div><div className="transaction-details"><p>{getDescription(tx)}</p><span className="transaction-date">{formatDate(tx.date)}</span></div><div className="transaction-status">{getAmount(tx)}{tx.status === 'pending' && <span className="pending-badge">PENDING</span>}{tx.status === 'failed' && <span className="failed-badge">FAILED</span>}</div></li>))}</ul>}
        </div>
    );
};

const PromotionCard = ({ user }: { user: User | null }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => { if (!user) return; navigator.clipboard.writeText(`${APP_URL}/register?ref=${user.referralCode}`); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (!user) return <div className="card promotion-card"><SkeletonLoader className="h-24 w-full" /></div>;
    return (
        <div className="card promotion-card"><span className="material-icon promo-icon">card_giftcard</span><h3>Invite a Friend, Get Free Gold!</h3><p>Share your referral link and you'll both receive <strong>{REFERRAL_BONUS_GRAMS}g of free gold</strong> when they make their first purchase.</p><div className="referral-code-wrapper"><span className="referral-code">{`${APP_URL}/register?ref=${user.referralCode}`}</span><button onClick={handleCopy} className={`copy-button ${copied ? 'copied' : ''}`}><span className="material-icon">{copied ? 'check' : 'content_copy'}</span>{copied ? 'Copied!' : 'Copy'}</button></div></div>
    );
};
const TestimonialsSection = () => (<div className="testimonials-section"><h2 className="header-title" style={{textAlign: 'center', marginBottom: '16px'}}>What Our Users Say</h2><div className="testimonials-grid">{TESTIMONIALS.map((t, i) => (<div key={i} className="card testimonial-card"><p className="testimonial-quote">"{t.quote}"</p><p className="testimonial-author">- {t.author}</p></div>))}</div></div>);

const GoldValueChartCard = ({ transactions, livePrice }: { transactions: Transaction[], livePrice: number }) => {
    const chartData = useMemo(() => {
        if (!transactions || transactions.length < 1) return [];
        const completedTxns = transactions.filter(tx => tx.status === 'completed').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let currentGold = 0;
        const dataPoints = completedTxns.map(tx => { const amountChange = ['transfer_out', 'withdrawal', 'loan', 'guarantee_provided'].includes(tx.type) ? -tx.amountGrams : tx.amountGrams; currentGold += amountChange; return { date: new Date(tx.date), value: currentGold * livePrice }; });
        if (dataPoints.length > 0) { dataPoints.push({ date: new Date(), value: currentGold * livePrice }); }
        return dataPoints;
    }, [transactions, livePrice]);
    const Chart = () => {
        if (chartData.length < 2) return <div className="empty-chart"><span className="material-icon">show_chart</span><p>Not enough data</p><span>Your asset growth will appear here.</span></div>;
        const width = 300, height = 150, padding = { top: 10, right: 0, bottom: 20, left: 0 };
        const maxValue = Math.max(...chartData.map(d => d.value));
        const firstDate = chartData[0].date.getTime(), lastDate = chartData[chartData.length - 1].date.getTime();
        const getX = (date: Date) => padding.left + ((date.getTime() - firstDate) / (lastDate - firstDate)) * (width - padding.left - padding.right);
        const getY = (value: number) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
        const path = chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(d.date)} ${getY(d.value)}`).join(' ');
        const firstLabel = formatDate(chartData[0].date.toISOString()).split(' ').slice(0,2).join(' '), lastLabel = "Today";
        return (<><svg viewBox={`0 0 ${width} ${height}`} className="chart-container" role="img" aria-label="Gold value over time chart"><path d={path} fill="none" stroke="var(--primary-gold)" strokeWidth="2" /></svg><div className="chart-labels"><span>{firstLabel}</span><span>{lastLabel}</span></div></>);
    };
    const latestValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
    return (
        <div className="card gold-chart-card">
            <div className="card-header"><h3><span className="material-icon">show_chart</span> Gold Value Growth</h3><div className="chart-current-value"><span>Current Value</span><strong>{formatCurrency(latestValue)}</strong></div></div>
            <Chart />
        </div>
    );
};

// --- CHAT COMPONENTS ---
const ChatFAB = ({ onClick }: { onClick: () => void }) => (<button className="chat-fab" onClick={onClick} aria-label="Open AI chat assistant"><span className="material-icon">smart_toy</span></button>);
const ChatInterface = ({ user, onClose }: { user: User, onClose: () => void }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([{ sender: 'ai', text: `Hello ${user.name}! How can I help you today?` }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => { const chatInstance = ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction: `You are a helpful financial assistant for "Golden Digital Gold". The current gold price is ${formatCurrency(BASE_GOLD_PRICE_ETB)} per gram. The user's name is ${user.name}, their gold balance is ${formatGrams(user.goldBalance)}. Be concise and helpful. Today's date is ${new Date().toDateString()}.`}}); setChat(chatInstance); }, [user]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    const handleSend = async (messageText?: string) => {
        const textToSend = messageText || input;
        if (!textToSend.trim() || isLoading || !chat) return;
        const newUserMessage: ChatMessage = { sender: 'user', text: textToSend };
        setMessages(prev => [...prev, newUserMessage]); setInput(''); setIsLoading(true);
        try { const response: GenerateContentResponse = await chat.sendMessage({ message: textToSend }); setMessages(prev => [...prev, { sender: 'ai', text: response.text }]); }
        catch (error) { console.error("AI chat error:", error); setMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting." }]); }
        finally { setIsLoading(false); }
    };
    const suggestions = ["What's my gold worth?", "Summarize my last 3 transactions", "How does the loan work?"];
    return (<div className="chat-overlay" onClick={onClose}><div className="chat-window" onClick={e => e.stopPropagation()}><div className="chat-header"><h3><span className="material-icon">smart_toy</span>AI Assistant</h3><button className="close-button" onClick={onClose} aria-label="Close chat"><span className="material-icon">close</span></button></div><div className="chat-messages" ref={messagesEndRef}>{messages.map((msg, index) => (<div key={index} className={`chat-message ${msg.sender}-message`}><div className="message-bubble">{msg.text}</div></div>))}{isLoading && (<div className="chat-message ai-message"><div className="message-bubble ai-typing-indicator"><span></span><span></span><span></span></div></div>)}</div>{messages.length <= 1 && (<div className="suggestion-chips">{suggestions.map(s => <button key={s} onClick={() => handleSend(s)}>{s}</button>)}</div>)}<form className="chat-input-area" onSubmit={(e) => { e.preventDefault(); handleSend(); }}><input type="text" placeholder="Ask me anything..." value={input} onChange={(e) => setInput(e.target.value)} disabled={isLoading} /><button type="submit" disabled={isLoading || !input.trim()}><span className="material-icon">send</span></button></form></div></div>);
};

// --- MAIN PAGE & LAYOUT COMPONENTS ---
const AppHeader = ({ user, onLogout }: { user: User | null, onLogout: () => void }) => (<header className="app-header"><h1 className="header-title">Golden Digital Gold</h1>{user && (<button onClick={onLogout} className="sign-out-button"><span className="material-icon">logout</span>Sign Out</button>)}</header>);
const BottomNavBar = ({ activeView, setView, isAdmin }: { activeView: ViewType, setView: (view: ViewType) => void, isAdmin: boolean }) => (<nav className="bottom-nav"><button className={activeView === 'home' ? 'active' : ''} onClick={() => setView('home')}><span className="material-icon">dashboard</span> Home</button><button className={activeView === 'profile' ? 'active' : ''} onClick={() => setView('profile')}><span className="material-icon">person</span> Profile</button>{isAdmin && (<button className={activeView === 'admin' ? 'active' : ''} onClick={() => setView('admin')}><span className="material-icon">admin_panel_settings</span> Admin</button>)}</nav>);

const MainDashboard = ({ user, transactions, livePrice, onAction, onNewTransaction, onShowToast, onShowProfile }: { user: User, transactions: Transaction[], livePrice: number, onAction: (type: ModalType) => void, onNewTransaction: (tx: Omit<Transaction, 'id' | 'date' | 'userId'>) => void, onShowToast: (message: string, type: 'success' | 'error') => void, onShowProfile: () => void }) => (
    <div className="main-grid">
        <div className="balance-card-grid"><BalanceCard user={user} /></div>
        <div className="live-price-card-grid"><LivePriceCard livePrice={livePrice} /></div>
        <div className="action-buttons-grid-main"><ActionButtons onAction={onAction} /></div>
        <div className="chart-card-grid"><GoldValueChartCard transactions={transactions} livePrice={livePrice} /></div>
        <div className="conversion-form-grid"><BuyGoldForm livePrice={livePrice} onNewTransaction={onNewTransaction} onShowToast={onShowToast} /></div>
        <div className="transaction-history-grid"><TransactionHistory transactions={transactions} loading={false} onShowAll={onShowProfile} /></div>
        <div className="promotion-card-grid grid-col-span-2"><PromotionCard user={user} /></div>
        <div className="testimonials-grid-main grid-col-span-2"><TestimonialsSection /></div>
    </div>
);

const AuthPage = ({ onLogin, onShowTerms }: { onLogin: (userId: string) => void, onShowTerms: () => void }) => (<div className="auth-container"><div className="logo-container">G</div><h1 className="auth-title">Welcome to Golden Digital Gold</h1><p className="auth-subtitle">Your secure way to save and grow your wealth in Ethiopia.</p><div className="demo-users"><p>Select a demo user to log in:</p><div className="demo-users-grid"><button className="demo-user-button" onClick={() => onLogin('usr_1')}><strong>Abebe Bikila</strong><span>Standard User</span></button><button className="demo-user-button" onClick={() => onLogin('usr_2')}><strong>Fatuma Roba</strong><span>Standard User</span></button><button className="demo-user-button" onClick={() => onLogin('usr_3')}><strong>Admin User</strong><span>Administrator</span></button></div></div><button onClick={onShowTerms} className="terms-link">Terms and Conditions</button></div>);
const TermsPage = ({ onBack }: { onBack: () => void }) => (<div className="terms-page"><h1 className="auth-title">Terms and Conditions</h1><div className="card terms-content"><h3>1. Acceptance of Terms</h3><p>By using the Golden Digital Gold application ("Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you disagree with any part of the terms, then you may not access the Service.</p><h3>2. Service Description</h3><p>Our Service allows users to convert Ethiopian Birr (ETB) into digital gold. This digital gold can be stored, transferred to other users, or used as collateral for loans, subject to the conditions outlined herein.</p><h3>3. Account Security</h3><p>You are responsible for safeguarding the credentials you use to access the Service and for any activities or actions under your account. We are not liable for any loss or damage arising from your failure to comply with this security obligation.</p><h3>4. AI Feature Disclaimers</h3><p>Our Service utilizes AI-powered features, including a chat assistant and financial analysis tools. These features provide information and suggestions based on available data and are for informational purposes only. They do not constitute financial advice. We are not liable for any decisions made based on the AI's suggestions.</p><h3>5. Loan Services</h3><p>Loans are provided based on a percentage of your current digital gold value (Loan-to-Value ratio). All loans are subject to a commission fee. Failure to repay a loan may result in the liquidation of your collateralized gold.</p><h3>6. Transactions and Verifications</h3><p>All transactions, including ETB-to-gold conversions and transfers, are recorded on our ledger. Manual bank transfer conversions are subject to verification and may not be reflected in your account instantly. You agree to provide accurate information for all transactions.</p><h3>7. Service Availability</h3><p>While we strive to ensure the Service is available 24/7, we do not guarantee that the Service will operate without interruptions or be error-free. We are not liable for any loss due to service interruptions.</p></div><button onClick={onBack} className="modal-button">Back to Login</button></div>);

const ProfilePage = ({ user, transactions }: { user: User, transactions: Transaction[] }) => (
    <div className="profile-page">
        <div className="card profile-header-card">
            <span className="material-icon profile-avatar">account_circle</span>
            <h2>{user.name}</h2>
            <p>{user.email} &bull; {user.phone}</p>
            <span>Joined: {formatDate(user.joinDate)}</span>
        </div>
        <TransactionHistory transactions={transactions} loading={false} onShowAll={() => {}} title="Full Transaction History" limit={100} />
    </div>
);

const AdminDashboard = ({ users, transactions, onUserSelect, onApprove, onReject }: { users: User[], transactions: Transaction[], onUserSelect: (user: User) => void, onApprove: (txId: string) => void, onReject: (txId: string) => void }) => {
    const [adminView, setAdminView] = useState<'users' | 'approvals'>('approvals');
    const pendingTransactions = transactions.filter(tx => tx.status === 'pending');

    return (
        <div className="admin-dashboard">
            <div className="admin-tabs">
                <button className={adminView === 'approvals' ? 'active' : ''} onClick={() => setAdminView('approvals')}>Pending Approvals ({pendingTransactions.length})</button>
                <button className={adminView === 'users' ? 'active' : ''} onClick={() => setAdminView('users')}>User Management</button>
            </div>
            {adminView === 'approvals' ? (
                <div className="card">
                    {pendingTransactions.length > 0 ? (
                        <table className="admin-table">
                            <thead><tr><th>User</th><th>Date</th><th>Type</th><th>Amount</th><th>Actions</th></tr></thead>
                            <tbody>
                                {pendingTransactions.map(tx => {
                                    const user = users.find(u => u.id === tx.userId);
                                    return (
                                        <tr key={tx.id}>
                                            <td>{user?.name || 'Unknown'}</td>
                                            <td>{formatDate(tx.date)}</td>
                                            <td>{tx.type}</td>
                                            <td>{tx.type === 'conversion' ? formatCurrency(tx.amountETB!) : formatGrams(tx.amountGrams)}</td>
                                            <td className="table-actions">
                                                <button onClick={() => onApprove(tx.id)} className="approve-btn"><span className="material-icon">check</span>Approve</button>
                                                <button onClick={() => onReject(tx.id)} className="reject-btn"><span className="material-icon">close</span>Reject</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : <p className="admin-empty-state">No pending approvals.</p>}
                </div>
            ) : (
                 <div className="card">
                    <table className="admin-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Gold Balance</th><th>ETB Balance</th><th>Actions</th></tr></thead>
                        <tbody>
                            {users.filter(u => u.role !== 'admin').map(user => (
                                <tr key={user.id}>
                                    <td>{user.name}</td>
                                    <td>{user.email}</td>
                                    <td>{formatGrams(user.goldBalance)}</td>
                                    <td>{formatCurrency(user.etbBalance)}</td>
                                    <td className="table-actions">
                                        <button onClick={() => onUserSelect(user)} className="view-btn"><span className="material-icon">visibility</span>View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const AdminUserDetailModal = ({ user, transactions, onClose, onGenerateSummary, aiSummary, isAiLoading }: { user: User, transactions: Transaction[], onClose: () => void, onGenerateSummary: (user: User, transactions: Transaction[]) => void, aiSummary: AdminUserSummary | null, isAiLoading: boolean }) => (
    <Modal onClose={onClose} wide={true}>
        <div className="modal-header"><h2>User Details: {user.name}</h2><button onClick={onClose} className="close-button" aria-label="Close"><span className="material-icon">close</span></button></div>
        <div className="admin-user-detail-content">
            <div className="user-info-section">
                <h4><span className="material-icon">badge</span> User Info</h4>
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Phone:</strong> {user.phone}</p>
                <p><strong>Gold Balance:</strong> {formatGrams(user.goldBalance)}</p>
                <p><strong>ETB Balance:</strong> {formatCurrency(user.etbBalance)}</p>
            </div>
            <div className="ai-summary-section">
                <h4><span className="material-icon">psychology</span> AI Behavioral Summary</h4>
                {isAiLoading ? (
                    <div className="ai-loading-state"><div className="spinner"></div><p>Generating summary...</p></div>
                ) : aiSummary ? (
                    <div className="ai-summary-result">
                        <p><strong>Summary:</strong> {aiSummary.summary}</p>
                        <h5>Key Observations:</h5>
                        <ul>{aiSummary.key_observations.map((obs, i) => <li key={i}>{obs}</li>)}</ul>
                        <h5>Potential Risks:</h5>
                        <ul>{aiSummary.potential_risks.map((risk, i) => <li key={i}>{risk}</li>)}</ul>
                    </div>
                ) : null}
                 <button className="modal-button" onClick={() => onGenerateSummary(user, transactions)} disabled={isAiLoading}>
                    {aiSummary ? 'Re-Generate Summary' : 'Generate AI Summary'}
                </button>
            </div>
        </div>
        <div className="user-transactions-section">
            <h4><span className="material-icon">history</span> Transaction History</h4>
             <div className="transaction-table-container">
                <TransactionHistory transactions={transactions} loading={false} onShowAll={() => {}} limit={100} title="" />
            </div>
        </div>
    </Modal>
);

// --- THE MAIN APP COMPONENT ---
const App = () => {
    const [users, setUsers] = useLocalStorage<Record<string, User>>('gdg-users', INITIAL_USERS);
    const [transactions, setTransactions] = useLocalStorage<Transaction[]>('gdg-transactions', INITIAL_TRANSACTIONS);
    const [currentUserId, setCurrentUserId] = useLocalStorage<string | null>('gdg-session', null);
    
    const [authView, setAuthView] = useState<AuthViewType>('login');
    const [activeView, setActiveView] = useState<ViewType>('home');
    const [livePrice, setLivePrice] = useState(BASE_GOLD_PRICE_ETB);
    
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedUserForAdmin, setSelectedUserForAdmin] = useState<User | null>(null);
    const [aiSummary, setAiSummary] = useState<AdminUserSummary | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    const [showChat, setShowChat] = useState(false);
    const [notifications, setNotifications] = useState<NotificationInfo[]>([]);

    const currentUser = currentUserId ? users[currentUserId] : null;

    const addNotification = useCallback((message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
    }, []);
    const removeNotification = (id: number) => setNotifications(prev => prev.filter(n => n.id !== id));

    const handleLogin = (userId: string) => {
        if (users[userId]) {
            setCurrentUserId(userId);
            setActiveView('home');
        } else {
            addNotification('Login failed: User not found.', 'error');
        }
    };
    const handleLogout = () => { setCurrentUserId(null); setAuthView('login'); };

    const handleNewTransaction = (tx: Omit<Transaction, 'id' | 'date' | 'userId'>) => {
      if (!currentUser) return;
      const newTx: Transaction = { ...tx, id: `tx_${Date.now()}`, date: new Date().toISOString(), userId: currentUser.id };
      setTransactions(prev => [newTx, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };

    const handleTransfer = (recipientId: string, amountGrams: number) => {
        if (!currentUser) return;
        const sender = currentUser;
        const recipient = users[recipientId];
        
        // Update balances
        const updatedUsers = { ...users };
        updatedUsers[sender.id] = { ...sender, goldBalance: sender.goldBalance - amountGrams };
        updatedUsers[recipient.id] = { ...recipient, goldBalance: recipient.goldBalance + amountGrams };
        setUsers(updatedUsers);

        // Create transactions
        const outTx: Transaction = { id: `tx_${Date.now()}_out`, date: new Date().toISOString(), userId: sender.id, type: 'transfer_out', amountGrams, to: recipient.name, from: sender.name, status: 'completed' };
        const inTx: Transaction = { id: `tx_${Date.now()}_in`, date: new Date().toISOString(), userId: recipient.id, type: 'transfer_in', amountGrams, from: sender.name, to: recipient.name, status: 'completed' };
        setTransactions(prev => [outTx, inTx, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
        setActiveModal(null);
        addNotification(`Successfully transferred ${formatGrams(amountGrams)} to ${recipient.name}.`, 'success');
    };
    
    const handleWithdraw = (amountGrams: number) => {
        handleNewTransaction({type: 'withdrawal', amountGrams, status: 'pending' });
        setActiveModal(null);
        addNotification('Withdrawal request submitted for approval.', 'success');
    };
    
    const handleLoan = (collateralGrams: number, loanETB: number) => {
        if (!currentUser) return;
        const receivedETB = loanETB * (1 - LOAN_COMMISSION_RATE);
        
        const updatedUsers = { ...users };
        updatedUsers[currentUser.id] = { ...currentUser, goldBalance: currentUser.goldBalance - collateralGrams, etbBalance: currentUser.etbBalance + receivedETB };
        setUsers(updatedUsers);
        
        handleNewTransaction({type: 'loan', amountGrams: collateralGrams, amountETB: loanETB, status: 'completed' });
        setActiveModal(null);
        addNotification(`Loan of ${formatCurrency(loanETB)} approved.`, 'success');
    };
    
    const handleApproval = (txId: string, action: 'approve' | 'reject') => {
        const tx = transactions.find(t => t.id === txId);
        if (!tx) return;
        const user = users[tx.userId];
        
        let updatedUsers = { ...users };
        if (action === 'approve') {
            if (tx.type === 'conversion') {
                updatedUsers[user.id] = { ...user, goldBalance: user.goldBalance + tx.amountGrams };
            } else if (tx.type === 'withdrawal') {
                updatedUsers[user.id] = { ...user, goldBalance: user.goldBalance - tx.amountGrams };
            }
        }
        setUsers(updatedUsers);

        const updatedTransactions = transactions.map(t => t.id === txId ? { ...t, status: action === 'approve' ? 'completed' : 'failed' } : t);
        setTransactions(updatedTransactions as Transaction[]);
        addNotification(`Transaction ${txId.slice(-4)} has been ${action === 'approve' ? 'approved' : 'rejected'}.`, 'success');
    };
    
    const handleGenerateAdminSummary = async (user: User, userTransactions: Transaction[]) => {
        setAiSummary(null);
        setIsAiLoading(true);
        const transactionText = userTransactions.map(t => `${t.date}: ${t.type} of ${t.amountGrams}g (${t.status})`).join('\n');
        const prompt = `Analyze the following transaction history for user "${user.name}". Provide a concise behavioral summary, list 3-4 key observations (like high frequency trading, large withdrawals, etc.), and identify potential risks (like sudden large transactions, low activity, etc.). Keep the language professional and analytical. \n\nTransactions:\n${transactionText}`;
        
        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING, description: "A brief summary of the user's overall financial behavior."},
                    key_observations: { type: Type.ARRAY, items: {type: Type.STRING}, description: "A list of notable activities or patterns."},
                    potential_risks: { type: Type.ARRAY, items: {type: Type.STRING}, description: "A list of potential risks based on transaction history."}
                },
                required: ["summary", "key_observations", "potential_risks"]
            };
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: schema },
            });
            
            const parsedJson = JSON.parse(response.text);
            setAiSummary(parsedJson);

        } catch (error) {
            console.error("AI Summary Generation Error:", error);
            addNotification("Failed to generate AI summary.", "error");
        } finally {
            setIsAiLoading(false);
        }
    };
    
    // Simulate live price fluctuation
    useEffect(() => { const interval = setInterval(() => { const f = (Math.random() - 0.5) * 10; setLivePrice(p => Math.max(7800, p + f)); }, 5000); return () => clearInterval(interval); }, []);

    if (!currentUser) {
        if (authView === 'terms') return <TermsPage onBack={() => setAuthView('login')} />;
        return <AuthPage onLogin={handleLogin} onShowTerms={() => setAuthView('terms')} />;
    }
    
    const userTransactions = transactions.filter(tx => tx.userId === currentUser.id);

    return (
        <div className="app-container">
            <AppHeader user={currentUser} onLogout={handleLogout} />
            <main className="app-content">
                {activeView === 'home' && <MainDashboard user={currentUser} transactions={userTransactions} livePrice={livePrice} onAction={setActiveModal} onNewTransaction={handleNewTransaction} onShowToast={addNotification} onShowProfile={() => setActiveView('profile')} />}
                {activeView === 'profile' && <ProfilePage user={currentUser} transactions={userTransactions} />}
                {activeView === 'admin' && currentUser.role === 'admin' && <AdminDashboard users={Object.values(users)} transactions={transactions} onUserSelect={(user) => { setSelectedUserForAdmin(user); setActiveModal('admin_user_detail'); setAiSummary(null); }} onApprove={(txId) => handleApproval(txId, 'approve')} onReject={(txId) => handleApproval(txId, 'reject')} />}
            </main>

            <BottomNavBar activeView={activeView} setView={setActiveView} isAdmin={currentUser.role === 'admin'} />
            <ChatFAB onClick={() => setShowChat(true)} />
            
            {showChat && <ChatInterface user={currentUser} onClose={() => setShowChat(false)} />}
            
            {/* --- MODAL RENDERING --- */}
            {activeModal === 'transfer' && <TransferModal user={currentUser} onClose={() => setActiveModal(null)} onTransfer={handleTransfer} onShowToast={addNotification} users={users} />}
            {activeModal === 'withdraw' && <WithdrawModal user={currentUser} onClose={() => setActiveModal(null)} onWithdraw={handleWithdraw} />}
            {activeModal === 'loan_choice' && <LoanChoiceModal onClose={() => setActiveModal(null)} onSelect={setActiveModal} />}
            {activeModal === 'loan_self' && <LoanSelfModal user={currentUser} livePrice={livePrice} onClose={() => setActiveModal(null)} onLoan={handleLoan} />}
            {activeModal === 'admin_user_detail' && selectedUserForAdmin && <AdminUserDetailModal user={selectedUserForAdmin} transactions={transactions.filter(tx => tx.userId === selectedUserForAdmin.id)} onClose={() => setActiveModal(null)} onGenerateSummary={handleGenerateAdminSummary} aiSummary={aiSummary} isAiLoading={isAiLoading}/>}
            
            <div className="toast-container">{notifications.map(n => <ToastNotification key={n.id} {...n} onClose={() => removeNotification(n.id)} />)}</div>
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
