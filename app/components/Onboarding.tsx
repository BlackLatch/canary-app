'use client';

import { useState, useEffect } from 'react';

const STORY_SCROLL_PARTS = [
  "You're here because…",
  "You're a journalist who may not return.",
  "You're an activist preparing for a dangerous mission.",
  "You're holding a truth that needs to outlive you.",
  "Let's build your contingency plan."
];

const DOSSIER_INTRO = [
  "We're going to setup your first Dossier.",
  "The Dossier is where you set who can access your data, and under what circumstances."
];

const AUDIENCE_TYPES = [
  "journalist",
  "activist", 
  "whistleblower",
  "legal professional",
  "investigator"
];

const CONVERSATION_FLOW = [
  {
    id: 'situation',
    question: "Which situation best describes you?",
    options: ['Journalist', 'Activist', 'Whistleblower', 'Legal Professional', 'Other']
  },
  {
    id: 'risk',
    question: "How would you describe your current risk level?",
    options: ['Low risk', 'Moderate risk', 'High risk', 'Immediate danger']
  },
  {
    id: 'information',
    question: "What type of information do you need to protect?",
    options: ['Documents', 'Communications', 'Evidence', 'Research', 'Personal safety info']
  },
  {
    id: 'triggers',
    question: "How should Canary know if you're in trouble?",
    options: ['Manual check-ins', 'Location monitoring', 'Communication patterns', 'Social media activity']
  },
  {
    id: 'recipients',
    question: "Who should receive your information if needed?",
    options: ['Specific individuals', 'News organizations', 'Legal contacts', 'The public']
  },
  {
    id: 'timeline',
    question: "How often should you check in?",
    options: ['Daily', 'Weekly', 'Custom schedule']
  }
];

