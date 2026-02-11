import React from 'react';

export default function Score({ score = 0, position = 'left' }) {
  const overlayStyle = {
    position: 'absolute',
    top: '28px',
    right: position === 'right' ? '44px' : 'unset',
    left: position === 'left' ? '28px' : 'unset',
    color: '#00d6f5', // slightly dimmer blue
    fontSize: '3.2rem',
    fontFamily: 'Orbitron, Digital-7, "OCR A", monospace',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '.03em',
    background: 'none',
    padding: 0,
    border: 'none',
    borderRadius: 0,
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 10,
    boxShadow: 'none',
    textAlign: 'center',
    textShadow: '0 1px 0 #0d5163, 0 0 3px #48a9d4, 0 0 10px #189ab8',
    opacity: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const coinsStyle = {
    fontFamily: 'Orbitron, Digital-7, "OCR A", monospace',
    fontWeight: 800,
    fontSize: '1.6rem',
    color: '#00c2e0',
    letterSpacing: '0.04em',
    marginLeft: '0.2em',
    textShadow: '0 1px 0 #0d5163, 0 0 2px #48a9d4',
    textTransform: 'uppercase',
    opacity: 0.95,
  };

  return (
    <div style={overlayStyle}>
      {String(score).padStart(2, '0')}
      <span style={coinsStyle}>Coins</span>
    </div>
  );
}
