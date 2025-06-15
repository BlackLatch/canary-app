'use client';

import React from 'react';

export default function DesignBoard() {
  return (
    <>
      <style jsx>{`
        @keyframes waveFlow {
          0% {
            stroke-dashoffset: 600;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        
        .connection-line {
          transform-origin: center;
        }
      `}</style>
      <div className="design-board grid-background">
      {/* SVG for connection lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
        {/* Network-style connecting lines like in reference design */}
        
        {/* Perfect circular line */}
        <circle
          cx="680"
          cy="400"
          r="300"
          className="connection-line"
          style={{ 
            stroke: 'rgba(255, 255, 255, 0.3)',
            strokeWidth: '1.5',
            fill: 'none'
          }}
        />
        
        {/* Connection points on the perfect circular line */}
        <circle cx="380" cy="400" r="3" fill="rgba(255, 255, 255, 0.8)" />
        <circle cx="680" cy="100" r="3" fill="rgba(255, 255, 255, 0.8)" />
        <circle cx="980" cy="400" r="3" fill="rgba(255, 255, 255, 0.8)" />
      </svg>

      {/* Design cards positioned like in the screenshot */}
      
      {/* Canary logo in the top left corner */}
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        left: '20px', 
        zIndex: 5
      }}>
        <img 
          src="/canary.png" 
          alt="Canary Logo" 
          style={{ 
            width: '120px', 
            height: 'auto', 
            objectFit: 'contain',
            opacity: '0.8'
          }} 
        />
      </div>
      
      {/* Step blocks aligned with circle's vertical positioning */}
      <div style={{ 
        position: 'absolute', 
        top: '650px', 
        left: '40%', 
        transform: 'translateX(-50%)', 
        display: 'flex', 
        gap: '120px', 
        alignItems: 'center',
        zIndex: 10
      }}>
        {/* Step 1: Upload */}
        <div className="design-card" style={{ width: '220px', height: '140px', position: 'relative' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Upload</h3>
          <p>Upload your sensitive information.</p>
          <div className="tag" style={{ position: 'absolute', bottom: '12px', left: '12px' }}>Step 1</div>
        </div>

        {/* Step 2: Secure - positioned to align vertically with Decentralized & Secure */}
        <div className="design-card" style={{ width: '220px', height: '140px', position: 'relative' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Secure</h3>
          <p>Secure it privately.</p>
          <div className="tag" style={{ position: 'absolute', bottom: '12px', left: '12px' }}>Step 2</div>
        </div>

        {/* Step 3: Set Conditions */}
        <div className="design-card" style={{ width: '220px', height: '140px', position: 'relative' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Set Conditions</h3>
          <p>Set the conditions for automatic release.</p>
          <div className="tag" style={{ position: 'absolute', bottom: '12px', left: '12px' }}>Step 3</div>
        </div>
      </div>

      {/* Decentralized - positioned at top of circle (90°) */}
      <div className="design-card" style={{ top: '50px', left: '590px', width: '180px' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>🛡️ Decentralized</p>
        <p style={{ fontSize: '13px', margin: '0 0 8px 0', color: '#333' }}>Your data is protected and out of reach from central authorities.</p>
        <div className="tag">Reference</div>
      </div>

      {/* Flexible Disclosure - positioned at right side of circle */}
      <div className="design-card" style={{ top: '330px', left: '890px', width: '180px' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Flexible Disclosure</p>
        <p style={{ fontSize: '13px', margin: '0 0 8px 0', color: '#333' }}>Choose: notify trusted parties or go fully public.</p>
        <div className="tag">Reference</div>
      </div>

      {/* Dead Man's Switch - positioned at left side of circle */}
      <div className="design-card" style={{ top: '330px', left: '290px', width: '180px' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0', color: '#000' }}>Dead Man's Switch</p>
        <p style={{ fontSize: '13px', margin: '0 0 8px 0', color: '#333' }}>Set a timer. If you don't check in, your encrypted message is released.</p>
        <div className="tag">Reference</div>
      </div>

      {/* Right sidebar content */}
      <div style={{ 
        position: 'absolute', 
        top: '60px', 
        right: '60px', 
        width: '320px',
        background: 'rgba(245, 245, 245, 0.95)',
        padding: '24px',
        borderRadius: '4px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          margin: '0 0 16px 0',
          color: '#000'
        }}>
          What is Canary?
        </h2>
        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.5', 
          margin: '0 0 16px 0',
          color: '#000',
          fontWeight: '600'
        }}>
          A safe that opens itself—if you can't.
        </p>
        <p style={{ 
          fontSize: '16px', 
          lineHeight: '1.5', 
          margin: '0 0 32px 0',
          color: '#333'
        }}>
          Canary is a trusted, secure space for journalists, activists, and everyday citizens to automatically release critical information if they're unable to speak for themselves.
        </p>
        
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>
            Think of it like a secure vault for your most critical stories, truths, or instructions. If you can't personally unlock it—if you're detained, missing, or unable—it shares access to a predetermined party automatically.
          </p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>Privacy Impact</h3>
          <p style={{ fontSize: '13px', color: '#666', margin: '0 0 8px 0' }}>
            Removes centralized risk. Automates secure data disclosure while keeping you safe.
          </p>
        </div>


      </div>
    </div>
    </>
  );
} 