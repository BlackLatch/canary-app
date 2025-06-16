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
      borderRadius: '5px',
      padding: '18px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      fontSize: '15px',
      lineHeight: '1.4',
      color: '#333',
      maxWidth: '322px',
      zIndex: 3,
    },

    // Sidebar styles
    sidebar: {
      position: 'absolute',
      top: '69px',
      right: '69px',
      width: '368px',
      background: 'rgba(245, 245, 245, 0.95)',
      padding: '28px',
      borderRadius: '5px',
      zIndex: 10,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },

    sidebarH2: {
      fontSize: '28px',
      fontWeight: '600',
      margin: '0 0 18px 0',
      color: '#000',
    },

    sidebarP: {
      fontSize: '18px',
      lineHeight: '1.5',
      margin: '0 0 18px 0',
      color: '#333',
    },

    tagline: {
      fontSize: '18px',
      lineHeight: '1.5',
      margin: '0 0 18px 0',
      color: '#000',
      fontWeight: '600',
    },

    section: {
      marginBottom: '28px',
    },

    sectionH3: {
      fontSize: '16px',
      fontWeight: '600',
      margin: '0 0 14px 0',
      color: '#000',
    },

    sectionP: {
      fontSize: '15px',
      color: '#666',
      margin: '0 0 9px 0',
    },



    // Step blocks container
    stepBlocks: {
      position: 'absolute',
      top: '748px',
      left: '40%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: '138px',
      alignItems: 'center',
      zIndex: 10,
    },

    stepBlock: {
      width: '253px',
      height: '161px',
      position: 'relative',
      background: '#ffffff',
      borderRadius: '5px',
      padding: '18px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      fontSize: '15px',
      lineHeight: '1.4',
      color: '#333',
      zIndex: 3,
    },

    stepBlockH3: {
      fontSize: '18px',
      fontWeight: '600',
      margin: '0 0 9px 0',
      color: '#000',
    },

    stepBlockP: {
      margin: '0',
      color: '#555',
    },

    tag: {
      position: 'absolute',
      bottom: '14px',
      left: '14px',
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '13px',
      color: '#666',
      gap: '5px',
    },

    // Feature blocks positioning
    featureDecentralized: {
      ...this?.designCard,
      top: '58px',
      left: '679px',
      width: '207px',
    },

    featureFlexible: {
      ...this?.designCard,
      top: '380px',
      left: '1024px',
      width: '207px',
    },

    featureDeadman: {
      ...this?.designCard,
      top: '380px',
      left: '334px',
      width: '207px',
    },

    featureBlockTitle: {
      fontSize: '16px',
      fontWeight: '600',
      margin: '0 0 9px 0',
      color: '#000',
    },

    featureBlockDesc: {
      fontSize: '15px',
      margin: '0 0 9px 0',
      color: '#333',
    },

    featureTag: {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '13px',
      color: '#666',
      marginTop: '14px',
      gap: '5px',
    },
  };

  // Fix the circular reference in styles
  styles.featureDecentralized = {
    ...styles.designCard,
    top: '58px',
    left: '679px',
    width: '207px',
  };

  styles.featureFlexible = {
    ...styles.designCard,
    top: '380px',
    left: '1024px',
    width: '207px',
  };

  styles.featureDeadman = {
    ...styles.designCard,
    top: '380px',
    left: '334px',
    width: '207px',
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
            cx="782"
            cy="460"
            r="345"
            style={{
              stroke: 'rgba(255, 255, 255, 0.3)',
              strokeWidth: '1.7',
              fill: 'none'
            }}
          />
          
          {/* Connection points on the perfect circular line */}
          <circle cx="437" cy="460" r="3.5" fill="rgba(255, 255, 255, 0.6)" />
          <circle cx="782" cy="115" r="3.5" fill="rgba(255, 255, 255, 0.6)" />
          <circle cx="1127" cy="460" r="3.5" fill="rgba(255, 255, 255, 0.6)" />
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