import { useState, useRef, useEffect } from 'react'
import type { Translations } from '../i18n'
import type { Category } from '../types'

const OPENROUTER_KEY = (import.meta as any).env?.VITE_OPENROUTER_KEY ?? ''
const MODEL = 'poolside/laguna-m.1:free'
const API_URL = '/api/openrouter/api/v1/chat/completions'

const CATALOG_CATS: Record<Category, string> = {
  cpu: 'processors', gpu: 'videocards', motherboard: 'motherboards',
  ram: 'memory', psu: 'psu', storage: 'ssd',
}

export interface AiSuggestion {
  category: Category
  opendb_id: string
  name: string
  url: string
  price_uah: number | null
  image_url: string
  reasoning?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string | null
  reasoning_details?: any[]
}

interface DisplayMessage {
  role: 'user' | 'assistant'
  text: string
  reasoning?: string
  suggestions?: AiSuggestion[]
  streaming?: boolean
}

interface Props {
  tr: Translations
  onApplySuggestions: (suggestions: AiSuggestion[]) => void
  currentBuild: Record<string, { part: { name: string }; category: Category }>
}

async function fetchCatalogCategory(cat: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/catalog/${cat}?in_stock=true`)
    if (!res.ok) return []
    const data = await res.json()
    return data.products ?? []
  } catch { return [] }
}

// Rough budget split per component category (% of total budget)
const BUDGET_SPLIT: Record<Category, number> = {
  gpu: 0.38, cpu: 0.20, motherboard: 0.12, ram: 0.10, psu: 0.08, storage: 0.08,
}
// For office/no-gpu builds
const BUDGET_SPLIT_OFFICE: Record<Category, number> = {
  cpu: 0.30, motherboard: 0.18, ram: 0.16, storage: 0.14, psu: 0.12, gpu: 0.00,
}

function extractBudget(text: string): number | null {
  const m = text.match(/(\d[\d\s]*)[кК]?(₴|грн|000)?/)
  if (!m) return null
  const raw = m[1].replace(/\s/g, '')
  let n = parseInt(raw)
  if (text.toLowerCase().includes('к') || (n < 1000 && text.includes('000'))) n *= 1000
  if (n < 5000 || n > 500000) return null
  return n
}

async function buildCatalogContext(userMsg = ''): Promise<{ text: string; products: Record<string, any[]> }> {
  const budget = extractBudget(userMsg)
  const isOffice = /офіс|робот|word|excel|browse|навч/i.test(userMsg)
  const split = isOffice ? BUDGET_SPLIT_OFFICE : BUDGET_SPLIT
  const summaries: string[] = []
  const products: Record<string, any[]> = {}

  await Promise.all(Object.entries(CATALOG_CATS).map(async ([cat, catName]) => {
    const list = await fetchCatalogCategory(catName)
    products[catName] = list
    if (!list.length) return

    const withPrice = list.filter((p: any) => p.price_uah && p.price_uah > 0)

    // Filter by budget range if budget known: show items in 50%–200% of category target
    let filtered = withPrice
    if (budget) {
      const catBudget = budget * (split[cat as Category] ?? 0.15)
      const lo = catBudget * 0.4
      const hi = catBudget * 2.5
      const inRange = withPrice.filter((p: any) => p.price_uah >= lo && p.price_uah <= hi)
      filtered = inRange.length >= 3 ? inRange : withPrice
    }

    // Sort by rating*reviews score (balanced quality signal), take top 20
    const scored = filtered
      .map((p: any) => ({ ...p, _score: (p.rating ?? 0) * Math.log1p(p.reviews_count ?? 0) }))
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 20)

    const lines = scored.map((p: any) => {
      const slug = p.url?.split('/').filter(Boolean).slice(-2, -1)[0] ?? ''
      return `  [${slug}] ${p.name} | ${p.price_uah}₴ | ⭐${p.rating ?? '?'}(${p.reviews_count ?? 0})`
    })
    summaries.push(`### ${cat}\n${lines.join('\n')}`)
  }))

  return { text: summaries.join('\n\n'), products }
}

