'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

const FAQ_ANSWERS: Record<string, string> = {
  'report': 'To generate a report, go to any job detail page and click "Generate PDF Report". RiskMate will create a professional, branded PDF with all hazards, mitigations, photos, and compliance information in about 30 seconds.',
  'risk score': 'Risk scores are calculated automatically based on the hazards you identify. Each hazard has a weight (e.g., height work = 15 points, live electrical = 20 points). The score ranges from 0-100, with higher scores indicating higher risk. RiskMate also generates a mitigation checklist based on your risk factors.',
  'seats': 'Starter plan includes 1 seat, Pro plan includes 5 seats, and Business plan includes unlimited seats. Each seat is a team member who can access your organization\'s jobs and documentation.',
  'tax': 'In most jurisdictions, business software and tools used for operational purposes, including safety and compliance, are tax-deductible. RiskMate is a business expense that can typically be deducted. Please consult with your accountant for specific advice regarding your business.',
  'pricing': 'RiskMate has three plans: Starter ($29/mo, 3 jobs/month, 1 seat), Pro ($59/mo, unlimited jobs, 5 seats), and Business ($129/mo, unlimited jobs, unlimited seats, plus Permit Pack Generator and advanced features).',
  'trial': 'Yes! You can start with a free trial. The Starter plan includes 3 jobs per month, so you can test RiskMate with real jobs before committing to a paid plan.',
  'mobile': 'Mobile apps for iOS and Android are currently in development (Q1 2025). The web version works great on mobile browsers, and we\'re building native apps with offline mode and GPS metadata.',
  'support': 'Pro plan includes priority email support, and Business plan includes dedicated onboarding and phone support. Starter plan users can access our help center and community forums.',
}

const SUGGESTED_QUESTIONS = [
  'How do I generate a report?',
  'How does the risk score work?',
  'How many seats do I get?',
  'Is this tax deductible?',
]

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hi! I\'m here to help. Ask me anything about RiskMate, or choose a question below.',
      sender: 'bot',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const findAnswer = (question: string): string => {
    const lowerQuestion = question.toLowerCase()
    
    if (lowerQuestion.includes('report') || lowerQuestion.includes('pdf') || lowerQuestion.includes('generate')) {
      return FAQ_ANSWERS['report']
    }
    if (lowerQuestion.includes('risk') || lowerQuestion.includes('score')) {
      return FAQ_ANSWERS['risk score']
    }
    if (lowerQuestion.includes('seat') || lowerQuestion.includes('team') || lowerQuestion.includes('user')) {
      return FAQ_ANSWERS['seats']
    }
    if (lowerQuestion.includes('tax') || lowerQuestion.includes('deductible') || lowerQuestion.includes('cra')) {
      return FAQ_ANSWERS['tax']
    }
    if (lowerQuestion.includes('price') || lowerQuestion.includes('cost') || lowerQuestion.includes('plan')) {
      return FAQ_ANSWERS['pricing']
    }
    if (lowerQuestion.includes('trial') || lowerQuestion.includes('free')) {
      return FAQ_ANSWERS['trial']
    }
    if (lowerQuestion.includes('mobile') || lowerQuestion.includes('app') || lowerQuestion.includes('phone')) {
      return FAQ_ANSWERS['mobile']
    }
    if (lowerQuestion.includes('support') || lowerQuestion.includes('help')) {
      return FAQ_ANSWERS['support']
    }

    return "I'm not sure about that specific question. For detailed help, please email us at support@riskmate.com or check out our help center. You can also try asking about: generating reports, risk scores, team seats, pricing, or tax deductions."
  }

  const handleSend = (question?: string) => {
    const questionText = question || input.trim()
    if (!questionText) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: questionText,
      sender: 'user',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Simulate bot thinking
    setTimeout(() => {
      const answer = findAnswer(questionText)
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: answer,
        sender: 'bot',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMessage])
    }, 500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[#F97316] hover:bg-[#FB923C] text-white rounded-full shadow-lg flex items-center justify-center z-50 transition-colors"
          aria-label="Open chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-96 h-[600px] bg-[#121212] border border-white/10 rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-[#F97316] flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-black">RiskMate Support</h3>
                <p className="text-xs text-black/70">We&apos;re here to help</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-black hover:text-black/70 transition-colors"
                aria-label="Close chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-[#F97316] text-black'
                        : 'bg-white/5 text-white border border-white/10'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions */}
            {messages.length === 1 && (
              <div className="px-4 pb-2 space-y-2">
                <p className="text-xs text-white/60 mb-2">Quick questions:</p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="w-full text-left px-3 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-white/80"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your question..."
                  className="flex-1 px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316] text-sm"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2 text-center">
                Need more help? Email support@riskmate.com
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

