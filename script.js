const { jsPDF } = window.jspdf;

document.getElementById('generateBtn').onclick = () => {
  const name = document.getElementById('userName').value.trim();
  if (!name) {
    alert('Please enter your name.');
    return;
  }
  document.getElementById('recipientName').innerText = name;
  document.getElementById('issueDate').innerText =
    'Issued on: ' + new Date().toLocaleDateString();

  document.getElementById('certificateWrapper').classList.remove('hidden');
};

document.getElementById('downloadBtn').onclick = () => {
  const certEl = document.getElementById('certificate');
  html2canvas(certEl).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape', 'pt', [canvas.width, canvas.height]);
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${document.getElementById('recipientName').innerText}_Trust_Certificate.pdf`);
  });
};
// Dashboard.jsx
export function Dashboard({ savings, historyETB }) {
  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <h2>Total Gold Savings</h2>
          <p>{savings} g / {historyETB} ETB</p>
        </div>
        <div className="space-x-2">
          <button>Deposit</button>
          <button>Withdraw</button>
          <button>Request Loan</button>
        </div>
      </div>
      <MiniGraph data={historyETB} />
    </div>
  );
}

// LoanRequest.jsx
export function LoanRequest() {
  const [amount, setAmount] = useState(0);
  const [term, setTerm] = useState(0);
  const collateral = computeCollateral(amount);
  return (
    <form>
      <input type="number" value={amount} onChange={...} />
      <input type="number" value={term} onChange={...} />
      <p>Gold required: {collateral} g</p>
      <label>
        <input type="checkbox" /> Use group trust validation
      </label>
      <button type="submit">Submit Loan Request</button>
    </form>
  );// Dashboard.tsx
import { MiniGraph } from './MiniGraph';
export function Dashboard({ goldGrams, balanceETB, historyETB }: {
  goldGrams: number;
  balanceETB: number;
  historyETB: number[];
}) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Total Savings</h2>
          <p className="text-gray-700">{goldGrams} g / {balanceETB.toLocaleString('en-ET')} ETB</p>
        </div>
        <div className="space-x-2">
          <button className="btn-primary">Deposit</button>
          <button className="btn-secondary">Withdraw</button>
          <button className="btn-accent">Request Loan</button>
        </div>
      </div>
      <MiniGraph data={historyETB} />
    </div>
  );
}

// LoanRequest.tsx
export function LoanRequest({ goldPricePerGram }: { goldPricePerGram: number }) {
  const [amountETB, setAmountETB] = useState(0);
  const [termMonths, setTermMonths] = useState(0);
  const [groupTrust, setGroupTrust] = useState(false);

  const goldRequiredGrams = useMemo(() =>
    parseFloat((amountETB / goldPricePerGram).toFixed(2)),
    [amountETB, goldPricePerGram]
  );

  return (
    <form className="p-4 space-y-4">
      <div>
        <label>Loan Amount (ETB)</label>
        <input
          type="number" min="0"
          value={amountETB}
          onChange={e => setAmountETB(Number(e.target.value))}
          className="input"
        />
      </div>
      <div>
        <label>Repayment Term (months)</label>
        <input
          type="number" min="1"
          value={termMonths}
          onChange={e => setTermMonths(Number(e.target.value))}
          className="input"
        />
      </div>
      <p>Collateral needed: <strong>{goldRequiredGrams} g</strong></p>
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={groupTrust}
          onChange={() => setGroupTrust(v => !v)}
        />
        <span className="ml-2">Use group trust validation</span>
      </label>
      <button type="submit" className="btn-primary">Submit Loan Request</button>
    </form>
  );
}

}// SavingsGoals.tsx
interface Goal { id: string; name: string; targetGrams: number; savedGrams: number; }

export function SavingsGoals({ goals, onAddProgress }: {
  goals: Goal[];
  onAddProgress: (goalId: string, grams: number) => void;
}) {
  return (
    <div className="space-y-6">
      {goals.map(goal => {
        const pct = Math.min(100, (goal.savedGrams / goal.targetGrams) * 100);
        return (
          <div key={goal.id} className="p-4 border rounded-lg">
            <h3 className="font-semibold">{goal.name} — Goal {goal.targetGrams} g</h3>
            <div className="w-full bg-gray-200 h-4 rounded mt-2">
              <div className="bg-yellow-400 h-4 rounded" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-sm">
              {pct.toFixed(0)}% complete ({goal.savedGrams} g saved)
            </p>
            <button onClick={() => onAddProgress(goal.id, 1)} className="btn-sm mt-2">Add 1 g</button>
          </div>
        );
      })}
    </div>
  );
}

// Profile.tsx
export function Profile({ user }: { user: { name: string; verified: boolean; badges: string[] } }) {
  return (
    <div className="p-4">
      <h2 className="text-xl">{user.name}</h2>
      {user.verified && <span className="badge badge-blue">Verified</span>}
      <div className="mt-4 space-x-2">
        {user.badges.map(b => (
          <span key={b} className="badge badge-green">{b}</span>
        ))}
      </div>
      <ShareCertificate user={user} />
    </div>
  );
}

// ShareCertificate.tsx
export function ShareCertificate({ user }: { user: any }) {
  const handleShare = () => { /* generate shareable view or PDF */ };
  return <button onClick={handleShare} className="btn-outline mt-4">Share Trust Certificate</button>;
}
