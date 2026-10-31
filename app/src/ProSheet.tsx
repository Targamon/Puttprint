import { useState } from 'react'
import { loadPro, mockBuy } from './pro'

export default function ProSheet({ reason, trialFirst, onClose, onUnlocked }: { reason?: string; trialFirst?: boolean; onClose: () => void; onUnlocked: () => void }) {
  const [msg, setMsg] = useState('')
  const canTrial = !loadPro().trialUsed
  const buy = (k: 'monthly' | 'yearly' | 'lifetime' | 'trial') => { mockBuy(k); onUnlocked() }
  return <div className="sheetbg" onClick={onClose}>
    <div className="prosheet" onClick={e => e.stopPropagation()}>
      <img src="/icon.png" className="proicon" alt="" />
      <h2>Putt Print <span className="probadge">PRO</span></h2>
      {reason && <p className="muted small">{reason}</p>}
      <ul className="probullets">
        <li>👻 Best + Perfect ghosts</li>
        <li>☁️ Cloud sync &amp; multiplayer rooms</li>
        <li>🏌️ Learned clubs &amp; all courses</li>
      </ul>
      {canTrial && <button className="gold" onClick={() => buy('trial')}>{trialFirst ? 'Try Pro free 7 days' : 'Start 7-day free trial'}<div className="mock">Mock buy — unlocks on this device</div></button>}
      <button className="price best" onClick={() => buy('yearly')}><span className="save">BEST VALUE · save 50%</span><b>$29.99 / year</b><div className="mock">Mock buy — unlocks on this device</div></button>
      <button className="price" onClick={() => buy('monthly')}><b>$4.99 / month</b><div className="mock">Mock buy — unlocks on this device</div></button>
      <button className="price" onClick={() => buy('lifetime')}><b>Lifetime $59.99</b> <span className="muted small">one-time</span><div className="mock">Mock buy — unlocks on this device</div></button>
      <p className="muted small">Free: stamp shots, scorecard, 1 course, Last ghost only, solo.</p>
      <div className="prolinks"><button className="link" onClick={() => setMsg('No purchases to restore yet — store billing is not connected in this build.')}>Restore</button>
        <button className="link" onClick={onClose}>Maybe later</button></div>
      {msg && <p className="muted small">{msg}</p>}
    </div>
  </div>
}
