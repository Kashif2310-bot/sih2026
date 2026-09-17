import { useTranslation } from 'react-i18next'
import { Bot, User, WifiOff } from 'lucide-react'
import clsx from 'clsx'
import type { UIMessage } from '../../assistant/state/assistant-state'

export function ChatMessageBubble({ message }: { message: UIMessage }) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <span
        className={clsx(
          'grid h-8 w-8 shrink-0 place-items-center rounded-full',
          isUser ? 'bg-forest text-white' : 'bg-mist text-forest',
        )}
        aria-hidden
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={clsx('max-w-[85%] space-y-1.5', isUser && 'items-end')}>
        <div
          className={clsx(
            'whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser ? 'rounded-tr-sm bg-forest text-white' : 'rounded-tl-sm bg-white text-ink shadow-sm',
          )}
        >
          {message.text}
        </div>
        {!isUser && message.isFallback && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-[#8a6a00]">
            <WifiOff className="h-3 w-3" />
            {t('assistant.offlineBadge')}
          </span>
        )}
      </div>
    </div>
  )
}
