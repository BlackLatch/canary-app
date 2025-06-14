'use client';

import { useState, useEffect } from 'react';

const STORY_SEQUENCES = [
  "You're here because...",
  "You're entering a risky situation as a journalist.",
  "You're an activist facing potential capture.",
  "You want to secure critical information.",
  "You need truth to survive, even when you can't."
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
  onComplete: (userChoices: Record<string, string>) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentPhase, setCurrentPhase] = useState('story'); // story, conversation, account
  const [storyIndex, setStoryIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [conversationStep, setConversationStep] = useState(0);
  const [userChoices, setUserChoices] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Array<{type: string, text: string}>>([]);

  // Story sequence effect with auto-advance fallback
  useEffect(() => {
    if (currentPhase === 'story') {
      const timer = setTimeout(() => {
        handleNextStorySlide();
      }, storyIndex === 0 ? 5000 : 6000); // Longer timeout to allow for clicking

      return () => clearTimeout(timer);
    }
  }, [currentPhase, storyIndex]);

  const handleNextStorySlide = () => {
    if (storyIndex < STORY_SEQUENCES.length - 1) {
      setIsVisible(false);
      setTimeout(() => {
        setStoryIndex(storyIndex + 1);
        setIsVisible(true);
      }, 800);
    } else {
      // Transition to conversation
      setTimeout(() => {
        setCurrentPhase('conversation');
        setMessages([
          { type: 'system', text: "I'm here to help you protect what matters most. Let's set up your Canary together." }
        ]);
        setTimeout(() => {
          setMessages(prev => [...prev, 
            { type: 'system', text: CONVERSATION_FLOW[0].question }
          ]);
        }, 1000);
      }, 2000);
    }
  };

  const handleStoryClick = () => {
    if (currentPhase === 'story' && isVisible) {
      handleNextStorySlide();
    }
  };

  const handleOptionSelect = (option: string) => {
    const currentQuestion = CONVERSATION_FLOW[conversationStep];
    const newChoices = { ...userChoices, [currentQuestion.id]: option };
    setUserChoices(newChoices);

    // Add user response to messages
    setMessages(prev => [...prev, { type: 'user', text: option }]);

    // Move to next question or finish
    if (conversationStep < CONVERSATION_FLOW.length - 1) {
      setTimeout(() => {
        setConversationStep(conversationStep + 1);
        setMessages(prev => [...prev, 
          { type: 'system', text: CONVERSATION_FLOW[conversationStep + 1].question }
        ]);
      }, 1000);
    } else {
      // Complete onboarding
      setTimeout(() => {
        onComplete(newChoices);
      }, 1000);
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
        onClick={handleStoryClick}
      >
        <div className="max-w-4xl w-full">
          {/* Canary wordmark */}
          <div className="absolute top-4 left-4 md:top-8 md:left-8 opacity-100 transition-opacity duration-500">
            <h1 className="editorial-header text-base md:text-lg tracking-[0.2em]">CANARY</h1>
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
              Skip to app
            </button>
          </div>

          {/* Story text */}
          <div className="text-center px-4">
            <h2 
              className={`editorial-header text-3xl md:text-5xl lg:text-6xl xl:text-7xl leading-tight transition-all duration-800 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              {STORY_SEQUENCES[storyIndex]}
            </h2>
            <div className="mt-6 md:mt-8 w-24 md:w-32 h-0.5 bg-gradient-to-r from-transparent via-slate-400 to-transparent mx-auto"></div>
            
            {/* Click indicator */}
            <div className="mt-8 md:mt-12">
              <p className="editorial-body text-sm text-gray-500 opacity-75">
                Click anywhere to continue or wait to auto-advance
              </p>
              <div className="flex justify-center mt-2">
                <div className="flex space-x-2">
                  {STORY_SEQUENCES.map((_, index) => (
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
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === 'conversation') {
    const currentQuestion = CONVERSATION_FLOW[conversationStep];
    
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Canary wordmark */}
          <div className="text-center mb-8 md:mb-12 opacity-100 transition-opacity duration-500">
            <h1 className="editorial-header text-xl md:text-2xl tracking-[0.2em]">CANARY</h1>
          </div>

          {/* Skip button */}
          <div className="absolute top-4 right-4 md:top-8 md:right-8">
            <button
              onClick={handleSkip}
              className="editorial-body text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Skip to app
            </button>
          </div>

          {/* Newspaper-style interview layout */}
          <div className="max-w-3xl mx-auto">
            <div className="editorial-card bg-white p-6 md:p-8">
              <h2 className="editorial-header text-2xl md:text-3xl mb-6 border-b-2 border-gray-200 pb-4">
                Security Assessment Interview
              </h2>
              
              {/* Conversation flow */}
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <div key={index} className="opacity-100 transition-opacity duration-500">
                    {message.type === 'system' ? (
                      <div className="border-l-4 border-slate-600 pl-4">
                        <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                          CANARY SECURITY ADVISOR
                        </div>
                        <p className="editorial-body text-base md:text-lg font-medium text-slate-800">
                          {message.text}
                        </p>
                      </div>
                    ) : (
                      <div className="ml-8 border-l-2 border-gray-300 pl-4">
                        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                          YOUR RESPONSE
                        </div>
                        <p className="editorial-body text-base font-semibold text-gray-700">
                          "{message.text}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Current question options */}
                {currentQuestion && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-4">
                      SELECT YOUR RESPONSE:
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentQuestion.options.map((option, index) => (
                        <button
                          key={index}
                          className="editorial-button text-left py-3 px-4 text-sm md:text-base border border-gray-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 bg-white"
                          onClick={() => handleOptionSelect(option)}
                        >
                          <span className="font-medium">"{option}"</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentPhase === 'account') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-8">
        <div className="max-w-2xl w-full text-center opacity-100 transition-opacity duration-500">
          {/* Canary wordmark */}
          <h1 className="editorial-header text-xl md:text-2xl tracking-[0.2em] mb-8 md:mb-12">CANARY</h1>

          {/* Skip button */}
          <div className="absolute top-4 right-4 md:top-8 md:right-8">
            <button
              onClick={handleSkip}
              className="editorial-body text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Skip to app
            </button>
          </div>

          {/* Setup summary */}
          <div className="editorial-card mb-6 md:mb-8">
            <h3 className="editorial-subheader mb-3 md:mb-4">Your Canary Setup:</h3>
            <p className="editorial-body text-sm md:text-base text-gray-600 leading-relaxed">
              {Object.entries(userChoices).map(([key, value]) => value).join(' • ')}
            </p>
          </div>

          {/* Account creation */}
          <h2 className="editorial-header text-3xl md:text-4xl lg:text-5xl mb-6 md:mb-8 leading-tight">
            Create your Canary account
          </h2>

          <div className="space-y-3 md:space-y-4 max-w-md mx-auto">
            <button
              className="editorial-button w-full py-3 md:py-4 text-base md:text-lg bg-slate-700 hover:bg-slate-800 text-white font-medium transition-all duration-200 hover:scale-105 transform"
              onClick={() => handleAccountCreation('Web3 Wallet')}
            >
              Connect Web3 Wallet
            </button>
            
            <button
              className="editorial-button w-full py-3 md:py-4 text-base md:text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105 transform bg-white"
              onClick={() => handleAccountCreation('Email')}
            >
              Create with Email
            </button>
          </div>

          <p className="editorial-body text-gray-600 mt-6 md:mt-8 text-sm md:text-base">
            Your truth protection starts now.
          </p>
        </div>
      </div>
    );
  }

  return null;
} 