function parseSuggestions(text: string, products: Record<string, any[]>): AiSuggestion[] {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (!jsonMatch) return []
  try {
    const items: { category: Category; id: string; reasoning?: string }[] = JSON.parse(jsonMatch[1])
    const result: AiSuggestion[] = []
    for (const item of items) {
      const catName = CATALOG_CATS[item.category]
      if (!catName) continue
      const list = products[catName] ?? []
      const prod = list.find((p: any) =>
        p.url?.includes(`/${item.id}/`) || p.url?.includes(item.id)
      )
      if (prod) {
        result.push({
          category: item.category,
          opendb_id: prod.url?.split('/').filter(Boolean).pop()?.replace(/^p/, '') ?? item.id,
          name: prod.name,
          url: prod.url,
          price_uah: prod.price_uah ?? null,
          image_url: prod.image_url ?? '',
          reasoning: item.reasoning,
        })
      }
    }
    return result
  } catch { return [] }
}

const SYSTEM_PROMPT = `Ти — експерт з підбору ПК комплектуючих. Відповідай коротко і одразу.

ПРАВИЛА:
- Використовуй ТІЛЬКИ товари з каталогу. Slug — частина в дужках [slug].
- Перевіряй сумісність: сокет CPU = MB; тип RAM підтримується MB.
- Вкладайся в бюджет користувача.
- Відповідай українською.

ФОРМАТ (суворо дотримуйся):
Одне речення — коротке пояснення.

\`\`\`json
[
  {"category":"cpu","id":"slug","reasoning":"1 речення"},
  {"category":"motherboard","id":"slug","reasoning":"1 речення"},
  {"category":"ram","id":"slug","reasoning":"1 речення"},
  {"category":"gpu","id":"slug","reasoning":"1 речення"},
  {"category":"psu","id":"slug","reasoning":"1 речення"},
  {"category":"storage","id":"slug","reasoning":"1 речення"}
]
\`\`\`

Категорії: cpu, gpu, motherboard, ram, psu, storage
НЕ пиши нічого після JSON блоку.`

const QUICK_PROMPTS = [
  'Офісний ПК до 30 000₴',
  'Ігровий ПК до 60 000₴',
  'Потужна система до 100 000₴',
]

