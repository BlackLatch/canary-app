import React from 'react';

const CanaryGuideStandalone = () => {
  const styles = {
    designBoard: {
      position: 'relative',
      minHeight: '100vh',
      overflow: 'hidden',
    },

    // Design cards
    designCard: {
      position: 'absolute',
      background: '#ffffff',
      borderRadius: '4px',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      fontSize: '13px',
      lineHeight: '1.4',
      color: '#333',
      maxWidth: '280px',
      zIndex: 3,
    },

    // Sidebar styles
    sidebar: {
      position: 'absolute',
      top: '60px',
      right: '60px',
      width: '320px',
      background: 'rgba(245, 245, 245, 0.95)',
      padding: '24px',
      borderRadius: '4px',
      zIndex: 10,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },

    sidebarH2: {
      fontSize: '24px',
      fontWeight: '600',
      margin: '0 0 16px 0',
      color: '#000',
    },

    sidebarP: {
      fontSize: '16px',
      lineHeight: '1.5',
      margin: '0 0 16px 0',
      color: '#333',
    },

    tagline: {
      fontSize: '16px',
      lineHeight: '1.5',
      margin: '0 0 16px 0',
      color: '#000',
      fontWeight: '600',
    },

    section: {
      marginBottom: '24px',
    },

    sectionH3: {
      fontSize: '14px',
      fontWeight: '600',
      margin: '0 0 12px 0',
      color: '#000',
    },

    sectionP: {
      fontSize: '13px',
      color: '#666',
      margin: '0 0 8px 0',
    },



    // Step blocks container
    stepBlocks: {
      position: 'absolute',
      top: '650px',
      left: '40%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '120px',
      alignItems: 'center',
      zIndex: 10,
    },

    stepBlock: {
      width: '220px',
      height: '140px',
      position: 'relative',
      background: '#ffffff',
      borderRadius: '4px',
      padding: '16px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      fontSize: '13px',
      lineHeight: '1.4',
      color: '#333',
      zIndex: 3,
    },

    stepBlockH3: {
      fontSize: '16px',
      fontWeight: '600',
      margin: '0 0 8px 0',
      color: '#000',
    },

    stepBlockP: {
      margin: '0',
      color: '#555',
    },

    tag: {
      position: 'absolute',
      bottom: '12px',
      left: '12px',
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '11px',
      color: '#666',
      gap: '4px',
    },

    // Feature blocks positioning
    featureDecentralized: {
      ...this?.designCard,
      top: '50px',
      left: '590px',
      width: '180px',
    },

    featureFlexible: {
      ...this?.designCard,
      top: '330px',
      left: '890px',
      width: '180px',
    },

    featureDeadman: {
      ...this?.designCard,
      top: '330px',
      left: '290px',
      width: '180px',
    },

    featureBlockTitle: {
      fontSize: '14px',
      fontWeight: '600',
      margin: '0 0 8px 0',
      color: '#000',
    },

    featureBlockDesc: {
      fontSize: '13px',
      margin: '0 0 8px 0',
      color: '#333',
    },

    featureTag: {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '11px',
      color: '#666',
      marginTop: '12px',
      gap: '4px',
    },
  };

  // Fix the circular reference in styles
  styles.featureDecentralized = {
    ...styles.designCard,
    top: '50px',
    left: '590px',
    width: '180px',
  };

  styles.featureFlexible = {
    ...styles.designCard,
    top: '330px',
    left: '890px',
    width: '180px',
  };

  styles.featureDeadman = {
    ...styles.designCard,
    top: '330px',
    left: '290px',
    width: '180px',
  };

  return (
    <>
      <style>
        {`
          @keyframes waveFlow {
            0% { stroke-dashoffset: 600; }
            100% { stroke-dashoffset: 0; }
          }
          .canary-guide-tag::before {
            content: "○";
            font-size: 8px;
            margin-right: 4px;
          }
        `}
      </style>
      
      <div style={styles.designBoard}>
        {/* SVG for connection lines */}
        <svg style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}>
          {/* Perfect circular line */}
          <circle
            cx="680"
            cy="400"
            r="300"
            style={{
              stroke: 'rgba(0, 0, 0, 0.15)',
              strokeWidth: '1.5',
              fill: 'none'
            }}
          />
          
          {/* Connection points on the perfect circular line */}
          <circle cx="380" cy="400" r="3" fill="rgba(0, 0, 0, 0.4)" />
          <circle cx="680" cy="100" r="3" fill="rgba(0, 0, 0, 0.4)" />
          <circle cx="980" cy="400" r="3" fill="rgba(0, 0, 0, 0.4)" />
        </svg>


        
        {/* Step blocks in a horizontal row at bottom */}
        <div style={styles.stepBlocks}>
          {/* Step 1: Upload */}
          <div style={styles.stepBlock}>
            <h3 style={styles.stepBlockH3}>Upload</h3>
            <p style={styles.stepBlockP}>Upload your sensitive information.</p>
            <div style={styles.tag} className="canary-guide-tag">Step 1</div>
          </div>

          {/* Step 2: Secure */}
          <div style={styles.stepBlock}>
            <h3 style={styles.stepBlockH3}>Secure</h3>
            <p style={styles.stepBlockP}>Secure it privately.</p>
            <div style={styles.tag} className="canary-guide-tag">Step 2</div>
          </div>

          {/* Step 3: Set Conditions */}
          <div style={styles.stepBlock}>
            <h3 style={styles.stepBlockH3}>Set Conditions</h3>
            <p style={styles.stepBlockP}>Set the conditions for automatic release.</p>
            <div style={styles.tag} className="canary-guide-tag">Step 3</div>
          </div>
        </div>

        {/* Decentralized - positioned at top of circle */}
        <div style={styles.featureDecentralized}>
          <p style={styles.featureBlockTitle}>🛡️ Decentralized</p>
          <p style={styles.featureBlockDesc}>Your data is protected and out of reach from central authorities.</p>
          <div style={styles.featureTag} className="canary-guide-tag">Reference</div>
        </div>

        {/* Flexible Disclosure - positioned at right side of circle */}
        <div style={styles.featureFlexible}>
          <p style={styles.featureBlockTitle}>Flexible Disclosure</p>
          <p style={styles.featureBlockDesc}>Choose: notify trusted parties or go fully public.</p>
          <div style={styles.featureTag} className="canary-guide-tag">Reference</div>
        </div>

        {/* Dead Man's Switch - positioned at left side of circle */}
        <div style={styles.featureDeadman}>
          <p style={styles.featureBlockTitle}>Dead Man's Switch</p>
          <p style={styles.featureBlockDesc}>Set a timer. If you don't check in, your encrypted message is released.</p>
          <div style={styles.featureTag} className="canary-guide-tag">Reference</div>
        </div>

        {/* Right sidebar content */}
        <div style={styles.sidebar}>
          <h2 style={styles.sidebarH2}>What is Canary?</h2>
          <p style={styles.tagline}>A safe that opens itself—if you can't.</p>
          <p style={styles.sidebarP}>
            Canary is a trusted, secure space for journalists, activists, and everyday citizens to automatically release critical information if they're unable to speak for themselves.
          </p>
          
          <div style={styles.section}>
            <p style={styles.sectionP}>
              Think of it like a secure vault for your most critical stories, truths, or instructions. If you can't personally unlock it—if you're detained, missing, or unable—it shares access to a predetermined party automatically.
            </p>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionH3}>Privacy Impact</h3>
            <p style={styles.sectionP}>
              Removes centralized risk. Automates secure data disclosure while keeping you safe.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CanaryGuideStandalone; 