interface OnboardingProps {
  onComplete: (userChoices: Record<string, string[]>) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentPhase, setCurrentPhase] = useState('story'); // story, conversation, summary
  const [storyIndex, setStoryIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [conversationStep, setConversationStep] = useState(0);
  const [userChoices, setUserChoices] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<Array<{type: string, text: string}>>([]);
  const [currentAudienceIndex, setCurrentAudienceIndex] = useState(0);
  const [audienceWordVisible, setAudienceWordVisible] = useState(true);
  const [showDossierIntro, setShowDossierIntro] = useState(false);

  // Story sequence effect with auto-advance fallback
  useEffect(() => {
    if (currentPhase === 'story' && !showDossierIntro && storyIndex < STORY_SCROLL_PARTS.length - 1) {
      const timer = setTimeout(() => {
        handleNextStorySlide();
      }, 4000); // 4 second interval for all scroll slides
      return () => clearTimeout(timer);
    }
    if (currentPhase === 'story' && !showDossierIntro && storyIndex === STORY_SCROLL_PARTS.length - 1) {
      const timer = setTimeout(() => {
        setShowDossierIntro(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, storyIndex, showDossierIntro]);

  // Audience type animation effect for slide 1 (index 1)
  useEffect(() => {
    if (currentPhase === 'story' && storyIndex === 1) {
      const audienceTimer = setInterval(() => {
        setAudienceWordVisible(false);
        setTimeout(() => {
          setCurrentAudienceIndex((prev) => (prev + 1) % AUDIENCE_TYPES.length);
          setAudienceWordVisible(true);
        }, 300);
      }, 1500);

      return () => clearInterval(audienceTimer);
    }
  }, [currentPhase, storyIndex]);

  const handleNextStorySlide = () => {
    if (storyIndex < STORY_SCROLL_PARTS.length - 1) {
      setIsVisible(false);
      setTimeout(() => {
        setStoryIndex(storyIndex + 1);
        setIsVisible(true);
      }, 800);
    } else {
      setTimeout(() => {
        setShowDossierIntro(true);
      }, 800);
    }
  };

  const handleStoryClick = () => {
    if (currentPhase === 'story' && isVisible) {
      handleNextStorySlide();
    }
  };

  const handleOptionSelect = (option: string) => {
    const currentQuestion = CONVERSATION_FLOW[conversationStep];
    const currentSelections = userChoices[currentQuestion.id] || [];
    
    let newSelections: string[];
    if (currentSelections.includes(option)) {
      newSelections = currentSelections.filter(item => item !== option);
    } else {
      newSelections = [...currentSelections, option];
    }
    
    const newChoices = { ...userChoices, [currentQuestion.id]: newSelections };
    setUserChoices(newChoices);
  };

  const handleContinue = () => {
    if (conversationStep < CONVERSATION_FLOW.length - 1) {
      setConversationStep(conversationStep + 1);
    } else {
      setCurrentPhase('summary');
    }
  };

  const handleAccountCreation = (method: string) => {
    console.log('Account creation method:', method);
    console.log('User choices:', userChoices);
    onComplete(userChoices);
  };

  const handleSkip = () => {
    onComplete({});
  };

  if (currentPhase === 'story') {
    return (
      <div 
        className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8 cursor-pointer"
        onClick={() => {
          if (!showDossierIntro && isVisible) handleNextStorySlide();
        }}
      >
        <div className="max-w-4xl w-full">
          {/* Logo */}
          <div className="absolute top-4 left-4 md:top-8 md:left-8 opacity-100 transition-opacity duration-500">
            <img 
              src="/canary.png" 
              alt="Canary" 
              className="h-12 md:h-16 w-auto"
              style={{
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))'
              }}
            />
          </div>

          {/* Skip button */}
          <div className="absolute top-4 right-4 md:top-8 md:right-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSkip();
              }}
              className="editorial-body text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Skip intro →
            </button>
          </div>

          {/* Story text */}
          <div className="text-center px-4">
            {!showDossierIntro ? (
              <h2
                className={`editorial-header text-3xl md:text-5xl lg:text-6xl xl:text-7xl leading-tight transition-all duration-800 ${
                  isVisible ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {STORY_SCROLL_PARTS[storyIndex]}
              </h2>
            ) : (
              <div className="transition-all duration-800 flex flex-col items-center justify-center">
                <h2 className="editorial-header text-2xl md:text-4xl text-slate-800 mb-4 text-center">{DOSSIER_INTRO[0]}</h2>
                <p className="editorial-body text-base md:text-lg text-slate-600 mb-8 text-center">{DOSSIER_INTRO[1]}</p>
                <button
                  onClick={() => onComplete({})}
                  className="px-8 py-3 text-lg bg-slate-600 text-white hover:bg-slate-700 transition-all duration-200 rounded-lg"
                >
                  Create Your First Dossier
                </button>
              </div>
            )}
            <div className="mt-6 md:mt-8 w-24 md:w-32 h-0.5 bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto"></div>
            {/* Click indicator or Continue button */}
            {!showDossierIntro && (
              <div className="mt-8 md:mt-12">
                <p className="editorial-body text-sm text-gray-500 opacity-75">
                  Click anywhere to continue
                </p>
                <div className="flex justify-center mt-2">
                  <div className="flex space-x-2">
                    {STORY_SCROLL_PARTS.map((_, index) => (
                      <div
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          index === storyIndex ? 'bg-slate-600' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === 'conversation') {
    const currentQuestion = CONVERSATION_FLOW[conversationStep];
    const totalQuestions = CONVERSATION_FLOW.length;
    // Emoji map for options (customize as needed)
    const emojiMap: Record<string, string> = {
      Journalist: '📰',
      Activist: '✊',
      Researcher: '🔍',
      Whistleblower: '🔔',
      'Legal Professional': '⚖️',
      'Other': '❓',
      Documents: '📄',
      Communications: '💬',
      Evidence: '🧾',
      Research: '📚',
      'Personal safety info': '🛡️',
      'Manual check-ins': '✅',
      'Location monitoring': '📍',
      'Communication patterns': '📡',
      'Social media activity': '🌐',
      'Specific individuals': '👤',
      'News organizations': '🗞️',
      'Legal contacts': '⚖️',
      'The public': '🌍',
      Daily: '📅',
      Weekly: '🗓️',
      'Custom schedule': '⏰',
      'Low risk': '🟢',
      'Moderate risk': '🟡',
      'High risk': '🟠',
      'Immediate danger': '🔴',
    };
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col p-0 md:p-8">
        {/* Progress bar and status */}
        <div className="w-full flex flex-col items-center mt-6 mb-2">
          <div className="relative w-3/5 md:w-2/5 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-2 bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${((conversationStep + 1) / totalQuestions) * 100}%` }}
            />
          </div>
          <div className="text-center text-xs text-slate-500 font-medium mt-2 tracking-wide">
            {conversationStep + 1} / {totalQuestions}
          </div>
        </div>
        <div className="max-w-xl w-full mx-auto flex-1 flex flex-col justify-center">
          {/* Logo */}
          <div className="text-center mt-8 mb-4">
            <img 
              src="/canary.png" 
              alt="Canary" 
              className="h-12 md:h-14 w-auto mx-auto"
              style={{
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))'
              }}
            />
          </div>

          {/* Question card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-6 md:p-8 mb-8">
            <div className="text-center">
              <div className="text-xs text-slate-500 mb-2 tracking-wide">
                Question {conversationStep + 1} of {totalQuestions}
              </div>
              <div className="editorial-header text-2xl md:text-3xl font-bold text-slate-800 mb-2">
                {currentQuestion.question}
              </div>
              <div className="w-16 h-1 mx-auto bg-yellow-400 rounded-full mb-4" />
              <div className="inline-block bg-yellow-100 text-yellow-800 text-xs font-medium rounded px-3 py-1 mb-6">
                ✓ Multiple selections allowed
              </div>
            </div>
            {/* Multiple choice options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  className={`w-full flex items-center px-4 py-4 border-2 rounded-lg transition-all duration-200 text-left text-lg font-medium tracking-tight shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 mb-1
                    ${
                      (userChoices[currentQuestion.id] || []).includes(option)
                        ? 'border-yellow-400 bg-yellow-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-yellow-300'
                    }
                  `}
                  onClick={() => handleOptionSelect(option)}
                >
                  <span className="mr-3 text-xl">
                    {emojiMap[option] || ''}
                  </span>
                  <span className="flex-1">{option}</span>
                  <span className="ml-2">
                    <input
                      type="checkbox"
                      checked={(userChoices[currentQuestion.id] || []).includes(option)}
                      readOnly
                      className="form-checkbox w-5 h-5 text-yellow-400 border-slate-300 rounded focus:ring-yellow-400"
                    />
                  </span>
                </button>
              ))}
            </div>
            {/* Continue button */}
            <div className="flex justify-end mt-6">
              <button
                onClick={handleContinue}
                disabled={!userChoices[currentQuestion.id]?.length}
                className={`px-8 py-3 text-lg font-semibold rounded-lg transition-all duration-200 shadow-sm
                  ${
                    userChoices[currentQuestion.id]?.length
                      ? 'bg-yellow-400 text-slate-900 hover:bg-yellow-300'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                {conversationStep < CONVERSATION_FLOW.length - 1 ? 'Continue' : 'Review'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === 'summary') {
    // Map questions to display labels for a more human-friendly summary
    const summaryLabels: Record<string, string> = {
      situation: 'Situation',
      setup_type: 'Setup type',
      files: 'Files',
      risk: 'Risk',
      recipients: 'Recipients',
      timeline: 'Timeline',
      // Add more mappings as needed
    };
    // Prepare summary data as pairs for two-column layout
    const summaryPairs = [
      ['situation', 'setup_type'],
      ['files', 'risk'],
      ['recipients', 'timeline'],
    ];
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Logo */}
          <div className="text-center mb-6 md:mb-8">
            <img 
              src="/canary.png" 
              alt="Canary" 
              className="h-12 md:h-14 w-auto mx-auto"
              style={{
                filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))'
              }}
            />
          </div>

          {/* Summary card/table */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-6 mb-8">
              <div className="text-center text-base md:text-lg font-semibold text-slate-700 mb-4">Your first Dossier setup</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summaryPairs.map((pair, rowIdx) => (
                  <>
                    {pair.map((key, colIdx) => (
                      <div key={key} className="bg-slate-50 rounded-lg px-3 py-2 flex flex-col min-h-[60px]">
                        <span className="text-xs text-slate-400 mb-1 font-medium tracking-wide">
                          {summaryLabels[key] || key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-slate-700 break-words">
                          {(userChoices[key] && userChoices[key].length > 0)
                            ? userChoices[key].join(', ')
                            : <span className="text-slate-300">—</span>}
                        </span>
                      </div>
                    ))}
                  </>
                ))}
              </div>
            </div>
          </div>

          {/* Login options */}
          <div className="max-w-md mx-auto mt-8 md:mt-12">
            <div className="text-center text-2xl md:text-3xl font-semibold text-slate-800 mb-6">Login to encrypt your files</div>
            <button
              onClick={() => onComplete(userChoices)}
              className="w-full px-4 py-2.5 text-base bg-white border border-gray-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 rounded-lg flex items-center justify-center mb-3"
            >
              <span className="mr-2">✉️</span> Create with Email
            </button>
            <div className="text-center text-xs text-slate-400 mb-2">For advanced users:</div>
            <button
              onClick={() => onComplete(userChoices)}
              className="w-full px-4 py-2.5 text-base bg-yellow-400 text-slate-800 hover:bg-yellow-300 transition-all duration-200 rounded-lg flex items-center justify-center font-semibold"
            >
              <span className="mr-2">🔒</span> Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 