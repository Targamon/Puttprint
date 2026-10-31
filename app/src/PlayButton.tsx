export default function PlayButton({ onClick, disabled, label = 'PLAY', sub = 'tap to stamp shot' }: { onClick: () => void; disabled?: boolean; label?: string; sub?: string }) {
  return (
    <button className="playbtn" onClick={onClick} disabled={disabled} aria-label={label}>
      <span style={{ display: 'block', width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: '3px solid #e9c46a', boxShadow: '0 4px 14px rgba(0,0,0,.45)', margin: '0 auto', background: '#fff' }}>
        <img src="/icon.png" alt="Golf ball with thumbprint" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.35)', display: 'block' }} />
      </span>
      <span className="pl">{label}</span><span className="ps">{sub}</span>
    </button>
  )
}