export default function AiBuilder({ tr, onApplySuggestions, currentBuild }: Props) {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([])
  const [history, setHistory] = useState<Message[]>([]) // real API history
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [catalogCtx, setCatalogCtx] = useState<{ text: string; products: Record<string, any[]> } | null>(null)
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready'>('idle')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayMessages])

  async function ensureCatalog(userMsg = '') {
    if (catalogCtx) return catalogCtx
    setCatalogStatus('loading')
    const ctx = await buildCatalogContext(userMsg)
    setCatalogCtx(ctx)
    setCatalogStatus('ready')
    return ctx
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userText = input.trim()
    setInput('')

    const userDisplay: DisplayMessage = { role: 'user', text: userText }
    setDisplayMessages(prev => [...prev, userDisplay])
    setLoading(true)

    // Add streaming placeholder
    setDisplayMessages(prev => [...prev, { role: 'assistant', text: '', streaming: true }])

    try {
      const ctx = await ensureCatalog(userText)

      const buildDesc = Object.entries(currentBuild)
        .map(([slot, e]) => `${slot}: ${e.part.name}`).join(', ')
      const buildCtx = buildDesc ? `\nПоточна збірка: ${buildDesc}` : ''

      const systemContent = `${SYSTEM_PROMPT}\n\nАКТУАЛЬНИЙ КАТАЛОГ ROZETKA:\n${ctx.text}${buildCtx}`

      // Build messages array: system + history + new user message
      const newUserMsg: Message = { role: 'user', content: userText }
      const messages = [
        { role: 'system', content: systemContent },
        ...history,
        newUserMsg,
      ]

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 120_000)

      // Show thinking indicator while waiting
      let dotCount = 0
      const thinkingInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4
        const dots = '.'.repeat(dotCount + 1)
        setDisplayMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.streaming) {
            updated[updated.length - 1] = { ...last, text: `Думаю${dots}` }
          }
          return updated
        })
      }, 600)

      let fullContent = ''
      let fullReasoning = ''

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'PARTLIST PC Builder',
          },
          body: JSON.stringify({
            model: MODEL,
            messages,
            stream: false,
            reasoning: { enabled: true },
            temperature: 0.3,
            max_tokens: 2048,
          })
        })
        clearTimeout(timeout)

        if (!res.ok) {
          const err = await res.text()
          throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`)
        }

        const data = await res.json()
        const msg = data.choices?.[0]?.message
        fullContent = msg?.content ?? ''
        // reasoning_details can be array of {type, thinking} objects
        const rd = msg?.reasoning_details ?? msg?.reasoning ?? []
        if (Array.isArray(rd)) {
          fullReasoning = rd.map((r: any) => r.thinking ?? r.text ?? '').join('\n')
        } else if (typeof rd === 'string') {
          fullReasoning = rd
        }

      } finally {
        clearInterval(thinkingInterval)
        clearTimeout(timeout)
      }

      const suggestions = parseSuggestions(fullContent, ctx.products)

      setDisplayMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          text: fullContent || 'Немає відповіді — спробуйте ще раз.',
          reasoning: fullReasoning || undefined,
          suggestions,
          streaming: false,
        }
        return updated
      })

      // Update history for multi-turn
      const assistantMsg: Message = {
        role: 'assistant',
        content: fullContent,
        ...(fullReasoning ? { reasoning_details: [{ type: 'thinking', thinking: fullReasoning }] } : {}),
      }
      setHistory(prev => [...prev, newUserMsg, assistantMsg])

    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError'
      const errText = isAbort
        ? 'Час очікування вичерпано. Модель довго думала але не відповіла — спробуйте ще раз.'
        : `${tr.aiError}: ${e instanceof Error ? e.message : String(e)}`
      setDisplayMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', text: errText, streaming: false }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function clearChat() {
    setDisplayMessages([])
    setHistory([])
  }

  function renderText(text: string) {
    // Remove JSON block from visible text
    return text.replace(/```json[\s\S]*?```/g, '').trim()
  }

  function handleApply(suggestions: AiSuggestion[]) {
    onApplySuggestions(suggestions)
  }

  return (
    <div className="ai-builder">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span className="ai-title-text">{tr.aiTitle}</span>
          {catalogStatus === 'loading' && <span className="ai-catalog-badge">завантажую каталог…</span>}
          {catalogStatus === 'ready'   && <span className="ai-catalog-badge ready">✓ каталог готовий</span>}
        </div>
        {displayMessages.length > 0 && (
          <button className="ai-clear-btn" onClick={clearChat}>{tr.aiClear}</button>
        )}
      </div>

      {/* Messages */}
      <div className="ai-messages">
        {displayMessages.length === 0 && (
          <div className="ai-empty">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".25">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <p>Опишіть вимоги до збірки — AI підбере оптимальні комплектуючі з каталогу Rozetka</p>
            <div className="ai-suggestions-quick">
              {QUICK_PROMPTS.map(q => (
                <button key={q} className="ai-quick-btn"
                  onClick={() => { setInput(q); inputRef.current?.focus() }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {displayMessages.map((msg, i) => (
          <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ai-msg-avatar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                </svg>
              </div>
            )}
            <div className="ai-msg-body">
              {/* Reasoning block */}
              {msg.reasoning && (
                <details className="ai-reasoning">
                  <summary>Міркування моделі</summary>
                  <div className="ai-reasoning-text">{msg.reasoning}</div>
                </details>
              )}

              {/* Main text */}
              {(renderText(msg.text) || msg.streaming) && (
                <div className="ai-msg-text">
                  {renderText(msg.text)}
                  {msg.streaming && <span className="ai-cursor">▊</span>}
                </div>
              )}

              {/* Suggestion cards */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="ai-suggestions">
                  <div className="ai-suggestions-grid">
                    {msg.suggestions.map((s, si) => (
                      <div key={si} className="ai-suggestion-card">
                        {s.image_url && (
                          <img src={s.image_url} alt="" className="ai-suggestion-img" />
                        )}
                        <div className="ai-suggestion-info">
                          <span className="ai-suggestion-cat">{s.category.toUpperCase()}</span>
                          <span className="ai-suggestion-name">{s.name}</span>
                          {s.price_uah && (
                            <span className="ai-suggestion-price">
                              {s.price_uah.toLocaleString('uk-UA')} ₴
                            </span>
                          )}
                          {s.reasoning && (
                            <span className="ai-suggestion-reason">{s.reasoning}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="ai-apply-btn" onClick={() => handleApply(msg.suggestions!)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    {tr.aiApply}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="ai-input-row">
        <textarea
          ref={inputRef}
          className="ai-input"
          placeholder={tr.aiPlaceholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={loading}
        />
        <button
          className="ai-send-btn"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          {loading
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ai-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          }
        </button>
      </div>
    </div>
  )
}